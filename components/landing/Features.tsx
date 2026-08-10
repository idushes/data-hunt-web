import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Choose a source",
    description: "Select the protocol or account and enter only the parameters it needs. Saved wallet aliases stay in this browser.",
  },
  {
    number: "02",
    title: "Click the number",
    description: "Load the normalized table and click any value. Data Hunt builds a formula tied to the row's stable identifier.",
  },
  {
    number: "03",
    title: "Paste into Sheets",
    description: "Use the complete CSV or a single-cell IMPORTDATA formula that keeps working when rows move or new positions appear.",
  },
];

const capabilities = [
  {
    title: "Stable by design",
    description: "Single values are selected by a position key and column name—not by a fragile row number.",
  },
  {
    title: "Full table or one cell",
    description: "Explore everything first, then import only the exact balance, APY, debt, fee, or reward your model needs.",
  },
  {
    title: "Fewer upstream requests",
    description: "CSV responses are cached for at least 60 seconds and identical concurrent requests are combined into one fetch.",
  },
  {
    title: "Readable raw data",
    description: "Every source is available as a plain CSV route, making formulas easy to inspect, replace, and audit.",
  },
];

export default function Features() {
  return (
    <>
      <section id="workflow" className="border-y border-white/5 bg-white/[0.015] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">How it works</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                From a live position to one dependable cell.
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-400">
                The helper handles URL parameters and row matching, so you can focus on the spreadsheet model around the number.
              </p>
              <Link
                href="/sheets"
                className="mt-8 inline-flex items-center text-sm font-semibold text-white transition hover:text-violet-200"
              >
                Build a formula <span className="ml-2">→</span>
              </Link>
            </div>

            <ol className="divide-y divide-white/10 border-y border-white/10">
              {steps.map((step) => (
                <li key={step.number} className="grid gap-3 py-7 sm:grid-cols-[64px_0.7fr_1fr] sm:items-start sm:gap-6">
                  <span className="font-mono text-xs text-zinc-600">{step.number}</span>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  <p className="leading-7 text-zinc-400">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="security" className="py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Built for spreadsheets</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Simple plumbing for a portfolio you control.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-zinc-400 lg:justify-self-end">
              Public wallet sources never need a private key. Saved wallet names and addresses stay in local browser storage. For credentialed exchange sources, treat generated formulas as private and never share the sheet publicly.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
            {capabilities.map((capability) => (
              <article key={capability.title} className="bg-[#08080a] p-7 sm:p-8">
                <div className="mb-5 h-px w-10 bg-gradient-to-r from-violet-400 to-blue-400" />
                <h3 className="text-xl font-semibold text-white">{capability.title}</h3>
                <p className="mt-3 leading-7 text-zinc-400">{capability.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
