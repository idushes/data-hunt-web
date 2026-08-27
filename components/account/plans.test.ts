import { describe, expect, it } from "vitest";

import { ACCOUNT_PLANS } from "./plans";

describe("account plan preview", () => {
  it("presents Free as the usable default plan", () => {
    expect(ACCOUNT_PLANS[0]).toEqual(
      expect.objectContaining({
        id: "free",
        price: "$0",
        requestAllowance: "1,000 data requests / month",
        status: "current",
      })
    );
  });

  it("keeps the unlimited Pro plan unavailable during the pricing test", () => {
    expect(ACCOUNT_PLANS[1]).toEqual(
      expect.objectContaining({
        id: "pro",
        price: "$19",
        requestAllowance: "Unlimited data requests",
        status: "coming_soon",
      })
    );
  });
});
