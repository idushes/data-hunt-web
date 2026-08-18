import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import CopiedLinks from "@/components/links/CopiedLinks";

export const metadata: Metadata = {
  title: "My copied links — DataHunt",
  description: "Review and reuse your copied Google Sheets formulas.",
};

export default function LinksPage() {
  return (
    <>
      <Header />
      <CopiedLinks />
    </>
  );
}
