export const CHAINS = { Ethereum: 1, Arbitrum: 42161, Base: 8453, Arc: 5042, Solana: 0 } as const;
export type Chain = keyof typeof CHAINS;
export const COLLATERALS = {
  ETH: ["ETH", "WETH", "stETH", "wstETH", "weETH", "ezETH", "rsETH", "rETH", "cbETH", "osETH", "sfrxETH", "frxETH"],
  BTC: ["BTC", "WBTC", "cbBTC", "tBTC", "LBTC", "eBTC", "FBTC", "BTC.b", "xBTC", "cirBTC", "SolvBTC"],
} as const;
export const STABLECOINS = ["USDC", "USDC.e", "USDbC", "USDT", "USDT0", "DAI", "USDS", "crvUSD", "GHO", "USDe", "USDG", "PYUSD", "RLUSD", "frxUSD", "JupUSD", "EURC"] as const;
export type Family = keyof typeof COLLATERALS;
export type BorrowMarket = {
  id: string; protocol: string; chain: Chain; name: string;
  collateral: string; collateralAddress: string; debt: string; debtAddress: string;
  apr: number | null; ltv: number | null; liquidationThreshold: number | null;
  liquidityUsd: number | null; collateralPrice: number | null; debtPrice: number | null;
  collateralCapacityUsd: number | null; minimumDebtUsd: number | null; quotedDebtUsd: number | null;
  borrowFee: number | null; url: string; notes: string[];
};
export type Coverage = { source: string; chain: Chain; status: "ok" | "error"; markets: number };
export type BorrowCatalog = { markets: BorrowMarket[]; coverage: Coverage[]; retrievedAt: string; collateralUsd: number; bands: number };

export function number(value: unknown): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}
export function family(symbol: string): Family | null {
  for (const [name, symbols] of Object.entries(COLLATERALS)) {
    if (symbols.some(token => token.toLowerCase() === symbol.toLowerCase())) return name as Family;
  }
  return null;
}
export function isStable(symbol: string): boolean {
  return STABLECOINS.some(token => token.toLowerCase() === symbol.toLowerCase());
}
// A common nominal annual rate for comparison. APY sources compound per second.
export function apyToApr(apyFraction: unknown): number | null {
  const apy = number(apyFraction);
  return apy === null ? null : Math.expm1(Math.log1p(apy) / 31_536_000) * 31_536_000 * 100;
}
export function scale(value: unknown, divisor: number): number | null {
  const n = number(value);
  return n === null ? null : n / divisor;
}
export function capacity(market: BorrowMarket, collateralUsd: number, bufferPercent: number): number | null {
  if (!Number.isFinite(collateralUsd) || collateralUsd <= 0 || !Number.isFinite(bufferPercent) || bufferPercent < 0 || bufferPercent >= 100 || market.ltv === null || market.ltv <= 0 || market.ltv >= 100) return null;
  if (market.collateralCapacityUsd !== null && market.collateralCapacityUsd < collateralUsd) return 0;
  const limit = collateralUsd * market.ltv / 100 * (1 - bufferPercent / 100);
  const quoted = market.quotedDebtUsd === null ? limit : Math.min(limit, market.quotedDebtUsd * (1 - bufferPercent / 100));
  const result = market.liquidityUsd === null ? null : Math.max(0, Math.min(quoted, market.liquidityUsd));
  return result !== null && market.minimumDebtUsd !== null && result < market.minimumDebtUsd ? 0 : result;
}
export type Filters = { chain: string; protocol: string; collateral: string; debt: string; maxApr: number | null; minLtv: number | null; minLoanUsd: number; availableOnly: boolean };
export function matches(market: BorrowMarket, filters: Filters, collateralUsd: number, buffer: number): boolean {
  return (filters.chain === "All" || market.chain === filters.chain)
    && (filters.protocol === "All" || market.protocol === filters.protocol)
    && (filters.collateral === "All" || (filters.collateral === "ETH" || filters.collateral === "BTC" ? family(market.collateral) === filters.collateral : market.collateral === filters.collateral.replace(/^token:/, "")))
    && (filters.debt === "All" || market.debt === filters.debt)
    && (filters.maxApr === null || (market.apr !== null && market.apr <= filters.maxApr))
    && (filters.minLtv === null || (market.ltv !== null && market.ltv >= filters.minLtv))
    && (filters.minLoanUsd === 0 || (capacity(market, collateralUsd, buffer) ?? 0) >= filters.minLoanUsd)
    && (!filters.availableOnly || (capacity(market, collateralUsd, buffer) ?? 0) > 0);
}
export function csvExport(markets: BorrowMarket[], collateralUsd: number, buffer: number): string {
  const cells = (row: unknown[]) => row.map(value => {
    let text = value === null ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",");
  return [cells(["protocol", "chain", "market", "collateral", "collateral_address", "stablecoin", "stablecoin_address", "borrow_apr_percent", "max_ltv_percent", "liquidation_threshold_percent", "available_usd", "collateral_usd", "buffer_percent", "borrow_usd", "annual_interest_usd", "borrow_fee_percent", "notes", "url"]), ...markets.map(m => {
    const amount = capacity(m, collateralUsd, buffer);
    return cells([m.protocol, m.chain, m.name, m.collateral, m.collateralAddress, m.debt, m.debtAddress, m.apr, m.ltv, m.liquidationThreshold, m.liquidityUsd, collateralUsd, buffer, amount, amount !== null && m.apr !== null ? amount * m.apr / 100 : null, m.borrowFee, m.notes.join("; "), m.url]);
  })].join("\r\n");
}
