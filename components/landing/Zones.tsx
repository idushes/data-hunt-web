import {
  landingSourceGroups,
  landingSources,
} from "@/components/landing/sources";

export default function Zones() {
  return (
    <section id="sources" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            All your crypto. One sheet.
          </h2>
          <p className="text-sm text-zinc-500">
            {landingSourceGroups.join(" · ")}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {landingSources.map((source) => (
            <div
              key={source.id}
              className="group flex min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${source.tone} text-sm font-black text-black shadow-lg shadow-black/30`}>
                {source.mark}
              </div>
              <div className="mt-6">
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                  {source.group}
                </p>
                <p className="mt-1 text-sm font-medium leading-5 text-zinc-200">
                  {source.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
