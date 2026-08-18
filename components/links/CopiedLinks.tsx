"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CopiedValueResource,
  loadCopiedResources,
  recordCopiedResource,
} from "./api";
import { sheetSources } from "../sheets/catalog";
import { buildImportFormula, buildShortValueUrl } from "../sheets/csv";
import {
  API_BASE_URL,
  activeLoginToken,
  localCredentials,
  sheetsAccessToken,
} from "../sheets/browserAuth";

const PAGE_SIZE = 50;

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

export function formatRelativeTime(timestamp: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor(now / 1000) - timestamp);

  if (elapsedSeconds < 60) return "just now";
  if (elapsedSeconds < 60 * 60) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 24 * 60 * 60) {
    return `${Math.floor(elapsedSeconds / (60 * 60))}h ago`;
  }
  if (elapsedSeconds < 30 * 24 * 60 * 60) {
    return `${Math.floor(elapsedSeconds / (24 * 60 * 60))}d ago`;
  }
  if (elapsedSeconds < 365 * 24 * 60 * 60) {
    return `${Math.floor(elapsedSeconds / (30 * 24 * 60 * 60))}mo ago`;
  }
  return `${Math.floor(elapsedSeconds / (365 * 24 * 60 * 60))}y ago`;
}

function shortValue(value: string) {
  if (value.length <= 42) return value;
  return `${value.slice(0, 22)}…${value.slice(-14)}`;
}

export function credentialsFor(item: CopiedValueResource) {
  const available = localCredentials(item.source);
  return Object.fromEntries(
    item.credential_parameters
      .map((name) => [name, available[name] ?? ""])
      .filter(([, value]) => value)
  );
}

export function hasRequiredCredentials(item: CopiedValueResource) {
  if (item.credential_parameters.length === 0) return true;
  const credentials = credentialsFor(item);
  if (item.source === "coinbase") {
    return Boolean(credentials.capsule || credentials.intx_capsule);
  }
  return item.credential_parameters.every((name) => Boolean(credentials[name]));
}

