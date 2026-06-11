"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/landing/Header";

const STORAGE_KEY = "data_hunt_gmtrade_wallet";
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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

type GmTradeSummary = {
  total_value_usd: number;
  value_with_apy_usd: number;
  weighted_apy_percent: number | null;
  estimated_daily_usd: number;
  estimated_yearly_usd: number;
  position_count: number;
  updated_at: string;
};

type GmTradeResponse = {
  wallet: string;
  rows: GmTradeRow[];
  summary: GmTradeSummary;
};

type ApiError = {
  error: string;
};

function isValidSolanaAddress(value: string) {
  return SOLANA_ADDRESS_RE.test(value.trim());
}

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

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1 ? 4 : 8,
  });
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 4 : 8,
  });
}

function formatTimestamp(value: string) {
  if (!value) return "-";

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;

  const milliseconds = parsed > 1e12 ? parsed : parsed * 1000;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(milliseconds));
}

function rowTone(value: number | null) {
  if (value === null) return "text-zinc-500";
  if (value < 0) return "text-red-300";
  if (value > 0) return "text-emerald-300";
  return "text-zinc-300";
}

function metricTone(value: number | null) {
  if (value === null) return "text-zinc-200";
  if (value < 0) return "text-red-200";
  return "text-white";
}

export default function GMTradePage() {
  const [wallet, setWallet] = useState("");
  const [data, setData] = useState<GmTradeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const trimmedWallet = wallet.trim();
  const canLoad = trimmedWallet.length > 0 && !loading;

  const loadWalletData = useCallback(async (targetWallet: string) => {
    const normalizedWallet = targetWallet.trim();
    setHasLoaded(true);

    if (!normalizedWallet) {
      setError("Enter a Solana wallet address.");
      setData(null);
      return;
    }

    if (!isValidSolanaAddress(normalizedWallet)) {
      setError("Invalid Solana wallet address.");
      setData(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      localStorage.setItem(STORAGE_KEY, normalizedWallet);

      const response = await fetch(
        `/api/gmtrade?wallet=${encodeURIComponent(normalizedWallet)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as GmTradeResponse | ApiError;

      if (!response.ok) {
        const message =
          "error" in payload && payload.error
            ? payload.error
            : "Failed to load GMTRADE data.";
        throw new Error(message);
      }

      setData(payload as GmTradeResponse);
      setError("");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load GMTRADE data.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedWallet = localStorage.getItem(STORAGE_KEY);
    if (!savedWallet) return;

    setWallet(savedWallet);
    void loadWalletData(savedWallet);
  }, [loadWalletData]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadWalletData(wallet);
  };

  const summaryItems = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: "Total value",
        value: formatUsd(data.summary.total_value_usd),
        tone: "text-white",
      },
      {
        label: "Weighted live APY",
        value: formatPercent(data.summary.weighted_apy_percent),
        tone: metricTone(data.summary.weighted_apy_percent),
      },
      {
        label: "Estimated daily",
        value: formatUsd(data.summary.estimated_daily_usd),
        tone: metricTone(data.summary.estimated_daily_usd),
      },
      {
        label: "Estimated yearly",
        value: formatUsd(data.summary.estimated_yearly_usd),
        tone: metricTone(data.summary.estimated_yearly_usd),
      },
    ];
  }, [data]);

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <section className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              GMTRADE Solana
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
              Live GMTRADE APY
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Real-time GM and GLV positions with annualized yield estimates.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col gap-3 lg:max-w-2xl lg:flex-row"
          >
            <label className="sr-only" htmlFor="gmtrade-wallet">
              Solana wallet
            </label>
            <input
              id="gmtrade-wallet"
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder="Solana wallet address"
              className="min-h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="grid grid-cols-2 gap-3 lg:flex">
              <button
                type="submit"
                disabled={!canLoad}
                className="min-h-11 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Loading" : "Load"}
              </button>
              <button
                type="button"
                disabled={!canLoad || !data}
                onClick={() => void loadWalletData(wallet)}
                className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </form>
        </section>

        {data && (
          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/10 bg-zinc-950/80 p-5"
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  {item.label}
                </p>
                <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </section>
        )}

        {data && (
          <section className="mt-4 flex flex-col gap-2 border-b border-white/10 pb-5 text-sm text-zinc-400 md:flex-row md:items-center md:justify-between">
            <span>
              Wallet <span className="font-mono text-zinc-200">{shortAddress(data.wallet)}</span>
            </span>
            <span>
              Positions {data.summary.position_count} · Source updated{" "}
              <span className="text-zinc-200">
                {formatTimestamp(data.summary.updated_at)}
              </span>
            </span>
          </section>
        )}

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

        {!loading && !data && !error && !hasLoaded && (
          <section className="mt-10 rounded-lg border border-white/10 bg-zinc-950/70 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-white">No wallet selected</p>
            <p className="mt-2 text-sm text-zinc-500">
              Enter a Solana wallet to load GMTRADE positions.
            </p>
          </section>
        )}

        {!loading && data && data.rows.length === 0 && (
          <section className="mt-10 rounded-lg border border-white/10 bg-zinc-950/70 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-white">No GMTRADE positions</p>
            <p className="mt-2 text-sm text-zinc-500">
              This wallet has no active GM or GLV balance.
            </p>
          </section>
        )}

        {!loading && data && data.rows.length > 0 && (
          <section className="mt-8 overflow-hidden rounded-lg border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pool</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">APY</th>
                    <th className="px-4 py-3 font-medium">PnL APY</th>
                    <th className="px-4 py-3 font-medium">Total APY</th>
                    <th className="px-4 py-3 font-medium">Daily</th>
                    <th className="px-4 py-3 font-medium">Yearly</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black">
                  {data.rows.map((row) => (
                    <tr key={`${row.type}-${row.mint}`} className="hover:bg-zinc-950">
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`rounded border px-2 py-1 text-xs font-semibold ${
                              row.type === "GM"
                                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                                : "border-amber-300/30 bg-amber-300/10 text-amber-100"
                            }`}
                          >
                            {row.type}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[280px] truncate font-medium text-white">
                              {row.name}
                            </p>
                            <p className="font-mono text-xs text-zinc-500">
                              {shortAddress(row.mint)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-zinc-200">
                        {formatAmount(row.balance)}
                      </td>
                      <td className="px-4 py-4 font-mono text-zinc-300">
                        {formatPrice(row.price_usd)}
                      </td>
                      <td className="px-4 py-4 font-mono text-white">
                        {formatUsd(row.value_usd)}
                      </td>
                      <td className={`px-4 py-4 font-mono ${rowTone(row.apy_percent)}`}>
                        {formatPercent(row.apy_percent)}
                      </td>
                      <td
                        className={`px-4 py-4 font-mono ${rowTone(
                          row.pnl_apy_percent
                        )}`}
                      >
                        {formatPercent(row.pnl_apy_percent)}
                      </td>
                      <td
                        className={`px-4 py-4 font-mono ${rowTone(
                          row.total_apy_percent
                        )}`}
                      >
                        {formatPercent(row.total_apy_percent)}
                      </td>
                      <td className="px-4 py-4 font-mono text-zinc-200">
                        {formatUsd(row.estimated_daily_usd)}
                      </td>
                      <td className="px-4 py-4 font-mono text-zinc-200">
                        {formatUsd(row.estimated_yearly_usd)}
                      </td>
                      <td className="px-4 py-4 text-zinc-400">
                        {formatTimestamp(row.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
