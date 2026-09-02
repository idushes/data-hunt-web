import { matchesPair, normalizeYieldPool, type PairSearch, type YieldSearchResponse } from "../../uniswap/model";

export async function searchYieldPools(search: PairSearch, fetcher: typeof fetch = fetch): Promise<YieldSearchResponse> {
  const response = await fetcher("https://yields.llama.fi/pools", {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error("Yield provider unavailable.");
  const payload = await response.json();
  if (payload?.status !== "success" || !Array.isArray(payload.data)) throw new Error("Invalid yield provider response.");
  const catalog = payload.data.map(normalizeYieldPool).filter((pool: ReturnType<typeof normalizeYieldPool>) => pool !== null) as NonNullable<ReturnType<typeof normalizeYieldPool>>[];
  if (!catalog.length) throw new Error("Uniswap coverage is temporarily unavailable.");
  const matching = catalog.filter(pool => matchesPair(pool, search)).sort((a, b) => b.tvl - a.tvl);
  return {
    rows: matching.slice(0, 200), search,
    chains: [...new Set(catalog.map(pool => pool.chain))].sort(),
    matches: matching.length, indexedPools: catalog.length,
    retrievedAt: new Date().toISOString(),
  };
}
