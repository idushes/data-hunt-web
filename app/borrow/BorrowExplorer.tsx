"use client";

import { useEffect, useMemo, useState } from "react";
import { CHAINS, capacity, csvExport, matches, number, type BorrowCatalog, type BorrowMarket, type Filters } from "./model";

const control = "mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60";
const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(2)}%`;
const initialFilters: Filters = { chain: "All", protocol: "All", collateral: "All", debt: "All", maxApr: null, minLtv: null, minLoanUsd: 1000, availableOnly: true };
type Sort = "apr" | "ltv" | "capacity" | "liquidity";

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <label className="block text-xs text-zinc-400">{label}<select className={control} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs text-zinc-400">{label}</p><p className="mt-3 font-mono text-3xl tracking-tight text-cyan-200">{value}</p><p className="mt-2 truncate text-xs text-zinc-500">{note}</p></div>;
}

export default function BorrowExplorer() {
  const [catalog, setCatalog] = useState<BorrowCatalog | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [usdInput, setUsdInput] = useState("10000");
  const [bandsInput, setBandsInput] = useState("10");
  const [query, setQuery] = useState({ usd: 10_000, bands: 10, sequence: 0 });
  const [buffer, setBuffer] = useState(10);
  const [sort, setSort] = useState<Sort>("apr");
  const [descending, setDescending] = useState(false);
  const [limit, setLimit] = useState(40);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ chain: "All", usd: String(query.usd), bands: String(query.bands) });
    const load = async () => {
      setLoading(true); setError(""); setCatalog(null);
      try {
        const response = await fetch(`/api/borrow?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Borrow data is unavailable.");
        if (!Array.isArray(data.markets) || !Array.isArray(data.coverage)) throw new Error("Borrow data is unavailable.");
        if (!controller.signal.aborted) setCatalog(data);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Borrow data is unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [query]);

  const amount = (market: BorrowMarket) => capacity(market, query.usd, buffer);
  const rows = useMemo(() => {
    const result = (catalog?.markets ?? []).filter(market => matches(market, filters, query.usd, buffer));
    const metric = (m: BorrowMarket) => sort === "apr" ? m.apr : sort === "ltv" ? m.ltv : sort === "liquidity" ? m.liquidityUsd : capacity(m, query.usd, buffer);
    return result.sort((a, b) => {
      const av = metric(a), bv = metric(b);
      if (av === null) return bv === null ? a.id.localeCompare(b.id) : 1;
      if (bv === null) return -1;
      return (descending ? bv - av : av - bv) || a.id.localeCompare(b.id);
    });
  }, [catalog, filters, sort, descending, query.usd, buffer]);
  const cheapest = rows.filter(m => m.apr !== null && (amount(m) ?? 0) > 0).reduce<BorrowMarket | null>((best, row) => !best || row.apr! < best.apr! ? row : best, null);
  const largest = rows.reduce<BorrowMarket | null>((best, row) => (amount(row) ?? 0) > (best ? amount(best) ?? 0 : 0) ? row : best, null);
  const highestLtv = rows.reduce<number | null>((best, row) => row.ltv !== null && (best === null || row.ltv > best) ? row.ltv : best, null);
  const protocols = [...new Set(catalog?.markets.map(m => m.protocol))].sort();
  const tokens = [...new Set(catalog?.markets.map(m => m.collateral))].sort();
  const debts = [...new Set(catalog?.markets.map(m => m.debt))].sort();
  const coverage = (catalog?.coverage ?? []).filter(c => filters.chain === "All" || c.chain === filters.chain);
  const failures = coverage.filter(c => c.status === "error");
  const change = <K extends keyof Filters>(key: K, next: Filters[K]) => { setFilters(prev => ({ ...prev, [key]: next })); setLimit(40); };
  const changeSort = (next: Sort) => { if (sort === next) setDescending(v => !v); else { setSort(next); setDescending(next !== "apr"); } };
  const pending = Number(usdInput) !== query.usd || Number(bandsInput) !== query.bands;
  const download = () => {
    const url = URL.createObjectURL(new Blob([csvExport(rows, query.usd, buffer)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "datahunt-borrow.csv"; link.click(); URL.revokeObjectURL(url);
  };

  return <>
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">DataHunt / Borrow</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your collateral.<br /><span className="text-zinc-500">More borrowing power.</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Compare stablecoin loans against ETH and BTC. One table for borrowing rates, LTV and the amount you can borrow.</p></div>
      <div className="text-xs leading-6 text-zinc-500">{catalog ? <>Fetched {new Date(catalog.retrievedAt).toLocaleTimeString()}<br />Snapshots cached for 60 seconds</> : loading ? "Loading protocol data…" : "Data unavailable"}</div>
    </div>

    <form onSubmit={event => { event.preventDefault(); const usd = Number(usdInput), bands = Number(bandsInput); if (usd >= 1 && usd <= 10_000_000 && bands >= 4 && bands <= 50 && Number.isInteger(bands)) { setQuery(prev => ({ usd, bands, sequence: prev.sequence + 1 })); setLimit(40); } }} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.035] p-5">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_1fr_auto]">
        <label className="text-xs text-zinc-400">Collateral value in USD<input required type="number" min="1" max="10000000" step="any" value={usdInput} onChange={event => setUsdInput(event.target.value)} className={control} /></label>
        <label className="text-xs text-zinc-400">Buffer below borrowing limit · {buffer}%<input aria-label="Buffer below borrowing limit" type="range" min="1" max="50" step="1" value={buffer} onChange={event => setBuffer(Number(event.target.value))} className="mt-4 block h-10 w-full accent-cyan-300" /></label>
        <label className="text-xs text-zinc-400">Curve bands<input required type="number" min="4" max="50" step="1" value={bandsInput} onChange={event => setBandsInput(event.target.value)} className={control} /></label>
        <button disabled={loading} className="min-h-11 rounded-xl bg-cyan-200 px-6 text-sm font-semibold text-black transition hover:bg-cyan-100 disabled:opacity-40">{loading ? "Comparing…" : pending ? "Apply & compare" : "Refresh data ↻"}</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">The same USD collateral value is used for each token. ETH / BTC families include wrapped and staked tokens; select your exact token below. {pending ? <span className="text-amber-200">Apply changes to recalculate Curve quotes.</span> : <>Calculations use {money(query.usd)} of collateral.</>}</p>
    </form>

    <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Lowest borrow APR" value={percent(cheapest?.apr ?? null)} note={cheapest ? `${cheapest.protocol} · ${cheapest.chain} · ${cheapest.collateral} → ${cheapest.debt}` : "No matching available market"} />
      <Metric label={`Largest loan · ${buffer}% buffer`} value={money(largest ? amount(largest) : null)} note={largest ? `${largest.protocol} · ${largest.chain} · ${largest.collateral} → ${largest.debt}` : "No matching available market"} />
      <Metric label="Highest LTV in this view" value={percent(highestLtv)} note="Curve shows effective LTV for this deposit" />
      <Metric label="Matching markets" value={String(rows.length)} note={failures.length ? `${failures.length} source(s) unavailable · partial coverage` : `${coverage.filter(c => c.status === "ok").length} connected sources`} />
    </div>

    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Select label="Network" value={filters.chain} onChange={v => change("chain", v)} options={[{ value: "All", label: "All networks" }, ...Object.keys(CHAINS).map(value => ({ value, label: value }))]} />
      <Select label="Protocol" value={filters.protocol} onChange={v => change("protocol", v)} options={[{ value: "All", label: "All protocols" }, ...protocols.map(value => ({ value, label: value }))]} />
      <Select label="Collateral" value={filters.collateral} onChange={v => change("collateral", v)} options={[{ value: "All", label: "ETH + BTC families" }, { value: "ETH", label: "ETH family" }, { value: "BTC", label: "BTC family" }, ...tokens.map(value => ({ value: `token:${value}`, label: `${value} · exact token` }))]} />
      <Select label="Borrow asset" value={filters.debt} onChange={v => change("debt", v)} options={[{ value: "All", label: "All stablecoins" }, ...debts.map(value => ({ value, label: value }))]} />
      <label className="text-xs text-zinc-400">Maximum APR (%)<input type="number" min="0" step="0.1" placeholder="No limit" value={filters.maxApr ?? ""} onChange={e => change("maxApr", number(e.target.value))} className={control} /></label>
      <label className="text-xs text-zinc-400">Minimum LTV (%)<input type="number" min="0" max="99" step="1" placeholder="No minimum" value={filters.minLtv ?? ""} onChange={e => change("minLtv", number(e.target.value))} className={control} /></label>
      <label className="text-xs text-zinc-400">Minimum loan (USD)<input type="number" min="0" step="1" value={filters.minLoanUsd || ""} placeholder="No minimum" onChange={e => change("minLoanUsd", number(e.target.value) ?? 0)} className={control} /></label>
    </div>

    {error ? <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error} <button onClick={() => setQuery(prev => ({ ...prev, sequence: prev.sequence + 1 }))} className="ml-2 underline">Retry</button></div> : null}
    {failures.length ? <div role="status" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-200">Partial coverage: {failures.map(c => `${c.source} / ${c.chain}`).join(", ")} unavailable. These markets are missing; the lowest rate applies only to the loaded markets.</div> : null}
    <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
      <label className="flex items-center gap-2 text-zinc-400"><input type="checkbox" checked={filters.availableOnly} onChange={e => change("availableOnly", e.target.checked)} className="accent-cyan-300" />Only markets with available borrowing capacity</label>
      <div className="flex gap-4"><button onClick={() => { setFilters(initialFilters); setLimit(40); }} className="text-zinc-500 hover:text-white">Reset filters</button><button disabled={!rows.length} onClick={download} className="text-cyan-200 hover:text-white disabled:opacity-40">Export CSV ↓</button></div>
    </div>

    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <caption className="sr-only">Stablecoin borrowing markets for {money(query.usd)} collateral with {buffer}% buffer below the limit</caption>
        <thead className="bg-[#111116] text-xs text-zinc-400"><tr>
          <th scope="col" className="p-4">Protocol / network</th><th scope="col" className="p-4">Collateral → loan</th>
          {(["apr", "ltv", "capacity", "liquidity"] as Sort[]).map(key => <th scope="col" key={key} aria-sort={sort === key ? descending ? "descending" : "ascending" : "none"} className="p-4 text-right"><button onClick={() => changeSort(key)} className="whitespace-nowrap hover:text-white">{key === "apr" ? "Borrow APR" : key === "ltv" ? "Max / effective LTV" : key === "capacity" ? "You can borrow" : "Available liquidity"} {sort === key ? descending ? "↓" : "↑" : "↕"}</button></th>)}
          <th scope="col" className="p-4 text-right">Annual interest</th><th scope="col" className="p-4">Market</th>
        </tr></thead>
        <tbody className="divide-y divide-white/[0.06]">{rows.slice(0, limit).map(m => {
          const loan = amount(m), selectedLtv = loan === null ? null : loan / query.usd * 100;
          return <tr key={m.id} className="bg-[#08080b] transition-colors hover:bg-white/[0.035]">
            <td className="p-4"><span className="font-medium text-white">{m.protocol}</span><span className="mt-1 block text-xs text-zinc-500">{m.chain} · {m.name}</span></td>
            <td className="p-4"><span className="whitespace-nowrap font-medium">{m.collateral} <span className="mx-1 text-zinc-600">→</span> {m.debt}</span><details className="mt-1 max-w-48 text-xs text-zinc-500"><summary className="cursor-pointer">Token addresses</summary><p className="mt-2 break-all">Collateral: {m.collateralAddress || "Unknown"}<br />Borrow: {m.debtAddress || "Unknown"}</p></details></td>
            <td className="p-4 text-right font-mono text-cyan-200">{percent(m.apr)}<span className="mt-1 block font-sans text-[10px] text-zinc-600">Gross · variable</span></td>
            <td className="p-4 text-right font-mono">{percent(m.ltv)}<span className="mt-1 block font-sans text-[10px] text-zinc-500">{m.protocol === "Curve" ? `Effective · ${query.bands} bands` : `Liquidation ${percent(m.liquidationThreshold)}`}</span></td>
            <td className="p-4 text-right font-mono font-semibold text-white">{money(loan)}<span className="mt-1 block font-sans text-[10px] font-normal text-zinc-500">{loan !== null && m.debtPrice ? `${(loan / m.debtPrice).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${m.debt} · ${percent(selectedLtv)} LTV` : loan !== null ? `${percent(selectedLtv)} LTV` : "Capacity unknown"}</span></td>
            <td className="p-4 text-right font-mono text-zinc-400">{money(m.liquidityUsd)}</td>
            <td className="p-4 text-right font-mono text-zinc-400">{money(loan !== null && m.apr !== null ? loan * m.apr / 100 : null)}<span className="mt-1 block font-sans text-[10px] text-zinc-600">At current APR</span></td>
            <td className="p-4"><a href={m.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-cyan-200 hover:underline">Open ↗</a><details className="mt-2 max-w-56 text-xs text-zinc-500"><summary className="cursor-pointer">Details</summary><p className="mt-2 leading-5">{m.notes.join(" ")}{m.borrowFee !== null ? ` Opening fee: ${percent(m.borrowFee)}.` : " Opening fees not included in annual interest."}</p></details></td>
          </tr>;
        })}</tbody>
      </table>
      {loading ? <div role="status" className="p-12 text-center text-sm text-zinc-500">Fetching rates, risk parameters and contract quotes…</div> : !rows.length && !error ? <div className="p-12 text-center text-sm text-zinc-500">No markets match these filters. Try another network or token, or show markets without available capacity.</div> : null}
    </div>
    {rows.length > limit ? <div className="mt-4 text-center"><button onClick={() => setLimit(v => v + 40)} className="rounded-xl border border-white/10 px-6 py-3 text-sm text-zinc-300 hover:bg-white/5">Show more · {limit} of {rows.length}</button></div> : null}

    <details className="mt-8 rounded-2xl border border-white/10 p-5 text-sm text-zinc-400"><summary className="cursor-pointer font-medium text-zinc-200">Data coverage & calculation</summary>
      <p className="mt-4 text-xs leading-6">Loan estimate = collateral value × LTV × (1 − buffer), capped by available liquidity and protocol limits. For Curve, the contract quote also caps the amount. The buffer reduces borrowing capacity; it is not a guarantee against liquidation. Annual interest assumes the current APR and constant debt for one year. Fees, rewards, gas and rate changes after your borrow are excluded.</p>
      <p className="mt-3 text-xs leading-6">Aave V3 uses standard mode; E-mode and isolation mode are not included. Aave V4 assumes a new position with one collateral token and includes its risk premium. Morpho includes listed markets. Fluid includes single token collateral and debt vaults. Solana uses Jupiter Lend. Curve includes indexed LlamaLend V1/V2 markets on Ethereum and Arbitrum, plus Ethereum crvUSD mint markets; effective LTV depends on deposit size, liquidity and bands. Tokens and networks require their own assets; bridged and staked versions carry different risks. EURC is denominated in euros; displayed loan values are converted to USD.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{coverage.map(c => <div key={`${c.source}:${c.chain}`} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs"><span className={c.status === "ok" ? "text-emerald-300" : "text-amber-200"}>{c.status === "ok" ? "●" : "○"}</span> {c.source} · {c.chain}<span className="float-right text-zinc-500">{c.status === "ok" ? `${c.markets} markets` : "Unavailable"}</span></div>)}</div>
      <p className="mt-4 text-xs text-zinc-500">Direct sources: <a className="underline" href="https://docs.morpho.org/developers/api/morpho/" target="_blank" rel="noopener noreferrer">Morpho</a>, <a className="underline" href="https://aave.com/docs" target="_blank" rel="noopener noreferrer">Aave</a>, <a className="underline" href="https://fluid.io/" target="_blank" rel="noopener noreferrer">Fluid</a>, <a className="underline" href="https://docs.compound.finance/" target="_blank" rel="noopener noreferrer">Compound contracts</a>, <a className="underline" href="https://api.curve.finance/v1/documentation/" target="_blank" rel="noopener noreferrer">Curve API + contracts</a>, <a className="underline" href="https://developers.jup.ag/docs/lend/borrow" target="_blank" rel="noopener noreferrer">Jupiter Lend</a>.</p>
    </details>
  </>;
}
