import { NextRequest, NextResponse } from "next/server";

import { removePaymentOptionService } from "@/lib/api-services/payments";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse, PaymentProfile } from "@/lib/types";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paymentOptionId: string }> }
): Promise<NextResponse<PaymentProfile | ApiErrorResponse>> {
  const forbidden = rejectCrossOriginUnsafeRequest(request);
  if (forbidden) return forbidden;

  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  const { paymentOptionId } = await params;
  const result = await removePaymentOptionService(token, readCountryCode(request), paymentOptionId);
  return NextResponse.json(result.body, { status: result.status });
}
