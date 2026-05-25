import { NextRequest, NextResponse } from "next/server";

import { isApiAuthError } from "@/lib/api-error";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { buildPicnicClient } from "@/lib/picnic-client";
import { rejectCrossOriginUnsafeRequest } from "@/lib/request-security";
import type { ApiErrorResponse } from "@/lib/types";

const RECIPE_ID_RE = /^[0-9a-f]{24}$/;

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
  if (!RECIPE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  try {
    const countryCode = readCountryCode(request);
    const client = buildPicnicClient(token, countryCode);

    if (shouldSave) {
      await client.recipe.saveRecipe(id);
      return NextResponse.json({ saved: true });
    }

    await client.recipe.unsaveRecipe(id);
    return NextResponse.json({ saved: false });
  } catch (error) {
    if (isApiAuthError(error)) {
      return NextResponse.json(
        { error: "Your token has expired", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[/api/recipe/[id]/saved] Failed:", message);

    return NextResponse.json(
      { error: "Failed to update saved recipe. Please try again later." },
      { status: 502 }
    );
  }
}
