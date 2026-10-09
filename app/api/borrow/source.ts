import { CHAINS, apyToApr, family, isStable, number, scale, type BorrowCatalog, type BorrowMarket, type Chain } from "../../borrow/model";
import { blockNumber, rpcBatch, type RpcCall } from "./rpc";

type RecordValue = Record<string, unknown>;
export function value(raw: unknown, ...path: string[]): unknown {
  let result = raw;
  for (const key of path) result = result && typeof result === "object" ? (result as RecordValue)[key] : undefined;
  return result;
}
const str = (raw: unknown) => typeof raw === "string" ? raw : "";
function records(raw: unknown): RecordValue[] {
  if (!Array.isArray(raw) || raw.some(item => !item || typeof item !== "object")) throw new Error("Invalid catalogue");
  return raw;
}
async function json(url: string, fetcher: typeof fetch, body?: unknown): Promise<unknown> {
  const response = await fetcher(url, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(18_000) });
  if (!response.ok) throw new Error("Provider unavailable");
  return response.json();
}
async function graphql(url: string, query: string, variables: unknown, fetcher: typeof fetch): Promise<unknown> {
  const payload = await json(url, fetcher, { query, variables });
  if (value(payload, "errors") || !value(payload, "data")) throw new Error("Invalid GraphQL response");
  return value(payload, "data");
}
function market(protocol: string, chain: Chain, id: string, collateral: string, debt: string): BorrowMarket | null {
  if (!id || !family(collateral) || !isStable(debt)) return null;
  return { id: `${protocol}:${chain}:${id}`, protocol, chain, name: `${collateral} / ${debt}`, collateral, debt, collateralAddress: "", debtAddress: "", apr: null, ltv: null, liquidationThreshold: null, liquidityUsd: null, collateralPrice: null, debtPrice: null, collateralCapacityUsd: null, minimumDebtUsd: null, quotedDebtUsd: null, borrowFee: null, url: "", notes: [] };
}
export function normalizeMorpho(raw: unknown, chain: Chain): BorrowMarket | null {
  const id = str(value(raw, "marketId"));
  const row = market("Morpho", chain, id, str(value(raw, "collateralAsset", "symbol")), str(value(raw, "loanAsset", "symbol")));
  if (!row || !/^0x[0-9a-f]{64}$/i.test(id)) return null;
  return { ...row, collateralAddress: str(value(raw, "collateralAsset", "address")), debtAddress: str(value(raw, "loanAsset", "address")), apr: apyToApr(value(raw, "state", "borrowApy")), ltv: scale(value(raw, "lltv"), 1e16), liquidationThreshold: scale(value(raw, "lltv"), 1e16), liquidityUsd: number(value(raw, "state", "liquidityAssetsUsd")), collateralPrice: number(value(raw, "collateralAsset", "price", "usd")), debtPrice: number(value(raw, "loanAsset", "price", "usd")), url: `https://app.morpho.org/${chain.toLowerCase()}/market/${id}`, notes: ["Listed markets only. LLTV is the liquidation boundary; open below this limit. Rewards excluded."] };
}
async function morpho(chain: Chain, fetcher: typeof fetch): Promise<BorrowMarket[]> {
  const query = `query BorrowMarkets($chain: Int!, $skip: Int!) { markets(first: 500, skip: $skip, where: {chainId_in: [$chain], listed: true}) { pageInfo {countTotal count} items {marketId lltv loanAsset {symbol address price {usd}} collateralAsset {symbol address price {usd}} state {borrowApy liquidityAssetsUsd}} } }`;
  const rows: BorrowMarket[] = [];
  for (let skip = 0; skip < 10_000; skip += 500) {
    const data = await graphql("https://api.morpho.org/graphql", query, { chain: CHAINS[chain], skip }, fetcher);
    const items = records(value(data, "markets", "items"));
    rows.push(...items.map(item => normalizeMorpho(item, chain)).filter(row => row !== null));
    const total = number(value(data, "markets", "pageInfo", "countTotal"));
    if (total === null || (!items.length && skip < total)) throw new Error("Invalid pagination");
    if (skip + items.length >= total) return rows;
  }
  throw new Error("Incomplete pagination");
}

