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

export const householdDetailsSchema = v.object({
  adults: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(20)),
  children: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(20)),
  cats: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(20)),
  dogs: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(20)),
});

export const accountNameSchema = v.object({
  firstname: nonEmptyStringSchema,
  lastname: v.optional(v.string()),
});

export const consentDeclarationSchema = v.object({
  consent_request_text_id: nonEmptyStringSchema,
  consent_request_locale: nonEmptyStringSchema,
  agreement: v.boolean(),
});

export const consentSettingsUpdateSchema = v.object({
  consent_declarations: v.pipe(v.array(consentDeclarationSchema), v.minLength(1)),
  general_consent: v.optional(v.boolean()),
});

const retrievedAddressSchema = v.object({
  id: nonEmptyStringSchema,
  formatted_address: v.optional(v.nullable(v.string())),
  city: nonEmptyStringSchema,
  street: nonEmptyStringSchema,
  house_number: v.pipe(v.number(), v.integer(), v.minValue(1)),
  house_number_ext: v.optional(v.nullable(v.string())),
  postcode: nonEmptyStringSchema,
  coordinates: v.optional(
    v.nullable(
      v.object({
        latitude: v.optional(v.nullable(v.number())),
        longitude: v.optional(v.nullable(v.number())),
      })
    )
  ),
  signature: nonEmptyStringSchema,
});

export const addressRetrieveSchema = v.object({
  addressId: nonEmptyStringSchema,
});

export const addressUpdateSchema = v.object({
  address: retrievedAddressSchema,
});

export const addressSpecificationSchema = v.object({
  addressId: nonEmptyStringSchema,
  deliveryInstruction: v.optional(v.nullable(v.string())),
  addressSpecification: v.object({
    accessCodes: v.optional(v.array(v.string())),
    buildingType: v.optional(v.nullable(v.picklist(["APARTMENT", "HOUSE", "BUSINESS"]))),
    buildingIdentifier: v.optional(v.nullable(v.string())),
    floor: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(-4), v.maxValue(50)))),
    frontDoorGuidance: v.optional(v.nullable(v.string())),
    elevator: v.optional(v.nullable(v.boolean())),
  }),
});

export const avatarUpdateSchema = v.object({
  type: v.picklist(["STANDARD_SELECTED", "USER_DEFINED"]),
  image_id: nonEmptyStringSchema,
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
export type HouseholdDetailsInput = v.InferOutput<typeof householdDetailsSchema>;
export type AccountNameInput = v.InferOutput<typeof accountNameSchema>;
export type ConsentSettingsUpdateInput = v.InferOutput<typeof consentSettingsUpdateSchema>;
export type AddressRetrieveInput = v.InferOutput<typeof addressRetrieveSchema>;
export type AddressUpdateInput = v.InferOutput<typeof addressUpdateSchema>;
export type AddressSpecificationInput = v.InferOutput<typeof addressSpecificationSchema>;
export type AvatarUpdateInput = v.InferOutput<typeof avatarUpdateSchema>;
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
