import { describe, expect, it } from "vitest";

import { parseCartResponse } from "@/lib/parse/cart";

function rawCartItem({
  lineId,
  productId,
  quantity,
  displayPrice,
  price,
  maxCount = 99,
}: {
  lineId: string;
  productId: string;
  quantity: number;
  displayPrice: number;
  price: number;
  maxCount?: number;
}) {
  return {
    id: lineId,
    display_price: displayPrice,
    price,
    decorators: [{ type: "QUANTITY", quantity }],
    items: [
      {
        id: productId,
        name: "Flevosap perensap",
        unit_quantity: "1 liter",
        image_ids: ["image-id"],
        max_count: maxCount,
      },
    ],
  };
}

describe("cart parser", () => {
  it("coalesces mirrored duplicate order lines for the same product", () => {
    const parsed = parseCartResponse(
      {
        checkout_total_price: 747,
        total_count: 3,
        items: [
          rawCartItem({
            lineId: "line-1",
            productId: "s-perensap",
            quantity: 3,
            displayPrice: 747,
            price: 787,
          }),
          rawCartItem({
            lineId: "line-2",
            productId: "s-perensap",
            quantity: 3,
            displayPrice: 747,
            price: 787,
          }),
        ],
      },
      "NL"
    );

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      id: "line-1",
      productId: "s-perensap",
      quantity: 3,
      displayPrice: 747,
      originalPrice: 787,
    });
    expect(parsed.totalCount).toBe(3);
    expect(parsed.totalPrice).toBe(747);
  });

  it("uses the largest mirrored quantity when duplicate lines disagree", () => {
    const parsed = parseCartResponse(
      {
        checkout_total_price: 747,
        total_count: 3,
        items: [
          rawCartItem({
            lineId: "line-1",
            productId: "s-perensap",
            quantity: 2,
            displayPrice: 498,
            price: 538,
            maxCount: 4,
          }),
          rawCartItem({
            lineId: "line-2",
            productId: "s-perensap",
            quantity: 3,
            displayPrice: 747,
            price: 787,
            maxCount: 4,
          }),
        ],
      },
      "NL"
    );

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      id: "line-2",
      productId: "s-perensap",
      quantity: 3,
      displayPrice: 747,
      originalPrice: 787,
      maxCount: 4,
    });
  });
});