export function normalizeFluid(raw: unknown, chain: Chain, solana = false): BorrowMarket | null {
  const supply = solana ? value(raw, "supplyToken") : value(raw, "supplyToken", "token0");
  const borrow = solana ? value(raw, "borrowToken") : value(raw, "borrowToken", "token0");
  // Smart collateral/debt pairs need a separate portfolio model, not single-token LTV.
  if (!solana && [value(raw, "supplyToken", "token1", "address"), value(raw, "borrowToken", "token1", "address")].some(address => typeof address === "string" && !/^0x0{40}$/i.test(address))) return null;
  const id = String(value(raw, "id") ?? "");
  const row = market(solana ? "Jupiter Lend" : "Fluid", chain, id, str(value(supply, "symbol")), str(value(borrow, "symbol")));
  if (!row || !/^\d+$/.test(id)) return null;
  const debtPrice = number(value(borrow, "price"));
  const decimals = number(value(borrow, "decimals"));
  const liquid = decimals === null ? null : scale(value(raw, "borrowable"), 10 ** decimals);
  const min = decimals === null ? null : scale(value(raw, "minimumBorrowing"), 10 ** decimals);
  return { ...row, collateralAddress: str(value(supply, "address")), debtAddress: str(value(borrow, "address")), apr: scale(solana ? value(raw, "borrowRate") : value(raw, "borrowRate", "vault", "rate"), 100), ltv: scale(value(raw, "collateralFactor"), solana ? 10 : 100), liquidationThreshold: scale(value(raw, "liquidationThreshold"), solana ? 10 : 100), debtPrice, collateralPrice: number(value(supply, "price")), liquidityUsd: liquid !== null && debtPrice !== null ? liquid * debtPrice : null, minimumDebtUsd: min !== null && debtPrice !== null ? min * debtPrice : null, borrowFee: scale(value(raw, "borrowFee"), 100), url: solana ? "https://jup.ag/lend/borrow" : `https://fluid.io/vault/${CHAINS[chain]}/${id}`, notes: [solana ? "Jupiter Lend / Fluid technology. Single collateral, single debt." : "Single collateral, single debt vaults. Borrow availability includes vault limits.", "Gross borrow rate; rewards excluded."] };
}
async function fluid(chain: Chain, fetcher: typeof fetch): Promise<BorrowMarket[]> {
  const solana = chain === "Solana";
  const data = await json(solana ? "https://api.jup.ag/lend/v1/borrow/vaults" : `https://api.fluid.io/v2/${CHAINS[chain]}/vaults`, fetcher);
  return records(data).map(row => normalizeFluid(row, chain, solana)).filter(row => row !== null);
}

