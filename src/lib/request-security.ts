import { NextRequest, NextResponse } from "next/server";

import type { ApiErrorResponse } from "./types";

const CROSS_SITE = "cross-site";

export function rejectCrossOriginUnsafeRequest(
  request: NextRequest
): NextResponse<ApiErrorResponse> | null {
  if (isCrossOriginUnsafeRequest(request)) {
    return forbiddenOriginResponse();
  }

  return null;
}

export function isCrossOriginUnsafeRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return true;
  }

  if (!origin && request.headers.get("sec-fetch-site") === CROSS_SITE) {
    return true;
  }

  return false;
}

function forbiddenOriginResponse(): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
}
