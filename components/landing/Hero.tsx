import Link from "next/link";

const proofPoints = [
  "No wallet connection for public addresses",
  "60-second request cache",
  "Stable single-value routes",
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 pb-20 pt-28 sm:pt-32 lg:pb-28">
      <div className="landing-grid absolute inset-0 opacity-60" />
      <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[140px]" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]" />
            14 live data sources
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            Put live crypto positions in the sheet you already use.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
            Generate ready-to-paste Google Sheets formulas for DeFi positions,
            wallet balances, Solana vaults, exchange accounts, and token prices.
            Import a full table or pin one dependable value to one cell.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sheets"
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-violet-100"
            >
              Open Sheets helper
              <span aria-hidden="true" className="ml-2">→</span>
            </Link>
            <a
              href="#sources"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
            >
              Browse data sources
            </a>
          </div>

          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-zinc-500">
            {proofPoints.map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
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
              <span className="ml-3 font-mono text-[10px] text-zinc-600">crypto.lisacorp.com/sheets</span>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-[1.15fr_1fr_0.75fr]">
                <div className="rounded-xl border border-white/10 bg-black/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">Source</p>
                  <p className="mt-1.5 text-sm text-white">Uniswap V3 positions</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">Wallet</p>
                  <p className="mt-1.5 truncate font-mono text-xs text-zinc-300">0x6272…e339</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">Network</p>
                  <p className="mt-1.5 text-sm text-zinc-300">Ethereum</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] bg-white/[0.04] px-4 py-2.5 font-mono text-[10px] text-zinc-500">
                  <span>PAIR</span>
                  <span>VALUE</span>
                  <span>FEES</span>
                  <span>STATUS</span>
                </div>
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] items-center border-t border-white/5 px-4 py-3 text-xs text-zinc-300">
                  <span className="font-medium text-white">WMON / USDC</span>
                  <span>$3,502</span>
                  <span className="rounded-md bg-violet-400/15 px-2 py-1 text-violet-200">$175.40</span>
                  <span className="text-emerald-400">In range</span>
                </div>
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] items-center border-t border-white/5 px-4 py-3 text-xs text-zinc-500">
                  <span>ETH / USDC</span>
                  <span>$8,941</span>
                  <span>$31.08</span>
                  <span>In range</span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Formula copied</p>
                  <span className="text-[10px] text-zinc-600">one stable cell</span>
                </div>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-zinc-300">
                  =IMPORTDATA(&quot;https://hunt.data.lisacorp.com/value?source=uniswap&amp;key=…&amp;column=claimable_fees_usd&quot;)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
