import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("./source", () => ({ fetchBorrowCatalog: vi.fn() }));
import { GET } from "./route";
import { fetchBorrowCatalog } from "./source";
describe("borrow API", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["chain=Moon", "usd=NaN", "usd=0", "usd=10000001", "bands=3", "bands=51", "bands=4.5", "chain=__proto__"])("rejects invalid query %s before contacting providers", async query => {
    const response = await GET(new NextRequest(`https://test.example/api/borrow?${query}`));
    expect(response.status).toBe(400); expect(fetchBorrowCatalog).not.toHaveBeenCalled();
  });
  it("passes deposit size and bands through the cache key", async () => {
    vi.mocked(fetchBorrowCatalog).mockResolvedValue({ markets: [], coverage: [], retrievedAt: "2026-10-09T00:00:00Z", collateralUsd: 25000, bands: 12 });
    const response = await GET(new NextRequest("https://test.example/api/borrow?chain=Arc&usd=25000&bands=12"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchBorrowCatalog).toHaveBeenCalledWith("Arc", 25000, 12);
  });
  it("returns a retryable error without internal provider details", async () => {
    vi.mocked(fetchBorrowCatalog).mockRejectedValue(new Error("private provider detail"));
    const response = await GET(new NextRequest("https://test.example/api/borrow"));
    expect(response.status).toBe(502); expect(JSON.stringify(await response.json())).not.toContain("private provider");
  });
});
