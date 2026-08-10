import { describe, expect, it } from "vitest";

import { parseAuthorizedWallets } from "./addresses";

describe("parseAuthorizedWallets", () => {
  it("keeps only unique authorized EVM wallets", () => {
    const address = "0x6272AB4F91e0dF14AcB6a2A311d817381210E339";
    const result = parseAuthorizedWallets([
      { id: 1, address, network: "eth", can_auth: true },
      { id: 2, address: address.toLowerCase(), network: "base", can_auth: true },
      {
        id: 3,
        address: "0x94CE9ae15c739552EeBB8A8746C0CA33c3d369Ce",
        network: "eth",
        can_auth: false,
      },
      { id: 4, address: "not-an-address", network: "eth", can_auth: true },
    ]);

    expect(result).toEqual([
      { id: 2, address: address.toLowerCase(), network: "base" },
    ]);
  });

  it("returns an empty list for an unexpected API response", () => {
    expect(parseAuthorizedWallets({ items: [] })).toEqual([]);
  });
});
