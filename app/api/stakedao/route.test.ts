import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("./source", () => ({ fetchCatalog: vi.fn() }));
import { fetchCatalog } from "./source";
import { GET } from "./route";

describe("Stake DAO catalogue API", () => {
  it("returns data without another browser/CDN cache", async () => {
    vi.mocked(fetchCatalog).mockResolvedValue({ strategies: [], warnings: [], retrievedAt: "2026-09-02T00:00:00Z" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("returns a clear uncached error on upstream failure", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new Error("private detail"));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("private detail");
  });
});
