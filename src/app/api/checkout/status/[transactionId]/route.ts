import { NextRequest, NextResponse } from "next/server";

import { getCheckoutStatusService } from "@/lib/api-services/payments";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { ApiErrorResponse, CheckoutStatusResponse } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
): Promise<NextResponse<CheckoutStatusResponse | ApiErrorResponse>> {
  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  const { transactionId } = await params;
  const result = await getCheckoutStatusService(token, readCountryCode(request), transactionId);
  return NextResponse.json(result.body, { status: result.status });
}
