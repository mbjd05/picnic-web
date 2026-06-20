import { NextRequest, NextResponse } from "next/server";

import { getCookbookCountsService } from "@/lib/api-services/recipes";
import { readAuthToken, readCountryCode } from "@/lib/auth";

export async function GET(
  request: NextRequest
): Promise<NextResponse<Record<string, number> | { error: string }>> {
  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const result = await getCookbookCountsService(token, readCountryCode(request));
  return NextResponse.json(result.body, { status: result.status });
}
