"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchesStrategy, strategyUrl, type Catalog } from "./model";
import WalletPositions from "./WalletPositions";

export const controlClass = "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus-visible:border-emerald-400 focus-visible:ring-1 focus-visible:ring-emerald-400";
export const usd = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
export const percent = (value: number | null) => value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

export default function StakeDaoExplorer() {
  const [view, setView] = useState<"strategies" | "positions">("strategies");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState("All");
  const [protocol, setProtocol] = useState("All");
  const [version, setVersion] = useState("All");
  const [sort, setSort] = useState<"tvl" | "apr">("tvl");
  const [limit, setLimit] = useState(50);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/stakedao", { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.strategies)) throw new Error("Stake DAO strategies could not be loaded. Please retry.");
      if (!controller.signal.aborted) setCatalog(data);
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to load strategies."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => pending.current?.abort(); }, [load]);
  const strategies = catalog?.strategies;
  const filtered = useMemo(() => (strategies ?? []).filter(strategy => matchesStrategy(strategy, query) && (network === "All" || String(strategy.chainId) === network) && (protocol === "All" || strategy.protocol === protocol) && (version === "All" || String(strategy.version) === version)).sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1)), [strategies, query, network, protocol, version, sort]);
  const networks = [...new Map((strategies ?? []).map(strategy => [strategy.chainId, strategy.chain])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Stake DAO</p><h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Strategy yields & your positions</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Find strategies for your assets. Load your Ethereum wallet to see deposited value and claimable rewards in one place.</p></div>
      <a href="https://app.stakedao.org/portfolio" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center self-start rounded-lg border border-zinc-700 px-4 text-xs text-zinc-300">Open Stake DAO ↗</a>
    </div>
    <div className="mt-7 flex gap-2 border-b border-white/10 pb-4" aria-label="Stake DAO views">
      {([ ["strategies", "Strategies"], ["positions", "My positions"] ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`min-h-11 rounded-lg px-5 text-sm font-medium ${view === key ? "bg-emerald-300 text-black" : "border border-zinc-800 text-zinc-400 hover:text-white"}`}>{label}</button>)}
    </div>
    {error ? <p role="alert" className="mt-5 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-100">{error} <button type="button" onClick={() => void load()} className="underline">Retry catalogue</button>{catalog ? " Previously loaded rates remain visible." : " Positions can still be loaded without the catalogue."}</p> : null}
    {catalog?.warnings.map(warning => <p key={warning} role="status" className="mt-3 text-xs text-amber-200">{warning}</p>)}
    <section hidden={view !== "strategies"} className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <label className="min-w-0 text-xs text-zinc-400">Pair, token, or contract<input value={query} onChange={event => { setQuery(event.target.value); setLimit(50); }} maxLength={120} placeholder="frxUSD / USG" className={controlClass} /></label>
        <label className="text-xs text-zinc-400">Network<select value={network} onChange={event => { setNetwork(event.target.value); setLimit(50); }} className={controlClass}><option value="All">All networks</option>{networks.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-xs text-zinc-400">Protocol<select value={protocol} onChange={event => { setProtocol(event.target.value); setLimit(50); }} className={controlClass}><option value="All">All protocols</option>{["curve", "pendle", "balancer"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-xs text-zinc-400">Version<select value={version} onChange={event => { setVersion(event.target.value); setLimit(50); }} className={controlClass}><option value="All">All versions</option><option value="2">V2</option><option value="1">V1</option></select></label>
        <label className="text-xs text-zinc-400">Sort by<select value={sort} onChange={event => setSort(event.target.value as "tvl" | "apr")} className={controlClass}><option value="tvl">Highest TVL</option><option value="apr">Highest APR</option></select></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{["frxUSD/USG", "frxUSD/sUSDe", "ETH"].map(pair => <button key={pair} type="button" onClick={() => { setQuery(pair); setNetwork("All"); setProtocol("All"); setVersion("All"); setLimit(50); }} className="min-h-9 rounded-lg border border-zinc-800 px-3 text-xs text-emerald-200">{pair}</button>)}<button type="button" onClick={() => { setQuery(""); setNetwork("All"); setProtocol("All"); setVersion("All"); setLimit(50); }} className="min-h-9 px-3 text-xs text-zinc-500">Clear filters</button></div>
      <p className="mt-5 rounded-lg border border-amber-300/15 bg-amber-300/5 p-4 text-xs leading-6 text-zinc-400">APR and boost are strategy-level snapshots from Stake DAO, not your realized return. Rates can change and may include underlying trading-fee APY. They do not include your gas costs or losses from asset price changes. Token symbols are not verified identities; check contract addresses.</p>
      <div className="mt-5 flex items-center justify-between gap-4"><p className="text-xs text-zinc-500">{loading ? "Loading strategies…" : `${filtered.length} strategies`}{catalog ? ` · Retrieved ${new Date(catalog.retrievedAt).toLocaleString("en-US")}` : ""}</p><button type="button" onClick={() => void load()} disabled={loading} className="min-h-10 px-3 text-xs text-emerald-200 disabled:opacity-50">Refresh</button></div>
      {filtered.length ? <div className="mt-3 overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-zinc-950 text-xs text-zinc-500"><tr>{["Strategy", "Network", "Current APR", "Boost", "TVL", ""].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{filtered.slice(0, limit).map(strategy => <tr key={strategy.id} className="align-top hover:bg-white/[0.02]">
        <td className="px-4 py-4"><p className="font-semibold text-white">{strategy.name}</p><p className="mt-1 text-xs text-zinc-400">{strategy.protocol} · V{strategy.version}{strategy.onlyBoost ? " · OnlyBoost" : ""}{strategy.inactive ? " · Inactive gauge" : ""}</p><details className="mt-2 max-w-72 text-xs text-zinc-500"><summary className="cursor-pointer text-emerald-200">Contracts</summary><p className="mt-2 break-all">Vault: {strategy.vault}</p>{strategy.tokens.map(token => <p key={token.address} className="mt-2 break-all">{token.symbol}: {token.address}</p>)}</details></td>
        <td className="px-4 py-4 text-zinc-400">{strategy.chain}</td><td className="px-4 py-4 font-mono text-emerald-200">{percent(strategy.apr)}</td><td className="px-4 py-4 text-zinc-400">{strategy.boost === null ? "—" : `${strategy.boost.toFixed(2)}×`}</td><td className="px-4 py-4 font-mono">{usd(strategy.tvl)}</td><td className="px-4 py-4"><a href={strategyUrl(strategy)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${strategy.name} V${strategy.version} on ${strategy.chain}`} className="inline-flex min-h-9 items-center rounded-lg border border-emerald-400/25 px-3 text-xs text-emerald-200">Strategy ↗</a></td>
      </tr>)}</tbody></table></div> : !loading && catalog ? <p className="py-12 text-center text-sm text-zinc-400">No matching strategies. Try a token symbol, contract address, or another network.</p> : null}
      {filtered.length > limit ? <button type="button" onClick={() => setLimit(value => value + 50)} className="mt-4 min-h-11 rounded-lg border border-zinc-700 px-5 text-sm">Show more ({limit} of {filtered.length})</button> : null}
      <p className="mt-4 text-xs leading-5 text-zinc-600">Source: <a href="https://api.stakedao.org/" target="_blank" rel="noopener noreferrer" className="underline">official Stake DAO API</a>. Curve and Balancer V2 across their indexed networks; Curve, Balancer and Pendle V1 on Ethereum. Search results use a 60-second cache; source snapshots may be older.</p>
    </section>
    <section hidden={view !== "positions"} className="mt-6"><WalletPositions catalog={catalog} /></section>
  </>;
}
