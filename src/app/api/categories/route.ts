import { NextRequest, NextResponse } from "next/server";

import { getCategoriesService } from "@/lib/api-services/categories";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { CategoriesApiResponse } from "@/lib/category-types";
import type { ApiErrorResponse } from "@/lib/types";

/**
 * GET /api/categories
 *
 * Fetches both the empty-search-page-root (category list) and
 * home_page_root (shortcut tiles) in parallel, then returns
 * the combined parsed result.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<CategoriesApiResponse | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const result = await getCategoriesService(token, countryCode);
  return NextResponse.json(result.body, { status: result.status });
}
