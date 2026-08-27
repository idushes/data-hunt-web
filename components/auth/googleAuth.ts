export type LoginResponse = {
  access_token?: string;
  detail?: string;
  is_new_account?: boolean;
};

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://hunt.data.lisacorp.com"
).replace(/\/$/, "");

export async function exchangeGoogleCredential(
  credential: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`${API_URL}/web3/google/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const data = (await response.json()) as LoginResponse;
  return { response, data };
}
