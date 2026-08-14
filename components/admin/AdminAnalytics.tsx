"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://hunt.data.lisacorp.com";

type Period = 1 | 7 | 30;

type DailyUsage = {
  date: string;
  requests: number;
  users: number;
};

type SourceUsage = {
  source: string;
  requests: number;
  users: number;
  errors: number;
};

type ErrorSource = {
  source: string;
  requests: number;
  errors: number;
  client_errors: number;
  server_errors: number;
  error_rate: number;
};

type Analytics = {
  period_days: Period;
  registered_users: number;
  active_users: number;
  requests: number;
  errors: number;
  success_rate: number;
  daily: DailyUsage[];
  sources: SourceUsage[];
  error_sources?: ErrorSource[];
};

type QueueProvider = {
  provider: string;
  hosts: string[];
  requests: number;
  period_seconds: number;
  concurrency: number;
  waiting: number;
  in_flight: number;
  utilization_percent: number;
  next_slot_delay_ms: number;
  cooldown_ms: number;
};

type QueueStatus = {
  enabled: boolean;
  redis: boolean;
  max_wait_seconds: number;
  providers: QueueProvider[];
  scheduled_refresh?: {
    enabled: boolean;
    queued: number;
    due: number;
    redis?: boolean;
  };
};

const periods: Array<[Period, string]> = [
  [1, "Today"],
  [7, "7 days"],
  [30, "30 days"],
];

const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function shortDate(value: string) {
  return date.format(new Date(`${value}T00:00:00Z`));
}

function queueState(queue: QueueProvider) {
  if (queue.cooldown_ms > 0) return ["Cooldown", "text-rose-300 bg-rose-400/10"];
  if (queue.waiting > 0) return ["Queued", "text-amber-300 bg-amber-400/10"];
  if (queue.in_flight > 0) return ["Active", "text-emerald-300 bg-emerald-400/10"];
  return ["Idle", "text-zinc-500 bg-white/[0.04]"];
}

