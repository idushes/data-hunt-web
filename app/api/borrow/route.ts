import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { CHAINS, type Chain } from "../../borrow/model";
import { fetchBorrowCatalog } from "./source";

export const maxDuration = 60;
const cached = unstable_cache(fetchBorrowCatalog, ["borrow-catalog-v1"], { revalidate: 60 });
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const chain = params.get("chain") ?? "All";
  const usd = Number(params.get("usd") ?? "10000"), bands = Number(params.get("bands") ?? "10");
  if ((chain !== "All" && !Object.hasOwn(CHAINS, chain)) || !Number.isFinite(usd) || usd < 1 || usd > 10_000_000 || !Number.isInteger(bands) || bands < 4 || bands > 50) return NextResponse.json({ error: "Choose a supported chain, collateral value $1–$10,000,000 and 4–50 Curve bands." }, { status: 400, headers });
  try { return NextResponse.json(await cached(chain as Chain | "All", usd, bands), { headers }); }
  catch { return NextResponse.json({ error: "Borrow data is temporarily unavailable. Please retry shortly." }, { status: 502, headers }); }
}