export function normalizeAaveV3(raw: unknown, chain: Chain, collateralUsd: number): BorrowMarket[] {
  const rows: BorrowMarket[] = [];
  for (const pool of records(value(raw, "markets"))) {
    if (/horizon/i.test(str(pool.name))) continue; // Permissioned institutional market.
    const reserves = records(pool.reserves).filter(r => r.isPaused === false && r.isFrozen === false);
    const collateral = reserves.filter(r => r.isIsolatedCollateral !== true && family(str(value(r, "underlyingToken", "symbol"))) && value(r, "supplyInfo", "canBeCollateral") === true && value(r, "supplyInfo", "supplyCapReached") === false);
    const debts = reserves.filter(r => isStable(str(value(r, "underlyingToken", "symbol"))) && value(r, "borrowInfo", "borrowingState") === "ENABLED" && value(r, "borrowInfo", "borrowCapReached") === false);
    for (const col of collateral) for (const debt of debts) {
      const ca = str(value(col, "underlyingToken", "address")), da = str(value(debt, "underlyingToken", "address"));
      const row = market("Aave", chain, `${pool.address}:${ca}:${da}`, str(value(col, "underlyingToken", "symbol")), str(value(debt, "underlyingToken", "symbol")));
      if (!row) continue;
      const liquid = number(value(debt, "borrowInfo", "availableLiquidity", "usd"));
      const cap = number(value(debt, "borrowInfo", "borrowCap", "usd"));
      const borrowed = number(value(debt, "borrowInfo", "total", "usd"));
      const supplyCap = number(value(col, "supplyInfo", "supplyCap", "usd"));
      const supplyTotal = number(value(col, "supplyInfo", "total", "value"));
      const price = number(col.usdExchangeRate);
      const remaining = supplyCap !== null && supplyCap > 0 && supplyTotal !== null && price !== null ? Math.max(0, supplyCap - supplyTotal * price) : null;
      rows.push({ ...row, name: `${str(pool.name)} · standard`, collateralAddress: ca, debtAddress: da, apr: apyToApr(value(debt, "borrowInfo", "apy", "value")), ltv: scale(value(col, "supplyInfo", "maxLTV", "value"), .01), liquidationThreshold: scale(value(col, "supplyInfo", "liquidationThreshold", "value"), .01), liquidityUsd: liquid === null ? null : cap !== null && cap > 0 && borrowed !== null ? Math.min(liquid, Math.max(0, cap - borrowed)) : liquid, collateralPrice: price, debtPrice: number(debt.usdExchangeRate), collateralCapacityUsd: remaining, url: "https://app.aave.com/", notes: ["V3 standard mode. E-mode, isolation mode and rewards excluded.", ...(remaining !== null && remaining < collateralUsd ? ["Collateral supply cap cannot fit this deposit."] : [])] });
    }
  }
  return rows;
}
async function aaveV3(chain: Chain, collateralUsd: number, fetcher: typeof fetch): Promise<BorrowMarket[]> {
  const query = `query BorrowMarkets($request: MarketsRequest!) { markets(request: $request) {name address reserves {underlyingToken {symbol address} usdExchangeRate isFrozen isPaused supplyInfo {maxLTV {value} liquidationThreshold {value} canBeCollateral supplyCapReached supplyCap {usd} total {value}} borrowInfo {apy {value} borrowingState borrowCapReached availableLiquidity {usd} borrowCap {usd} total {usd}}}}}`;
  const data = await graphql("https://api.v3.aave.com/graphql", query, { request: { chainIds: [CHAINS[chain]] } }, fetcher);
  const pools = records(value(data, "markets"));
  const collaterals = pools.flatMap(pool => records(pool.reserves).filter(r => family(str(value(r, "underlyingToken", "symbol")))).map(reserve => ({ pool, reserve })));
  const block = await blockNumber(RPC[chain]!, fetcher);
  const config = await rpcBatch(RPC[chain]!, collaterals.map(({ pool, reserve }) => call(str(pool.address), "getConfiguration(address) view returns(uint256)", [str(value(reserve, "underlyingToken", "address"))])), fetcher, block);
  if (config.some(item => item === null)) throw new Error("Missing isolation configuration");
  collaterals.forEach(({ reserve }, index) => {
    // Aave V3 ReserveConfiguration: debt ceiling bits 212–251; bit 252 is unrelated.
    reserve.isIsolatedCollateral = ((BigInt(config[index]![0]) >> BigInt(212)) & ((BigInt(1) << BigInt(40)) - BigInt(1))) > BigInt(0);
  });
  return normalizeAaveV3(data, chain, collateralUsd);
}
export function normalizeAaveV4(raw: unknown, chain: Chain): BorrowMarket[] {
  const rows: BorrowMarket[] = [];
  const reserves = records(value(raw, "reserves")).filter(r => value(r, "status", "active") === true && value(r, "status", "paused") === false && value(r, "status", "frozen") === false);
  for (const col of reserves.filter(r => r.canSupply === true && r.canUseAsCollateral === true)) {
    for (const debt of reserves.filter(r => r.canBorrow === true && value(r, "spoke", "id") === value(col, "spoke", "id"))) {
      const row = market("Aave", chain, `${String(col.id)}:${String(debt.id)}`, str(value(col, "asset", "underlying", "info", "symbol")), str(value(debt, "asset", "underlying", "info", "symbol")));
      if (!row) continue;
      const base = apyToApr(scale(value(debt, "asset", "summary", "borrowApy", "normalized"), 100));
      const risk = number(value(col, "settings", "collateralRisk", "normalized"));
      const factor = number(value(col, "settings", "collateralFactor", "normalized"));
      rows.push({ ...row, name: `Aave V4 ${str(value(col, "spoke", "name"))}`, collateralAddress: str(value(col, "asset", "underlying", "address")), debtAddress: str(value(debt, "asset", "underlying", "address")), apr: base !== null && risk !== null ? base * (1 + risk / 100) : null, ltv: factor, liquidationThreshold: factor, liquidityUsd: number(value(debt, "summary", "borrowable", "exchange", "value")), collateralCapacityUsd: number(value(col, "summary", "suppliable", "exchange", "value")), debtPrice: number(value(debt, "asset", "summary", "availableLiquidity", "exchangeRate", "value")), collateralPrice: number(value(col, "asset", "summary", "availableLiquidity", "exchangeRate", "value")), url: "https://app.aave.com/", notes: [`V4 single collateral estimate; includes ${risk ?? "unknown"}% risk premium multiplier. Borrow below collateral factor. Rewards excluded.`] });
    }
  }
  return rows;
}
async function aaveV4(chain: Chain, fetcher: typeof fetch): Promise<BorrowMarket[]> {
  const query = `query BorrowMarkets($request: ReservesRequest!) {reserves(request: $request) {id spoke {id name} status {active frozen paused} canBorrow canSupply canUseAsCollateral settings {collateralFactor {normalized} collateralRisk {normalized}} summary {borrowable {exchange {value}} suppliable {exchange {value}}} asset {underlying {address info {symbol}} summary {borrowApy {normalized} availableLiquidity {exchangeRate {value}}}}}}`;
  return normalizeAaveV4(await graphql("https://api.v4.aave.com/graphql", query, { request: { query: { chainIds: [CHAINS[chain]] } } }, fetcher), chain);
}

