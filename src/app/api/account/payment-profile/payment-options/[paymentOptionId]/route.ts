import { NextRequest, NextResponse } from "next/server";

import { readAuthToken, readCountryCode } from "@/lib/auth";
import { mapPaymentRouteError, removePaymentOption } from "@/lib/picnic-payment";
import { buildPicnicClient } from "@/lib/picnic-client";
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

  if (!paymentOptionId) {
    return NextResponse.json(
      { error: "Missing required route parameter: paymentOptionId" },
      { status: 400 }
    );
  }

  try {
    const client = buildPicnicClient(token, readCountryCode(request));
    const profile = await removePaymentOption(client, paymentOptionId);

    return NextResponse.json(profile);
  } catch (error) {
    return mapPaymentRouteError(
      error,
      "[/api/account/payment-profile/payment-options] Failed to delete option",
      "Kan betaalmethode niet verwijderen. Probeer het opnieuw."
    );
  }
}
