const sourceGroups = [
  {
    label: "Onchain DeFi",
    title: "Positions, debt, fees, and rewards",
    description:
      "Read supplied assets, loans, health factors, LP composition, claimable fees, and farming rewards directly into your workbook.",
    sources: ["Fluid", "Aave", "Uniswap V3", "Stake DAO"],
    accent: "violet",
  },
  {
    label: "Wallets & market",
    title: "The balances around your positions",
    description:
      "Keep Ethereum and Solana stablecoin balances beside current market prices without maintaining another portfolio app.",
    sources: ["USDC / USDT", "Ethereum", "Solana", "CoinMarketCap"],
    accent: "blue",
  },
  {
    label: "Solana",
    title: "Vaults, assets, and perpetuals",
    description:
      "Bring Kamino Earn, Private Credit, kVaults, GMTrade assets, and open perpetual positions into the same sheet.",
    sources: ["Kamino", "kVaults", "GMTrade", "Perpetuals"],
    accent: "emerald",
  },
  {
    label: "Trading accounts",
    title: "Exchange equity in the same view",
    description:
      "Combine account values, collateral, withdrawable balances, and portfolio positions with your onchain holdings.",
    sources: ["Coinbase", "Hyperliquid", "Lighter", "Paradex"],
    accent: "amber",
  },
];

const accents = {
  violet: "border-violet-400/15 bg-violet-400/[0.06] text-violet-200",
  blue: "border-blue-400/15 bg-blue-400/[0.06] text-blue-200",
  emerald: "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200",
  amber: "border-amber-400/15 bg-amber-400/[0.06] text-amber-200",
};

export default function Zones() {
  return (
    <section id="sources" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">Data sources</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            One helper for the numbers scattered across your portfolio.
          </h2>
          <p className="mt-5 text-lg leading-8 text-zinc-400">
            Data Hunt normalizes different protocols and APIs into simple tables,
            so your spreadsheet can stay the single place where you make decisions.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {sourceGroups.map((group) => (
            <article
              key={group.label}
              className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-white/20 hover:bg-white/[0.04] sm:p-8"
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{group.label}</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{group.title}</h3>
                </div>
                <span className="font-mono text-xs text-zinc-700">0{sourceGroups.indexOf(group) + 1}</span>
              </div>
              <p className="mt-4 max-w-xl leading-7 text-zinc-400">{group.description}</p>
              <div className="mt-7 flex flex-wrap gap-2">
                {group.sources.map((source) => (
                  <span
                    key={source}
                    className={`rounded-full border px-3 py-1.5 text-xs ${accents[group.accent as keyof typeof accents]}`}
                  >
                    {source}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
