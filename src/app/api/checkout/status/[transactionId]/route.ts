import { NextRequest, NextResponse } from "next/server";

import { readAuthToken, readCountryCode } from "@/lib/auth";
import { getErrorMessage } from "@/lib/payment";
import { mapPaymentRouteError, sendPicnicRequest } from "@/lib/picnic-payment";
import { buildPicnicClient } from "@/lib/picnic-client";
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

  if (!transactionId) {
    return NextResponse.json(
      { error: "Missing required route parameter: transactionId" },
      { status: 400 }
    );
  }

  try {
    const client = buildPicnicClient(token, readCountryCode(request));
    const raw = await sendPicnicRequest(
      client,
      "GET",
      `/cart/checkout/${encodeURIComponent(transactionId)}/status`,
      null,
      false
    );

    return NextResponse.json({ raw });
  } catch (error) {
    const message = getErrorMessage(error);
    const status = (error as { response?: { status?: number } }).response?.status;

    if (status === 404 || message === "Not Found" || message.includes("Not Found")) {
      return NextResponse.json({
        inactive: true,
        status: "NOT_FOUND",
      });
    }

    return mapPaymentRouteError(error, "[/api/checkout/status] Failed to fetch status");
  }
}

