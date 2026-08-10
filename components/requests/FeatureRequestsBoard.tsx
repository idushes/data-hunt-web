"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthModal from "@/components/auth/AuthModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://hunt.data.lisacorp.com";

type RequestStatus = "requested" | "planned" | "in_progress" | "released";
type Verdict = "works" | "not_working";

type FeatureRequest = {
  id: number;
  title: string;
  description: string;
  category: string;
  status: RequestStatus;
  created_at: number;
  updated_at: number;
  support_count: number;
  works_count: number;
  not_working_count: number;
  viewer_supports: boolean;
  viewer_feedback: { verdict: Verdict; comment: string } | null;
  match_score?: number;
};

type Feedback = {
  id: number;
  verdict: Verdict;
  comment: string;
  author_address: string;
  updated_at: number;
};

const categories = [
  ["all", "All types"],
  ["blockchain", "Blockchain"],
  ["defi_protocol", "DeFi protocol"],
  ["exchange", "Exchange"],
  ["data_field", "Data field"],
  ["other", "Other"],
] as const;

const statuses: Array<[RequestStatus | "all", string]> = [
  ["all", "All statuses"],
  ["requested", "Requested"],
  ["planned", "Planned"],
  ["in_progress", "In progress"],
  ["released", "Released"],
];

const statusStyle: Record<RequestStatus, string> = {
  requested: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  planned: "border-blue-400/20 bg-blue-400/10 text-blue-200",
  in_progress: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  released: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
};

