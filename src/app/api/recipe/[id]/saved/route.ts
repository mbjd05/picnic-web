import { NextRequest, NextResponse } from "next/server";

import { updateSavedRecipeService } from "@/lib/api-services/recipes";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ saved: boolean } | ApiErrorResponse>> {
  return updateSavedState(request, params, true);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ saved: boolean } | ApiErrorResponse>> {
  return updateSavedState(request, params, false);
}

async function updateSavedState(
  request: NextRequest,
  params: Promise<{ id: string }>,
  shouldSave: boolean
): Promise<NextResponse<{ saved: boolean } | ApiErrorResponse>> {
  const forbidden = rejectCrossOriginUnsafeRequest(request);
  if (forbidden) return forbidden;

  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required", code: "TOKEN_EXPIRED" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await updateSavedRecipeService(token, readCountryCode(request), id, shouldSave);
  return NextResponse.json(result.body, { status: result.status });
}
