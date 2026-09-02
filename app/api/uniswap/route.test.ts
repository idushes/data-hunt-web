import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("./source", () => ({ searchYieldPools: vi.fn() }));
import { GET } from "./route";
import { searchYieldPools } from "./source";

describe("Uniswap search API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects invalid input without fetching the provider", async () => {
    const result = await GET(new NextRequest("https://example.test/api/uniswap?tokenA=0x123&tokenB=USDC"));
    expect(result.status).toBe(400);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(searchYieldPools).not.toHaveBeenCalled();
  });
  it("passes a normalized search without adding a second response cache", async () => {
    vi.mocked(searchYieldPools).mockResolvedValue({ rows: [], search: { tokenA: "ETH", tokenB: "USDC", chain: "Base", version: "V3" }, chains: ["Base"], matches: 0, indexedPools: 100, retrievedAt: "2026-09-02T00:00:00Z" });
    const result = await GET(new NextRequest("https://example.test/api/uniswap?tokenA=eth&tokenB=usdc&chain=Base&version=V3"));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(searchYieldPools).toHaveBeenCalledWith({ tokenA: "ETH", tokenB: "USDC", chain: "Base", version: "V3" });
    expect((await result.json()).matches).toBe(0);
  });
  it("returns an uncached failure without leaking provider errors", async () => {
    vi.mocked(searchYieldPools).mockRejectedValue(new Error("private upstream details"));
    const result = await GET(new NextRequest("https://example.test/api/uniswap?tokenA=ETH&tokenB=USDC"));
    expect(result.status).toBe(502);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(await result.json())).not.toContain("private upstream");
  });
});
