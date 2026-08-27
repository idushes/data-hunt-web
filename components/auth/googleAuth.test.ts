import { describe, expect, it, vi } from "vitest";

import { exchangeGoogleCredential } from "./googleAuth";

describe("Google authentication API", () => {
  it("exchanges the Google ID credential for a Data Hunt session", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "data-hunt-token",
          token_type: "bearer",
          is_new_account: true,
        }),
        { status: 200 },
      ),
    );

    const result = await exchangeGoogleCredential("google-id-token", fetcher);

    expect(result.response.ok).toBe(true);
    expect(result.data.access_token).toBe("data-hunt-token");
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/web3/google/login"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: "google-id-token" }),
      },
    );
  });
});
