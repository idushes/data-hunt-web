import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import SheetsBuilder from "@/components/sheets/SheetsBuilder";

export const metadata: Metadata = {
  title: "Google Sheets helper — DataHunt",
  description: "Choose a CSV source and copy a formula for a specific cell.",
};

export default function SheetsPage() {
  return (
    <>
      <Header />
      <SheetsBuilder />
    </>
  );
}
