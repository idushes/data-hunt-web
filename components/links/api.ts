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

function errorMessage(content: string) {
  try {
    const parsed = JSON.parse(content) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    // The API can return a plain-text error.
  }
  return content || "Unable to load copied links";
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
