import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GoogleAdsTag from "@/components/analytics/GoogleAdsTag";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://crypto.lisacorp.com"),
  title: "DataHunt — Personal DeFi positions in Google Sheets",
  description:
    "Track your personal DeFi deposits, debt, APY, rewards, liquidity positions, and wallet balances in Google Sheets.",
  openGraph: {
    title: "DataHunt — Personal DeFi positions in Google Sheets",
    description:
      "Track deposits, debt, APY, rewards, and liquidity positions in your own spreadsheet.",
    type: "website",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "DataHunt — personal DeFi positions in Google Sheets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DataHunt — Personal DeFi positions in Google Sheets",
    description:
      "Track deposits, debt, APY, rewards, and liquidity positions in your own spreadsheet.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon_io/datahunt-mark.svg", type: "image/svg+xml" },
      { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon_io/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/favicon_io/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "manifest",
        url: "/favicon_io/site.webmanifest",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <GoogleAdsTag />
      </body>
    </html>
  );
}
