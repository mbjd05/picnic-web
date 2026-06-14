import { NextRequest, NextResponse } from "next/server";

import { isApiAuthError } from "@/lib/api-error";
import { applyNoStore, readCountryCode, setAuthCookie, setCountryCookie } from "@/lib/auth";
import { buildPicnicClient } from "@/lib/picnic-client";
import { isCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { AuthApiResponse } from "@/lib/types";
import { type CountryCode, SUPPORTED_COUNTRY_CODES } from "@/lib/types";

/**
 * POST /api/auth/login
 *
 * Validates a Picnic auth token by making a test API call.
 * On success, sets an HTTP-only cookie and returns { success: true }.
 * On failure, returns { success: false, error: <code> }.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AuthApiResponse>> {
  if (isCrossOriginUnsafeRequest(request)) {
    return authJson({ success: false, error: "Invalid request origin" }, 403);
  }

  const body = await request.json().catch(() => null);
  const token: string | undefined = body?.token;
  // Prefer the country from the request body (set by the login page selector);
  // fall back to the existing cookie if absent.
  const rawCode = String(body?.countryCode ?? "").toUpperCase();
  const countryCode: CountryCode = (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(rawCode)
    ? (rawCode as CountryCode)
    : readCountryCode(request);

  if (!token || token.trim() === "") {
    return authJson({ success: false, error: "TOKEN_INVALID" });
  }

  try {
    const trimmedToken = token.trim();
    const client = buildPicnicClient(trimmedToken, countryCode);
    await client.catalog.getSuggestions("");

    const response = NextResponse.json<AuthApiResponse>({ success: true });
    setAuthCookie(response, trimmedToken);
    setCountryCookie(response, countryCode);

    return applyNoStore(response);
  } catch (error) {
    const trimmedToken = token.trim();
    const partialClient = buildPicnicClient(trimmedToken, countryCode);

    try {
      await partialClient.auth.generate2FACode("SMS");

      const response = NextResponse.json<AuthApiResponse>({
        success: false,
        error: "2FA_REQUIRED",
        partialToken: trimmedToken,
      });
      setCountryCookie(response, countryCode);

      return applyNoStore(response);
    } catch {
      // Fall through to the original token validation error handling.
    }

    const isAuthError = isApiAuthError(error);

    if (isAuthError) {
      return authJson({ success: false, error: "TOKEN_INVALID" });
    }

    return authJson({ success: false, error: "API_UNREACHABLE" });
  }
}

function authJson(body: AuthApiResponse, status = 200): NextResponse<AuthApiResponse> {
  return applyNoStore(NextResponse.json<AuthApiResponse>(body, { status }));
}
