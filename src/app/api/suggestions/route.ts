import { NextRequest, NextResponse } from "next/server";

import { getSuggestionsService } from "@/lib/api-services/products";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { ApiErrorResponse, SuggestionsApiResponse } from "@/lib/types";

/**
 * GET /api/suggestions?q=<query>
 *
 * Returns search suggestions from the Picnic API.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SuggestionsApiResponse | ApiErrorResponse>> {
  const token = readAuthToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const countryCode = readCountryCode(request);
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const result = await getSuggestionsService(token, countryCode, query);
  return NextResponse.json(result.body, { status: result.status });
}
