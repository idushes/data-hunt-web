import Link from "next/link";
import { ACCOUNT_PLANS } from "@/components/account/plans";

export default function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-white/10 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
            Freemium
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Start free. Upgrade only when you need more.
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-400 sm:text-lg">
            Build and refresh your DeFi dashboard with 1,000 free data requests every month. No credit card required.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {ACCOUNT_PLANS.map((plan) => {
            const isFree = plan.id === "free";

            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  isFree
                    ? "border-violet-400/40 bg-gradient-to-b from-violet-500/15 to-white/[0.03] shadow-[0_0_60px_-30px_rgba(139,92,246,0.8)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-400">{plan.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isFree ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-zinc-400"
                    }`}
                  >
                    {isFree ? "Available now" : "Coming soon"}
                  </span>
                </div>

                <div className="mt-7 flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-white">{plan.price}</span>
                  <span className="pb-1 text-sm text-zinc-500">{plan.cadence}</span>
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="font-semibold text-white">{plan.requestAllowance}</p>
                  <p className="mt-1 text-xs text-zinc-500">{plan.requestNote}</p>
                </div>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-zinc-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="mt-0.5 size-4 shrink-0 text-violet-300"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.293a1 1 0 0 1 .003 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.411 0Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isFree ? (
                  <Link
                    href="/sheets"
                    className="mt-8 rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-violet-100"
                  >
                    Start free
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-8 cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-500"
                  >
                    Coming soon
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Pro billing is not enabled yet. You can use the Free plan today.
        </p>
      </div>
    </section>
  );
}
