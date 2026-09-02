import { describe, expect, it, vi } from "vitest";
import { fetchCatalog } from "./source";

const row = { name: "frxUSD/USG", chainId: 1, vault: `0x${"2".repeat(40)}`, lpToken: { address: `0x${"3".repeat(40)}` }, tvl: 1000, apr: { current: { total: 29.46 } } };
const response = (data: unknown) => new Response(JSON.stringify(data));

describe("Stake DAO source aggregation", () => {
  it("normalizes both official catalogue formats and retains version identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => response(String(url).includes("/v2/") ? [row] : { deployed: [row] }));
    const result = await fetchCatalog(fetcher);
    expect(result.strategies).toHaveLength(5);
    expect(new Set(result.strategies.map(strategy => strategy.id)).size).toBe(5);
    expect(result.warnings).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("https://api.stakedao.org/api/strategies/"), expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
  });
  it("reports missing protocol data instead of silently presenting a complete catalogue", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (String(url).includes("/v2/curve/")) return response([row]);
      throw new Error("unavailable");
    });
    const result = await fetchCatalog(fetcher);
    expect(result.strategies).toHaveLength(1);
    expect(result.warnings).toHaveLength(4);
  });
  it("fails closed when no valid strategy data is available", async () => {
    await expect(fetchCatalog(vi.fn<typeof fetch>().mockResolvedValue(response({ error: "invalid" })))).rejects.toThrow("unavailable");
    await expect(fetchCatalog(vi.fn<typeof fetch>().mockImplementation(async () => new Response("down", { status: 502 })))).rejects.toThrow("unavailable");
  });
});