export default function CopiedLinks() {
  const [items, setItems] = useState<CopiedValueResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [copyingId, setCopyingId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [error, setError] = useState("");
  const [separator, setSeparator] = useState<"," | ";">(";");
  const [now, setNow] = useState(() => Date.now());

  const sourceNames = useMemo(
    () => new Map(sheetSources.map((source) => [source.id, source.name])),
    []
  );

  async function loadPage(offset: number, append: boolean) {
    const loginToken = activeLoginToken();
    setIsAuthenticated(Boolean(loginToken));
    if (!loginToken) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const page = await loadCopiedResources(loginToken, {
        limit: PAGE_SIZE,
        offset,
      });
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setTotal(page.total);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load copied links"
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage(0, false);

    function refreshAuth() {
      void loadPage(0, false);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === "data_hunt_token") refreshAuth();
    }

    window.addEventListener("data-hunt-auth", refreshAuth);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("data-hunt-auth", refreshAuth);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  async function copyFormula(item: CopiedValueResource) {
    const loginToken = activeLoginToken();
    if (!loginToken) {
      setIsAuthenticated(false);
      setError("Sign in again to copy this formula.");
      return;
    }
    if (!hasRequiredCredentials(item)) {
      setError(
        `${sourceNames.get(item.source) ?? item.source} needs an access key saved in this browser. Open Sheets helper and add it again.`
      );
      return;
    }

    setCopyingId(item.id);
    setError("");
    try {
      const userToken = await sheetsAccessToken(loginToken);
      const url = buildShortValueUrl({
        apiBaseUrl: API_BASE_URL,
        resourceId: item.id,
        credentials: credentialsFor(item),
        userToken,
      });
      const formula = buildImportFormula({
        url,
        stableUrl: url,
        rows: [["value"]],
        rowIndex: 0,
        columnIndex: 0,
        separator,
        stable: true,
      });
      await navigator.clipboard.writeText(formula);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(""), 1800);
      try {
        const updated = await recordCopiedResource(url, loginToken);
        if (updated) {
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === updated.id ? updated : candidate
            )
          );
        }
      } catch {
        setError("Formula copied, but its history counter could not be updated.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to copy this formula"
      );
    } finally {
      setCopyingId("");
    }
  }

  return (
    <main className="min-h-screen bg-black px-3 pb-8 pt-20 text-white sm:px-5">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-20 h-72 w-72 rounded-full bg-violet-600/10 blur-[110px]" />
        <div className="absolute right-[6%] top-56 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1920px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="shrink-0 text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
              My links
            </h1>
            <p className="truncate text-xs text-zinc-600 sm:text-sm">
              Saved Google Sheets formulas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="hidden sm:inline">Separator</span>
              <select
                value={separator}
                onChange={(event) =>
                  setSeparator(event.target.value as "," | ";")
                }
                aria-label="Formula separator"
                className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-2.5 text-xs text-white outline-none focus:border-violet-400/60"
              >
                <option value=";">Semicolon</option>
                <option value=",">Comma</option>
              </select>
            </label>
            <Link
              href="/sheets"
              className="grid h-9 place-items-center rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-violet-100"
            >
              Sheets helper
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        {!isAuthenticated && !loading ? (
          <section className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-6 text-center">
            <h2 className="text-lg font-semibold text-amber-100">Sign in to see your links</h2>
            <p className="mt-2 text-sm text-amber-100/60">
              Your history is private and connected only to your DataHunt account.
            </p>
          </section>
        ) : loading ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-14 animate-pulse border-b border-white/[0.06] bg-white/[0.025] last:border-0" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 font-mono text-zinc-500">
              fx
            </div>
            <h2 className="mt-4 text-lg font-semibold">No copied links yet</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Copy a value in Sheets helper and it will appear here.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
              <table className="w-full min-w-[980px] table-fixed text-left">
                <thead className="border-b border-white/10 bg-white/[0.025] text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  <tr>
                    <th className="w-[19%] px-3 py-2">Source</th>
                    <th className="w-[24%] px-3 py-2">Field</th>
                    <th className="w-[31%] px-3 py-2">Parameters</th>
                    <th className="w-[10%] px-3 py-2">Updated</th>
                    <th className="w-[5%] px-3 py-2 text-center">Uses</th>
                    <th className="w-[11%] px-3 py-2 text-right">Formula</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {items.map((item) => {
                    const ready = hasRequiredCredentials(item);
                    const parameterSummary = Object.entries(item.parameters)
                      .map(([name, value]) => `${name}=${value}`)
                      .join(" · ");
                    return (
                      <tr key={item.id} className="h-14 transition hover:bg-white/[0.035]">
                        <td className="px-3 py-1.5">
                          <div className="truncate text-xs font-medium text-violet-200">
                            {sourceNames.get(item.source) ?? item.source}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-700">
                            {item.id}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="truncate text-sm font-medium text-zinc-200">
                            {item.column ?? "Single value"}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-600" title={item.key ?? undefined}>
                            {item.key ? shortValue(item.key) : "—"}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="truncate font-mono text-[10px] text-zinc-600" title={parameterSummary || undefined}>
                            {parameterSummary || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-xs text-zinc-400" title={formatDate(item.last_copied_at)}>
                          {formatRelativeTime(item.last_copied_at, now)}
                        </td>
                        <td className="px-3 py-1.5 text-center font-mono text-xs text-zinc-500">
                          {item.copy_count}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => void copyFormula(item)}
                            disabled={copyingId === item.id || !ready}
                            title={
                              ready
                                ? "Copy a fresh protected formula"
                                : "Add this source's access key in Sheets helper first"
                            }
                            className="h-8 rounded-md bg-white px-3 text-xs font-semibold text-black transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
                          >
                            {copyingId === item.id
                              ? "Preparing…"
                              : copiedId === item.id
                                ? "Copied"
                                : ready
                                  ? "Copy"
                                  : "Key missing"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
              <span>
                Showing {items.length} of {total} unique links
              </span>
              {items.length < total ? (
                <button
                  type="button"
                  onClick={() => void loadPage(items.length, true)}
                  disabled={loadingMore}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
