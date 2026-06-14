import { NextRequest, NextResponse } from "next/server";

import { searchProductsService } from "@/lib/api-services/search";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { ApiErrorResponse, SearchApiResponse } from "@/lib/types";

/**
 * GET /api/search?q=<query>
 *
 * Searches the Picnic catalog and returns transformed Product[].
 *
 * catalog.search() is used as the source of truth for search relevance/order.
 * The raw Fusion page is still parsed so Picnic's secondary sections, such as
 * "Bekijk ook", remain available to the UI.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SearchApiResponse | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const result = await searchProductsService(token, countryCode, query);
  return NextResponse.json(result.body, { status: result.status });
}
