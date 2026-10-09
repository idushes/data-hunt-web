import { describe, expect, it, vi } from "vitest";
import { Interface } from "ethers";
import { blockNumber, rpcBatch } from "./rpc";
describe("read-only borrow RPC", () => {
  it("matches reordered responses by ID, keeps failures unknown, and pins the block", async () => {
    const abi = "function rate() view returns(uint256)", iface = new Interface([abi]);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{ id: 1, error: { code: -1 } }, { id: 0, result: iface.encodeFunctionResult("rate", [123]) }])));
    const result = await rpcBatch("https://rpc.example", [{ address: "0x01", abi }, { address: "0x02", abi }], fetcher, "0x123");
    expect(result[0]?.[0]).toBe(BigInt(123)); expect(result[1]).toBeNull();
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body[0].method).toBe("eth_call"); expect(body[0].params[1]).toBe("0x123");
  });
  it("rejects invalid block data and treats malformed contract results as missing", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ result: "latest" })));
    await expect(blockNumber("https://rpc.example", fetcher)).rejects.toThrow("Invalid block");
    const missing = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{ id: 0, result: "0x" }])));
    expect(await rpcBatch("https://rpc.example", [{ address: "0x01", abi: "function rate() view returns(uint256)" }], missing)).toEqual([null]);
  });
});
