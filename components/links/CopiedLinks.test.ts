import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  credentialsFor,
  formatRelativeTime,
  hasRequiredCredentials,
  previewCredentialsFromBrowser,
  requiredCredentialParameters,
  sortCopiedLinks,
} from "./CopiedLinks";
import type { CopiedValueResource } from "./api";

const storage = new Map<string, string>();

const baseItem: CopiedValueResource = {
  id: "AbCdEf123456",
  source: "morpho",
  key: "vault:one",
  column: "supply_usd",
  parameters: {},
  credential_parameters: [],
  first_copied_at: 1,
  last_copied_at: 1,
  copy_count: 1,
};

describe("copied link credentials", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  it("allows public resources without browser credentials", () => {
    expect(hasRequiredCredentials(baseItem)).toBe(true);
  });

  it("restores exchange capsules only from localStorage", () => {
    const item = {
      ...baseItem,
      source: "binance",
      credential_parameters: ["capsule"],
    };
    expect(hasRequiredCredentials(item)).toBe(false);

    storage.set("datahunt:binance:capsule:v1", "encrypted-capsule");

    expect(hasRequiredCredentials(item)).toBe(true);
    expect(credentialsFor(item)).toEqual({ capsule: "encrypted-capsule" });
  });

  it("accepts either locally saved Coinbase capsule", () => {
    const item = {
      ...baseItem,
      source: "coinbase",
      credential_parameters: ["capsule", "intx_capsule"],
    };
    expect(hasRequiredCredentials(item)).toBe(false);

    storage.set("datahunt:coinbase:intx-capsule:v1", "intx-capsule");

    expect(hasRequiredCredentials(item)).toBe(true);
    expect(credentialsFor(item)).toEqual({ intx_capsule: "intx-capsule" });
  });

  it("does not require an optional Lighter token when an account selector is saved", () => {
    const item = {
      ...baseItem,
      source: "lighter",
      parameters: { address: "0x6272ab4f91e0df14acb6a2a311d817381210e339" },
      credential_parameters: ["token"],
    };

    expect(requiredCredentialParameters(item)).toEqual([]);
    expect(hasRequiredCredentials(item)).toBe(true);
    expect(credentialsFor(item)).toEqual({});
  });

  it("still requires a Lighter token when no account selector is saved", () => {
    const item = {
      ...baseItem,
      source: "lighter",
      parameters: { field: "total_asset_value" },
      credential_parameters: ["token"],
    };

    expect(requiredCredentialParameters(item)).toEqual(["token"]);
    expect(hasRequiredCredentials(item)).toBe(false);
  });

  it("collects only locally available credentials for cached previews", () => {
    storage.set("datahunt:binance:capsule:v1", "binance-capsule");
    storage.set("datahunt:coinbase:intx-capsule:v1", "intx-capsule");

    expect(previewCredentialsFromBrowser()).toEqual({
      binance: { capsule: "binance-capsule" },
      coinbase: { intx_capsule: "intx-capsule" },
    });
  });
});

describe("copied link relative time", () => {
  const now = 200_000_000 * 1000;

  it("keeps recent updates compact", () => {
    expect(formatRelativeTime(199_999_980, now)).toBe("just now");
    expect(formatRelativeTime(199_999_700, now)).toBe("5m ago");
    expect(formatRelativeTime(199_992_800, now)).toBe("2h ago");
  });

  it("formats older updates without showing the first copied date", () => {
    expect(formatRelativeTime(199_827_200, now)).toBe("2d ago");
    expect(formatRelativeTime(196_112_000, now)).toBe("1mo ago");
  });
});

describe("copied link sorting", () => {
  const cached = (
    id: string,
    source: string,
    value: string | null,
    dataUpdatedAt: number | null
  ) => ({
    ...baseItem,
    id,
    source,
    value,
    data_updated_at: dataUpdatedAt,
  });

  it("sorts numeric-looking cached values naturally", () => {
    const items = [
      cached("AbCdEf123458", "fluid", "10", 30),
      cached("AbCdEf123457", "aave", "2", 20),
    ];

    expect(sortCopiedLinks(items, { key: "value", direction: "asc" }).map((item) => item.value)).toEqual(["2", "10"]);
  });

  it("keeps missing freshness at the bottom in either direction", () => {
    const items = [
      cached("AbCdEf123456", "morpho", null, null),
      cached("AbCdEf123457", "aave", "2", 20),
      cached("AbCdEf123458", "fluid", "10", 30),
    ];

    expect(sortCopiedLinks(items, { key: "freshness", direction: "desc" }).map((item) => item.id)).toEqual([
      "AbCdEf123458",
      "AbCdEf123457",
      "AbCdEf123456",
    ]);
  });
});
