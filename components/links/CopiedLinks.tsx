"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CachedValuePreview,
  type CopiedValueResource,
  loadCachedValuePreviews,
  loadCopiedResources,
  recordCopiedResource,
  removeCopiedResource,
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
const PREVIEW_CREDENTIAL_SOURCES = ["coinbase", "bybit", "binance"];

type DisplayValueResource = CopiedValueResource &
  Partial<Omit<CachedValuePreview, "id">>;

export type CopiedLinksSortKey =
  | "source"
  | "data"
  | "value"
  | "parameters"
  | "freshness";

type SortState = {
  key: CopiedLinksSortKey;
  direction: "asc" | "desc";
};

const valueCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

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

function parameterSummary(item: CopiedValueResource) {
  return Object.entries(item.parameters)
    .map(([name, value]) => `${name}=${value}`)
    .join(" · ");
}

export function sortCopiedLinks(
  items: DisplayValueResource[],
  sort: SortState,
  sourceNames: Map<string, string> = new Map()
) {
  return [...items].sort((left, right) => {
    let comparison = 0;
    if (sort.key === "freshness") {
      const leftValue = left.data_updated_at;
      const rightValue = right.data_updated_at;
      if (leftValue == null || rightValue == null) {
        if (leftValue == null && rightValue == null) comparison = 0;
        else return leftValue == null ? 1 : -1;
      } else {
        comparison = leftValue - rightValue;
      }
    } else {
      const values: Record<Exclude<CopiedLinksSortKey, "freshness">, [string, string]> = {
        source: [
          sourceNames.get(left.source) ?? left.source,
          sourceNames.get(right.source) ?? right.source,
        ],
        data: [
          `${left.column ?? ""} ${left.key ?? ""}`,
          `${right.column ?? ""} ${right.key ?? ""}`,
        ],
        value: [left.value ?? "", right.value ?? ""],
        parameters: [parameterSummary(left), parameterSummary(right)],
      };
      const [leftValue, rightValue] = values[sort.key];
      if (!leftValue || !rightValue) {
        if (!leftValue && !rightValue) comparison = 0;
        else return !leftValue ? 1 : -1;
      } else {
        comparison = valueCollator.compare(leftValue, rightValue);
      }
    }
    if (comparison === 0) comparison = left.id.localeCompare(right.id);
    return sort.direction === "asc" ? comparison : -comparison;
  });
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: CopiedLinksSortKey;
  sort: SortState | null;
  onSort: (key: CopiedLinksSortKey) => void;
  className: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th
      className={className}
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 transition hover:text-zinc-300"
      >
        {label}
        <span aria-hidden="true" className={active ? "text-violet-300" : "text-zinc-700"}>
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
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

export function previewCredentialsFromBrowser() {
  const credentialsBySource = PREVIEW_CREDENTIAL_SOURCES.map<
    [string, Record<string, string>]
  >((source) => {
      const credentials = Object.fromEntries(
        Object.entries(localCredentials(source)).filter(([, value]) => value)
      );
      return [source, credentials];
    });
  return Object.fromEntries(
    credentialsBySource.filter(
      ([, credentials]) => Object.keys(credentials).length > 0
    )
  );
}

function freshnessColor(timestamp: number | null | undefined, now: number) {
  if (!timestamp) return "bg-zinc-700";
  const age = Math.max(0, Math.floor(now / 1000) - timestamp);
  if (age <= 5 * 60) return "bg-emerald-400";
  if (age <= 60 * 60) return "bg-amber-400";
  return "bg-rose-400";
}

export default function CopiedLinks() {
  const [items, setItems] = useState<DisplayValueResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [copyingId, setCopyingId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [error, setError] = useState("");
  const [separator, setSeparator] = useState<"," | ";">(";");
  const [now, setNow] = useState(() => Date.now());

  const sourceNames = useMemo(
    () => new Map(sheetSources.map((source) => [source.id, source.name])),
    []
  );
  const visibleItems = useMemo(
    () => (sort ? sortCopiedLinks(items, sort, sourceNames) : items),
    [items, sort, sourceNames]
  );

  function toggleSort(key: CopiedLinksSortKey) {
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: key === "freshness" ? "desc" : "asc" };
    });
  }

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
      let loadedItems: DisplayValueResource[] = page.items;
      try {
        if (page.items.length === 0) {
          setItems((current) => (append ? current : []));
          setTotal(page.total);
          return;
        }
        const previews = await loadCachedValuePreviews(
          loginToken,
          page.items.map((item) => item.id),
          previewCredentialsFromBrowser()
        );
        const previewsById = new Map(
          previews.items.map((preview) => [preview.id, preview])
        );
        loadedItems = page.items.map((item) => ({
          ...item,
          ...previewsById.get(item.id),
        }));
      } catch {
        setError("Links loaded, but cached values are temporarily unavailable.");
      }
      setItems((current) => (append ? [...current, ...loadedItems] : loadedItems));
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
              candidate.id === updated.id
                ? { ...candidate, ...updated }
                : candidate
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

  async function removeLink(resourceId: string) {
    const loginToken = activeLoginToken();
    if (!loginToken) {
      setIsAuthenticated(false);
      setError("Sign in again to remove this link.");
      return;
    }

    setRemovingId(resourceId);
    setError("");
    try {
      await removeCopiedResource(resourceId, loginToken);
      setItems((current) => current.filter((item) => item.id !== resourceId));
      setTotal((current) => Math.max(0, current - 1));
      setConfirmRemoveId("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to remove this link"
      );
    } finally {
      setRemovingId("");
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
                    <SortableHeader
                      label="Source"
                      sortKey="source"
                      sort={sort}
                      onSort={toggleSort}
                      className="w-[16%] px-3 py-2"
                    />
                    <SortableHeader
                      label="Data"
                      sortKey="data"
                      sort={sort}
                      onSort={toggleSort}
                      className="w-[21%] px-3 py-2"
                    />
                    <SortableHeader
                      label="Current value"
                      sortKey="value"
                      sort={sort}
                      onSort={toggleSort}
                      className="w-[15%] px-3 py-2"
                    />
                    <SortableHeader
                      label="Parameters"
                      sortKey="parameters"
                      sort={sort}
                      onSort={toggleSort}
                      className="w-[25%] px-3 py-2"
                    />
                    <SortableHeader
                      label="Freshness"
                      sortKey="freshness"
                      sort={sort}
                      onSort={toggleSort}
                      className="w-[9%] px-3 py-2"
                    />
                    <th className="w-[14%] px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {visibleItems.map((item) => {
                    const ready = hasRequiredCredentials(item);
                    const parameters = parameterSummary(item);
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
                          <div
                            className="truncate font-mono text-sm font-medium text-white"
                            title={item.value ?? undefined}
                          >
                            {item.value === null || item.value === undefined
                              ? "Not cached"
                              : item.value || "empty"}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="truncate font-mono text-[10px] text-zinc-600" title={parameters || undefined}>
                            {parameters || "—"}
                          </div>
                        </td>
                        <td
                          className="px-3 py-1.5 text-xs text-zinc-400"
                          title={
                            item.data_updated_at
                              ? formatDate(item.data_updated_at)
                              : "No cached value is available"
                          }
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${freshnessColor(item.data_updated_at, now)}`}
                            />
                            {item.data_updated_at
                              ? formatRelativeTime(item.data_updated_at, now)
                              : "No cache"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
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
                            {confirmRemoveId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void removeLink(item.id)}
                                  disabled={removingId === item.id}
                                  className="h-8 rounded-md border border-red-400/30 bg-red-400/10 px-2 text-[10px] font-semibold text-red-200 transition hover:bg-red-400/20 disabled:opacity-50"
                                >
                                  {removingId === item.id ? "Removing…" : "Remove?"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveId("")}
                                  aria-label={`Cancel removing ${sourceNames.get(item.source) ?? item.source}`}
                                  className="h-8 w-7 rounded-md border border-white/10 text-xs text-zinc-500 transition hover:bg-white/10 hover:text-white"
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveId(item.id)}
                                aria-label={`Remove ${sourceNames.get(item.source) ?? item.source} from My links`}
                                title="Remove from My links"
                                className="h-8 w-8 rounded-md border border-white/10 text-sm text-zinc-600 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300"
                              >
                                ×
                              </button>
                            )}
                          </div>
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
