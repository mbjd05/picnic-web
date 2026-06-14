import { NextRequest, NextResponse } from "next/server";

import { verify2FAService } from "@/lib/api-services/auth";
import { applyNoStore, readCountryCode, setAuthCookie } from "@/lib/auth";
import { isCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { AuthApiResponse } from "@/lib/types";

/**
 * POST /api/auth/verify-2fa
 *
 * Completes 2FA verification using the partial auth token from the
 * credentials login step and the SMS code entered by the user.
 * On success, sets the auth cookie with the fully-authenticated token.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AuthApiResponse>> {
  if (isCrossOriginUnsafeRequest(request)) {
    return authJson({ success: false, error: "Invalid request origin" }, 403);
  }

  const body = await request.json().catch(() => null);
  const partialToken: string | undefined = body?.partialToken;
  const code: string | undefined = body?.code;
  const countryCode = readCountryCode(request);
  const result = await verify2FAService(partialToken, code, countryCode);

  const response = NextResponse.json<AuthApiResponse>(result.body, { status: result.status });
  if (result.authToken) {
    setAuthCookie(response, result.authToken);
  }
  return applyNoStore(response);
}

function authJson(body: AuthApiResponse, status = 200): NextResponse<AuthApiResponse> {
  return applyNoStore(NextResponse.json<AuthApiResponse>(body, { status }));
}
