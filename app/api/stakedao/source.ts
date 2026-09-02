import { normalizeStrategy, type Catalog } from "../../stakedao/model";

const SOURCES = [
  { path: "v2/curve/index.json", protocol: "curve", version: 2, label: "Curve V2" },
  { path: "v2/balancer/index.json", protocol: "balancer", version: 2, label: "Balancer V2" },
  { path: "curve/1.json", protocol: "curve", version: 1, label: "Curve V1 (Ethereum)" },
  { path: "balancer/1.json", protocol: "balancer", version: 1, label: "Balancer V1 (Ethereum)" },
  { path: "pendle/1.json", protocol: "pendle", version: 1, label: "Pendle (Ethereum)" },
] as const;

export async function fetchCatalog(fetcher: typeof fetch = fetch): Promise<Catalog> {
  const results = await Promise.all(SOURCES.map(async source => {
    try {
      const response = await fetcher(`https://api.stakedao.org/api/strategies/${source.path}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error("Provider unavailable");
      const payload = await response.json();
      const values: unknown = source.version === 2 ? payload : payload?.deployed;
      if (!Array.isArray(values)) throw new Error("Invalid catalogue");
      const strategies = values.map(value => normalizeStrategy(value, source.protocol, source.version)).filter(strategy => strategy !== null);
      if (values.length && !strategies.length) throw new Error("Invalid strategies");
      return { strategies, warning: null };
    } catch { return { strategies: [], warning: `${source.label} is temporarily unavailable; its strategies are missing from this view.` }; }
  }));
  const strategies = [...new Map(results.flatMap(result => result.strategies).map(strategy => [strategy.id, strategy])).values()].sort((a, b) => (b.tvl ?? -1) - (a.tvl ?? -1));
  if (!strategies.length) throw new Error("Stake DAO strategy data is temporarily unavailable.");
  return { strategies, warnings: results.flatMap(result => result.warning ? [result.warning] : []), retrievedAt: new Date().toISOString() };
}
