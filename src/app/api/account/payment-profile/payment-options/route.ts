import { NextRequest, NextResponse } from "next/server";

import { readAuthToken, readCountryCode } from "@/lib/auth";
import { createPreferredPaymentOption, mapPaymentRouteError } from "@/lib/picnic-payment";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse, PaymentOptionRequest, PaymentProfile } from "@/lib/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<PaymentProfile | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  let body: PaymentOptionRequest;
  try {
    body = (await request.json()) as PaymentOptionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.paymentMethod || typeof body.paymentMethod !== "string") {
    return NextResponse.json(
      { error: "Missing required field: paymentMethod" },
      { status: 400 }
    );
  }

  try {
    const client = buildPicnicClient(token, readCountryCode(request));
    const profile = await createPreferredPaymentOption(
      client,
      body.paymentMethod,
      body.bankId ?? null
    );

    return NextResponse.json(profile);
  } catch (error) {
    return mapPaymentRouteError(
      error,
      "[/api/account/payment-profile/payment-options] Failed to save option",
      "Kan betaalmethode niet opslaan. Probeer het opnieuw."
    );
  }
}
