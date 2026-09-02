import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { validateSearch } from "../../uniswap/model";
import { searchYieldPools } from "./source";

// Cache only the small pair-specific result, not the provider's multi-MB catalog.
const cachedSearch = unstable_cache(searchYieldPools, ["uniswap-pair-yields-v1"], { revalidate: 300 });

export async function GET(request: NextRequest) {
  let search;
  try {
    search = validateSearch(Object.fromEntries(request.nextUrl.searchParams));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid pair." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    // Server-side caching is sufficient; a second CDN cache would extend the
    // age of an already cached result by another five minutes.
    return NextResponse.json(await cachedSearch(search), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Uniswap yield data is temporarily unavailable. Please try again shortly." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
