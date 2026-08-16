import { describe, expect, it } from "vitest";

import {
  attributionFromSearch,
  buildFunnelPayload,
  createUuidV4,
  getOrCreateFunnelSession,
  isUserRejectedWalletRequest,
} from "./funnelTracker";

describe("funnel tracker privacy boundary", () => {
  it("keeps one valid anonymous UUIDv4 session in storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const makeSession = () => createUuidV4(new Uint8Array(16));

    expect(getOrCreateFunnelSession(storage, makeSession)).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
    expect(getOrCreateFunnelSession(storage, () => "unused")).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
  });

  it("allows only sanitized UTM attribution in the payload", () => {
    expect(
      buildFunnelPayload(
        "sheets_view",
        "00000000-0000-4000-8000-000000000000",
        "?utm_source=Google&utm_medium=CPC&utm_campaign=data-hunt-1&gclid=secret&address=0xabc",
      ),
    ).toEqual({
      session_id: "00000000-0000-4000-8000-000000000000",
      event: "sheets_view",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "data-hunt-1",
    });
    expect(attributionFromSearch("?utm_source=reddit&utm_medium=social&utm_campaign=secret")).toEqual({
      utm_source: "reddit",
      utm_medium: "social",
      utm_campaign: null,
    });
    expect(attributionFromSearch("?utm_source=unknown&utm_medium=organic")).toEqual({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    });
  });

  it("classifies only explicit provider rejection code 4001 as a rejection", () => {
    expect(isUserRejectedWalletRequest({ code: 4001 })).toBe(true);
    expect(isUserRejectedWalletRequest({ code: -32603 })).toBe(false);
    expect(isUserRejectedWalletRequest(new Error("rejected"))).toBe(false);
  });
});
