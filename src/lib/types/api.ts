import type { AuthErrorCode } from "@/lib/types/auth";

export type ApiErrorCode =
  | AuthErrorCode
  | "NO_PREFERRED_PAYMENT_OPTION"
  | "CART_OUT_OF_DATE"
  | "MINIMUM_ORDER_VALUE"
  | "PAYMENT_METHOD_UNAVAILABLE"
  | "PAYMENT_BANK_UNAVAILABLE"
  | "PAYMENT_OPTION_NOT_FOUND"
  | "CHECKOUT_PAYMENT_FAILED";

export type ApiErrorResponse = {
  error: string;
  code?: ApiErrorCode;
};