const RPC: Partial<Record<Chain, string>> = { Ethereum: "https://ethereum-rpc.publicnode.com", Base: "https://base-rpc.publicnode.com", Arbitrum: "https://arbitrum-one-rpc.publicnode.com" };
// Same stablecoin Comet deployments used by the existing backend Compound module.
export const COMETS: Partial<Record<Chain, string[]>> = {
  Ethereum: ["0xc3d688B66703497DAA19211EEdff47f25384cdc3", "0x5D409e56D886231aDAf00c8775665AD0f9897b56", "0x3Afdc9BCA9213A35503b077a6072F3D0d5AB0840"],
  Base: ["0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf", "0xb125E6687d4313864e53df431d5425969c15Eb2F", "0x2c776041CCFe903071AF44aa147368a9c8EEA518"],
  Arbitrum: ["0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA", "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf", "0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07"],
};
const call = (address: string, abi: string, args?: unknown[]): RpcCall => ({ address, abi: `function ${abi}`, args });
async function compound(chain: Chain, fetcher: typeof fetch): Promise<BorrowMarket[]> {
  const url = RPC[chain]!;
  const block = await blockNumber(url, fetcher);
  const results = await Promise.allSettled((COMETS[chain] ?? []).map(async address => {
    const head = await rpcBatch(url, [call(address, "baseToken() view returns(address)"), call(address, "baseTokenPriceFeed() view returns(address)"), call(address, "numAssets() view returns(uint8)"), call(address, "getUtilization() view returns(uint256)"), call(address, "isWithdrawPaused() view returns(bool)"), call(address, "isSupplyPaused() view returns(bool)"), call(address, "baseBorrowMin() view returns(uint256)")], fetcher, block);
    if (head.some(item => item === null)) throw new Error("Missing Comet state");
    if (head[4]![0] || head[5]![0]) return [];
    const base = String(head[0]![0]), feed = String(head[1]![0]), count = Number(head[2]![0]);
    if (count > 64) throw new Error("Invalid asset count");
    const metadata = await rpcBatch(url, [call(base, "symbol() view returns(string)"), call(base, "decimals() view returns(uint8)"), call(base, "balanceOf(address) view returns(uint256)", [address]), call(address, "getPrice(address) view returns(uint256)", [feed]), call(address, "getBorrowRate(uint256) view returns(uint64)", [head[3]![0]]), ...Array.from({ length: count }, (_, i) => call(address, "getAssetInfo(uint8) view returns(uint8,address,address,uint64,uint64,uint64,uint64,uint128)", [i]))], fetcher, block);
    if (metadata.some(item => item === null)) throw new Error("Missing Comet metadata");
    const debt = String(metadata[0]![0]);
    if (!isStable(debt)) return [];
    const debtScale = 10 ** Number(metadata[1]![0]), debtPrice = Number(metadata[3]![0]) / 1e8;
    const assets = metadata.slice(5);
    const details = await rpcBatch(url, assets.flatMap(info => [call(String(info![1]), "symbol() view returns(string)"), call(address, "getPrice(address) view returns(uint256)", [info![2]]), call(address, "totalsCollateral(address) view returns(uint128,uint128)", [info![1]])]), fetcher, block);
    if (details.some(item => item === null)) throw new Error("Missing collateral state");
    return assets.flatMap((info, i) => {
      const row = market("Compound", chain, `${address}:${info![1]}`, String(details[i * 3]![0]), debt);
      if (!row) return [];
      const price = Number(details[i * 3 + 1]![0]) / 1e8;
      return [{ ...row, name: `Compound III ${debt}`, collateralAddress: String(info![1]), debtAddress: base, apr: Number(metadata[4]![0]) / 1e18 * 31_536_000 * 100, ltv: Number(info![4]) / 1e16, liquidationThreshold: Number(info![5]) / 1e16, liquidityUsd: Number(metadata[2]![0]) / debtScale * debtPrice, debtPrice, collateralPrice: price, collateralCapacityUsd: Math.max(0, Number(info![7]) - Number(details[i * 3 + 2]![0])) / Number(info![3]) * price, minimumDebtUsd: Number(head[6]![0]) / debtScale * debtPrice, url: "https://app.compound.finance/", notes: [`On-chain block ${parseInt(block, 16)}. Collateral supply caps and minimum borrow included.`] }];
    });
  }));
  // Fail visibly instead of silently treating failed Comets as absent markets.
  if (results.some(result => result.status === "rejected")) throw new Error("Incomplete Comet data");
  return results.flatMap(result => result.status === "fulfilled" ? result.value : []);
}

