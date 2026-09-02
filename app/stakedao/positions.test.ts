import { describe, expect, it, vi } from "vitest";
import { fetchPositions } from "./positions";

const wallet = `0x${"1".repeat(40)}`;
const emptyCsv = "wallet,chain_id,position_id,position_contract,asset_address,name,amount,value_usd\n";
const signal = new AbortController().signal;

describe("Stake DAO position requests", () => {
  it("uses the existing authenticated API without placing credentials in URLs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(emptyCsv, { headers: { "Content-Type": "text/csv" } }));
    const result = await fetchPositions(wallet, "test-login-token", signal, fetcher);
    expect(result).toMatchObject({ wallet, positions: [] });
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toContain(`/stakedao/positions.csv?address=${wallet}&chain_id=1`);
    expect(String(url)).not.toContain("test-login-token");
    expect(options).toMatchObject({ headers: { Authorization: "Bearer test-login-token" }, cache: "no-store", signal });
  });
  it("requires sign-in and a valid address before requesting data", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(fetchPositions(wallet, "", signal, fetcher)).rejects.toThrow("Sign in");
    await expect(fetchPositions("invalid", "token", signal, fetcher)).rejects.toThrow("valid EVM");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 502])("does not treat HTTP %s as an empty wallet", async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("private diagnostic", { status }));
    await expect(fetchPositions(wallet, "token", signal, fetcher)).rejects.toThrow();
  });
  it("rejects non-CSV and network failures", async () => {
    await expect(fetchPositions(wallet, "token", signal, vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { headers: { "Content-Type": "application/json" } })))).rejects.toThrow("unexpected response");
    await expect(fetchPositions(wallet, "token", signal, vi.fn<typeof fetch>().mockRejectedValue(new Error("Network error")))).rejects.toThrow("Network error");
  });
});
