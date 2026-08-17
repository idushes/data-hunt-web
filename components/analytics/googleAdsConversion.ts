export const GOOGLE_ADS_TAG_ID = "AW-10839438803";
export const GOOGLE_ADS_REGISTRATION_DESTINATION =
  "AW-10839438803/MQUZCIOe9-IcENPr0rAo";

export type GoogleTag = (
  command: "event",
  eventName: "conversion",
  parameters: {
    send_to: string;
  },
) => void;

declare global {
  interface Window {
    gtag?: GoogleTag;
  }
}

/** Reports only the registration event. No account, wallet, or token data is sent. */
export function reportGoogleAdsRegistration(gtag: GoogleTag | undefined) {
  if (!gtag) return false;
  gtag("event", "conversion", {
    send_to: GOOGLE_ADS_REGISTRATION_DESTINATION,
  });
  return true;
}

export function trackGoogleAdsRegistration() {
  if (typeof window === "undefined") return false;
  return reportGoogleAdsRegistration(window.gtag);
}
