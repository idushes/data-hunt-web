export type AccountPlan = {
  id: "free" | "pro";
  name: string;
  price: string;
  cadence: string;
  description: string;
  requestAllowance: string;
  requestNote: string;
  features: readonly string[];
  status: "current" | "coming_soon";
};

export const ACCOUNT_PLANS: readonly AccountPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Everything you need for a personal DeFi dashboard.",
    requestAllowance: "1,000 data requests / month",
    requestNote: "Resets every calendar month",
    features: [
      "All available data sources",
      "Google Sheets helper",
      "Saved links and manual refreshes",
    ],
    status: "current",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    cadence: "per month",
    description: "For active dashboards that refresh throughout the day.",
    requestAllowance: "Unlimited data requests",
    requestNote: "No monthly request cap",
    features: [
      "Everything in Free",
      "Unlimited data requests",
      "Built for always-on dashboards",
    ],
    status: "coming_soon",
  },
];
