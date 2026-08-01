import type { CountryCode } from "@/lib/locale-types";

/** Error codes returned by API routes for auth-related failures. */
export type AuthErrorCode = "TOKEN_EXPIRED" | "TOKEN_INVALID" | "API_UNREACHABLE";
export type TwoFactorChannel = "SMS" | "EMAIL";

/** Response shape from the /api/auth/login route. */
export type AuthApiResponse =
  | { success: true }
  | { success: false; error: string }
  | { success: false; error: "2FA_REQUIRED"; partialToken: string };

export type SwitchCountryResponse = {
  success: true;
  countryCode: CountryCode;
  authenticated: boolean;
};
