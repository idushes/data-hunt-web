import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GRAPHQL_ENDPOINT =
  "https://gmx-solana-sqd.squids.live/gmx-solana-base:prod/api/graphql";
const SOLANA_RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PERFORMANCE_PERIODS = [1, 7, 30, 90] as const;
const HISTORY_LIMIT = 370;

type GraphQLData = Record<string, unknown>;
type PoolType = "GM" | "GLV";
type PeriodDays = (typeof PERFORMANCE_PERIODS)[number];
type PeriodKey = "1d" | "7d" | "30d" | "90d";

type GmUser = {
  marketToken: string;
  balance: string;
  timestamp: string;
};

type GlvUser = {
  glvToken: string;
  balance: string;
  timestamp: string;
};

type MarketInfo = {
  id: string;
  name: string;
  longTokenMint: string;
  shortTokenMint: string;
  indexTokenMint: string;
};

type GmInfo = {
  id: string;
  gmPriceNow: string;
  gmPrice7d: string;
  supply: string;
  apy: string;
  pnlApy: string;
  timestamp: string;
};

type GlvInfo = {
  id: string;
  glvPriceNow: string;
  glvPrice7d: string;
  supply: string;
  apy: string;
  timestamp: string;
};

type PricePoint = {
  timestamp: string;
  price_usd: number;
};

type PeriodReturns = Record<PeriodKey, number | null>;

type PoolPerformanceRow = {
  type: PoolType;
  mint: string;
  name: string;
  price_usd: number;
  supply: number;
  liquidity_usd: number;
  period_returns: PeriodReturns;
  long_token_mint: string;
  short_token_mint: string;
  index_token_mint: string;
  updated_at: string;
};

type GmTradeRow = {
  type: "GM" | "GLV";
  mint: string;
  name: string;
  balance: number;
  price_usd: number;
  value_usd: number;
  apy_percent: number | null;
  pnl_apy_percent: number | null;
  total_apy_percent: number | null;
  estimated_daily_usd: number | null;
  estimated_yearly_usd: number | null;
  long_token_mint: string;
  short_token_mint: string;
  index_token_mint: string;
  updated_at: string;
};

class SourceError extends Error {
  status: number;
  clientMessage: string;

  constructor(status: number, clientMessage: string, message?: string) {
    super(message ?? clientMessage);
    this.status = status;
    this.clientMessage = clientMessage;
  }
}

const sourceUnavailableMessage =
  "GMTRADE data source is temporarily unavailable. Try again later.";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function quoteGraphQLString(value: string) {
  return JSON.stringify(value);
}

function quoteGraphQLList(values: string[]) {
  return values.map(quoteGraphQLString).join(",");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item) => Object.keys(item).length > 0)
    : [];
}

function stringField(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function decimalFromScale(raw: string, scale: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return value / scale;
}

function priceFromRaw(raw: string) {
  return decimalFromScale(raw, 1e11);
}

function supplyFromRaw(raw: string) {
  return decimalFromScale(raw, 1e9);
}

function roundTo(value: number, digits: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function normalizeApyPercent(raw: string): number | null {
  if (!raw) return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  const absolute = Math.abs(value);
  if (absolute === 0) return 0;

  // GMX protocol APY values are commonly emitted as fixed-point fractions.
  if (absolute >= 1e20) {
    return value / 1e28;
  }

  if (absolute <= 1) {
    return value * 100;
  }

  return value;
}

function estimateYearly(valueUsd: number, apyPercent: number | null) {
  if (apyPercent === null) return null;
  return valueUsd * (apyPercent / 100);
}

function estimateDaily(yearlyUsd: number) {
  return yearlyUsd / 365;
}

function combineApy(apy: number | null, pnlApy: number | null) {
  if (apy === null && pnlApy === null) return null;
  return (apy ?? 0) + (pnlApy ?? 0);
}

function periodKey(days: PeriodDays): PeriodKey {
  return `${days}d` as PeriodKey;
}

function utcDateKey(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function percentChange(current: number, previous: number | null | undefined) {
  if (!Number.isFinite(current) || !previous || previous <= 0) return null;
  return roundTo((current / previous - 1) * 100, 4);
}

function emptyPeriodReturns(): PeriodReturns {
  return { "1d": null, "7d": null, "30d": null, "90d": null };
}

function latestTimestamp(...values: string[]) {
  return values.find((value) => value.trim().length > 0) ?? "";
}

async function queryGraphQL(query: string): Promise<GraphQLData> {
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
        cache: "no-store",
      });

      lastStatus = response.status;

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < 2) {
        await wait(300 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        throw new SourceError(
          502,
          sourceUnavailableMessage,
          `GMTRADE GraphQL returned HTTP ${response.status}`
        );
      }

      const payload = asRecord(await response.json());
      const errors = payload.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const firstError = asRecord(errors[0]);
        const message = stringField(firstError, "message") || sourceUnavailableMessage;
        throw new SourceError(502, message);
      }

      const data = asRecord(payload.data);
      if (Object.keys(data).length === 0) {
        throw new SourceError(502, sourceUnavailableMessage);
      }

      return data;
    } catch (error) {
      if (error instanceof SourceError) {
        throw error;
      }

      if (attempt < 2) {
        await wait(300 * (attempt + 1));
        continue;
      }

      const reason =
        error instanceof Error ? ` ${error.message}` : lastStatus ? ` HTTP ${lastStatus}` : "";
      throw new SourceError(502, sourceUnavailableMessage, reason.trim());
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new SourceError(502, sourceUnavailableMessage);
}

