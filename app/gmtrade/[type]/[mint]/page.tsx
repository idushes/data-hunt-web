"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/landing/Header";

type PoolType = "GM" | "GLV";
type PeriodKey = "1d" | "7d" | "30d" | "90d" | "1y";

type PricePoint = {
  timestamp: string;
  price_usd: number;
};

type PoolDetail = {
  mode: "pool-detail";
  type: PoolType;
  mint: string;
  name: string;
  price_usd: number;
  supply: number;
  liquidity_usd: number;
  period_returns: Record<PeriodKey, number | null>;
  long_token_mint: string;
  short_token_mint: string;
  index_token_mint: string;
  updated_at: string;
  history: PricePoint[];
};

type ApiError = {
  error: string;
};

const PERIODS: PeriodKey[] = ["1d", "7d", "30d", "90d", "1y"];

function shortAddress(value: string) {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 4 : 8,
  });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(new Date(parsed));
}

function returnTone(value: number | null) {
  if (value === null) return "text-zinc-500";
  if (value < 0) return "text-red-300";
  if (value > 0) return "text-emerald-300";
  return "text-zinc-300";
}

function poolTypeTone(type: PoolType) {
  return type === "GM"
    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
    : "border-amber-300/30 bg-amber-300/10 text-amber-100";
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19 3 12m0 0 7-7m-7 7h18" />
    </svg>
  );
}

function PriceChart({ points }: { points: PricePoint[] }) {
  const chart = useMemo(() => {
    const validPoints = points.filter(
      (point) => Number.isFinite(Date.parse(point.timestamp)) && point.price_usd > 0
    );

    if (validPoints.length < 2) {
      return null;
    }

    const width = 960;
    const height = 320;
    const padding = 28;
    const times = validPoints.map((point) => Date.parse(point.timestamp));
    const prices = validPoints.map((point) => point.price_usd);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const timeRange = maxTime - minTime || 1;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const polyline = validPoints
      .map((point) => {
        const x =
          padding + ((Date.parse(point.timestamp) - minTime) / timeRange) * innerWidth;
        const y =
          padding + (1 - (point.price_usd - minPrice) / priceRange) * innerHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

    return {
      width,
      height,
      padding,
      polyline,
      minPrice,
      maxPrice,
      start: validPoints[0],
      end: validPoints.at(-1) as PricePoint,
    };
  }, [points]);

  if (!chart) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-white/10 bg-zinc-950 text-sm text-zinc-500">
        Price history is not available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>{formatDate(chart.start.timestamp)}</span>
        <span>
          {formatPrice(chart.minPrice)} - {formatPrice(chart.maxPrice)}
        </span>
        <span>{formatDate(chart.end.timestamp)}</span>
      </div>
      <svg
        className="h-[320px] w-full"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Pool price history chart"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3].map((index) => {
          const y = chart.padding + index * ((chart.height - chart.padding * 2) / 3);
          return (
            <line
              key={index}
              x1={chart.padding}
              x2={chart.width - chart.padding}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          );
        })}
        <polyline
          fill="none"
          points={chart.polyline}
          stroke="#34d399"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export default function GMTradePoolDetailPage() {
  const params = useParams<{ type: string; mint: string }>();
  const type = String(params.type ?? "").toUpperCase();
  const mint = String(params.mint ?? "");
  const [data, setData] = useState<PoolDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPool = useCallback(async () => {
    if (type !== "GM" && type !== "GLV") {
      setError("Unknown pool type.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/gmtrade?type=${encodeURIComponent(type)}&mint=${encodeURIComponent(mint)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PoolDetail | ApiError;

      if (!response.ok) {
        const message =
          "error" in payload && payload.error
            ? payload.error
            : "Failed to load pool chart.";
        throw new Error(message);
      }

      setData(payload as PoolDetail);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load pool chart.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mint, type]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <section className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/gmtrade"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              <BackIcon />
              GMTRADE pools
            </Link>
            <div className="mt-4 flex min-w-0 items-center gap-3">
              <span
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  data ? poolTypeTone(data.type) : "border-zinc-700 text-zinc-400"
                }`}
              >
                {data?.type ?? type}
              </span>
              <h1 className="truncate text-3xl font-bold text-white md:text-4xl">
                {data?.name ?? shortAddress(mint)}
              </h1>
            </div>
            <p className="mt-2 font-mono text-xs text-zinc-500">{mint}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadPool()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading" : "Refresh"}
          </button>
        </section>

        {error && (
          <section className="mt-8 rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </section>
        )}

        {loading && (
          <section className="mt-10 flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          </section>
        )}

        {!loading && data && (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Price
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatPrice(data.price_usd)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Liquidity
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatUsd(data.liquidity_usd)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  30D Return
                </p>
                <p
                  className={`mt-3 text-2xl font-semibold ${returnTone(
                    data.period_returns["30d"]
                  )}`}
                >
                  {formatPercent(data.period_returns["30d"])}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Updated
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {formatTimestamp(data.updated_at)}
                </p>
              </div>
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PERIODS.map((period) => (
                <div
                  key={period}
                  className="rounded-lg border border-white/10 bg-zinc-950/70 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    {period.toUpperCase()}
                  </p>
                  <p
                    className={`mt-2 font-mono text-lg ${returnTone(
                      data.period_returns[period]
                    )}`}
                  >
                    {formatPercent(data.period_returns[period])}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-8">
              <PriceChart points={data.history} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
