import { describe, expect, it, vi } from "vitest";
import { validateSearch } from "../../uniswap/model";
import { searchYieldPools } from "./source";

const search = validateSearch({ tokenA: "ETH", tokenB: "USDC" });
const row = {
  pool: "b99bcdf5-1350-4269-981e-0e9b5cccb007", project: "uniswap-v3", chain: "Base",
  symbol: "WETH-USDC", underlyingTokens: ["0x4200000000000000000000000000000000000006", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"],
  tvlUsd: 100_000, apy: 12,
};
const provider = (data: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data), { status }));

describe("Uniswap yield catalogue", () => {
  it("filters unrelated pools, returns discovered networks and orders by TVL", async () => {
    const fetcher = provider({ status: "success", data: [row, { ...row, chain: "Ethereum", tvlUsd: 200_000 }, { ...row, project: "aave-v3" }, { ...row, chain: "Monad", symbol: "WMON-USDC" }] });
    const result = await searchYieldPools(search, fetcher);
    expect(result.rows.map(pool => pool.chain)).toEqual(["Ethereum", "Base"]);
    expect(result).toMatchObject({ search, chains: ["Base", "Ethereum", "Monad"], matches: 2, indexedPools: 3 });
    expect(Date.parse(result.retrievedAt)).not.toBeNaN();
    expect(fetcher).toHaveBeenCalledWith("https://yields.llama.fi/pools", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
  });
  it("applies the requested chain and version before limiting", async () => {
    const fetcher = provider({ status: "success", data: [row, { ...row, project: "uniswap-v4" }, { ...row, chain: "Ethereum" }] });
    expect((await searchYieldPools({ ...search, chain: "Base", version: "V3" }, fetcher)).rows).toHaveLength(1);
  });
  it("reports truncation and returns only the 200 largest matches", async () => {
    const fetcher = provider({ status: "success", data: Array.from({ length: 205 }, (_, i) => ({ ...row, tvlUsd: i + 1 })) });
    const result = await searchYieldPools(search, fetcher);
    expect(result.matches).toBe(205);
    expect(result.rows).toHaveLength(200);
    expect(result.rows[0].tvl).toBe(205);
    expect(result.rows[199].tvl).toBe(6);
  });
  it("distinguishes no matches from provider failure", async () => {
    expect((await searchYieldPools({ ...search, tokenB: "NOTFOUND" }, provider({ status: "success", data: [row] }))).rows).toEqual([]);
    await expect(searchYieldPools(search, provider({ status: "success", data: [] }))).rejects.toThrow("coverage");
    await expect(searchYieldPools(search, provider({ status: "error" }))).rejects.toThrow("Invalid");
    await expect(searchYieldPools(search, provider({}, 503))).rejects.toThrow("unavailable");
    await expect(searchYieldPools(search, vi.fn<typeof fetch>().mockRejectedValue(new Error("timeout")))).rejects.toThrow("timeout");
  });
});
