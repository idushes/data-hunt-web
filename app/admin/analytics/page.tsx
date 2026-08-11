import type { Metadata } from "next";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";

export const metadata: Metadata = {
  title: "Admin analytics — DataHunt",
  description: "Private DataHunt usage analytics.",
};

export default function AdminAnalyticsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Header />
      <AdminAnalytics />
      <Footer />
    </main>
  );
}
