import { describe, expect, it } from "vitest";

import { getCartQuantityCorrections } from "@/lib/cart/validity";
import type { CartData, CartItem } from "@/types/cart";

function cartItem(overrides: Partial<CartItem>): CartItem {
  return {
    id: "line-id",
    productId: "product-id",
    name: "Product",
    unitQuantity: "1 stuk",
    imageId: "",
    displayPrice: 100,
    originalPrice: null,
    quantity: 1,
    maxCount: 99,
    badges: [],
    priceRanges: null,
    isUnavailable: false,
    unavailableExplanation: null,
    replacements: [],
    ...overrides,
  };
}

function cart(items: CartItem[]): CartData {
  return {
    items,
    totalPrice: 0,
    totalCount: 0,
    totalDiscount: 0,
    depositTotal: 0,
    depositBreakdown: [],
    membershipSavings: 0,
    fees: [],
    minimumOrderValue: null,
    suggestions: [],
    selectedSlot: null,
    deliveryBannerText: "",
  };
}

describe("cart validity", () => {
  it("does not correct quantities inside the Picnic max boundary", () => {
    expect(
      getCartQuantityCorrections(cart([cartItem({ productId: "s1", quantity: 3, maxCount: 4 })]))
    ).toEqual([]);
  });

  it("calculates remove corrections for quantities above max count", () => {
    expect(
      getCartQuantityCorrections(
        cart([
          cartItem({ productId: "s1", quantity: 6, maxCount: 4 }),
          cartItem({ productId: "s2", quantity: 2, maxCount: 0 }),
        ])
      )
    ).toEqual([
      { productId: "s1", removeCount: 2 },
      { productId: "s2", removeCount: 2 },
    ]);
  });
});
