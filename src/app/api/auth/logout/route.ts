import { NextRequest, NextResponse } from "next/server";

import { applyNoStore, clearAuthCookie } from "@/lib/auth";
import { isCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { AuthApiResponse } from "@/lib/types";

/**
 * POST /api/auth/logout
 *
 * Clears the auth cookie and returns success.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AuthApiResponse>> {
  if (isCrossOriginUnsafeRequest(request)) {
    return authJson({ success: false, error: "Invalid request origin" }, 403);
  }

  const response = NextResponse.json<AuthApiResponse>({ success: true });
  clearAuthCookie(response);

  return applyNoStore(response);
}

function authJson(body: AuthApiResponse, status = 200): NextResponse<AuthApiResponse> {
  return applyNoStore(NextResponse.json<AuthApiResponse>(body, { status }));
}
