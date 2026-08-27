import { API_BASE_URL } from "../sheets/browserAuth";

export type CopiedValueResource = {
  id: string;
  source: string;
  key: string | null;
  column: string | null;
  parameters: Record<string, string>;
  credential_parameters: string[];
  first_copied_at: number;
  last_copied_at: number;
  copy_count: number;
};

export type CopiedValueResourcesPage = {
  items: CopiedValueResource[];
  total: number;
  limit: number;
  offset: number;
};

export type CachedValuePreview = {
  id: string;
  value: string | null;
  data_updated_at: number | null;
  cache_status: "fresh" | "stale" | "missing";
};

export type CachedValuePreviewsResponse = {
  items: CachedValuePreview[];
};

export type RequestedValueResource = {
  value: string;
  data_updated_at: number | null;
  cache_status: "fresh" | "stale" | null;
};

export class ValueResourceRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ValueResourceRequestError";
    this.status = status;
  }
}

function errorMessage(content: string) {
  try {
    const parsed = JSON.parse(content) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (parsed.detail !== undefined) return JSON.stringify(parsed.detail);
  } catch {
    // The API can return a plain-text error.
  }
  return content || "Unable to load copied links";
}

export async function requestValueResource(
  resourceId: string,
  credentials: Record<string, string>,
  userToken: string,
  fetcher: typeof fetch = fetch
) {
  const url = new URL(`/v/${encodeURIComponent(resourceId)}`, API_BASE_URL);
  for (const [name, value] of Object.entries(credentials)) {
    if (value) url.searchParams.set(name, value);
  }
  if (userToken) url.searchParams.set("auth_token", userToken);

  const response = await fetcher(url, { cache: "no-store" });
  const content = await response.text();
  if (!response.ok) {
    throw new ValueResourceRequestError(
      response.status,
      `HTTP ${response.status}: ${errorMessage(content)}`
    );
  }

  const updatedAtHeader = response.headers.get("x-data-updated-at");
  const updatedAt = updatedAtHeader ? Number(updatedAtHeader) : Number.NaN;
  const cacheHeader = response.headers.get("x-csv-cache")?.toLowerCase();
  return {
    value: content.trim(),
    data_updated_at: Number.isFinite(updatedAt) ? updatedAt : null,
    cache_status:
      cacheHeader === "stale" ? "stale" : cacheHeader ? "fresh" : null,
  } satisfies RequestedValueResource;
}

export function resourceIdFromShortUrl(value: string) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/v\/([A-Za-z0-9_-]{12,22})$/);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

export async function recordCopiedResource(
  shortUrl: string,
  loginToken: string,
  fetcher: typeof fetch = fetch
) {
  const resourceId = resourceIdFromShortUrl(shortUrl);
  if (!resourceId || !loginToken) return null;

  const response = await fetcher(
    `${API_BASE_URL}/value-resources/${encodeURIComponent(resourceId)}/copies`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${loginToken}` },
      cache: "no-store",
    }
  );
  const content = await response.text();
  if (!response.ok) throw new Error(errorMessage(content));
  return JSON.parse(content) as CopiedValueResource;
}

export async function removeCopiedResource(
  resourceId: string,
  loginToken: string,
  fetcher: typeof fetch = fetch
) {
  const response = await fetcher(
    `${API_BASE_URL}/value-resources/${encodeURIComponent(resourceId)}/copies`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${loginToken}` },
      cache: "no-store",
    }
  );
  const content = await response.text();
  if (!response.ok) throw new Error(errorMessage(content));
}

export async function loadCopiedResources(
  loginToken: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  fetcher: typeof fetch = fetch
) {
  const url = new URL("/value-resources/mine", API_BASE_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${loginToken}` },
    cache: "no-store",
  });
  const content = await response.text();
  if (!response.ok) throw new Error(errorMessage(content));
  return JSON.parse(content) as CopiedValueResourcesPage;
}

export async function loadCachedValuePreviews(
  loginToken: string,
  resourceIds: string[],
  credentials: Record<string, Record<string, string>>,
  fetcher: typeof fetch = fetch
) {
  const response = await fetcher(`${API_BASE_URL}/value-resources/previews`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${loginToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resource_ids: resourceIds, credentials }),
    cache: "no-store",
  });
  const content = await response.text();
  if (!response.ok) throw new Error(errorMessage(content));
  return JSON.parse(content) as CachedValuePreviewsResponse;
}
