import type {
  AvailablePaymentMethod,
  PaymentMethod,
  PaymentProfile,
  StoredPaymentOption,
} from "@/lib/payment-types";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

export function isEmptyJsonResponseError(error: unknown): boolean {
  return getErrorMessage(error).includes("Unexpected end of JSON input");
}

export function getPreferredPaymentOption(profile: PaymentProfile): StoredPaymentOption | null {
  const preferredId = profile.preferred_payment_option_id;
  if (!preferredId) return null;

  return profile.stored_payment_options?.find((option) => option.id === preferredId) ?? null;
}

export function getPreferredPaymentOptionForMethod(
  profile: PaymentProfile,
  paymentMethod: string
): StoredPaymentOption | null {
  const preferred = getPreferredPaymentOption(profile);
  if (!preferred) return null;

  return preferred.payment_method === paymentMethod ? preferred : null;
}

export function getAvailablePaymentMethod(
  profile: PaymentProfile,
  paymentMethod: string
): AvailablePaymentMethod | null {
  return (
    profile.available_payment_methods?.find((method) => method.payment_method === paymentMethod) ??
    null
  );
}

export function getPaymentMethodDetails(
  profile: PaymentProfile,
  paymentMethod: string
): PaymentMethod | null {
  return profile.payment_methods?.find((method) => method.payment_method === paymentMethod) ?? null;
}

export function getPaymentDisplayName(profile: PaymentProfile, paymentMethod: string): string {
  if (paymentMethod === "IDEAL") {
    return "iDEAL | Wero";
  }

  return getPaymentMethodDetails(profile, paymentMethod)?.display_name ?? paymentMethod;
}
