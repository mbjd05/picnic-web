import * as v from "valibot";

import type { CartMutationRequest } from "@/types/cart";
import type { CountryCode } from "@/types/locale";
import type { PaymentOptionRequest } from "@/types/payment";

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

const supportedCountryCodes = ["NL", "DE", "FR"] as const;
const twoFactorChannels = ["SMS", "EMAIL"] as const;

const nonEmptyStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const positiveNumberSchema = v.pipe(v.number(), v.finite(), v.minValue(1));
const positiveIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(1));
const nonNegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export const cartMutationSchema = v.object({
  productId: nonEmptyStringSchema,
  action: v.picklist(["add", "remove"]),
  count: positiveIntegerSchema,
});

export const deliverySlotSchema = v.object({
  slotId: nonEmptyStringSchema,
});

export const paymentOptionSchema = v.object({
  paymentMethod: nonEmptyStringSchema,
  bankId: v.optional(v.nullable(v.string())),
});

export const checkoutCancelSchema = v.object({
  transactionId: nonEmptyStringSchema,
});

export const authTokenLoginSchema = v.object({
  token: nonEmptyStringSchema,
  countryCode: v.optional(v.picklist(supportedCountryCodes)),
  twoFactorChannel: v.optional(v.picklist(twoFactorChannels)),
});

export const authCredentialsLoginSchema = v.object({
  email: nonEmptyStringSchema,
  password: nonEmptyStringSchema,
  countryCode: v.optional(v.picklist(supportedCountryCodes)),
  twoFactorChannel: v.optional(v.picklist(twoFactorChannels)),
});

export const twoFactorVerifySchema = v.object({
  partialToken: nonEmptyStringSchema,
  code: nonEmptyStringSchema,
});

export const switchCountrySchema = v.object({
  countryCode: v.picklist(supportedCountryCodes),
});

export const deliveryRatingSchema = v.object({
  rating: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10)),
});

const selectedIngredientSchema = v.object({
  id: nonEmptyStringSchema,
  count: nonNegativeIntegerSchema,
});

export const addRecipeToCartSchema = v.object({
  portions: v.optional(positiveNumberSchema),
  selectedIngredients: v.optional(v.array(selectedIngredientSchema)),
});

export type DeliverySlotInput = v.InferOutput<typeof deliverySlotSchema>;
export type PaymentOptionInput = PaymentOptionRequest;
export type CheckoutCancelInput = v.InferOutput<typeof checkoutCancelSchema>;
export type AuthTokenLoginInput = v.InferOutput<typeof authTokenLoginSchema>;
export type AuthCredentialsLoginInput = v.InferOutput<typeof authCredentialsLoginSchema>;
export type TwoFactorVerifyInput = v.InferOutput<typeof twoFactorVerifySchema>;
export type SwitchCountryInput = { countryCode: CountryCode };
export type DeliveryRatingInput = v.InferOutput<typeof deliveryRatingSchema>;
export type AddRecipeToCartInput = v.InferOutput<typeof addRecipeToCartSchema>;

export function validateInput<T>(
  schema: v.GenericSchema<unknown, T>,
  raw: unknown
): ValidationResult<T> {
  const result = v.safeParse(schema, raw);
  if (result.success) return { ok: true, data: result.output };
  return { ok: false, error: "Invalid request body" };
}

export function validateCartMutation(raw: unknown): ValidationResult<CartMutationRequest> {
  const result = validateInput(cartMutationSchema, raw);
  return result.ok ? { ok: true, data: result.data as CartMutationRequest } : result;
}
