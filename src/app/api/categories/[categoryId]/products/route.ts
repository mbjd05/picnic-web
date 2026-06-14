import { NextRequest, NextResponse } from "next/server";

import { getCategoryProductsService } from "@/lib/api-services/products";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { ApiErrorResponse, CategoryProductsApiResponse } from "@/lib/types";

/**
 * GET /api/categories/[categoryId]/products
 *
 * Fetches the L2 category page for the given sub-category ID
 * and returns its products parsed from the PML selling-unit tiles.
 * Sections are extracted when the PML tree contains section headers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
): Promise<NextResponse<CategoryProductsApiResponse | ApiErrorResponse>> {
  const { categoryId } = await params;
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const result = await getCategoryProductsService(token, countryCode, categoryId);
  return NextResponse.json(result.body, { status: result.status });
}