async function curve(chain: Chain, collateralUsd: number, bands: number, fetcher: typeof fetch): Promise<BorrowMarket[]> {
  const data = await json(`https://api.curve.finance/v1/getLendingVaults/all/${chain.toLowerCase()}`, fetcher);
  if (value(data, "success") !== true) throw new Error("Invalid Curve response");
  const vaults = records(value(data, "data", "lendingVaultData")).filter(v => family(str(value(v, "assets", "collateral", "symbol"))) && isStable(str(value(v, "assets", "borrowed", "symbol"))));
  const url = RPC[chain]!;
  const block = vaults.length ? await blockNumber(url, fetcher) : "latest";
  const calls = vaults.map(v => {
    const price = number(value(v, "assets", "collateral", "usdPrice")), decimals = number(value(v, "assets", "collateral", "decimals"));
    if (!price || decimals === null || decimals > 36) throw new Error("Missing collateral price");
    // Round down collateral to avoid quoting against more than the deposit value.
    const raw = BigInt(Math.floor(collateralUsd / price * 1e8)) * BigInt(10) ** BigInt(Math.max(0, decimals - 8)) / BigInt(10) ** BigInt(Math.max(0, 8 - decimals));
    return call(str(v.controllerAddress), "max_borrowable(uint256,uint256) view returns(uint256)", [raw, bands]);
  });
  const quotes = await rpcBatch(url, calls, fetcher, block);
  return vaults.flatMap((v, i) => {
    const row = market("Curve", chain, str(v.controllerAddress), str(value(v, "assets", "collateral", "symbol")), str(value(v, "assets", "borrowed", "symbol")));
    if (!row) return [];
    const debtPrice = number(value(v, "assets", "borrowed", "usdPrice")), decimals = number(value(v, "assets", "borrowed", "decimals"));
    const quoted = quotes[i] && debtPrice !== null && decimals !== null ? Number(quotes[i]![0]) / 10 ** decimals * debtPrice : null;
    return [{ ...row, name: `LlamaLend ${v.registryId === "oneway-v2" ? "V2" : "V1"} · ${bands} bands`, apr: scale(value(v, "rates", "borrowApr"), .01), collateralAddress: str(value(v, "assets", "collateral", "address")), debtAddress: str(value(v, "assets", "borrowed", "address")), collateralPrice: number(value(v, "assets", "collateral", "usdPrice")), debtPrice, ltv: quoted === null ? null : quoted / collateralUsd * 100, quotedDebtUsd: quoted, liquidityUsd: number(value(v, "availableToBorrow", "usdTotal")), url: `https://www.curve.finance/lend/${chain.toLowerCase()}/markets/${str(v.controllerAddress)}`, notes: [`Effective LTV from controller max_borrowable at ${bands} bands for this deposit; includes liquidity limits. Soft liquidation has no single threshold.`, ...(quoted === null ? ["Controller quote unavailable; borrowing capacity is unknown."] : [])] }];
  });
}

