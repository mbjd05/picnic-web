import { NextRequest, NextResponse } from "next/server";

import { getSubcategoriesService } from "@/lib/api-services/products";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { SubcategoriesApiResponse } from "@/lib/category-types";
import type { ApiErrorResponse } from "@/lib/types";

/**
 * GET /api/categories/[categoryId]/subcategories
 *
 * Fetches the L1 category page for the given parent category ID
 * and returns its sub-categories parsed from the PML tree.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
): Promise<NextResponse<SubcategoriesApiResponse | ApiErrorResponse>> {
  const { categoryId } = await params;
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const result = await getSubcategoriesService(token, countryCode, categoryId);
  return NextResponse.json(result.body, { status: result.status });
}
