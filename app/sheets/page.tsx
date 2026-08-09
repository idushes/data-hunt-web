import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import SheetsBuilder from "@/components/sheets/SheetsBuilder";

export const metadata: Metadata = {
  title: "Google Sheets helper — DataHunt",
  description: "Выберите CSV и скопируйте формулу для конкретной ячейки.",
};

export default function SheetsPage() {
  return (
    <>
      <Header />
      <SheetsBuilder />
    </>
  );
}