function milliseconds(value: number) {
  if (value <= 0) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>(7);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queues, setQueues] = useState<QueueStatus | null>(null);
  const [queueError, setQueueError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const token = localStorage.getItem("data_hunt_token");
    if (!token) {
      setAnalytics(null);
      setError("Sign in with an admin wallet to view analytics.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/admin/analytics?days=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (response.status === 401) {
        localStorage.removeItem("data_hunt_token");
        throw new Error("Your session expired. Sign in again.");
      }
      if (response.status === 403) {
        throw new Error("This wallet does not have admin access.");
      }
      if (!response.ok) throw new Error("Could not load analytics.");
      setAnalytics((await response.json()) as Analytics);
    } catch (caught) {
      setAnalytics(null);
      setError(caught instanceof Error ? caught.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadQueues = useCallback(async () => {
    const token = localStorage.getItem("data_hunt_token");
    if (!token) {
      setQueues(null);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/admin/analytics/queues`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Live queue data is temporarily unavailable.");
      setQueues((await response.json()) as QueueStatus);
      setQueueError("");
    } catch (caught) {
      setQueueError(
        caught instanceof Error
          ? caught.message
          : "Live queue data is temporarily unavailable.",
      );
    }
  }, []);

  useEffect(() => {
    void loadQueues();
    const timer = window.setInterval(() => void loadQueues(), 5000);
    return () => window.clearInterval(timer);
  }, [loadQueues]);

  const maxDailyRequests = Math.max(
    ...(analytics?.daily.map((item) => item.requests) ?? [0]),
    1,
  );

  const cards = analytics
    ? [
        ["Registered users", number.format(analytics.registered_users)],
        ["Active users", number.format(analytics.active_users)],
        ["Requests", number.format(analytics.requests)],
        ["Success rate", `${analytics.success_rate}%`],
      ]
    : [];

  const sortedQueues = [...(queues?.providers ?? [])].sort(
    (left, right) =>
      right.cooldown_ms - left.cooldown_ms ||
      right.waiting - left.waiting ||
      right.in_flight - left.in_flight ||
      left.provider.localeCompare(right.provider),
  );
  const totalWaiting = sortedQueues.reduce((sum, queue) => sum + queue.waiting, 0);
  const totalInFlight = sortedQueues.reduce(
    (sum, queue) => sum + queue.in_flight,
    0,
  );
  const cooldowns = sortedQueues.filter((queue) => queue.cooldown_ms > 0).length;

  return (
    <section className="mx-auto min-h-[75vh] max-w-7xl px-6 pb-24 pt-28">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
            Admin only
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Usage analytics
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Aggregated activity only. No wallet addresses, IPs, formulas, or credentials.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {periods.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                period === value
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mt-10 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-6 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : null}

      {!loading && analytics ? (
        <>
          <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Requests</h2>
                  <p className="mt-1 text-xs text-zinc-600">UTC, including cached reads</p>
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-8 flex h-52 items-end gap-1.5 sm:gap-2">
                {analytics.daily.map((item) => (
                  <div
                    key={item.date}
                    className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    title={`${shortDate(item.date)}: ${number.format(item.requests)} requests, ${number.format(item.users)} users`}
                  >
                    <div className="relative flex h-full w-full items-end overflow-hidden rounded-md bg-white/[0.03]">
                      <div
                        className="w-full rounded-md bg-gradient-to-t from-violet-600 to-blue-400 transition group-hover:brightness-125"
                        style={{
                          height:
                            item.requests > 0
                              ? `${Math.max(4, (item.requests / maxDailyRequests) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <span className="h-3 truncate text-[9px] text-zinc-600">
                      {analytics.daily.length <= 7 || item === analytics.daily.at(-1)
                        ? shortDate(item.date)
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
              <div className="border-b border-white/10 p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Top sources</h2>
                <p className="mt-1 text-xs text-zinc-600">Requests and active users</p>
              </div>
              {analytics.sources.length ? (
                <div className="divide-y divide-white/5">
                  {analytics.sources.map((source) => (
                    <div
                      key={source.source}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-5 px-5 py-3.5 text-sm sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-200">
                          {source.source}
                        </p>
                        {source.errors > 0 && (
                          <p className="mt-0.5 text-[10px] text-rose-400">
                            {number.format(source.errors)} errors
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">
                          {number.format(source.requests)}
                        </p>
                        <p className="text-[10px] text-zinc-600">requests</p>
                      </div>
                      <div className="w-12 text-right">
                        <p className="font-medium text-zinc-300">
                          {number.format(source.users)}
                        </p>
                        <p className="text-[10px] text-zinc-600">users</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-6 text-sm text-zinc-500">
                  No requests recorded in this period yet.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Source errors</h2>
                  {analytics.errors > 0 ? (
                    <span className="rounded-full bg-rose-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-300">
                      {number.format(analytics.errors)} errors
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                      Healthy
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Sources with failed requests during the selected period
                </p>
              </div>
            </div>

            {(analytics.error_sources ?? []).length ? (
              <div className="overflow-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-[#090909] text-zinc-600">
                    <tr>
                      <th className="px-5 py-3 font-medium sm:px-6">Source</th>
                      <th className="px-4 py-3 font-medium">Errors</th>
                      <th className="px-4 py-3 font-medium">Server</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Requests</th>
                      <th className="px-5 py-3 text-right font-medium sm:px-6">
                        Error rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(analytics.error_sources ?? []).map((source) => (
                      <tr key={source.source} className="text-zinc-300">
                        <td className="px-5 py-3 font-medium text-white sm:px-6">
                          {source.source}
                        </td>
                        <td className="px-4 py-3 font-semibold text-rose-300">
                          {number.format(source.errors)}
                        </td>
                        <td className="px-4 py-3 text-rose-300">
                          {number.format(source.server_errors)}
                        </td>
                        <td className="px-4 py-3 text-amber-300">
                          {number.format(source.client_errors)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {number.format(source.requests)}
                        </td>
                        <td className="px-5 py-3 text-right sm:px-6">
                          <span className="inline-flex rounded-full bg-rose-400/10 px-2 py-1 font-semibold text-rose-300">
                            {source.error_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-sm text-zinc-500">
                No source errors recorded in this period.
              </p>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">External API queues</h2>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                    Live · 5s
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Combined across all backend instances through Redis
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400">
                  Waiting <strong className="ml-1 text-white">{totalWaiting}</strong>
                </span>
                <span className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400">
                  In flight <strong className="ml-1 text-white">{totalInFlight}</strong>
                </span>
                <span className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400">
                  Cooldowns <strong className="ml-1 text-white">{cooldowns}</strong>
                </span>
                <span className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400">
                  Refresh scheduled{" "}
                  <strong className="ml-1 text-white">
                    {queues?.scheduled_refresh?.queued ?? 0}
                  </strong>
                </span>
                {(queues?.scheduled_refresh?.due ?? 0) > 0 ? (
                  <span className="rounded-lg border border-amber-400/20 px-3 py-2 text-amber-300">
                    Refresh due{" "}
                    <strong className="ml-1">
                      {queues?.scheduled_refresh?.due ?? 0}
                    </strong>
                  </span>
                ) : null}
                <span
                  className={`rounded-lg border px-3 py-2 ${
                    queues?.redis
                      ? "border-emerald-400/20 text-emerald-300"
                      : "border-amber-400/20 text-amber-300"
                  }`}
                >
                  {queues?.redis ? "Redis connected" : "Local fallback"}
                </span>
              </div>
            </div>

            {queueError ? (
              <p className="border-b border-amber-400/10 bg-amber-400/[0.05] px-5 py-3 text-xs text-amber-200 sm:px-6">
                {queueError}
              </p>
            ) : null}

            {queues ? (
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#090909] text-zinc-600">
                    <tr>
                      <th className="px-5 py-3 font-medium sm:px-6">Provider</th>
                      <th className="px-4 py-3 font-medium">State</th>
                      <th className="px-4 py-3 font-medium">Waiting</th>
                      <th className="px-4 py-3 font-medium">Concurrency</th>
                      <th className="px-4 py-3 font-medium">Rate limit</th>
                      <th className="px-5 py-3 text-right font-medium sm:px-6">
                        Delay / cooldown
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedQueues.map((queue) => {
                      const [state, stateClassName] = queueState(queue);
                      return (
                        <tr key={queue.provider} className="text-zinc-300">
                          <td className="px-5 py-3 font-medium text-white sm:px-6">
                            {queue.provider}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${stateClassName}`}
                            >
                              {state}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{queue.waiting}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-8 font-medium text-white">
                                {queue.in_flight}/{queue.concurrency}
                              </span>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400"
                                  style={{ width: `${queue.utilization_percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {queue.requests}/{queue.period_seconds}s
                          </td>
                          <td className="px-5 py-3 text-right text-zinc-500 sm:px-6">
                            {milliseconds(queue.next_slot_delay_ms)} / {milliseconds(queue.cooldown_ms)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-32 animate-pulse bg-white/[0.02]" />
            )}
          </div>

          <p className="mt-5 text-xs text-zinc-700">
            Usage tracking starts from this analytics release; earlier requests are not reconstructed.
          </p>
        </>
      ) : null}
    </section>
  );
}
