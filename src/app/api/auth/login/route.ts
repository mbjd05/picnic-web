import { NextRequest, NextResponse } from "next/server";

import { loginWithTokenService, resolveAuthCountryCode } from "@/lib/api-services/auth";
import { applyNoStore, readCountryCode, setAuthCookie, setCountryCookie } from "@/lib/auth";
import { isCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { AuthApiResponse } from "@/lib/types";

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
  const countryCode = resolveAuthCountryCode(body?.countryCode, readCountryCode(request));
  const result = await loginWithTokenService(token, countryCode);

  const response = NextResponse.json<AuthApiResponse>(result.body, { status: result.status });
  if (result.authToken) {
    setAuthCookie(response, result.authToken);
  }
  if (result.countryCode) {
    setCountryCookie(response, result.countryCode);
  }
  return applyNoStore(response);
}

function authJson(body: AuthApiResponse, status = 200): NextResponse<AuthApiResponse> {
  return applyNoStore(NextResponse.json<AuthApiResponse>(body, { status }));
}
