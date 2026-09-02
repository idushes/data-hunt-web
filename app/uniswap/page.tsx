import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import UniswapExplorer from "./UniswapExplorer";

export const metadata: Metadata = { title: "Uniswap pool yields | DataHunt", description: "Find liquidity pool yields for your token pairs across Uniswap networks and versions." };

export default function UniswapPage() {
  return <div className="min-h-screen bg-black text-zinc-100"><Header /><main className="mx-auto max-w-7xl px-4 py-24 md:px-6"><UniswapExplorer /></main></div>;
}
