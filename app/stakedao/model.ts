import { parseCsv } from "../../components/sheets/csv";

export const EVM_ADDRESS = /^0x[0-9a-f]{40}$/i;
const CHAINS: Record<number, string> = { 1: "Ethereum", 10: "Optimism", 100: "Gnosis", 146: "Sonic", 252: "Fraxtal", 8453: "Base", 42161: "Arbitrum", 42793: "Etherlink" };
export type Strategy = {
  id: string; name: string; protocol: string; version: number; chainId: number; chain: string;
  vault: string; gauge: string | null; assetAddress: string; tokens: { symbol: string; address: string }[];
  tvl: number | null; apr: number | null; projectedApr: number | null; boost: number | null;
  onlyBoost: boolean; inactive: boolean;
};
export type Catalog = { strategies: Strategy[]; warnings: string[]; retrievedAt: string };
export type Position = {
  id: string; wallet: string; chainId: number; name: string; protocol: string; product: string; type: string;
  contract: string; assetAddress: string; assetSymbol: string; amount: number | null; valueUsd: number | null;
  apr: number | null; rewardSymbol: string; rewardAmount: number | null; rewardUsd: number | null;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function finiteNumber(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function normalizeStrategy(value: unknown, protocol: string, version: number): Strategy | null {
  const raw = record(value);
  const lp = record(raw.lpToken);
  const chainId = finiteNumber(raw.chainId);
  if (!chainId || !Number.isInteger(chainId) || typeof raw.name !== "string" || !raw.name || typeof raw.vault !== "string" || !EVM_ADDRESS.test(raw.vault) || typeof lp.address !== "string" || !EVM_ADDRESS.test(lp.address)) return null;
  const vault = raw.vault.toLowerCase();
  const apr = record(raw.apr);
  const sdGauge = typeof raw.sdGauge === "string" ? raw.sdGauge : record(raw.sdGauge).address;
  const coins: unknown[] = Array.isArray(raw.coins) ? raw.coins : [];
  return {
    id: `${chainId}:${version}:${protocol}:${vault}`, name: raw.name, protocol, version, chainId, chain: CHAINS[chainId] ?? `Chain ${chainId}`,
    vault, gauge: typeof sdGauge === "string" && EVM_ADDRESS.test(sdGauge) ? sdGauge.toLowerCase() : null,
    assetAddress: lp.address.toLowerCase(), tokens: coins.flatMap(coin => {
      const token = record(coin);
      return typeof token.symbol === "string" && typeof token.address === "string" && EVM_ADDRESS.test(token.address) ? [{ symbol: token.symbol, address: token.address.toLowerCase() }] : [];
    }),
    tvl: finiteNumber(raw.tvl), apr: finiteNumber(record(apr.current).total), projectedApr: finiteNumber(record(apr.projected).total),
    boost: finiteNumber(apr.boost), onlyBoost: record(raw.onlyboost).active === true || record(raw.onlyBoost).active === true,
    inactive: record(raw.gauge).isKilled === true,
  };
}

export function matchesStrategy(strategy: Strategy, query: string): boolean {
  const parts = query.trim().toLowerCase().split(/[\s/,]+/).filter(Boolean);
  return parts.every(part => EVM_ADDRESS.test(part)
    ? [strategy.vault, strategy.gauge, strategy.assetAddress, ...strategy.tokens.map(token => token.address)].includes(part)
    : strategy.name.toLowerCase().includes(part) || strategy.tokens.some(token => token.symbol.toLowerCase() === part));
}
export function strategyUrl(strategy: Strategy) {
  return `https://app.stakedao.org/strategy?${new URLSearchParams({ protocol: strategy.protocol, vault: `${strategy.chainId}-${strategy.vault}` })}`;
}
export function normalizeWallet(value: string): string {
  const wallet = value.trim().toLowerCase();
  if (!EVM_ADDRESS.test(wallet)) throw new Error("Enter a valid EVM wallet address (0x + 40 hexadecimal characters).");
  return wallet;
}

export function parsePositions(content: string, wallet: string): Position[] {
  const [headers = [], ...rows] = parseCsv(content);
  const required = ["wallet", "chain_id", "position_id", "position_contract", "asset_address", "name", "amount", "value_usd"];
  if (!required.every(key => headers.includes(key))) throw new Error("The positions API returned an invalid table.");
  const positions = rows.map(cells => {
    const row = Object.fromEntries(headers.map((key, i) => [key, cells[i] ?? ""]));
    if (row.wallet.toLowerCase() !== wallet || row.chain_id !== "1" || !row.position_id || !EVM_ADDRESS.test(row.position_contract) || !EVM_ADDRESS.test(row.asset_address)) throw new Error("The positions API returned unexpected wallet or network data.");
    return {
      id: row.position_id, wallet, chainId: 1, name: row.name, protocol: row.protocol, product: row.product, type: row.position_type,
      contract: row.position_contract.toLowerCase(), assetAddress: row.asset_address.toLowerCase(), assetSymbol: row.asset_symbol,
      amount: finiteNumber(row.amount), valueUsd: finiteNumber(row.value_usd), apr: finiteNumber(row.apr_current_percent),
      rewardSymbol: row.claimable_reward_symbol, rewardAmount: finiteNumber(row.claimable_reward_amount), rewardUsd: finiteNumber(row.claimable_reward_value_usd),
    };
  });
  return [...new Map(positions.map(position => [position.id, position])).values()];
}

export function positionStrategy(position: Position, strategies: Strategy[]): Strategy | undefined {
  return strategies.find(strategy => strategy.chainId === position.chainId && strategy.assetAddress === position.assetAddress && (strategy.vault === position.contract || strategy.gauge === position.contract));
}
export function positionTotals(positions: Position[]) {
  const values = positions.flatMap(position => position.valueUsd === null ? [] : [position.valueUsd]);
  const rewards = positions.flatMap(position => position.rewardUsd === null ? [] : [position.rewardUsd]);
  return {
    valueUsd: values.length ? values.reduce((sum, value) => sum + value, 0) : positions.length ? null : 0,
    rewardUsd: rewards.length ? rewards.reduce((sum, value) => sum + value, 0) : positions.length ? null : 0,
    unpriced: positions.length - values.length, missingRewards: positions.length - rewards.length,
  };
}

export function savedWalletChoices(value: unknown): { label: string; address: string }[] {
  if (!Array.isArray(value)) return [];
  const choices = value.flatMap(item => {
    const entry = record(item);
    return entry.kind === "evm" && typeof entry.value === "string" && EVM_ADDRESS.test(entry.value.trim()) ? [{ label: typeof entry.label === "string" ? entry.label : "Saved wallet", address: entry.value.trim().toLowerCase() }] : [];
  });
  return [...new Map(choices.map(choice => [choice.address, choice])).values()];
}
