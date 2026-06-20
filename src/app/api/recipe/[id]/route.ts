import { NextRequest, NextResponse } from "next/server";

import { getRecipeDetailService } from "@/lib/api-services/recipes";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import type { RecipeDetailApiResponse } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<RecipeDetailApiResponse | { error: string }>> {
  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getRecipeDetailService(
    token,
    readCountryCode(request),
    id,
    request.nextUrl.searchParams.get("portions")
  );
  return NextResponse.json(result.body, { status: result.status });
}
