import { NextRequest, NextResponse } from "next/server";

import { isApiAuthError } from "@/lib/api-error";
import { applyNoStore, readCountryCode, setAuthCookie, setCountryCookie } from "@/lib/auth";
import { buildPicnicClient, buildPicnicClientAnonymous } from "@/lib/picnic-client";
import { isCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { AuthApiResponse } from "@/lib/types";
import { type CountryCode, SUPPORTED_COUNTRY_CODES } from "@/lib/types";

/**
 * POST /api/auth/login-credentials
 *
 * Authenticates with the Picnic API using email + password.
 * If 2FA is required, triggers an SMS code and returns { success: false, error: "2FA_REQUIRED", partialToken }.
 * If 2FA is not required, validates the token and sets the auth cookie.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AuthApiResponse>> {
  if (isCrossOriginUnsafeRequest(request)) {
    return authJson({ success: false, error: "Invalid request origin" }, 403);
  }

  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;
  const password: string | undefined = body?.password;
  const rawCode = String(body?.countryCode ?? "").toUpperCase();
  const countryCode: CountryCode = (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(rawCode)
    ? (rawCode as CountryCode)
    : readCountryCode(request);

  if (!email || email.trim() === "" || !password || password.trim() === "") {
    return authJson({
      success: false,
      error: "CREDENTIALS_INVALID",
    });
  }

  try {
    const client = buildPicnicClientAnonymous(countryCode);
    const result = await client.auth.login(email.trim(), password);

    const authKey = result.authKey || client.authKey;
    if (!authKey) {
      return authJson({
        success: false,
        error: "CREDENTIALS_INVALID",
      });
    }

    if (result.second_factor_authentication_required) {
      // Trigger the 2FA SMS code, then return the partial token to the client
      // so it can be used in the /api/auth/verify-2fa step.
      try {
        await client.auth.generate2FACode("SMS");
      } catch (error) {
        if (!canContinueAfter2FAGenerationError(error)) {
          return authJson({ success: false, error: "API_UNREACHABLE" });
        }
      }
      // Store the country cookie now so verify-2fa can read it.
      const response = NextResponse.json<AuthApiResponse>({
        success: false,
        error: "2FA_REQUIRED" as const,
        partialToken: authKey,
      });
      setCountryCookie(response, countryCode);
      return applyNoStore(response);
    }

    // No 2FA required — validate the token before storing it.
    const validatedClient = buildPicnicClient(authKey, countryCode);
    await validatedClient.catalog.getSuggestions("");

    const response = NextResponse.json<AuthApiResponse>({ success: true });
    setAuthCookie(response, authKey);
    setCountryCookie(response, countryCode);

    return applyNoStore(response);
  } catch (error) {
    if (isApiAuthError(error)) {
      return authJson({
        success: false,
        error: "CREDENTIALS_INVALID",
      });
    }

    return authJson({ success: false, error: "API_UNREACHABLE" });
  }
}

function authJson(body: AuthApiResponse, status = 200): NextResponse<AuthApiResponse> {
  return applyNoStore(NextResponse.json<AuthApiResponse>(body, { status }));
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
