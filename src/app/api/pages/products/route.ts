import { NextRequest, NextResponse } from "next/server";

import { getArbitraryProductsPageService } from "@/lib/api-services/products";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { ApiErrorResponse, CategoryProductsApiResponse } from "@/lib/types";

/**
 * GET /api/pages/products?pageId=...
 *
 * Fetches an arbitrary Picnic page by its full page ID (as extracted
 * from a deep-link target) and returns any products found in the PML
 * tree. Works for promotional pages, campaign pages, and category
 * pages alike.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<CategoryProductsApiResponse | ApiErrorResponse>> {
  const pageId = request.nextUrl.searchParams.get("pageId");

  if (!pageId) {
    return NextResponse.json({ error: "Missing pageId parameter" }, { status: 400 });
  }

  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const result = await getArbitraryProductsPageService(token, countryCode, pageId);
  return NextResponse.json(result.body, { status: result.status });
}
