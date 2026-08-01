import { describe, expect, it } from "vitest";

import {
  estimatedBundleLineTotal,
  estimatedBundlePriceDelta,
  estimatedProgressPriceDelta,
} from "@/lib/cart/price-estimates";
import type { BundleProgress, BundleThreshold } from "@/lib/types";

describe("cart price estimates", () => {
  const displayPrice = 250;
  const bundleTiers: BundleThreshold[] = [
    { quantity: 1, pricePerUnit: 250 },
    { quantity: 3, pricePerUnit: 225 },
    { quantity: 6, pricePerUnit: 200 },
  ];

  it("uses the normal display price when there is no active bundle discount", () => {
    expect(estimatedBundleLineTotal(bundleTiers, 1, displayPrice)).toBe(250);
    expect(estimatedBundlePriceDelta(bundleTiers, 0, 1, displayPrice)).toBe(250);
  });

  it("uses the active discounted tier for the whole estimated line total", () => {
    expect(estimatedBundleLineTotal(bundleTiers, 3, displayPrice)).toBe(675);
    expect(estimatedBundleLineTotal(bundleTiers, 6, displayPrice)).toBe(1200);
  });

  it("estimates threshold-crossing deltas from before and after line totals", () => {
    expect(estimatedBundlePriceDelta(bundleTiers, 2, 3, displayPrice)).toBe(175);
    expect(estimatedBundlePriceDelta(bundleTiers, 5, 6, displayPrice)).toBe(75);
  });

  it("uses the next active tier for cart-page optimistic bundle totals", () => {
    const juiceTiers: BundleThreshold[] = [
      { quantity: 1, pricePerUnit: 299 },
      { quantity: 2, pricePerUnit: 289 },
      { quantity: 6, pricePerUnit: 285 },
    ];

    expect(estimatedBundleLineTotal(juiceTiers, 5, 299)).toBe(1445);
    expect(estimatedBundleLineTotal(juiceTiers, 6, 299)).toBe(1710);
    expect(estimatedBundlePriceDelta(juiceTiers, 5, 6, 299)).toBe(265);
  });

  it("does not treat a tier equal to the display price as a discount", () => {
    const equalOnly = [{ quantity: 1, pricePerUnit: displayPrice }];
    expect(estimatedBundleLineTotal(equalOnly, 2, displayPrice)).toBe(500);
    expect(estimatedBundlePriceDelta(equalOnly, 1, 2, displayPrice)).toBe(250);
  });

  it("handles removals, missing bundles, and invalid quantities without negative totals", () => {
    expect(estimatedBundleLineTotal(bundleTiers, 0, displayPrice)).toBe(0);
    expect(estimatedBundlePriceDelta(null, 2, 1, displayPrice)).toBe(250);
    expect(estimatedBundlePriceDelta(undefined, 1, 0, displayPrice)).toBe(250);
  });

  it("accepts bundle progress from product cards", () => {
    const progress: BundleProgress = {
      productId: "s1",
      thresholds: bundleTiers,
      currentQuantity: 2,
    };
    expect(estimatedProgressPriceDelta(progress, 2, 3, displayPrice)).toBe(175);
    expect(estimatedProgressPriceDelta(null, 2, 3, displayPrice)).toBe(250);
  });
});
