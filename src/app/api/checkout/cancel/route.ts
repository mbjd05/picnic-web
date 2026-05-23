import { NextRequest, NextResponse } from "next/server";

import { readAuthToken, readCountryCode } from "@/lib/auth";
import { mapPaymentRouteError, sendPicnicRequest } from "@/lib/picnic-payment";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse, CheckoutCancelResponse } from "@/lib/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<CheckoutCancelResponse | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  let body: { transactionId?: string };
  try {
    body = (await request.json()) as { transactionId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.transactionId || typeof body.transactionId !== "string") {
    return NextResponse.json(
      { error: "Missing required field: transactionId" },
      { status: 400 }
    );
  }

  try {
    const client = buildPicnicClient(token, readCountryCode(request));
    await sendPicnicRequest(
      client,
      "POST",
      "/cart/checkout/cancel",
      { transaction_id: body.transactionId },
      true
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapPaymentRouteError(error, "[/api/checkout/cancel] Failed to cancel payment");
  }
}

