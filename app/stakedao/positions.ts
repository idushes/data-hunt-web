import { API_BASE_URL } from "../../components/sheets/browserAuth";
import { normalizeWallet, parsePositions } from "./model";

export async function fetchPositions(address: string, loginToken: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const wallet = normalizeWallet(address);
  if (!loginToken) throw new Error("Sign in to DataHunt using the button in the header, then load your positions.");
  const url = new URL("stakedao/positions.csv", `${API_BASE_URL}/`);
  url.searchParams.set("address", wallet);
  url.searchParams.set("chain_id", "1");
  const response = await fetcher(url.toString(), { headers: { Authorization: `Bearer ${loginToken}` }, cache: "no-store", signal });
  if (response.status === 401 || response.status === 403) throw new Error("Please sign in to DataHunt again before loading positions.");
  if (!response.ok) throw new Error("Positions could not be loaded. Please try again shortly.");
  if (!response.headers.get("content-type")?.includes("text/csv")) throw new Error("The positions API returned an unexpected response.");
  return { wallet, positions: parsePositions(await response.text(), wallet), retrievedAt: new Date().toISOString() };
}
