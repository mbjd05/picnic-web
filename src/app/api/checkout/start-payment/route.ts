import { NextRequest, NextResponse } from "next/server";

import { startCheckoutPaymentService } from "@/lib/api-services/payments";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse, CheckoutPaymentResponse } from "@/lib/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<CheckoutPaymentResponse | ApiErrorResponse>> {
  const forbidden = rejectCrossOriginUnsafeRequest(request);
  if (forbidden) return forbidden;

  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  const appReturnUrl = new URL("/cart/payment-return", request.nextUrl.origin).toString();
  const result = await startCheckoutPaymentService(token, readCountryCode(request), appReturnUrl);
  return NextResponse.json(result.body, { status: result.status });
}
