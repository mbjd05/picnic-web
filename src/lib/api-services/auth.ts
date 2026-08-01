import { is2FAError, isApiAuthError } from "@/lib/api/error";
import { buildPicnicClient, buildPicnicClientAnonymous } from "@/lib/picnic/client";
import type { AuthApiResponse, TwoFactorChannel } from "@/lib/types/auth";
import type { CountryCode } from "@/lib/types/locale";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/types/locale";

import type { ApiServiceResult } from "./types";

export type AuthServiceResult = ApiServiceResult<AuthApiResponse> & {
  authToken?: string;
  countryCode?: CountryCode;
};

export function resolveAuthCountryCode(rawCode: unknown, fallback: CountryCode): CountryCode {
  const countryCode = String(rawCode ?? "").toUpperCase();
  return (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(countryCode)
    ? (countryCode as CountryCode)
    : fallback;
}

export async function loginWithTokenService(
  token: string | undefined,
  countryCode: CountryCode,
  twoFactorChannel: TwoFactorChannel = "SMS"
): Promise<AuthServiceResult> {
  if (!token || token.trim() === "") {
    return { body: { success: false, error: "TOKEN_INVALID" } };
  }

  const trimmedToken = token.trim();

  try {
    const client = buildPicnicClient(trimmedToken, countryCode);
    await client.catalog.getSuggestions("");

    return {
      body: { success: true },
      authToken: trimmedToken,
      countryCode,
    };
  } catch (error) {
    const partialClient = buildPicnicClient(trimmedToken, countryCode);

    try {
      await partialClient.auth.generate2FACode(twoFactorChannel);

      return {
        body: {
          success: false,
          error: "2FA_REQUIRED",
          partialToken: trimmedToken,
        },
        countryCode,
      };
    } catch {
      // Fall through to the original token validation error handling.
    }

    if (isApiAuthError(error)) {
      return { body: { success: false, error: "TOKEN_INVALID" } };
    }

    return { body: { success: false, error: "API_UNREACHABLE" } };
  }
}

export async function loginWithCredentialsService(
  email: string | undefined,
  password: string | undefined,
  countryCode: CountryCode,
  twoFactorChannel: TwoFactorChannel = "SMS"
): Promise<AuthServiceResult> {
  if (!email || email.trim() === "" || !password || password.trim() === "") {
    return { body: { success: false, error: "CREDENTIALS_INVALID" } };
  }

  try {
    const client = buildPicnicClientAnonymous(countryCode);
    const result = await client.auth.login(email.trim(), password);

    const authKey = result.authKey || client.authKey;
    if (!authKey) {
      return { body: { success: false, error: "CREDENTIALS_INVALID" } };
    }

    if (result.second_factor_authentication_required) {
      try {
        await client.auth.generate2FACode(twoFactorChannel);
      } catch (error) {
        if (!canContinueAfter2FAGenerationError(error)) {
          return { body: { success: false, error: "API_UNREACHABLE" } };
        }
      }

      return {
        body: {
          success: false,
          error: "2FA_REQUIRED",
          partialToken: authKey,
        },
        countryCode,
      };
    }

    const validatedClient = buildPicnicClient(authKey, countryCode);
    await validatedClient.catalog.getSuggestions("");

    return {
      body: { success: true },
      authToken: authKey,
      countryCode,
    };
  } catch (error) {
    if (isApiAuthError(error)) {
      return { body: { success: false, error: "CREDENTIALS_INVALID" } };
    }

    return { body: { success: false, error: "API_UNREACHABLE" } };
  }
}

export function resolveTwoFactorChannel(rawChannel: unknown): TwoFactorChannel {
  return rawChannel === "EMAIL" ? "EMAIL" : "SMS";
}

export async function verify2FAService(
  partialToken: string | undefined,
  code: string | undefined,
  countryCode: CountryCode
): Promise<AuthServiceResult> {
  if (!partialToken || !code || code.trim() === "") {
    return { body: { success: false, error: "2FA_INVALID" } };
  }

  try {
    const client = buildPicnicClient(partialToken, countryCode);
    const result = await client.auth.verify2FACode(code.trim());

    const authKey = result.authKey || client.authKey;
    if (!authKey) {
      return { body: { success: false, error: "2FA_INVALID" } };
    }

    const validatedClient = buildPicnicClient(authKey, countryCode);
    await validatedClient.catalog.getSuggestions("");

    return {
      body: { success: true },
      authToken: authKey,
      countryCode,
    };
  } catch (error) {
    if (is2FAError(error)) {
      return { body: { success: false, error: "2FA_INVALID" } };
    }

    return { body: { success: false, error: "API_UNREACHABLE" } };
  }
}

function canContinueAfter2FAGenerationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("already") ||
    message.includes("sent") ||
    message.includes("required") ||
    message.includes("2fa")
  );
}
