import { NextRequest, NextResponse } from "next/server";

import { isApiAuthError } from "@/lib/api-error";
import { readAuthToken, readCountryCode } from "@/lib/auth";
import { extractProducts } from "@/lib/extract-products";
import { parseFusionSearchSections } from "@/lib/parse-fusion-search";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse, SearchApiResponse, SearchSection } from "@/lib/types";

type RawSellingUnits = Parameters<typeof extractProducts>[0];

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

  if (query === "") {
    return NextResponse.json({ products: [], sections: [], query: "" });
  }

  try {
    const client = buildPicnicClient(token, countryCode);

    const rawSellingUnits = (await client.catalog.search(query)) as RawSellingUnits;
    const orderedFallbackProducts = extractProducts(rawSellingUnits);

    let parsedSections: SearchSection[] = [];
    let enrichedProductsById = new Map(
      orderedFallbackProducts.map((product) => [product.id, product])
    );

    try {
      const rawPage = await (
        client as unknown as {
          sendRequest: (
            method: string,
            path: string,
            body: null,
            includeFusion: boolean
          ) => Promise<unknown>;
        }
      ).sendRequest(
        "GET",
        `/pages/search-page-results?search_term=${encodeURIComponent(query)}`,
        null,
        true
      );

      const { products: parsedProducts, sections } = parseFusionSearchSections(rawPage);

      parsedSections = sections;
      enrichedProductsById = new Map([
        ...orderedFallbackProducts.map((product) => [product.id, product] as const),
        ...parsedProducts.map((product) => [product.id, product] as const),
      ]);
    } catch (metadataError) {
      const message =
        metadataError instanceof Error ? metadataError.message : "Unknown metadata parse error";
      console.warn("[/api/search] Falling back to catalog.search() product metadata:", message);
    }

    const products = orderedFallbackProducts.map(
      (product) => enrichedProductsById.get(product.id) ?? product
    );

    const sections: SearchSection[] = [
      {
        title: `Zoekresultaten voor "${query}"`,
        products,
      },
      ...parsedSections,
    ];

    return NextResponse.json({
      products,
      sections,
      query,
    });
  } catch (error) {
    if (isApiAuthError(error)) {
      return NextResponse.json(
        { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        { status: 401 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[/api/search] Failed to search:", message);

    return NextResponse.json(
      { error: "Failed to search for products. Please try again later." },
      { status: 502 }
    );
  }
}