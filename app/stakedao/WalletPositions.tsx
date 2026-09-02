"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { activeLoginToken } from "@/components/sheets/browserAuth";
import { fetchPositions } from "./positions";
import { positionStrategy, positionTotals, savedWalletChoices, strategyUrl, type Catalog } from "./model";

const fieldClass = "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus-visible:border-emerald-400";
const money = (value: number | null) => value === null ? "—" : value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const amount = (value: number | null) => value === null ? "—" : value.toLocaleString("en-US", { maximumSignificantDigits: 8 });
type Loaded = Awaited<ReturnType<typeof fetchPositions>>;

export default function WalletPositions({ catalog }: { catalog: Catalog | null }) {
  const [wallet, setWallet] = useState("");
  const [saved, setSaved] = useState<ReturnType<typeof savedWalletChoices>>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    function readWallets() { try { setSaved(savedWalletChoices(JSON.parse(localStorage.getItem("datahunt:sheets:saved-addresses:v1") ?? "[]"))); } catch { setSaved([]); } }
    function authChanged() { pending.current?.abort(); setLoaded(null); setLoading(false); setError(""); }
    function storageChanged(event: StorageEvent) { if (event.key === "data_hunt_token" || event.key === null) authChanged(); if (event.key === "datahunt:sheets:saved-addresses:v1" || event.key === null) readWallets(); }
    readWallets();
    window.addEventListener("data-hunt-auth", authChanged);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("datahunt:sheets:saved-addresses-changed", readWallets);
    return () => { pending.current?.abort(); window.removeEventListener("data-hunt-auth", authChanged); window.removeEventListener("storage", storageChanged); window.removeEventListener("datahunt:sheets:saved-addresses-changed", readWallets); };
  }, []);

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(""); setLoaded(null);
    const timeout = setTimeout(() => controller.abort("timeout"), 75_000);
    try {
      const result = await fetchPositions(wallet, activeLoginToken(), controller.signal);
      if (!controller.signal.aborted) setLoaded(result);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to load positions.");
      else if (controller.signal.reason === "timeout") setError("Loading took too long. Please retry shortly.");
    } finally { clearTimeout(timeout); if (pending.current === controller) setLoading(false); }
  }
  const totals = loaded ? positionTotals(loaded.positions) : null;

  return <>
    <h2 className="text-xl font-semibold text-white">My positions <span className="text-sm font-normal text-zinc-500">· Ethereum</span></h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Read-only wallet lookup through your DataHunt account. No transaction or Stake DAO wallet connection required. Other networks are not included in this positions view yet.</p>
    <form onSubmit={load} className="mt-5 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-xs text-zinc-400">Wallet address<input value={wallet} onChange={event => setWallet(event.target.value)} required maxLength={42} placeholder="0x…" autoComplete="off" spellCheck={false} className={fieldClass} /></label>
      <button type="submit" disabled={loading} className="min-h-11 rounded-lg bg-emerald-300 px-5 text-sm font-semibold text-black hover:bg-emerald-200 disabled:opacity-50">{loading ? "Loading positions…" : "Load positions"}</button>
    </form>
    {saved.length ? <label className="mt-3 block max-w-xl text-xs text-zinc-500">Use a wallet saved in Sheets<select value="" onChange={event => setWallet(event.target.value)} className={fieldClass}><option value="">Choose saved wallet</option>{saved.map(choice => <option key={choice.address} value={choice.address}>{choice.label} · {choice.address.slice(0, 6)}…{choice.address.slice(-4)}</option>)}</select></label> : null}
    <p className="mt-3 text-xs leading-5 text-zinc-500">Your address is sent to DataHunt for public on-chain lookup. It is not saved by this tool. Existing Sheets wallets are read from this browser.</p>
    {error ? <p role="alert" className="mt-5 rounded-lg border border-red-400/25 bg-red-400/5 p-4 text-sm text-red-100">{error}</p> : null}
    {loading ? <p role="status" className="mt-5 text-sm text-zinc-400">Checking strategy vaults, gauges and lockers. This may take up to a minute.</p> : null}
    {loaded && totals ? <>
      <p className="mt-6 break-all text-xs text-zinc-500">Loaded wallet: {loaded.wallet} · {new Date(loaded.retrievedAt).toLocaleString("en-US")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{[["Deposited value", money(totals.valueUsd)], ["Claimable rewards", money(totals.rewardUsd)], ["Positions", String(loaded.positions.length)]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>)}</div>
      <p className="mt-4 text-xs leading-6 text-zinc-500">Claimable rewards are currently unclaimed amounts, not lifetime earnings. “—” means unavailable, not zero.{totals.unpriced ? ` ${totals.unpriced} unpriced positions are excluded from the value total.` : ""}{totals.missingRewards ? ` Rewards are not reported for ${totals.missingRewards} positions; the reward total is partial.` : ""} Coverage follows the existing DataHunt Ethereum integration and may omit unsupported positions.</p>
      {loaded.positions.length ? <div className="mt-5 overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-zinc-950 text-xs text-zinc-500"><tr>{["Position", "Strategy APR / boost", "Claimable rewards", "Deposited", ""].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{loaded.positions.map(position => {
        const strategy = positionStrategy(position, catalog?.strategies ?? []);
        const apr = strategy?.apr ?? position.apr;
        return <tr key={position.id} className="align-top hover:bg-white/[0.02]">
          <td className="px-4 py-5"><p className="font-semibold text-white">{strategy?.name ?? position.name}</p><p className="mt-1 text-xs text-zinc-500">{position.protocol} · {position.type}{strategy?.onlyBoost ? " · OnlyBoost" : ""}</p><details className="mt-2 max-w-64 text-xs text-zinc-500"><summary className="cursor-pointer text-emerald-200">Position contract</summary><p className="mt-2 break-all">{position.contract}</p></details></td>
          <td className="px-4 py-5"><p className="font-mono text-emerald-200">{apr === null ? "—" : `${apr.toFixed(2)}%`}</p>{strategy?.boost != null ? <p className="mt-1 text-xs text-zinc-500">{strategy.boost.toFixed(2)}× boost</p> : null}<p className="mt-1 text-xs text-zinc-600">Strategy rate, not realized P&L</p></td>
          <td className="px-4 py-5"><p className="font-mono">{money(position.rewardUsd)}</p>{position.rewardAmount !== null ? <p className="mt-1 text-xs text-zinc-500">{amount(position.rewardAmount)} {position.rewardSymbol}</p> : null}</td>
          <td className="px-4 py-5"><p className="font-mono">{money(position.valueUsd)}</p><p className="mt-1 text-xs text-zinc-500">{amount(position.amount)} {position.assetSymbol}</p></td>
          <td className="px-4 py-5">{strategy ? <a href={strategyUrl(strategy)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-lg border border-emerald-400/25 px-3 text-xs text-emerald-200">Strategy ↗</a> : <a href="https://app.stakedao.org/portfolio" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-200">Stake DAO ↗</a>}</td>
        </tr>;
      })}</tbody></table></div> : <p className="mt-5 rounded-xl border border-white/10 p-8 text-center text-sm text-zinc-400">No supported Stake DAO positions found for this wallet on Ethereum. Check the address and network.</p>}
      <p className="mt-4 text-xs leading-5 text-zinc-500">Balances and claimable rewards: DataHunt API (60-second cache, stale fallback possible). Strategy rates: official Stake DAO catalogue{catalog ? ` retrieved ${new Date(catalog.retrievedAt).toLocaleString("en-US")}` : " unavailable; showing reported current APR where available"}. <Link href="/sheets" className="text-emerald-200 underline">Use these positions in Sheets</Link>.</p>
    </> : null}
  </>;
}
