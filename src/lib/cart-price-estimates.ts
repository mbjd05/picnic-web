import type { BundleOption } from "@/lib/types/product";
import type { BundleProgress, BundleThreshold } from "@/lib/types/cart";

type BundleTier = Pick<BundleOption, "quantity" | "pricePerUnit"> | BundleThreshold;

function activeBundleUnitPrice(
  tiers: readonly BundleTier[] | null | undefined,
  quantity: number,
  displayPrice: number
): number | null {
  if (!tiers?.length || quantity <= 0) return null;
  const activePrice = tiers.filter((tier) => tier.quantity <= quantity).at(-1)?.pricePerUnit;
  return activePrice !== undefined && activePrice < displayPrice ? activePrice : null;
}

export function estimatedBundleLineTotal(
  tiers: readonly BundleTier[] | null | undefined,
  quantity: number,
  displayPrice: number
): number {
  if (quantity <= 0) return 0;
  return quantity * (activeBundleUnitPrice(tiers, quantity, displayPrice) ?? displayPrice);
}

export function estimatedBundlePriceDelta(
  tiers: readonly BundleTier[] | null | undefined,
  currentQuantity: number,
  nextQuantity: number,
  displayPrice: number
): number {
  return Math.abs(
    estimatedBundleLineTotal(tiers, nextQuantity, displayPrice) -
      estimatedBundleLineTotal(tiers, currentQuantity, displayPrice)
  );
}

export function estimatedProgressPriceDelta(
  progress: BundleProgress | null,
  currentQuantity: number,
  nextQuantity: number,
  displayPrice: number
): number {
  return estimatedBundlePriceDelta(
    progress?.thresholds,
    currentQuantity,
    nextQuantity,
    displayPrice
  );
}
