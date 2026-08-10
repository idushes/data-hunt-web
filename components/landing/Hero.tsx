import Link from "next/link";
import { sheetSources } from "@/components/sheets/catalog";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 pb-20 pt-28 sm:pt-32 lg:pb-28">
      <div className="landing-grid absolute inset-0 opacity-60" />
      <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[140px]" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]" />
            {sheetSources.length} ready-made tables
          </div>

          <h1 className="max-w-2xl text-6xl font-semibold tracking-[-0.06em] text-white sm:text-7xl lg:text-[82px] lg:leading-[0.96]">
            Crypto data.
            <span className="mt-2 block text-gradient-primary">Straight to Sheets.</span>
          </h1>

          <p className="mt-7 text-xl text-zinc-400">
            Pick a source. Click a number. Paste the formula.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sheets"
              className="inline-flex items-center justify-center rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-violet-100"
            >
              Open Sheets helper <span className="ml-2">→</span>
            </Link>
            <a
              href="#sources"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              See sources
            </a>
          </div>

          <div className="mt-9 flex flex-wrap gap-2 text-xs text-zinc-500">
            {[
              "No wallet connect",
              "Saved + authorized wallets",
              "60s cache",
              "Short reusable links",
            ].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-violet-500/15 via-blue-500/5 to-emerald-400/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#09090b]/95 shadow-2xl shadow-violet-950/30">
            <div className="flex h-11 items-center gap-2 border-b border-white/10 px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="ml-3 font-mono text-[10px] text-zinc-600">DataHunt / Sheets</span>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-[1.15fr_1fr_0.75fr]">
                {[
                  ["Source", "Uniswap V3"],
                  ["Wallet", "0x6272…e339"],
                  ["Network", "Ethereum"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-black/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
                    <p className="mt-1.5 truncate text-sm text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] bg-white/[0.04] px-4 py-2.5 font-mono text-[10px] text-zinc-500">
                  <span>PAIR</span><span>VALUE</span><span>FEES</span><span>STATUS</span>
                </div>
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] items-center border-t border-white/5 px-4 py-4 text-xs text-zinc-300">
                  <span className="font-medium text-white">WMON / USDC</span>
                  <span>$3,502</span>
                  <span className="rounded-md bg-violet-400/15 px-2 py-1 text-violet-200 ring-1 ring-violet-400/30">$175.40</span>
                  <span className="text-emerald-400">In range</span>
                </div>
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] items-center border-t border-white/5 px-4 py-3 text-xs text-zinc-600">
                  <span>ETH / USDC</span><span>$8,941</span><span>$31.08</span><span>In range</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-lg font-bold text-black">✓</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-200">Formula copied</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">=IMPORTDATA(&quot;…/v/8qL2mZ7pR4Kd&quot;)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
