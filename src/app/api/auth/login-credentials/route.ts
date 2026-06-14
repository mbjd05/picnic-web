import { NextRequest, NextResponse } from "next/server";

import { loginWithCredentialsService, resolveAuthCountryCode } from "@/lib/api-services/auth";
import { applyNoStore, readCountryCode, setAuthCookie, setCountryCookie } from "@/lib/auth";
import { isCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { AuthApiResponse } from "@/lib/types";

/**
 * POST /api/auth/login-credentials
 *
 * Authenticates with the Picnic API using email + password.
 * If 2FA is required, triggers an SMS code and returns { success: false, error: "2FA_REQUIRED", partialToken }.
 * If 2FA is not required, validates the token and sets the auth cookie.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AuthApiResponse>> {
  if (isCrossOriginUnsafeRequest(request)) {
    return applyNoStore(
      NextResponse.json<AuthApiResponse>(
        { success: false, error: "Invalid request origin" },
        { status: 403 }
      )
    );
  }

  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;
  const password: string | undefined = body?.password;
  const countryCode = resolveAuthCountryCode(body?.countryCode, readCountryCode(request));
  const result = await loginWithCredentialsService(email, password, countryCode);

  const response = NextResponse.json<AuthApiResponse>(result.body, { status: result.status });
  if (result.authToken) {
    setAuthCookie(response, result.authToken);
  }
  if (result.countryCode) {
    setCountryCookie(response, result.countryCode);
  }
  return applyNoStore(response);
}
