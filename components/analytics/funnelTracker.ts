const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://hunt.data.lisacorp.com"
).replace(/\/$/, "");

const SESSION_STORAGE_KEY = "datahunt:analytics:funnel-session:v1";
const ATTRIBUTION_SOURCES = new Set([
  "google",
  "reddit",
  "x",
  "threads",
  "product_hunt",
  "uneed",
  "launching_next",
]);
const ATTRIBUTION_MEDIA = new Set(["cpc", "organic", "social", "referral"]);
const CAMPAIGN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+){0,3}$/;

export const funnelEvents = [
  "sheets_view",
  "login_clicked",
  "wallet_missing",
  "wallet_connection_rejected",
  "signature_requested",
  "signature_rejected",
  "login_succeeded",
  "login_failed",
  "table_loaded",
  "formula_copied",
] as const;

export type FunnelEvent = (typeof funnelEvents)[number];

type Attribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

type FunnelPayload = Attribution & {
  session_id: string;
  event: FunnelEvent;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function normalizedValue(value: string | null) {
  if (!value) return null;
  return value.trim().toLowerCase() || null;
}

export function attributionFromSearch(search: string): Attribution {
  const params = new URLSearchParams(search);
  const source = normalizedValue(params.get("utm_source"));
  const medium = normalizedValue(params.get("utm_medium"));
  const validPair =
    source !== null &&
    medium !== null &&
    ATTRIBUTION_SOURCES.has(source) &&
    ATTRIBUTION_MEDIA.has(medium);
  const campaign = normalizedValue(params.get("utm_campaign"));
  return {
    utm_source: validPair ? source : null,
    utm_medium: validPair ? medium : null,
    utm_campaign:
      validPair && source === "google" && medium === "cpc" && campaign &&
      campaign.length <= 32 && CAMPAIGN_PATTERN.test(campaign)
        ? campaign
        : null,
  };
}

export function createUuidV4(randomValues: Uint8Array) {
  if (randomValues.length < 16) throw new Error("Expected 16 random bytes");
  const bytes = randomValues.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function getOrCreateFunnelSession(
  storage: StorageLike,
  makeSession: () => string,
) {
  const existing = storage.getItem(SESSION_STORAGE_KEY);
  if (existing && isUuidV4(existing)) return existing;
  const session = makeSession();
  storage.setItem(SESSION_STORAGE_KEY, session);
  return session;
}

function isUuidV4(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function buildFunnelPayload(
  event: FunnelEvent,
  sessionId: string,
  search: string,
): FunnelPayload {
  return { session_id: sessionId, event, ...attributionFromSearch(search) };
}

function browserSessionId() {
  const randomValues = new Uint8Array(16);
  window.crypto.getRandomValues(randomValues);
  return createUuidV4(randomValues);
}

/** Sends only an anonymous session ID, an allowlisted event, and sanitized UTM values. */
export function trackFunnelEvent(event: FunnelEvent) {
  if (typeof window === "undefined") return;
  try {
    const sessionId = getOrCreateFunnelSession(localStorage, browserSessionId);
    const payload = buildFunnelPayload(event, sessionId, window.location.search);
    void fetch(`${API_URL}/analytics/funnel/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "omit",
      keepalive: true,
      referrerPolicy: "no-referrer",
    }).catch(() => undefined);
  } catch {
    // Analytics is intentionally best-effort and must not affect product flows.
  }
}

export function isUserRejectedWalletRequest(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 4001
  );
}
