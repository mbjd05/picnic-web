import { NextRequest, NextResponse } from "next/server";

import { searchCookbookService } from "@/lib/api-services/cookbook";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { ApiErrorResponse, CookbookApiResponse } from "@/lib/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<CookbookApiResponse | ApiErrorResponse>> {
  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" as const },
      { status: 401 }
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const countryCode = readCountryCode(request);
  const result = await searchCookbookService(token, countryCode, q);
  return NextResponse.json(result.body, { status: result.status });
}
