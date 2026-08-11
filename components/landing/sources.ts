import { sheetSources } from "../sheets/catalog";

type SourceVisual = {
  logos: readonly string[];
};

const visuals: Partial<Record<string, SourceVisual>> = {
  fluid: { logos: ["/logos/fluid.webp"] },
  aave: { logos: ["/logos/aave.webp"] },
  morpho: { logos: ["/logos/morpho.webp"] },
  compound: { logos: ["/logos/compound.webp"] },
  euler: { logos: ["/logos/euler.webp"] },
  lido: { logos: ["/logos/lido.webp"] },
  gmx: { logos: ["/logos/gmx.webp"] },
  uniswap: { logos: ["/logos/uniswap.webp"] },
  stablecoins: { logos: ["/logos/usdc.png", "/logos/usdt.png"] },
  stakedao: { logos: ["/logos/stakedao.webp"] },
  "cmc-price": { logos: ["/logos/coinmarketcap.png"] },
  hyperliquid: { logos: ["/logos/hyperliquid.webp"] },
  lighter: { logos: ["/logos/lighter.webp"] },
  paradex: { logos: ["/logos/paradex.webp"] },
  coinbase: { logos: ["/logos/coinbase.webp"] },
  "gmtrade-assets": { logos: ["/logos/gmtrade.webp"] },
  "jupiter-jlp": { logos: ["/logos/jupiter.webp"] },
  "gmtrade-perps": { logos: ["/logos/gmtrade.webp"] },
  "kamino-vaults": { logos: ["/logos/kamino.webp"] },
  "kamino-positions": { logos: ["/logos/kamino.webp"] },
};

const fallbackVisual: SourceVisual = {
  logos: ["/favicon_io/datahunt-mark.svg"],
};

export const landingSources = sheetSources.map((source) => ({
  id: source.id,
  name: source.name,
  group: source.group,
  ...(visuals[source.id] ?? fallbackVisual),
}));

export const landingSourceGroups = Array.from(
  new Set(sheetSources.map((source) => source.group))
);
