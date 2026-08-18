export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://hunt.data.lisacorp.com"
).replace(/\/$/, "");

export const COINBASE_CAPSULE_STORAGE_KEY =
  "datahunt:coinbase:capsule:v1";
export const COINBASE_INTX_CAPSULE_STORAGE_KEY =
  "datahunt:coinbase:intx-capsule:v1";
export const BYBIT_CAPSULE_STORAGE_KEY = "datahunt:bybit:capsule:v1";
export const BINANCE_CAPSULE_STORAGE_KEY = "datahunt:binance:capsule:v1";
export const SHEETS_ACCESS_STORAGE_KEY = "datahunt:sheets:access:v1";

type StoredSheetsAccess = {
  accountId: string;
  token: string;
};

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(base64 + padding));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function activeLoginToken() {
  const token = localStorage.getItem("data_hunt_token") ?? "";
  const payload = jwtPayload(token);
  const expiresAt = typeof payload?.exp === "number" ? payload.exp : 0;
  return token && expiresAt > Date.now() / 1000 ? token : "";
}

function storedSheetsAccess(): StoredSheetsAccess | null {
  try {
    const content = localStorage.getItem(SHEETS_ACCESS_STORAGE_KEY);
    if (!content) return null;
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<StoredSheetsAccess>;
    if (
      typeof candidate.accountId !== "string" ||
      typeof candidate.token !== "string"
    ) {
      return null;
    }
    return { accountId: candidate.accountId, token: candidate.token };
  } catch {
    return null;
  }
}

function responseError(content: string) {
  try {
    const parsed = JSON.parse(content) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (parsed.detail) return JSON.stringify(parsed.detail);
  } catch {
    // The API can return a plain-text error.
  }
  return content || "Unable to authorize Google Sheets access";
}

export async function sheetsAccessToken(loginToken: string) {
  const payload = jwtPayload(loginToken);
  const accountId = typeof payload?.sub === "string" ? payload.sub : "";
  if (!accountId) return "";

  const stored = storedSheetsAccess();
  if (stored?.accountId === accountId) return stored.token;

  const expiresAt = typeof payload?.exp === "number" ? payload.exp : 0;
  if (expiresAt <= Date.now() / 1000) return "";

  const response = await fetch(`${API_BASE_URL}/web3/sheets-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${loginToken}` },
    cache: "no-store",
  });
  const content = await response.text();
  if (!response.ok) throw new Error(responseError(content));
  const result = JSON.parse(content) as {
    access_token?: unknown;
    account_id?: unknown;
  };
  if (
    typeof result.access_token !== "string" ||
    typeof result.account_id !== "string"
  ) {
    throw new Error("The API did not return a Sheets access token.");
  }

  localStorage.setItem(
    SHEETS_ACCESS_STORAGE_KEY,
    JSON.stringify({ accountId: result.account_id, token: result.access_token })
  );
  return result.access_token;
}

export function localCredentials(source: string): Record<string, string> {
  if (source === "coinbase") {
    return {
      capsule: localStorage.getItem(COINBASE_CAPSULE_STORAGE_KEY) ?? "",
      intx_capsule:
        localStorage.getItem(COINBASE_INTX_CAPSULE_STORAGE_KEY) ?? "",
    };
  }
  if (source === "bybit") {
    return {
      capsule: localStorage.getItem(BYBIT_CAPSULE_STORAGE_KEY) ?? "",
    };
  }
  if (source === "binance") {
    return {
      capsule: localStorage.getItem(BINANCE_CAPSULE_STORAGE_KEY) ?? "",
    };
  }
  return {};
}
