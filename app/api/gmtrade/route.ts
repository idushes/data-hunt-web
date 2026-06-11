import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GRAPHQL_ENDPOINT =
  "https://gmx-solana-sqd.squids.live/gmx-solana-base:prod/api/graphql";
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type GraphQLData = Record<string, unknown>;

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
  apy: string;
  pnlApy: string;
  timestamp: string;
};

type GlvInfo = {
  id: string;
  glvPriceNow: string;
  apy: string;
  timestamp: string;
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

async function fetchGmInfos(mints: string[]): Promise<Record<string, GmInfo>> {
  if (mints.length === 0) return {};

  const data = await queryGraphQL(
    `{ marketGmInfos(where:{id_in:[${quoteGraphQLList(
      mints
    )}]}) { id gmPriceNow apy pnlApy timestamp } }`
  );

  return Object.fromEntries(
    asList(data.marketGmInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        gmPriceNow: stringField(item, "gmPriceNow"),
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
    )}]}) { id glvPriceNow apy timestamp } }`
  );

  return Object.fromEntries(
    asList(data.glvInfos)
      .map((item) => ({
        id: stringField(item, "id"),
        glvPriceNow: stringField(item, "glvPriceNow"),
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

function positiveGmUsers(users: GmUser[]) {
  return users.filter((user) => decimalFromScale(user.balance, 1e9) > 0);
}

function positiveGlvUsers(users: GlvUser[]) {
  return users.filter((user) => decimalFromScale(user.balance, 1e9) > 0);
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

  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }

  if (!SOLANA_ADDRESS_RE.test(wallet)) {
    return NextResponse.json(
      { error: "Invalid Solana wallet address" },
      { status: 400 }
    );
  }

  try {
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
