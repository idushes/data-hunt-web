import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import BorrowExplorer from "./BorrowExplorer";

export const metadata: Metadata = { title: "Borrow stablecoins | DataHunt", description: "Compare borrowing rates, LTV and available stablecoin loans against ETH and BTC collateral across lending protocols." };
export default function BorrowPage() {
  return <div className="min-h-screen bg-black text-zinc-100"><Header /><main className="mx-auto max-w-[1440px] px-4 pb-16 pt-28 md:px-8"><BorrowExplorer /></main></div>;
}
