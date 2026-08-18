import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  credentialsFor,
  hasRequiredCredentials,
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
});
