import { describe, expect, it } from "vitest";

import {
  addRecipeToCartSchema,
  authCredentialsLoginSchema,
  deliveryRatingSchema,
  paymentOptionSchema,
  validateCartMutation,
  validateInput,
} from "@/lib/api/validation";

describe("API validation schemas", () => {
  it("accepts valid cart mutations and rejects invalid actions", () => {
    expect(validateCartMutation({ productId: "s1", action: "add", count: 2 })).toEqual({
      ok: true,
      data: { productId: "s1", action: "add", count: 2 },
    });
    expect(validateCartMutation({ productId: "s1", action: "clear", count: 2 }).ok).toBe(false);
  });

  it("validates payment option bodies with optional bank ids", () => {
    expect(validateInput(paymentOptionSchema, { paymentMethod: "IDEAL", bankId: "asn" })).toEqual({
      ok: true,
      data: { paymentMethod: "IDEAL", bankId: "asn" },
    });
    expect(validateInput(paymentOptionSchema, { bankId: "asn" }).ok).toBe(false);
  });

  it("validates auth credentials and delivery ratings", () => {
    expect(
      validateInput(authCredentialsLoginSchema, {
        email: "user@example.test",
        password: "secret",
        countryCode: "NL",
      }).ok
    ).toBe(true);
    expect(validateInput(deliveryRatingSchema, { rating: 10 }).ok).toBe(true);
    expect(validateInput(deliveryRatingSchema, { rating: 11 }).ok).toBe(false);
  });

  it("validates recipe cart additions with selected ingredients", () => {
    expect(
      validateInput(addRecipeToCartSchema, {
        portions: 4,
        selectedIngredients: [{ id: "s1", count: 2 }],
      }).ok
    ).toBe(true);
    expect(
      validateInput(addRecipeToCartSchema, { selectedIngredients: [{ id: "", count: 2 }] }).ok
    ).toBe(false);
  });
});
