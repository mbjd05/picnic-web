import { NextRequest, NextResponse } from "next/server";

import { getCartService, mutateCartService } from "@/lib/api-services/cart";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse, CartData } from "@/lib/types";

/**
 * GET /api/cart
 *
 * Fetches the user's shopping cart from the Picnic API using the sendRequest
 * cast pattern (same as /api/search and /api/product). The raw response is
 * `unknown` and is validated/transformed at runtime by parseCartResponse.
 * Returns a CartData JSON object.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<CartData | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const result = await getCartService(token, countryCode);
  return NextResponse.json(result.body, { status: result.status });
}

// ─── POST /api/cart ─────────────────────────────────────────────────────────

/**
 * POST /api/cart
 *
 * Adds or removes a product from the user's cart. Reads the `action` field
 * to determine which Picnic API endpoint to call:
 *   - "add"    → POST /cart/add_product
 *   - "remove" → POST /cart/remove_product
 *
 * Both Picnic endpoints return the full cart response, which is parsed by
 * parseCartResponse and returned as CartData.
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

  const result = await mutateCartService(token, countryCode, body);
  return NextResponse.json(result.body, { status: result.status });
}
