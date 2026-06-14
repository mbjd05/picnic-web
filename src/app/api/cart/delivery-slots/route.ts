import { NextRequest, NextResponse } from "next/server";

import { getDeliverySlotsService, setDeliverySlotService } from "@/lib/api-services/cart";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { DeliverySlotPickerData } from "@/lib/delivery-slot-types";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse, CartData } from "@/lib/types";

// ─── GET /api/cart/delivery-slots ────────────────────────────────────────────

/**
 * Fetches all available delivery slots from the Picnic API, parsed and grouped
 * by day with green-choice identification. Used by the slot picker modal.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<DeliverySlotPickerData | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const result = await getDeliverySlotsService(token, countryCode);
  return NextResponse.json(result.body, { status: result.status });
}

// ─── POST /api/cart/delivery-slots ───────────────────────────────────────────

/**
 * Selects a delivery slot. Returns the full updated cart state (same shape as
 * GET /api/cart) so the cart page can reconcile all state in one shot.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CartData | ApiErrorResponse>> {
  const forbidden = rejectCrossOriginUnsafeRequest(request);
  if (forbidden) return forbidden;

  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await setDeliverySlotService(token, countryCode, body);
  return NextResponse.json(result.body, { status: result.status });
}
