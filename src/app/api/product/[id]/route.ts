import { NextRequest, NextResponse } from "next/server";

import { getProductDetailService } from "@/lib/api-services/products";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { ApiErrorResponse, ProductDetail } from "@/lib/types";

/**
 * GET /api/product/[id]
 *
 * Fetches product details by requesting the raw product-details-page-root
 * Fusion page and parsing it server-side. Returns a ProductDetail JSON object.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ProductDetail | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);

  const { id: productId } = await params;

  const result = await getProductDetailService(token, countryCode, productId);
  return NextResponse.json(result.body, { status: result.status });
}
