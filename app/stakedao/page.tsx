import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import StakeDaoExplorer from "./StakeDaoExplorer";

export const metadata: Metadata = { title: "Stake DAO yields & positions | DataHunt", description: "Compare Stake DAO strategy APRs and load your Ethereum positions by wallet address." };

export default function StakeDaoPage() {
  return <div className="min-h-screen bg-black text-zinc-100"><Header /><main className="mx-auto max-w-7xl px-4 py-24 md:px-6"><StakeDaoExplorer /></main></div>;
}
