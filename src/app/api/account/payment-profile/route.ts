import { NextRequest, NextResponse } from "next/server";

import { createPaymentOptionService, getPaymentProfileService } from "@/lib/api-services/payments";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse, PaymentProfile } from "@/lib/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<PaymentProfile | ApiErrorResponse>> {
  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  const result = await getPaymentProfileService(token, readCountryCode(request));
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(
  request: NextRequest
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createPaymentOptionService(token, readCountryCode(request), body);
  return NextResponse.json(result.body, { status: result.status });
}
