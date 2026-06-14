import { NextRequest, NextResponse } from "next/server";

import { readAuthToken, readCountryCode } from "@/lib/auth";
import { mapPaymentRouteError, startCheckoutPayment } from "@/lib/picnic-payment";
import { buildPicnicClient } from "@/lib/picnic-client";
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

  try {
    const client = buildPicnicClient(token, readCountryCode(request));
    const appReturnUrl = new URL("/cart/payment-return", request.nextUrl.origin).toString();
    const result = await startCheckoutPayment(client, appReturnUrl);

    return NextResponse.json(result);
  } catch (error) {
    return mapPaymentRouteError(error, "[/api/checkout/start-payment] Failed to start payment");
  }
}