async function fetchGmUsers(wallet: string): Promise<GmUser[]> {
  const data = await queryGraphQL(
    `{ marketGmUsers(where:{owner_eq:${quoteGraphQLString(
      wallet
    )}}) { marketToken balance timestamp } }`
  );

  return asList(data.marketGmUsers).map((item) => ({
    marketToken: stringField(item, "marketToken"),
    balance: stringField(item, "balance"),
    timestamp: stringField(item, "timestamp"),
  }));
}

async function fetchGlvUsers(wallet: string): Promise<GlvUser[]> {
  const data = await queryGraphQL(
    `{ glvUsers(where:{owner_eq:${quoteGraphQLString(
      wallet
    )}}) { glvToken balance timestamp } }`
  );

  return asList(data.glvUsers).map((item) => ({
    glvToken: stringField(item, "glvToken"),
    balance: stringField(item, "balance"),
    timestamp: stringField(item, "timestamp"),
  }));
}

async function fetchMarketInfos(mints: string[]): Promise<Record<string, MarketInfo>> {
  if (mints.length === 0) return {};

  const data = await queryGraphQL(
    `{ marketInfos(where:{id_in:[${quoteGraphQLList(
      mints
    )}]}) { id name longTokenMint shortTokenMint indexTokenMint } }`
  );

  return Object.fromEntries(
    asList(data.marketInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        name: stringField(item, "name"),
        longTokenMint: stringField(item, "longTokenMint"),
        shortTokenMint: stringField(item, "shortTokenMint"),
        indexTokenMint: stringField(item, "indexTokenMint"),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );
}

async function fetchAllMarketInfos(): Promise<Record<string, MarketInfo>> {
  const data = await queryGraphQL(
    "{ marketInfos(limit:500) { id name longTokenMint shortTokenMint indexTokenMint } }"
  );

  return Object.fromEntries(
    asList(data.marketInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        name: stringField(item, "name"),
        longTokenMint: stringField(item, "longTokenMint"),
        shortTokenMint: stringField(item, "shortTokenMint"),
        indexTokenMint: stringField(item, "indexTokenMint"),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );
}

async function fetchGmInfos(mints: string[]): Promise<Record<string, GmInfo>> {
  if (mints.length === 0) return {};

  const data = await queryGraphQL(
    `{ marketGmInfos(where:{id_in:[${quoteGraphQLList(
      mints
    )}]}) { id gmPriceNow gmPrice7d supply apy pnlApy timestamp } }`
  );

  return Object.fromEntries(
    asList(data.marketGmInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        gmPriceNow: stringField(item, "gmPriceNow"),
        gmPrice7d: stringField(item, "gmPrice7d"),
        supply: stringField(item, "supply"),
        apy: stringField(item, "apy"),
        pnlApy: stringField(item, "pnlApy"),
        timestamp: stringField(item, "timestamp"),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );
}

async function fetchAllGmInfos(): Promise<Record<string, GmInfo>> {
  const data = await queryGraphQL(
    "{ marketGmInfos(limit:500) { id gmPriceNow gmPrice7d supply apy pnlApy timestamp } }"
  );

  return Object.fromEntries(
    asList(data.marketGmInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        gmPriceNow: stringField(item, "gmPriceNow"),
        gmPrice7d: stringField(item, "gmPrice7d"),
        supply: stringField(item, "supply"),
        apy: stringField(item, "apy"),
        pnlApy: stringField(item, "pnlApy"),
        timestamp: stringField(item, "timestamp"),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );
}

async function fetchGlvInfos(mints: string[]): Promise<Record<string, GlvInfo>> {
  if (mints.length === 0) return {};

  const data = await queryGraphQL(
    `{ glvInfos(where:{id_in:[${quoteGraphQLList(
      mints
    )}]}) { id glvPriceNow glvPrice7d supply apy timestamp } }`
  );

  return Object.fromEntries(
    asList(data.glvInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        glvPriceNow: stringField(item, "glvPriceNow"),
        glvPrice7d: stringField(item, "glvPrice7d"),
        supply: stringField(item, "supply"),
        apy: stringField(item, "apy"),
        timestamp: stringField(item, "timestamp"),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );
}

async function fetchAllGlvInfos(): Promise<Record<string, GlvInfo>> {
  const data = await queryGraphQL(
    "{ glvInfos(limit:100) { id glvPriceNow glvPrice7d supply apy timestamp } }"
  );

  return Object.fromEntries(
    asList(data.glvInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        glvPriceNow: stringField(item, "glvPriceNow"),
        glvPrice7d: stringField(item, "glvPrice7d"),
        supply: stringField(item, "supply"),
        apy: stringField(item, "apy"),
        timestamp: stringField(item, "timestamp"),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function optional<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

async function fetchAssetName(mint: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(SOLANA_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: mint },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return "";
    const payload = asRecord(await response.json());
    const result = asRecord(payload.result);
    const content = asRecord(result.content);
    const metadata = asRecord(content.metadata);
    return stringField(metadata, "name");
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAssetNames(mints: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    unique(mints).map(async (mint) => [mint, await fetchAssetName(mint)] as const)
  );
  return Object.fromEntries(entries.filter(([, name]) => name));
}

function periodDateMap() {
  return new Map(
    PERFORMANCE_PERIODS.map((days) => [utcDateKey(days), days] as const)
  );
}

function historicalIds(mints: string[]) {
  const dates = PERFORMANCE_PERIODS.map(utcDateKey);
  return mints.flatMap((mint) => dates.map((date) => `${mint}_${date}`));
}

async function fetchPeriodPrices(
  gmMints: string[],
  glvMints: string[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  const dates = periodDateMap();
  const gmIds = historicalIds(gmMints);
  const glvIds = historicalIds(glvMints);

  const [gmData, glvData] = await Promise.all([
    gmIds.length > 0
      ? optional(
          () =>
            queryGraphQL(
              `{ marketGmPriceDailies(where:{id_in:[${quoteGraphQLList(
                gmIds
              )}]}, limit:${gmIds.length}) { id marketToken gmPriceNow timestamp } }`
            ),
          {} as GraphQLData
        )
      : Promise.resolve({} as GraphQLData),
    glvIds.length > 0
      ? optional(
          () =>
            queryGraphQL(
              `{ glvPriceDailies(where:{id_in:[${quoteGraphQLList(
                glvIds
              )}]}, limit:${glvIds.length}) { id glvToken glvPriceNow timestamp } }`
            ),
          {} as GraphQLData
        )
      : Promise.resolve({} as GraphQLData),
  ]);

  for (const item of asList(gmData.marketGmPriceDailies)) {
    const id = stringField(item, "id");
    const date = id.slice(-10);
    const days = dates.get(date);
    const mint = stringField(item, "marketToken");
    if (!days || !mint) continue;
    priceMap.set(`GM:${mint}:${days}`, priceFromRaw(stringField(item, "gmPriceNow")));
  }

  for (const item of asList(glvData.glvPriceDailies)) {
    const id = stringField(item, "id");
    const date = id.slice(-10);
    const days = dates.get(date);
    const mint = stringField(item, "glvToken");
    if (!days || !mint) continue;
    priceMap.set(`GLV:${mint}:${days}`, priceFromRaw(stringField(item, "glvPriceNow")));
  }

  return priceMap;
}

function buildReturns(
  type: PoolType,
  mint: string,
  currentPrice: number,
  periodPrices: Map<string, number>,
  fallback7dPrice: number
): PeriodReturns {
  const returns = emptyPeriodReturns();

  for (const days of PERFORMANCE_PERIODS) {
    const previousPrice =
      periodPrices.get(`${type}:${mint}:${days}`) ||
      (days === 7 ? fallback7dPrice : 0);
    returns[periodKey(days)] = percentChange(currentPrice, previousPrice);
  }

  return returns;
}

async function fetchDailyHistory(
  type: PoolType,
  mint: string
): Promise<PricePoint[]> {
  const data =
    type === "GM"
      ? await queryGraphQL(
          `{ marketGmPriceDailies(where:{marketToken_eq:${quoteGraphQLString(
            mint
          )}}, orderBy:timestamp_DESC, limit:${HISTORY_LIMIT}) { gmPriceNow timestamp } }`
        )
      : await queryGraphQL(
          `{ glvPriceDailies(where:{glvToken_eq:${quoteGraphQLString(
            mint
          )}}, orderBy:timestamp_DESC, limit:${HISTORY_LIMIT}) { glvPriceNow timestamp } }`
        );

  const source =
    type === "GM" ? data.marketGmPriceDailies : data.glvPriceDailies;
  const priceKey = type === "GM" ? "gmPriceNow" : "glvPriceNow";

  return asList(source)
    .map((item) => ({
      timestamp: stringField(item, "timestamp"),
      price_usd: roundTo(priceFromRaw(stringField(item, priceKey)), 9),
    }))
    .filter((item) => item.timestamp && item.price_usd > 0)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function positiveGmUsers(users: GmUser[]) {
  return users.filter((user) => decimalFromScale(user.balance, 1e9) > 0);
}

function positiveGlvUsers(users: GlvUser[]) {
  return users.filter((user) => decimalFromScale(user.balance, 1e9) > 0);
}

function buildGmPoolRows(
  gmInfos: Record<string, GmInfo>,
  markets: Record<string, MarketInfo>,
  periodPrices: Map<string, number>
): PoolPerformanceRow[] {
  return Object.values(gmInfos)
    .map((info) => {
      const priceUsd = priceFromRaw(info.gmPriceNow);
      const supply = supplyFromRaw(info.supply);
      const market = markets[info.id];

      return {
        type: "GM" as const,
        mint: info.id,
        name: market?.name || info.id,
        price_usd: roundTo(priceUsd, 9),
        supply: roundTo(supply, 6),
        liquidity_usd: roundTo(priceUsd * supply, 2),
        period_returns: buildReturns(
          "GM",
          info.id,
          priceUsd,
          periodPrices,
          priceFromRaw(info.gmPrice7d)
        ),
        long_token_mint: market?.longTokenMint ?? "",
        short_token_mint: market?.shortTokenMint ?? "",
        index_token_mint: market?.indexTokenMint ?? "",
        updated_at: info.timestamp,
      };
    })
    .filter((row) => row.price_usd > 0);
}

function buildGlvPoolRows(
  glvInfos: Record<string, GlvInfo>,
  glvNames: Record<string, string>,
  periodPrices: Map<string, number>
): PoolPerformanceRow[] {
  return Object.values(glvInfos)
    .map((info) => {
      const priceUsd = priceFromRaw(info.glvPriceNow);
      const supply = supplyFromRaw(info.supply);

      return {
        type: "GLV" as const,
        mint: info.id,
        name: glvNames[info.id] || info.id,
        price_usd: roundTo(priceUsd, 9),
        supply: roundTo(supply, 6),
        liquidity_usd: roundTo(priceUsd * supply, 2),
        period_returns: buildReturns(
          "GLV",
          info.id,
          priceUsd,
          periodPrices,
          priceFromRaw(info.glvPrice7d)
        ),
        long_token_mint: "",
        short_token_mint: "",
        index_token_mint: "",
        updated_at: info.timestamp,
      };
    })
    .filter((row) => row.price_usd > 0);
}

function weightedReturn(rows: PoolPerformanceRow[], key: PeriodKey) {
  const rowsWithReturn = rows.filter(
    (row) => row.period_returns[key] !== null && row.liquidity_usd > 0
  );
  const liquidity = rowsWithReturn.reduce(
    (sum, row) => sum + row.liquidity_usd,
    0
  );

  if (liquidity <= 0) return null;

  return roundTo(
    rowsWithReturn.reduce(
      (sum, row) => sum + row.liquidity_usd * (row.period_returns[key] ?? 0),
      0
    ) / liquidity,
    4
  );
}

function bestReturn(rows: PoolPerformanceRow[], key: PeriodKey) {
  const values = rows
    .map((row) => row.period_returns[key])
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  return roundTo(Math.max(...values), 4);
}

function buildPoolsSummary(rows: PoolPerformanceRow[]) {
  const totalLiquidity = rows.reduce((sum, row) => sum + row.liquidity_usd, 0);

  return {
    pool_count: rows.length,
    gm_count: rows.filter((row) => row.type === "GM").length,
    glv_count: rows.filter((row) => row.type === "GLV").length,
    total_liquidity_usd: roundTo(totalLiquidity, 2),
    weighted_returns: {
      "1d": weightedReturn(rows, "1d"),
      "7d": weightedReturn(rows, "7d"),
      "30d": weightedReturn(rows, "30d"),
      "90d": weightedReturn(rows, "90d"),
    },
    best_returns: {
      "1d": bestReturn(rows, "1d"),
      "7d": bestReturn(rows, "7d"),
      "30d": bestReturn(rows, "30d"),
      "90d": bestReturn(rows, "90d"),
    },
    updated_at:
      rows
        .map((row) => row.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? "",
  };
}

async function buildAllPoolsResponse() {
  const [markets, gmInfos, glvInfos] = await Promise.all([
    optional(() => fetchAllMarketInfos(), {} as Record<string, MarketInfo>),
    optional(() => fetchAllGmInfos(), {} as Record<string, GmInfo>),
    optional(() => fetchAllGlvInfos(), {} as Record<string, GlvInfo>),
  ]);

  const gmMints = Object.keys(gmInfos);
  const glvMints = Object.keys(glvInfos);

  if (gmMints.length === 0 && glvMints.length === 0) {
    throw new SourceError(502, sourceUnavailableMessage);
  }

  const [periodPrices, glvNames] = await Promise.all([
    fetchPeriodPrices(gmMints, glvMints),
    optional(() => fetchAssetNames(glvMints), {} as Record<string, string>),
  ]);

  const rows = [
    ...buildGmPoolRows(gmInfos, markets, periodPrices),
    ...buildGlvPoolRows(glvInfos, glvNames, periodPrices),
  ].sort((a, b) => {
    const bReturn = b.period_returns["30d"] ?? b.period_returns["7d"] ?? -Infinity;
    const aReturn = a.period_returns["30d"] ?? a.period_returns["7d"] ?? -Infinity;
    return bReturn - aReturn || b.liquidity_usd - a.liquidity_usd;
  });

  return {
    mode: "pools",
    periods: PERFORMANCE_PERIODS.map(periodKey),
    rows,
    summary: buildPoolsSummary(rows),
  };
}

function priceAtOrBefore(points: PricePoint[], daysAgo: PeriodDays) {
  const target = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  const eligible = points.filter((point) => {
    const time = Date.parse(point.timestamp);
    return Number.isFinite(time) && time <= target;
  });
  return eligible.at(-1)?.price_usd ?? null;
}

function returnsFromHistory(currentPrice: number, points: PricePoint[]) {
  const returns = emptyPeriodReturns();

  for (const days of PERFORMANCE_PERIODS) {
    returns[periodKey(days)] = percentChange(
      currentPrice,
      priceAtOrBefore(points, days)
    );
  }

  return returns;
}

function appendCurrentPoint(
  history: PricePoint[],
  currentPrice: number,
  timestamp: string
) {
  if (!timestamp || currentPrice <= 0) return history;

  const last = history.at(-1);
  if (last?.timestamp === timestamp) return history;

  return [
    ...history,
    { timestamp, price_usd: roundTo(currentPrice, 9) },
  ].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

async function buildPoolDetailResponse(type: PoolType, mint: string) {
  if (type === "GM") {
    const [infos, markets, history] = await Promise.all([
      fetchGmInfos([mint]),
      fetchMarketInfos([mint]),
      fetchDailyHistory(type, mint),
    ]);
    const info = infos[mint];

    if (!info) {
      throw new SourceError(404, "GM pool not found");
    }

    const priceUsd = priceFromRaw(info.gmPriceNow);
    const fullHistory = appendCurrentPoint(history, priceUsd, info.timestamp);
    const market = markets[mint];

    return {
      mode: "pool-detail",
      type,
      mint,
      name: market?.name || mint,
      price_usd: roundTo(priceUsd, 9),
      supply: roundTo(supplyFromRaw(info.supply), 6),
      liquidity_usd: roundTo(priceUsd * supplyFromRaw(info.supply), 2),
      period_returns: returnsFromHistory(priceUsd, fullHistory),
      long_token_mint: market?.longTokenMint ?? "",
      short_token_mint: market?.shortTokenMint ?? "",
      index_token_mint: market?.indexTokenMint ?? "",
      updated_at: info.timestamp,
      history: fullHistory,
    };
  }

  const [infos, names, history] = await Promise.all([
    fetchGlvInfos([mint]),
    optional(() => fetchAssetNames([mint]), {} as Record<string, string>),
    fetchDailyHistory(type, mint),
  ]);
  const info = infos[mint];

  if (!info) {
    throw new SourceError(404, "GLV pool not found");
  }

  const priceUsd = priceFromRaw(info.glvPriceNow);
  const fullHistory = appendCurrentPoint(history, priceUsd, info.timestamp);

  return {
    mode: "pool-detail",
    type,
    mint,
    name: names[mint] || mint,
    price_usd: roundTo(priceUsd, 9),
    supply: roundTo(supplyFromRaw(info.supply), 6),
    liquidity_usd: roundTo(priceUsd * supplyFromRaw(info.supply), 2),
    period_returns: returnsFromHistory(priceUsd, fullHistory),
    long_token_mint: "",
    short_token_mint: "",
    index_token_mint: "",
    updated_at: info.timestamp,
    history: fullHistory,
  };
}

function buildGmRows(
  users: GmUser[],
  markets: Record<string, MarketInfo>,
  gmInfos: Record<string, GmInfo>
): GmTradeRow[] {
  return users.map((user) => {
    const mint = user.marketToken;
    const market = markets[mint];
    const gmInfo = gmInfos[mint];
    const balance = decimalFromScale(user.balance, 1e9);
    const priceUsd = decimalFromScale(gmInfo?.gmPriceNow ?? "", 1e11);
    const valueUsd = balance * priceUsd;
    const apy = normalizeApyPercent(gmInfo?.apy ?? "");
    const pnlApy = normalizeApyPercent(gmInfo?.pnlApy ?? "");
    const totalApy = combineApy(apy, pnlApy);
    const yearlyUsd = estimateYearly(valueUsd, totalApy);

    return {
      type: "GM",
      mint,
      name: market?.name || mint,
      balance: roundTo(balance, 9),
      price_usd: roundTo(priceUsd, 9),
      value_usd: roundTo(valueUsd, 2),
      apy_percent: apy === null ? null : roundTo(apy, 4),
      pnl_apy_percent: pnlApy === null ? null : roundTo(pnlApy, 4),
      total_apy_percent: totalApy === null ? null : roundTo(totalApy, 4),
      estimated_daily_usd:
        yearlyUsd === null ? null : roundTo(estimateDaily(yearlyUsd), 2),
      estimated_yearly_usd: yearlyUsd === null ? null : roundTo(yearlyUsd, 2),
      long_token_mint: market?.longTokenMint ?? "",
      short_token_mint: market?.shortTokenMint ?? "",
      index_token_mint: market?.indexTokenMint ?? "",
      updated_at: latestTimestamp(gmInfo?.timestamp ?? "", user.timestamp),
    };
  });
}

function buildGlvRows(
  users: GlvUser[],
  glvInfos: Record<string, GlvInfo>
): GmTradeRow[] {
  return users.map((user) => {
    const mint = user.glvToken;
    const glvInfo = glvInfos[mint];
    const balance = decimalFromScale(user.balance, 1e9);
    const priceUsd = decimalFromScale(glvInfo?.glvPriceNow ?? "", 1e11);
    const valueUsd = balance * priceUsd;
    const apy = normalizeApyPercent(glvInfo?.apy ?? "");
    const yearlyUsd = estimateYearly(valueUsd, apy);

    return {
      type: "GLV",
      mint,
      name: mint,
      balance: roundTo(balance, 9),
      price_usd: roundTo(priceUsd, 9),
      value_usd: roundTo(valueUsd, 2),
      apy_percent: apy === null ? null : roundTo(apy, 4),
      pnl_apy_percent: null,
      total_apy_percent: apy === null ? null : roundTo(apy, 4),
      estimated_daily_usd:
        yearlyUsd === null ? null : roundTo(estimateDaily(yearlyUsd), 2),
      estimated_yearly_usd: yearlyUsd === null ? null : roundTo(yearlyUsd, 2),
      long_token_mint: "",
      short_token_mint: "",
      index_token_mint: "",
      updated_at: latestTimestamp(glvInfo?.timestamp ?? "", user.timestamp),
    };
  });
}

function buildSummary(rows: GmTradeRow[]) {
  const totalValueUsd = rows.reduce((sum, row) => sum + row.value_usd, 0);
  const rowsWithApy = rows.filter((row) => row.total_apy_percent !== null);
  const valueWithApy = rowsWithApy.reduce((sum, row) => sum + row.value_usd, 0);
  const estimatedYearlyUsd = rowsWithApy.reduce(
    (sum, row) => sum + (row.estimated_yearly_usd ?? 0),
    0
  );
  const weightedApy =
    valueWithApy > 0
      ? rowsWithApy.reduce(
          (sum, row) => sum + row.value_usd * (row.total_apy_percent ?? 0),
          0
        ) / valueWithApy
      : null;

  return {
    total_value_usd: roundTo(totalValueUsd, 2),
    value_with_apy_usd: roundTo(valueWithApy, 2),
    weighted_apy_percent: weightedApy === null ? null : roundTo(weightedApy, 4),
    estimated_daily_usd: roundTo(estimatedYearlyUsd / 365, 2),
    estimated_yearly_usd: roundTo(estimatedYearlyUsd, 2),
    position_count: rows.length,
    updated_at:
      rows
        .map((row) => row.updated_at)
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a))[0] ?? "",
  };
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet")?.trim() ?? "";
  const typeParam = request.nextUrl.searchParams.get("type")?.trim().toUpperCase();
  const mint = request.nextUrl.searchParams.get("mint")?.trim() ?? "";

  try {
    if (typeParam && mint) {
      if (typeParam !== "GM" && typeParam !== "GLV") {
        return NextResponse.json(
          { error: "type must be GM or GLV" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        await buildPoolDetailResponse(typeParam as PoolType, mint)
      );
    }

    if (!wallet) {
      return NextResponse.json(await buildAllPoolsResponse());
    }

    if (!SOLANA_ADDRESS_RE.test(wallet)) {
      return NextResponse.json(
        { error: "Invalid Solana wallet address" },
        { status: 400 }
      );
    }

    const [gmUsersRaw, glvUsersRaw] = await Promise.all([
      fetchGmUsers(wallet),
      fetchGlvUsers(wallet),
    ]);

    const gmUsers = positiveGmUsers(gmUsersRaw);
    const glvUsers = positiveGlvUsers(glvUsersRaw);
    const gmMints = unique(gmUsers.map((user) => user.marketToken));
    const glvMints = unique(glvUsers.map((user) => user.glvToken));

    const [markets, gmInfos, glvInfos] = await Promise.all([
      fetchMarketInfos(gmMints),
      fetchGmInfos(gmMints),
      fetchGlvInfos(glvMints),
    ]);

    const rows = [
      ...buildGmRows(gmUsers, markets, gmInfos),
      ...buildGlvRows(glvUsers, glvInfos),
    ].sort((a, b) => b.value_usd - a.value_usd);

    return NextResponse.json({
      wallet,
      rows,
      summary: buildSummary(rows),
    });
  } catch (error) {
    if (error instanceof SourceError) {
      return NextResponse.json(
        { error: error.clientMessage },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load GMTRADE data" },
      { status: 500 }
    );
  }
}
