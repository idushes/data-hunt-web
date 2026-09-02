export type UniswapVersion = "All" | "V2" | "V3" | "V4";
export type PairSearch = { tokenA: string; tokenB: string; chain: string; version: UniswapVersion };
export type YieldPool = {
  id: string;
  chain: string;
  version: Exclude<UniswapVersion, "All">;
  symbol: string;
  tokens: string[];
  feeTier: string | null;
  tvl: number;
  feeApy: number | null;
  rewardApy: number | null;
  totalApy: number | null;
  average30d: number | null;
  volume24h: number | null;
  dynamicFee: boolean;
  outlier: boolean;
};
export type YieldSearchResponse = {
  rows: YieldPool[];
  search: PairSearch;
  chains: string[];
  matches: number;
  indexedPools: number;
  retrievedAt: string;
};

const PROJECTS = { "uniswap-v2": "V2", "uniswap-v3": "V3", "uniswap-v4": "V4" } as const;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const POOL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeYieldPool(value: unknown): YieldPool | null {
  const pool = record(value);
  const version = Object.hasOwn(PROJECTS, String(pool.project)) ? PROJECTS[pool.project as keyof typeof PROJECTS] : undefined;
  const tokens = Array.isArray(pool.underlyingTokens) && pool.underlyingTokens.length === 2 && pool.underlyingTokens.every((token): token is string => typeof token === "string" && ADDRESS.test(token)) ? pool.underlyingTokens.map(token => token.toLowerCase()) : [];
  const tvl = positiveNumber(pool.tvlUsd);
  if (!version || typeof pool.pool !== "string" || !POOL_ID.test(pool.pool) || typeof pool.chain !== "string" || !pool.chain || typeof pool.symbol !== "string" || !pool.symbol || tokens.length !== 2 || tvl === null) return null;
  const feeTier = typeof pool.poolMeta === "string" ? pool.poolMeta : version === "V2" ? "0.3%" : null;
  const dynamicFee = /dynamic|hook/i.test(feeTier ?? "");
  // Dynamic-fee coverage differs across the source's chain adapters. Do not
  // display a zero from a missing calculation as an actual zero yield.
  return {
    id: pool.pool, chain: pool.chain, version, symbol: pool.symbol, tokens, feeTier, tvl,
    feeApy: dynamicFee ? null : positiveNumber(pool.apyBase),
    rewardApy: positiveNumber(pool.apyReward),
    totalApy: dynamicFee ? null : positiveNumber(pool.apy),
    average30d: dynamicFee ? null : positiveNumber(pool.apyMean30d),
    volume24h: positiveNumber(pool.volumeUsd1d), dynamicFee, outlier: pool.outlier === true,
  };
}

export function validateSearch(value: unknown): PairSearch {
  const input = record(value);
  const token = (value: unknown) => {
    if (typeof value !== "string") throw new Error("Enter both token symbols or contract addresses.");
    const result = value.trim();
    if (!result || result.length > 64 || /[\s/]/.test(result)) throw new Error("Enter one symbol or contract address in each token field.");
    if (/^0x/i.test(result) && !ADDRESS.test(result)) throw new Error("A token contract address must contain 0x followed by 40 hexadecimal characters.");
    return ADDRESS.test(result) ? result.toLowerCase() : result.toUpperCase();
  };
  const tokenA = token(input.tokenA);
  const tokenB = token(input.tokenB);
  const chain = typeof input.chain === "string" ? input.chain.trim() : "All";
  const version = input.version ?? "All";
  if (!chain || chain.length > 40 || !/^[a-zA-Z0-9 ._-]+$/.test(chain)) throw new Error("Invalid network.");
  if (typeof version !== "string" || !["All", "V2", "V3", "V4"].includes(version)) throw new Error("Invalid Uniswap version.");
  return { tokenA, tokenB, chain, version: version as UniswapVersion };
}

function symbolKey(symbol: string) {
  const key = symbol.toUpperCase();
  return key === "ETH" ? "WETH" : key;
}

export function matchesPair(pool: YieldPool, search: PairSearch): boolean {
  if (search.chain !== "All" && pool.chain.toLowerCase() !== search.chain.toLowerCase()) return false;
  if (search.version !== "All" && pool.version !== search.version) return false;
  const symbols = pool.symbol.split("-");
  const matchesToken = (query: string, index: number) => ADDRESS.test(query)
    ? pool.tokens[index] === query.toLowerCase()
    : symbols.length === 2 && symbolKey(symbols[index]) === symbolKey(query);
  return (matchesToken(search.tokenA, 0) && matchesToken(search.tokenB, 1)) || (matchesToken(search.tokenA, 1) && matchesToken(search.tokenB, 0));
}

export function savedPairKey(search: PairSearch) {
  return JSON.stringify([[search.tokenA.toLowerCase(), search.tokenB.toLowerCase()].sort(), search.chain.toLowerCase(), search.version]);
}

export function readSavedPairs(value: unknown): PairSearch[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, PairSearch>();
  for (const item of value.slice(0, 100)) {
    try { const pair = validateSearch(item); unique.set(savedPairKey(pair), pair); } catch { /* Ignore stale or invalid browser data. */ }
  }
  return [...unique.values()].slice(0, 20);
}

export function poolAnalyticsUrl(id: string) {
  return `https://defillama.com/yields/pool/${encodeURIComponent(id)}`;
}