// curvefi/curve-llamalend.js src/constants/llammas.ts; WBTC is also used by routers/curve.py.
const MINT_MARKETS = [
  { symbol: "WBTC", decimals: 8, token: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", controller: "0x4e59541306910ad6dc1dac0ac9dfb29bd9f15c67", amm: "0xe0438eb3703bf871e31ce639bd351109c88666ea", slug: "wbtc" },
  { symbol: "ETH", decimals: 18, token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", controller: "0xa920de414ea4ab66b97da1bfe9e6eca7d4219635", amm: "0x1681195c176239ac5e72d9aebacf5b2492e0c4ee", slug: "eth" },
  { symbol: "wstETH", decimals: 18, token: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", controller: "0x100daa78fc509db39ef7d04de0c1abd299f4c6ce", amm: "0x37417b2238aa52d0dd2d6252d989e728e8f706e4", slug: "wsteth" },
  { symbol: "sfrxETH", decimals: 18, token: "0xac3e018457b222d93114458476f3e3416abbe38f", controller: "0x8472a9a7632b173c8cf3a86d3afec50c35548e76", amm: "0x136e783846ef68c8bd00a3369f787df8d683a696", slug: "sfrxeth" },
  { symbol: "sfrxETH", decimals: 18, token: "0xac3e018457b222d93114458476f3e3416abbe38f", controller: "0xec0820efafc41d8943ee8de495fc9ba8495b15cf", amm: "0xfa96ad0a9e64261db86950e2da362f5572c5c6fd", slug: "sfrxeth2" },
  { symbol: "tBTC", decimals: 18, token: "0x18084fba666a33d37592fa2633fd49a74dd93a88", controller: "0x1c91da0223c763d2e0173243eadaa0a2ea47e704", amm: "0xf9bd9da2427a50908c4c6d1599d8e62837c2bcb0", slug: "tbtc" },
];
async function curveMint(collateralUsd: number, bands: number, fetcher: typeof fetch): Promise<BorrowMarket[]> {
  const url = RPC.Ethereum!, stable = "0xf939e0a03fb07f59a73314e73794be0e57ac1b4e";
  const priceKey = `ethereum:${stable}`;
  const priceData = await json(`https://coins.llama.fi/prices/current/${priceKey}`, fetcher);
  const debtPrice = number(value(priceData, "coins", priceKey, "price"));
  const timestamp = number(value(priceData, "coins", priceKey, "timestamp"));
  if (!debtPrice || timestamp === null || Math.abs(Date.now() / 1000 - timestamp) > 3600) throw new Error("Missing current crvUSD price");
  const block = await blockNumber(url, fetcher);
  const state = await rpcBatch(url, MINT_MARKETS.flatMap(m => [call(m.amm, "price_oracle() view returns(uint256)"), call(m.amm, "rate() view returns(uint256)"), call(stable, "balanceOf(address) view returns(uint256)", [m.controller])]), fetcher, block);
  if (state.some(item => item === null)) throw new Error("Incomplete mint market state");
  const quotes = await rpcBatch(url, MINT_MARKETS.map((m, i) => {
    const price = Number(state[i * 3]![0]) / 1e18 * debtPrice;
    if (price <= 0) throw new Error("Invalid mint oracle");
    const raw = BigInt(Math.floor(collateralUsd / price * 1e8)) * BigInt(10) ** BigInt(Math.max(0, m.decimals - 8));
    return call(m.controller, "max_borrowable(uint256,uint256) view returns(uint256)", [raw, bands]);
  }), fetcher, block);
  return MINT_MARKETS.map((m, i) => {
    const row = market("Curve", "Ethereum", m.controller, m.symbol, "crvUSD")!;
    const quote = quotes[i] ? Number(quotes[i]![0]) / 1e18 * debtPrice : null;
    return { ...row, name: `crvUSD mint · ${bands} bands`, collateralAddress: m.token, debtAddress: stable, apr: Number(state[i * 3 + 1]![0]) / 1e18 * 31_536_000 * 100, ltv: quote === null ? null : quote / collateralUsd * 100, collateralPrice: Number(state[i * 3]![0]) / 1e18 * debtPrice, debtPrice, quotedDebtUsd: quote, liquidityUsd: Number(state[i * 3 + 2]![0]) / 1e18 * debtPrice, url: `https://www.curve.finance/crvusd/ethereum/markets/${m.slug}`, notes: [`Mint market, not a lending vault. Effective LTV from max_borrowable with ${bands} bands, at block ${parseInt(block, 16)}. Soft liquidation has no single threshold.`, ...(quote === null ? ["Controller quote unavailable; borrowing capacity is unknown."] : [])] };
  });
}

export async function fetchBorrowCatalog(chain: Chain | "All", collateralUsd: number, bands: number, fetcher: typeof fetch = fetch): Promise<BorrowCatalog> {
  const upstream = fetcher, deadline = AbortSignal.timeout(45_000);
  fetcher = (input, init) => upstream(input, { ...init, signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]) });
  const chains = chain === "All" ? Object.keys(CHAINS) as Chain[] : [chain];
  const jobs: { source: string; chain: Chain; run: () => Promise<BorrowMarket[]> }[] = [];
  for (const c of chains) {
    if (["Ethereum", "Base", "Arbitrum"].includes(c)) {
      jobs.push({ source: "Morpho", chain: c, run: () => morpho(c, fetcher) }, { source: "Fluid", chain: c, run: () => fluid(c, fetcher) }, { source: "Aave V3", chain: c, run: () => aaveV3(c, collateralUsd, fetcher) }, { source: "Compound III", chain: c, run: () => compound(c, fetcher) });
    }
    if (c === "Ethereum" || c === "Arbitrum") jobs.push({ source: "Curve LlamaLend", chain: c, run: () => curve(c, collateralUsd, bands, fetcher) });
    if (c === "Ethereum") jobs.push({ source: "Curve crvUSD mint", chain: c, run: () => curveMint(collateralUsd, bands, fetcher) });
    if (c === "Ethereum" || c === "Arc") jobs.push({ source: "Aave V4", chain: c, run: () => aaveV4(c, fetcher) });
    if (c === "Solana") jobs.push({ source: "Jupiter Lend (Fluid)", chain: c, run: () => fluid(c, fetcher) });
  }
  const results = await Promise.all(jobs.map(async job => {
    try { const markets = await job.run(); return { markets, coverage: { source: job.source, chain: job.chain, status: "ok" as const, markets: markets.length } }; }
    catch { return { markets: [], coverage: { source: job.source, chain: job.chain, status: "error" as const, markets: 0 } }; }
  }));
  if (results.every(result => result.coverage.status === "error")) throw new Error("Borrow data unavailable");
  const markets = [...new Map(results.flatMap(result => result.markets).map(row => [row.id, row])).values()];
  return { markets, coverage: results.map(result => result.coverage), retrievedAt: new Date().toISOString(), collateralUsd, bands };
}
