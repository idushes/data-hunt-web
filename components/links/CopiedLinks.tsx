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
    <main className="min-h-screen bg-black px-4 pb-16 pt-24 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-20 h-72 w-72 rounded-full bg-violet-600/10 blur-[110px]" />
        <div className="absolute right-[6%] top-56 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              Google Sheets
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              My copied links
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Reuse every unique value without rebuilding the formula.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <label className="text-xs text-zinc-500">
              Formula separator
              <select
                value={separator}
                onChange={(event) =>
                  setSeparator(event.target.value as "," | ";")
                }
                className="mt-1 block rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
              >
                <option value=";">Semicolon ;</option>
                <option value=",">Comma ,</option>
              </select>
            </label>
            <Link
              href="/sheets"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-violet-100"
            >
              Open Sheets helper
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!isAuthenticated && !loading ? (
          <section className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-8 text-center">
            <h2 className="text-lg font-semibold text-amber-100">Sign in to see your links</h2>
            <p className="mt-2 text-sm text-amber-100/60">
              Your history is private and connected only to your DataHunt account.
            </p>
          </section>
        ) : loading ? (
          <div className="mt-8 grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center">
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
            <div className="mt-8 grid gap-3">
              {items.map((item) => {
                const ready = hasRequiredCredentials(item);
                const parameterEntries = Object.entries(item.parameters);
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                            {sourceNames.get(item.source) ?? item.source}
                          </span>
                          <span className="font-mono text-xs text-zinc-600">{item.id}</span>
                        </div>
                        <h2 className="mt-3 truncate text-lg font-semibold text-white">
                          {item.column ?? "Single value"}
                        </h2>
                        {item.key ? (
                          <p className="mt-1 font-mono text-xs text-zinc-500" title={item.key}>
                            {shortValue(item.key)}
                          </p>
                        ) : null}
                        {parameterEntries.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {parameterEntries.map(([name, value]) => (
                              <span key={name} className="rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] text-zinc-500">
                                {name}={shortValue(value)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-right">
                          <span className="text-zinc-600">Last copied</span>
                          <span className="text-zinc-400">{formatDate(item.last_copied_at)}</span>
                          <span className="text-zinc-600">First copied</span>
                          <span className="text-zinc-400">{formatDate(item.first_copied_at)}</span>
                          <span className="text-zinc-600">Copies</span>
                          <span className="font-mono text-zinc-300">{item.copy_count}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyFormula(item)}
                          disabled={copyingId === item.id || !ready}
                          title={
                            ready
                              ? "Copy a fresh protected formula"
                              : "Add this source's access key in Sheets helper first"
                          }
                          className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
                        >
                          {copyingId === item.id
                            ? "Preparing…"
                            : copiedId === item.id
                              ? "Formula copied"
                              : ready
                                ? "Copy formula"
                                : "Access key missing"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between text-xs text-zinc-600">
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
