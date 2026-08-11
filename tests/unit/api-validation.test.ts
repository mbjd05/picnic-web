import { describe, expect, it } from "vitest";

import {
  accountNameSchema,
  addRecipeToCartSchema,
  addressSpecificationSchema,
  addressUpdateSchema,
  authCredentialsLoginSchema,
  avatarUpdateSchema,
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

  it("validates account profile and avatar updates", () => {
    expect(validateInput(accountNameSchema, { firstname: "Ada", lastname: "Lovelace" }).ok).toBe(
      true
    );
    expect(validateInput(accountNameSchema, { firstname: "" }).ok).toBe(false);
    expect(
      validateInput(avatarUpdateSchema, {
        type: "STANDARD_SELECTED",
        image_id: "avatar-1",
      }).ok
    ).toBe(true);
    expect(validateInput(avatarUpdateSchema, { type: "REMOTE_URL", image_id: "avatar-1" }).ok).toBe(
      false
    );
  });

  it("validates selected addresses and delivery specifications", () => {
    const address = {
      id: "address-1",
      city: "Utrecht",
      street: "Voorbeeldstraat",
      house_number: 10,
      postcode: "1234 AB",
      signature: "signed-address",
    };

    expect(validateInput(addressUpdateSchema, { address }).ok).toBe(true);
    expect(
      validateInput(addressUpdateSchema, {
        address: { ...address, house_number: 0 },
      }).ok
    ).toBe(false);
    expect(
      validateInput(addressSpecificationSchema, {
        addressId: address.id,
        addressSpecification: {
          buildingType: "APARTMENT",
          floor: 4,
          elevator: true,
        },
      }).ok
    ).toBe(true);
    expect(
      validateInput(addressSpecificationSchema, {
        addressId: address.id,
        addressSpecification: { floor: 51 },
      }).ok
    ).toBe(false);
  });
});
