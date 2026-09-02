import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { fetchCatalog } from "./source";

const cachedCatalog = unstable_cache(fetchCatalog, ["stakedao-strategies-v1"], { revalidate: 60 });

export async function GET() {
  try { return NextResponse.json(await cachedCatalog(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Stake DAO strategy data is temporarily unavailable. Please retry shortly." }, { status: 502, headers: { "Cache-Control": "no-store" } }); }
}