function labelFor(value: string, options: ReadonlyArray<readonly [string, string]>) {
  return options.find(([key]) => key === value)?.[1] ?? value;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function authHeaders(token: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

export default function FeatureRequestsBoard() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<FeatureRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("popular");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const pendingAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("data_hunt_token"));
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ sort, limit: "100" });
    if (query.trim()) params.set("query", query.trim());
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);

    try {
      let response = await fetch(`${API_URL}/feature-requests?${params}`, {
        headers: authHeaders(token),
        cache: "no-store",
      });
      if (response.status === 401 && token) {
        localStorage.removeItem("data_hunt_token");
        setToken(null);
        response = await fetch(`${API_URL}/feature-requests?${params}`, { cache: "no-store" });
      }
      if (!response.ok) throw new Error("Could not load requests");
      const data = await response.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setIsAdmin(Boolean(data.viewer_is_admin));
      setSelectedId((current) => {
        if (!data.items?.length) return null;
        return data.items.some((item: FeatureRequest) => item.id === current)
          ? current
          : data.items[0].id;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load requests");
    } finally {
      setLoading(false);
    }
  }, [category, query, sort, status, token]);

  useEffect(() => {
    const timeout = window.setTimeout(fetchRequests, 250);
    return () => window.clearTimeout(timeout);
  }, [fetchRequests]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const fetchFeedback = useCallback(async (requestId: number) => {
    setFeedbackLoading(true);
    try {
      const response = await fetch(`${API_URL}/feature-requests/${requestId}/feedback`, { cache: "no-store" });
      const data = response.ok ? await response.json() : { items: [] };
      setFeedback(data.items ?? []);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId !== null) fetchFeedback(selectedId);
  }, [fetchFeedback, selectedId]);

  useEffect(() => {
    setComment(selected?.viewer_feedback?.comment ?? "");
  }, [selected?.id, selected?.viewer_feedback?.comment]);

  const replaceItem = (updated: FeatureRequest) => {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const requireAuth = (action: () => void) => {
    if (token) {
      action();
      return;
    }
    pendingAction.current = action;
    setAuthOpen(true);
  };

  const onAuthenticated = () => {
    const storedToken = localStorage.getItem("data_hunt_token");
    setToken(storedToken);
    const action = pendingAction.current;
    pendingAction.current = null;
    window.setTimeout(() => action?.(), 0);
  };

  const vote = (item: FeatureRequest) => requireAuth(async () => {
    const active = !item.viewer_supports;
    setBusyAction(`vote-${item.id}`);
    try {
      const response = await fetch(`${API_URL}/feature-requests/${item.id}/vote`, {
        method: "PUT",
        headers: authHeaders(localStorage.getItem("data_hunt_token"), true),
        body: JSON.stringify({ active }),
      });
      if (response.ok) replaceItem((await response.json()).item);
    } finally {
      setBusyAction("");
    }
  });

  const submitFeedback = (verdict: Verdict) => {
    if (!selected) return;
    requireAuth(async () => {
      setBusyAction(`feedback-${verdict}`);
      try {
        const response = await fetch(`${API_URL}/feature-requests/${selected.id}/feedback`, {
          method: "PUT",
          headers: authHeaders(localStorage.getItem("data_hunt_token"), true),
          body: JSON.stringify({ verdict, comment }),
        });
        if (response.ok) {
          replaceItem((await response.json()).item);
          await fetchFeedback(selected.id);
        }
      } finally {
        setBusyAction("");
      }
    });
  };

  const updateStatus = async (nextStatus: RequestStatus) => {
    if (!selected) return;
    setBusyAction("status");
    try {
      const response = await fetch(`${API_URL}/feature-requests/${selected.id}/status`, {
        method: "PATCH",
        headers: authHeaders(token, true),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) replaceItem((await response.json()).item);
    } finally {
      setBusyAction("");
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 pb-20 pt-24 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="flex flex-col gap-7 border-b border-white/10 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Community roadmap</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">What should we build next?</h1>
            <p className="mt-4 max-w-2xl text-zinc-400">Request a source. Vote for it. Confirm when it works.</p>
          </div>
          <button
            onClick={() => requireAuth(() => setCreateOpen(true))}
            className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-violet-100"
          >
            + New request
          </button>
        </section>

        <section className="mt-8 grid gap-3 lg:grid-cols-[1fr_190px_170px_150px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search requests"
            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-violet-400/40"
          />
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-white/10 bg-[#0a0a0c] px-4 py-3 text-sm text-zinc-300 outline-none">
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-white/10 bg-[#0a0a0c] px-4 py-3 text-sm text-zinc-300 outline-none">
            {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-white/10 bg-[#0a0a0c] px-4 py-3 text-sm text-zinc-300 outline-none">
            <option value="popular">Most wanted</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </section>

        <div className="mt-4 text-xs text-zinc-600">{total} request{total === 1 ? "" : "s"}</div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-3">
            {loading && <div className="rounded-2xl border border-white/10 p-10 text-center text-zinc-600">Loading…</div>}
            {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-red-200">{error}</div>}
            {!loading && !error && items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
                <p className="text-lg font-medium">No matching requests yet.</p>
                <button onClick={() => requireAuth(() => setCreateOpen(true))} className="mt-3 text-sm text-violet-300">Create the first one →</button>
              </div>
            )}
            {items.map((item) => (
              <article
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`cursor-pointer rounded-2xl border p-4 transition sm:p-5 ${selectedId === item.id ? "border-violet-400/35 bg-violet-400/[0.06]" : "border-white/10 bg-white/[0.025] hover:border-white/20"}`}
              >
                <div className="flex gap-4">
                  <button
                    onClick={(event) => { event.stopPropagation(); vote(item); }}
                    disabled={busyAction === `vote-${item.id}`}
                    aria-label={item.viewer_supports ? "Remove support vote" : "Support this request"}
                    className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition ${item.viewer_supports ? "border-violet-400/40 bg-violet-400/15 text-violet-200" : "border-white/10 bg-black/40 text-zinc-400 hover:border-violet-400/30"}`}
                  >
                    <span className="text-lg leading-none">↑</span>
                    <span className="mt-1">{item.support_count}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusStyle[item.status]}`}>{labelFor(item.status, statuses)}</span>
                      <span className="text-xs text-zinc-600">{labelFor(item.category, categories)}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-white sm:text-xl">{item.title}</h2>
                    {item.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">{item.description}</p>}
                    {item.status === "released" && (
                      <div className="mt-3 flex gap-4 text-xs">
                        <span className="text-emerald-300">✓ {item.works_count} works</span>
                        <span className="text-red-300">× {item.not_working_count} issues</span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-2xl border border-white/10 bg-[#09090b] p-5 lg:sticky lg:top-24 sm:p-6">
            {!selected ? (
              <p className="py-12 text-center text-sm text-zinc-600">Select a request</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusStyle[selected.status]}`}>{labelFor(selected.status, statuses)}</span>
                  {isAdmin && (
                    <select value={selected.status} disabled={busyAction === "status"} onChange={(event) => updateStatus(event.target.value as RequestStatus)} className="rounded-lg border border-white/10 bg-black px-2 py-1.5 text-xs text-zinc-300">
                      {statuses.filter(([value]) => value !== "all").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  )}
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{selected.title}</h2>
                {selected.description && <p className="mt-3 text-sm leading-6 text-zinc-400">{selected.description}</p>}
                <button onClick={() => vote(selected)} className={`mt-5 w-full rounded-xl border py-3 text-sm font-semibold transition ${selected.viewer_supports ? "border-violet-400/40 bg-violet-400/15 text-violet-200" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"}`}>
                  ↑ {selected.viewer_supports ? "Supported" : "Support this request"} · {selected.support_count}
                </button>

                {selected.status === "released" ? (
                  <div className="mt-7 border-t border-white/10 pt-6">
                    <p className="text-sm font-semibold">Does it work?</p>
                    <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Optional comment" className="mt-3 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/50 p-3 text-sm outline-none placeholder:text-zinc-700 focus:border-violet-400/40" />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => submitFeedback("works")} disabled={busyAction.startsWith("feedback-")} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${selected.viewer_feedback?.verdict === "works" ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border-white/10 hover:bg-emerald-400/10"}`}>✓ Works</button>
                      <button onClick={() => submitFeedback("not_working")} disabled={busyAction.startsWith("feedback-")} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${selected.viewer_feedback?.verdict === "not_working" ? "border-red-400/40 bg-red-400/15 text-red-200" : "border-white/10 hover:bg-red-400/10"}`}>× Has issues</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-zinc-500">Verification opens after release.</div>
                )}

                <div className="mt-7 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Community feedback</p>
                    <span className="text-xs text-zinc-600">{selected.works_count + selected.not_working_count}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {feedbackLoading && <p className="text-xs text-zinc-600">Loading…</p>}
                    {!feedbackLoading && feedback.length === 0 && <p className="text-xs text-zinc-600">No feedback yet.</p>}
                    {feedback.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-white/10 bg-black/40 p-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className={entry.verdict === "works" ? "text-emerald-300" : "text-red-300"}>{entry.verdict === "works" ? "✓ Works" : "× Has issues"}</span>
                          <span className="font-mono text-zinc-700">{shortAddress(entry.author_address)}</span>
                        </div>
                        {entry.comment && <p className="mt-2 text-sm leading-5 text-zinc-400">{entry.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </aside>
        </section>
      </div>

      {createOpen && (
        <CreateRequestModal
          token={token}
          onClose={() => setCreateOpen(false)}
          onExisting={(item) => {
            setItems((current) => current.some((entry) => entry.id === item.id) ? current : [item, ...current]);
            setSelectedId(item.id);
            setCreateOpen(false);
          }}
          onCreated={(item) => {
            setItems((current) => [item, ...current]);
            setTotal((current) => current + 1);
            setSelectedId(item.id);
            setCreateOpen(false);
          }}
        />
      )}

      <AuthModal
        isOpen={authOpen}
        onClose={() => { setAuthOpen(false); pendingAction.current = null; }}
        onAuthenticated={onAuthenticated}
        redirectTo={null}
      />
    </main>
  );
}

function CreateRequestModal({
  token,
  onClose,
  onExisting,
  onCreated,
}: {
  token: string | null;
  onClose: () => void;
  onExisting: (item: FeatureRequest) => void;
  onCreated: (item: FeatureRequest) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("defi_protocol");
  const [matches, setMatches] = useState<FeatureRequest[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (title.trim().length < 2) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`${API_URL}/feature-requests/search?query=${encodeURIComponent(title.trim())}`, {
          headers: authHeaders(token),
          signal: controller.signal,
        });
        if (response.ok) setMatches((await response.json()).items ?? []);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setMatches([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [title, token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/feature-requests`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({ title, description, category }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.detail?.request_id) {
          setError("This request already exists. Choose it from the matches above.");
        } else {
          setError(typeof data.detail === "string" ? data.detail : "Could not create request");
        }
        return;
      }
      onCreated(data.item);
    } catch {
      setError("Could not create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <form onSubmit={submit} className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0b0d] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">New request</p>
            <h2 className="mt-2 text-2xl font-semibold">What is missing?</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-zinc-500 hover:text-white">×</button>
        </div>

        <label className="mt-7 block text-sm text-zinc-400">
          Title
          <input autoFocus required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Add Morpho positions" className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/40" />
        </label>

        {(searching || matches.length > 0) && (
          <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
            <p className="text-xs font-semibold text-amber-200">Already requested?</p>
            {searching && <p className="mt-2 text-xs text-zinc-600">Searching…</p>}
            <div className="mt-2 space-y-2">
              {matches.map((match) => (
                <button type="button" key={match.id} onClick={() => onExisting(match)} className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left text-sm transition hover:border-violet-400/30">
                  <span>{match.title}</span>
                  <span className="text-xs text-zinc-600">↑ {match.support_count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mt-5 block text-sm text-zinc-400">
          Type
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none">
            {categories.filter(([value]) => value !== "all").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="mt-5 block text-sm text-zinc-400">
          Details <span className="text-zinc-700">(optional)</span>
          <textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Which chains, positions, balances, or fields do you need?" className="mt-2 min-h-28 w-full resize-y rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none placeholder:text-zinc-700 focus:border-violet-400/40" />
        </label>

        {error && <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
        <button disabled={submitting || title.trim().length < 3} className="mt-6 w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40">
          {submitting ? "Creating…" : "Create request"}
        </button>
      </form>
    </div>
  );
}
