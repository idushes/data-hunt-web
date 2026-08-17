import { describe, expect, it, vi } from "vitest";

import {
  GOOGLE_ADS_REGISTRATION_DESTINATION,
  reportGoogleAdsRegistration,
} from "./googleAdsConversion";

describe("Google Ads registration conversion", () => {
  it("does nothing until the Google tag is available", () => {
    expect(reportGoogleAdsRegistration(undefined)).toBe(false);
  });

  it("sends only the configured conversion destination", () => {
    const gtag = vi.fn();

    expect(reportGoogleAdsRegistration(gtag)).toBe(true);
    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: GOOGLE_ADS_REGISTRATION_DESTINATION,
    });
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(
      /wallet|address|token|account/i,
    );
  });
});
