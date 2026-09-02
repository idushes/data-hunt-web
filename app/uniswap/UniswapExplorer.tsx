"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { poolAnalyticsUrl, readSavedPairs, savedPairKey, validateSearch, type PairSearch, type YieldPool, type YieldSearchResponse } from "./model";

const DEFAULT_PAIR: PairSearch = { tokenA: "ETH", tokenB: "USDC", chain: "All", version: "All" };
const SAVED_KEY = "uniswap:saved-pairs:v1";
const PAGE_SIZE = 50;
const controlClass = "min-h-11 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus-visible:border-pink-400 focus-visible:ring-1 focus-visible:ring-pink-400";
const percent = (value: number | null) => value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const usd = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
const shortToken = (value: string) => value.startsWith("0x") ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
type Sort = "tvl" | "totalApy" | "feeApy" | "average30d" | "volume24h";

export default function UniswapExplorer() {
  const [inputs, setInputs] = useState<PairSearch>(DEFAULT_PAIR);
  const [data, setData] = useState<YieldSearchResponse | null>(null);
  const [saved, setSaved] = useState<PairSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageNotice, setStorageNotice] = useState("");
  const [sort, setSort] = useState<Sort>("tvl");
  const [minimumTvl, setMinimumTvl] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const pending = useRef<AbortController | null>(null);

  const load = useCallback(async (pair: PairSearch) => {
    let search: PairSearch;
    try { search = validateSearch(pair); } catch (caught) { setError(caught instanceof Error ? caught.message : "Invalid pair."); return; }
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/uniswap?${new URLSearchParams(search)}`, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.rows)) throw new Error(payload.error || "Unable to load pool yields.");
      if (!controller.signal.aborted) { setData(payload); setVisibleCount(PAGE_SIZE); }
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to load pool yields.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    try { setSaved(readSavedPairs(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"))); } catch { /* Browsing works without local storage. */ }
    void load(DEFAULT_PAIR);
    return () => pending.current?.abort();
  }, [load]);

  function persistPairs(next: PairSearch[]) {
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); setStorageNotice(""); }
    catch { setStorageNotice("Browser storage is unavailable. Saved pairs will last only for this visit."); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(inputs); }
  function openPair(pair: PairSearch) { setInputs(pair); setMinimumTvl(""); void load(pair); }
  const sorted = useMemo(() => (data?.rows ?? []).filter(pool => pool.tvl >= Math.max(0, Number(minimumTvl) || 0)).sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity)), [data, minimumTvl, sort]);
  const savedCurrent = data ? saved.some(pair => savedPairKey(pair) === savedPairKey(data.search)) : false;
  const chains = [...new Set(["All", ...(data?.chains ?? []), inputs.chain])];

  return <>
    <section className="border-b border-white/10 pb-7">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pink-300">Uniswap · pool comparison</p>
      <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Find yields for your pairs</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Compare fees, liquidity, and annualized yields across networks and Uniswap versions. No wallet connection needed.</p>
      <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_150px_auto]">
        <label className="min-w-0 text-xs text-zinc-400">Token A<input aria-label="Token A" value={inputs.tokenA} onChange={event => setInputs({ ...inputs, tokenA: event.target.value })} placeholder="ETH or contract address" maxLength={64} required autoComplete="off" spellCheck={false} className={`mt-2 ${controlClass}`} /></label>
        <label className="min-w-0 text-xs text-zinc-400">Token B<input aria-label="Token B" value={inputs.tokenB} onChange={event => setInputs({ ...inputs, tokenB: event.target.value })} placeholder="USDC or contract address" maxLength={64} required autoComplete="off" spellCheck={false} className={`mt-2 ${controlClass}`} /></label>
        <label className="text-xs text-zinc-400">Network<select aria-label="Network" value={inputs.chain} onChange={event => setInputs({ ...inputs, chain: event.target.value })} className={`mt-2 ${controlClass}`}>{chains.map(chain => <option key={chain} value={chain}>{chain === "All" ? "All networks" : chain}</option>)}</select></label>
        <label className="text-xs text-zinc-400">Version<select aria-label="Version" value={inputs.version} onChange={event => setInputs({ ...inputs, version: event.target.value as PairSearch["version"] })} className={`mt-2 ${controlClass}`}>{["All", "V2", "V3", "V4"].map(version => <option key={version}>{version}</option>)}</select></label>
        <button type="submit" disabled={loading} className="min-h-11 self-end rounded-lg bg-pink-300 px-6 text-sm font-semibold text-black transition hover:bg-pink-200 disabled:opacity-50">{loading ? "Searching…" : "Find pools"}</button>
      </form>
      <p className="mt-3 text-xs leading-5 text-zinc-500">ETH also matches WETH. USDC and bridged USDC.e stay separate. Symbols are not proof of token identity; use contract addresses and a network for exact matching.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Quick pairs</span>
        {[DEFAULT_PAIR, { ...DEFAULT_PAIR, tokenA: "WBTC", tokenB: "ETH" }, { ...DEFAULT_PAIR, tokenA: "USDC", tokenB: "USDT" }].map(pair => <button key={pair.tokenA + pair.tokenB} type="button" onClick={() => openPair(pair)} className="min-h-9 rounded-lg border border-zinc-800 px-3 text-zinc-300 hover:border-pink-400/60">{pair.tokenA}/{pair.tokenB}</button>)}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Saved pairs</span>
        {saved.length === 0 ? <span className="text-xs text-zinc-600">Save a search to revisit it in one click.</span> : saved.map(pair => <span key={savedPairKey(pair)} className="inline-flex max-w-full items-center rounded-lg border border-pink-400/20 bg-pink-400/5 text-xs">
          <button type="button" onClick={() => openPair(pair)} className="min-h-10 min-w-0 break-all px-3 py-2 text-pink-100">{shortToken(pair.tokenA)}/{shortToken(pair.tokenB)} · {pair.chain} · {pair.version}</button>
          <button type="button" aria-label={`Remove saved ${shortToken(pair.tokenA)}/${shortToken(pair.tokenB)} ${pair.chain} ${pair.version}`} onClick={() => persistPairs(saved.filter(item => savedPairKey(item) !== savedPairKey(pair)))} className="h-10 w-10 shrink-0 text-zinc-500 hover:text-white">×</button>
        </span>)}
      </div>
      {storageNotice ? <p role="status" className="mt-2 text-xs text-amber-200">{storageNotice}</p> : null}
    </section>

    <aside className="mt-6 rounded-lg border border-amber-300/15 bg-amber-300/5 p-4 text-xs leading-6 text-zinc-400">
      <span className="font-medium text-amber-100">Pool yields, not a position forecast.</span> V3/V4 returns depend on your price range and time in range. Rates exclude impermanent loss and your gas costs. Source: <a href="https://github.com/DefiLlama/yield-server" target="_blank" rel="noopener noreferrer" className="text-pink-200 underline">DeFiLlama</a>. Coverage is limited to indexed pools; a missing result does not mean no pool exists.
    </aside>
    {error ? <p role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}{data ? " Previous search results remain below." : ""}</p> : null}
    {loading && !data ? <p role="status" className="py-16 text-center text-sm text-zinc-400">Loading Uniswap pool yields…</p> : null}
    {!data && !loading ? <button type="button" onClick={() => void load(inputs)} className="mt-4 min-h-11 rounded-lg border border-zinc-700 px-5 text-sm">Retry search</button> : null}
    {data ? <section className="mt-7" aria-busy={loading}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h2 className="break-all text-xl font-semibold text-white">{shortToken(data.search.tokenA)} / {shortToken(data.search.tokenB)}</h2><p className="mt-1 text-xs text-zinc-500">{data.search.chain === "All" ? "All indexed networks" : data.search.chain} · {data.search.version === "All" ? "V2 / V3 / V4" : data.search.version} · {sorted.length} pools{loading ? " · updating…" : ""}</p></div>
        <button type="button" disabled={savedCurrent || saved.length >= 20} onClick={() => persistPairs([...saved, data.search])} className="min-h-10 rounded-lg border border-pink-400/30 px-4 text-sm text-pink-100 disabled:opacity-50">{savedCurrent ? "Pair saved" : saved.length >= 20 ? "20 saved pairs limit" : "Save pair"}</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <label className="text-xs text-zinc-400">Minimum TVL ($)<input type="number" min="0" value={minimumTvl} onChange={event => { setMinimumTvl(event.target.value); setVisibleCount(PAGE_SIZE); }} className={`mt-2 ${controlClass}`} placeholder="No minimum" /></label>
        <label className="text-xs text-zinc-400">Sort pools<select value={sort} onChange={event => { setSort(event.target.value as Sort); setVisibleCount(PAGE_SIZE); }} className={`mt-2 ${controlClass}`}><option value="tvl">TVL: highest first</option><option value="totalApy">Total APY: highest first</option><option value="feeApy">Fee APY: highest first</option><option value="average30d">30D avg APY: highest first</option><option value="volume24h">24H volume: highest first</option></select></label>
      </div>
      <p className="mt-4 text-xs leading-5 text-zinc-500">Rates are reported by DeFiLlama. Fee APY uses recent trading activity; 30D avg is the mean reported total APY, not the return earned over 30 days. “—” means unavailable. Retrieved {new Date(data.retrievedAt).toLocaleString("en-US")}. Searches use a 5-minute cache; underlying data may be older.</p>
      {data.matches > data.rows.length ? <p className="mt-2 text-xs text-amber-200">Showing the {data.rows.length} largest pools by TVL out of {data.matches} matches. Narrow the network or version to compare more precisely.</p> : null}
      {sorted.length ? <div className="mt-5 overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-500"><tr>{["Pair / network", "Version / fee", "TVL", "24H volume", "Fee APY", "Reward APY", "Total APY", "30D avg APY", "Details"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{sorted.slice(0, visibleCount).map(pool => <PoolRow key={pool.id} pool={pool} />)}</tbody></table></div> : <div className="mt-5 rounded-lg border border-white/10 py-14 text-center"><h3 className="font-semibold text-white">No matching indexed pools</h3><p className="mt-2 px-4 text-sm text-zinc-500">Try another network, remove the TVL minimum, or check the token addresses. Small or new pools may not be indexed yet.</p></div>}
      {sorted.length > visibleCount ? <button type="button" onClick={() => setVisibleCount(count => count + PAGE_SIZE)} className="mt-4 min-h-11 rounded-lg border border-zinc-700 px-5 text-sm">Show more ({visibleCount} of {sorted.length})</button> : null}
    </section> : null}
  </>;
}

function PoolRow({ pool }: { pool: YieldPool }) {
  return <tr className="align-top transition hover:bg-zinc-950">
    <td className="px-4 py-4"><p className="font-semibold text-white">{pool.symbol}</p><p className="mt-1 text-xs text-zinc-400">{pool.chain}</p><details className="mt-2 max-w-56 text-xs text-zinc-500"><summary className="cursor-pointer text-pink-200">Token addresses</summary>{pool.tokens.map((token, index) => <p key={`${index}:${token}`} className="mt-2 break-all font-mono">{token}</p>)}</details>{pool.outlier ? <p className="mt-2 text-xs text-amber-200">Source flagged yield outlier</p> : null}</td>
    <td className="px-4 py-4"><span className="rounded border border-pink-400/25 bg-pink-400/10 px-2 py-1 text-xs text-pink-200">{pool.version}</span><p className="mt-2 text-xs text-zinc-400">{pool.feeTier ?? "Not reported"}</p>{pool.dynamicFee ? <p className="mt-1 max-w-32 text-xs text-amber-200">Dynamic-fee yield unavailable</p> : null}</td>
    <td className="px-4 py-4 font-mono">{usd(pool.tvl)}</td><td className="px-4 py-4 font-mono text-zinc-300">{usd(pool.volume24h)}</td><td className="px-4 py-4 font-mono text-zinc-200">{percent(pool.feeApy)}</td><td className="px-4 py-4 font-mono text-zinc-400">{percent(pool.rewardApy)}</td><td className="px-4 py-4 font-mono text-emerald-300">{percent(pool.totalApy)}</td><td className="px-4 py-4 font-mono text-zinc-200">{percent(pool.average30d)}</td>
    <td className="px-4 py-4"><a href={poolAnalyticsUrl(pool.id)} target="_blank" rel="noopener noreferrer" aria-label={`View ${pool.symbol} ${pool.version} ${pool.chain} ${pool.feeTier ?? ""} on DeFiLlama`} className="inline-flex min-h-9 items-center rounded-lg border border-pink-400/25 px-3 text-xs text-pink-200">DeFiLlama ↗</a></td>
  </tr>;
}
