import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { isApiTokenExpiredError } from "@/lib/api-error";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { parseCookbookPage } from "@/lib/parse-cookbook";
import { buildPicnicClient } from "@/lib/picnic-client";

// Server-side cache per country, expires after 5 minutes.
const cache = new Map<string, { counts: Record<string, number>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

type SendRequestClient = {
  sendRequest: (method: string, path: string, body: unknown, fusion: boolean) => Promise<unknown>;
};

export async function GET(
  request: NextRequest
): Promise<NextResponse<Record<string, number> | { error: string }>> {
  const token = readAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const countryCode = readCountryCode(request);
  const cacheKey = `${countryCode}:${crypto.createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.counts);
  }

  try {
    const client = buildPicnicClient(token, countryCode);
    const rawFeaturedPage = await client.recipe.getRecipesPage();
    const rawSavedPage = await (client as unknown as SendRequestClient).sendRequest(
      "GET",
      "/pages/saved-deep-dive-page-content",
      null,
      true
    );

    const counts = {
      __featured__: parseCookbookPage(rawFeaturedPage).length,
      __saved__: parseCookbookPage(rawSavedPage).length,
    };
    cache.set(cacheKey, { counts, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(counts);
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return NextResponse.json({ error: "Your token has expired" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load counts" }, { status: 502 });
  }
}
