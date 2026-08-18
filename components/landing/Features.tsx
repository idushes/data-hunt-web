import Link from "next/link";

function ChooseVisual() {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/50 p-4">
      <div className="rounded-xl border border-violet-400/30 bg-violet-400/10 p-3">
        <p className="text-[9px] uppercase tracking-wider text-violet-300">Table</p>
        <p className="mt-1 text-sm text-white">Aave positions⌄</p>
      </div>
      <div className="grid grid-cols-[1fr_0.55fr] gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-500">0x94ce…69ce</div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">Ethereum</div>
      </div>
    </div>
  );
}

function ClickVisual() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50">
      <div className="grid grid-cols-3 bg-white/[0.04] px-4 py-3 font-mono text-[9px] text-zinc-600">
        <span>ASSET</span><span>AMOUNT</span><span>VALUE</span>
      </div>
      <div className="grid grid-cols-3 items-center border-t border-white/5 px-4 py-4 text-xs text-zinc-400">
        <span>ETH</span><span>51.38</span><span>$98,470</span>
      </div>
      <div className="grid grid-cols-3 items-center border-t border-white/5 px-4 py-4 text-xs text-zinc-300">
        <span>wstETH</span><span>11.05</span><span className="rounded-lg bg-violet-400 px-2 py-1.5 font-semibold text-black shadow-[0_0_20px_rgba(167,139,250,0.35)]">$26,290</span>
      </div>
    </div>
  );
}

function PasteVisual() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1610]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500 text-xs font-black text-white">S</span>
        <span className="text-xs text-zinc-400">Portfolio</span>
      </div>
      <div className="grid grid-cols-[42px_1fr_1fr] text-xs">
        <span className="border-b border-r border-white/10 p-3 text-zinc-700">12</span>
        <span className="border-b border-r border-white/10 p-3 text-zinc-500">Aave</span>
        <span className="border-2 border-emerald-400 bg-emerald-400/10 p-3 font-semibold text-white">$26,290</span>
        <span className="border-r border-white/10 p-3 text-zinc-700">13</span>
        <span className="border-r border-white/10 p-3 text-zinc-500">Fluid</span>
        <span className="p-3 text-zinc-600">$18,420</span>
      </div>
    </div>
  );
}

const benefits = [
  { icon: "✓", title: "Signed access", note: "Login required" },
  { icon: "60", title: "60s cache", note: "Fewer requests" },
  { icon: "↗", title: "Saved links", note: "Copy once, reuse anytime" },
  { icon: "🔒", title: "Private Coinbase", note: "Separate Main + Perps keys" },
  { icon: "+", title: "Multi-wallet", note: "EVM + Solana + TRON" },
];

function PrivacyVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-lg">
            ◉
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Your browser
            </p>
            <p className="mt-1 text-sm text-white">
              Saved wallets, access tokens, encrypted capsules
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-zinc-600 sm:flex-col">
        <span>Request only</span>
        <span className="text-lg text-violet-300 sm:rotate-0">→</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg text-zinc-400">
            ∅
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              DataHunt database
            </p>
            <p className="mt-1 text-sm text-white">No service keys or tokens</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Features() {
  const steps = [
    { number: "01", title: "Choose", Visual: ChooseVisual },
    { number: "02", title: "Click", Visual: ClickVisual },
    { number: "03", title: "Paste", Visual: PasteVisual },
  ];

  return (
    <>
      <section id="workflow" className="border-y border-white/5 bg-white/[0.015] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Three clicks. Done.</h2>
            <Link href="/sheets" className="hidden text-sm font-semibold text-violet-200 sm:block">Try it →</Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(({ number, title, Visual }) => (
              <article key={number} className="rounded-3xl border border-white/10 bg-[#08080a] p-5 sm:p-6">
                <Visual />
                <div className="mt-6 flex items-center gap-4">
                  <span className="font-mono text-xs text-zinc-600">{number}</span>
                  <h3 className="text-2xl font-semibold text-white">{title}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Private by design
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Your keys stay yours.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">
                We never persist API keys or service tokens. Anything you save
                in the helper stays in this browser on your computer.
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">
                Credentials inside a Sheets formula are also visible wherever
                you share that spreadsheet.
              </p>
            </div>
            <PrivacyVisual />
          </div>

          <h2 className="mt-20 text-center text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Made for everyday use.</h2>
          <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center sm:p-7">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-400/20 to-blue-400/10 font-mono text-sm font-bold text-white">
                  {benefit.icon}
                </div>
                <h3 className="mt-4 font-semibold text-white">{benefit.title}</h3>
                <p className="mt-1 text-xs text-zinc-600">{benefit.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
