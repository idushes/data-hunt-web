import {
  landingSourceGroups,
  landingSources,
} from "@/components/landing/sources";
import Image from "next/image";

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
              <div className="relative h-12 w-12 drop-shadow-lg">
                {source.logos.map((logo, index) => (
                  <Image
                    key={logo}
                    src={logo}
                    alt={`${source.name} logo`}
                    width={48}
                    height={48}
                    className={
                      source.logos.length === 1
                        ? "h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10"
                        : `absolute h-9 w-9 rounded-full object-cover ring-2 ring-black ${
                            index === 0 ? "left-0 top-0" : "bottom-0 right-0"
                          }`
                    }
                  />
                ))}
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
