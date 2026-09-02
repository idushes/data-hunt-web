import type { RaydiumPoolType } from "@/app/raydium/types";

export function raydiumPoolUrl(type: RaydiumPoolType, poolId: string) {
  const encodedPoolId = encodeURIComponent(poolId);
  return type === "Concentrated"
    ? `https://raydium.io/clmm/create-position/?pool_id=${encodedPoolId}`
    : `https://raydium.io/liquidity/increase/?mode=add&pool_id=${encodedPoolId}`;
}
