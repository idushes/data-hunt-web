import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import FeatureRequestsBoard from "@/components/requests/FeatureRequestsBoard";

export const metadata: Metadata = {
  title: "Feature requests — DataHunt",
  description: "Request data sources, vote for integrations, and confirm what works.",
};

export default function FeatureRequestsPage() {
  return (
    <>
      <Header />
      <FeatureRequestsBoard />
      <Footer />
    </>
  );
}
