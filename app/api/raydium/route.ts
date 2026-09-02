import { NextRequest, NextResponse } from "next/server";
import {
  asList,
  asRecord,
  normalizeLiquidityDistribution,
  normalizeLiquidityHistory,
  normalizeRaydiumPool,
  stringValue,
} from "@/app/api/raydium/normalize";
import type { RaydiumPool } from "@/app/raydium/types";

export const dynamic = "force-dynamic";

const RAYDIUM_API_URL = "https://api-v3.raydium.io";
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CURSOR_RE = /^[A-Za-z0-9._~-]{1,256}$/;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const SORT_FIELDS = new Set([
  "liquidity",
  "volume24h",
  "fee24h",
  "apr24h",
  "volume7d",
  "fee7d",
  "apr7d",
  "volume30d",
  "fee30d",
  "apr30d",
]);

class RaydiumSourceError extends Error {
  status: number;
  clientMessage: string;

  constructor(status: number, clientMessage: string, message?: string) {
    super(message ?? clientMessage);
    this.status = status;
    this.clientMessage = clientMessage;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRaydium(
  path: string,
  parameters: Record<string, string>
): Promise<Record<string, unknown>> {
  const url = new URL(path, RAYDIUM_API_URL);
  Object.entries(parameters).forEach(([key, value]) =>
    url.searchParams.set(key, value)
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < 2) {
        await wait(250 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        throw new RaydiumSourceError(
          502,
          "Raydium data source is temporarily unavailable. Try again later.",
          `Raydium returned HTTP ${response.status}`
        );
      }

      const payload = asRecord(await response.json());
      if (payload.success !== true) {
        throw new RaydiumSourceError(
          502,
          stringValue(payload.msg) ||
            "Raydium data source is temporarily unavailable. Try again later."
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof RaydiumSourceError) throw error;
      if (attempt < 2) {
        await wait(250 * (attempt + 1));
        continue;
      }

      throw new RaydiumSourceError(
        502,
        "Raydium data source is temporarily unavailable. Try again later.",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new RaydiumSourceError(
    502,
    "Raydium data source is temporarily unavailable. Try again later."
  );
}

function cacheHeaders() {
  return {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  };
}

function buildSummary(rows: RaydiumPool[]) {
  return {
    poolCount: rows.length,
    concentratedCount: rows.filter((row) => row.type === "Concentrated").length,
    standardCount: rows.filter((row) => row.type === "Standard").length,
    totalTvl: rows.reduce((sum, row) => sum + row.tvl, 0),
    volume24h: rows.reduce((sum, row) => sum + row.day.volume, 0),
  };
}

async function poolDetail(id: string) {
  const detailPayload = await fetchRaydium("/pools/info/ids", { ids: id });
  const pool = normalizeRaydiumPool(asList(detailPayload.data)[0]);

  if (!pool) {
    throw new RaydiumSourceError(404, "Raydium pool not found.");
  }

  const historyPromise = fetchRaydium("/pools/line/liquidity", { id })
    .then((payload) => normalizeLiquidityHistory(payload.data))
    .catch(() => []);
  const distributionPromise =
    pool.type === "Concentrated"
      ? fetchRaydium("/pools/line/position", { id })
          .then((payload) =>
            normalizeLiquidityDistribution(payload.data, pool.price)
          )
          .catch(() => [])
      : Promise.resolve([]);
  const [liquidityHistory, liquidityDistribution] = await Promise.all([
    historyPromise,
    distributionPromise,
  ]);

  return {
    mode: "pool-detail" as const,
    pool,
    liquidityHistory,
    liquidityDistribution,
    fetchedAt: new Date().toISOString(),
  };
}

async function poolList(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const rawSize = Number(search.get("size") ?? 200);
  const size = Number.isFinite(rawSize)
    ? Math.min(250, Math.max(1, Math.trunc(rawSize)))
    : 200;
  const requestedSort = search.get("sortField") ?? "liquidity";
  const sortField = SORT_FIELDS.has(requestedSort)
    ? requestedSort
    : "liquidity";
  const sortType = search.get("sortType") === "asc" ? "asc" : "desc";
  const poolType = search.get("poolType");
  const nextPageId = search.get("nextPageId") ?? "";

  if (nextPageId && !CURSOR_RE.test(nextPageId)) {
    throw new RaydiumSourceError(400, "Invalid Raydium page cursor.");
  }

  const parameters: Record<string, string> = {
    size: String(size),
    sortField,
    sortType,
  };
  if (poolType === "Concentrated" || poolType === "Standard") {
    parameters.poolType = poolType;
  }
  if (nextPageId) parameters.nextPageId = nextPageId;

  const payload = await fetchRaydium("/pools/info/list-v2", parameters);
  const data = asRecord(payload.data);
  const rows = asList(data.data)
    .map(normalizeRaydiumPool)
    .filter((pool): pool is RaydiumPool => pool !== null);
  const cursor = stringValue(data.nextPageId);

  return {
    mode: "pools" as const,
    rows,
    nextPageId: cursor || null,
    fetchedAt: new Date().toISOString(),
    summary: buildSummary(rows),
  };
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";

    if (id && !SOLANA_ADDRESS_RE.test(id)) {
      return NextResponse.json(
        { error: "Invalid Raydium pool address." },
        { status: 400 }
      );
    }

    const response = id ? await poolDetail(id) : await poolList(request);
    return NextResponse.json(response, { headers: cacheHeaders() });
  } catch (error) {
    const status = error instanceof RaydiumSourceError ? error.status : 500;
    const message =
      error instanceof RaydiumSourceError
        ? error.clientMessage
        : "Failed to load Raydium data.";

    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
