import { describe, expect, it, vi } from "vitest";

import {
  loadCachedValuePreviews,
  loadCopiedResources,
  recordCopiedResource,
  removeCopiedResource,
  resourceIdFromShortUrl,
} from "./api";

describe("copied links API", () => {
  it("extracts only valid short resource IDs", () => {
    expect(
      resourceIdFromShortUrl(
        "https://hunt.data.lisacorp.com/v/AbCdEf123456?auth_token=hidden"
      )
    ).toBe("AbCdEf123456");
    expect(resourceIdFromShortUrl("https://example.com/value?key=old")).toBe("");
  });

  it("records a copy without sending URL credentials to the history endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "AbCdEf123456",
          source: "coinbase",
          key: "coinbase:total_balance",
          column: "balance",
          parameters: {},
          credential_parameters: ["capsule"],
          first_copied_at: 1,
          last_copied_at: 1,
          copy_count: 1,
        }),
        { status: 200 }
      )
    );

    await recordCopiedResource(
      "https://hunt.data.lisacorp.com/v/AbCdEf123456?capsule=secret&auth_token=sheets",
      "login-token",
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/\/value-resources\/AbCdEf123456\/copies$/),
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer login-token" },
      })
    );
    expect(fetcher.mock.calls[0]?.[0].toString()).not.toContain("secret");
    expect(fetcher.mock.calls[0]?.[0].toString()).not.toContain("sheets");
  });

  it("loads a private paginated history", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], total: 0, limit: 25, offset: 50 }),
        { status: 200 }
      )
    );

    const result = await loadCopiedResources(
      "login-token",
      { limit: 25, offset: 50 },
      fetcher
    );

    expect(result.total).toBe(0);
    const [url, options] = fetcher.mock.calls[0] ?? [];
    expect(url.toString()).toContain("limit=25");
    expect(url.toString()).toContain("offset=50");
    expect(options).toEqual(
      expect.objectContaining({
        headers: { Authorization: "Bearer login-token" },
      })
    );
  });

  it("removes only the authenticated user's copied link", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await removeCopiedResource("AbCdEf123456", "login-token", fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/\/value-resources\/AbCdEf123456\/copies$/),
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: "Bearer login-token" },
      })
    );
  });

  it("loads cached previews without putting credentials in the URL", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    );

    await loadCachedValuePreviews(
      "login-token",
      ["AbCdEf123456"],
      { binance: { capsule: "encrypted-capsule" } },
      fetcher
    );

    const [url, options] = fetcher.mock.calls[0] ?? [];
    expect(url.toString()).toMatch(/\/value-resources\/previews$/);
    expect(url.toString()).not.toContain("encrypted-capsule");
    expect(options).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer login-token",
          "Content-Type": "application/json",
        },
      })
    );
    expect(JSON.parse(options?.body?.toString() ?? "{}")).toEqual({
      resource_ids: ["AbCdEf123456"],
      credentials: { binance: { capsule: "encrypted-capsule" } },
    });
  });
});
