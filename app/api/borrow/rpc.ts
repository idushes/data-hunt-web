import { Interface, type Result } from "ethers";

export type RpcCall = { address: string; abi: string; args?: unknown[] };
export async function rpcBatch(url: string, calls: RpcCall[], fetcher: typeof fetch = fetch, block = "latest"): Promise<(Result | null)[]> {
  if (!calls.length) return [];
  const interfaces = calls.map(call => new Interface([call.abi]));
  const fragments = interfaces.map(iface => iface.fragments[0]);
  const response = await fetcher(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    body: JSON.stringify(calls.map((call, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call", params: [{ to: call.address, data: interfaces[i].encodeFunctionData(fragments[i].format(), call.args ?? []) }, block] }))),
  });
  if (!response.ok) throw new Error("RPC unavailable");
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Invalid RPC response");
  const byId = new Map(payload.map(item => [item.id, item]));
  return calls.map((_, i) => {
    try {
      const value = byId.get(i);
      return value && !value.error && typeof value.result === "string" ? interfaces[i].decodeFunctionResult(fragments[i].format(), value.result) : null;
    } catch { return null; }
  });
}
export async function blockNumber(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000), body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) });
  if (!response.ok) throw new Error("RPC unavailable");
  const value = await response.json();
  if (value.error || typeof value.result !== "string" || !/^0x[0-9a-f]+$/i.test(value.result)) throw new Error("Invalid block");
  return value.result;
}
