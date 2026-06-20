import { NextRequest, NextResponse } from "next/server";

import { cancelCheckoutService } from "@/lib/api-services/payments";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse, CheckoutCancelResponse } from "@/lib/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<CheckoutCancelResponse | ApiErrorResponse>> {
  const forbidden = rejectCrossOriginUnsafeRequest(request);
  if (forbidden) return forbidden;

  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await cancelCheckoutService(token, readCountryCode(request), body);
  return NextResponse.json(result.body, { status: result.status });
}
