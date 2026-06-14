import { isApiAuthError } from "@/lib/api-error";
import { extractProducts } from "@/lib/extract-products";
import { getTranslations } from "@/lib/i18n";
import { parseFusionSearchSections } from "@/lib/parse-fusion-search";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse, CountryCode, SearchApiResponse, SearchSection } from "@/lib/types";

import type { ApiServiceResult } from "./types";

type RawSellingUnits = Parameters<typeof extractProducts>[0];

type SearchMetadataClient = {
  sendRequest: (
    method: string,
    path: string,
    body: null,
    includeFusion: boolean
  ) => Promise<unknown>;
};

export async function searchProductsService(
  authToken: string,
  countryCode: CountryCode,
  rawQuery: string
): Promise<ApiServiceResult<SearchApiResponse | ApiErrorResponse>> {
  const query = rawQuery.trim();
  if (query === "") {
    return { body: { products: [], sections: [], query: "" } };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const t = getTranslations(countryCode);

    const rawSellingUnits = (await client.catalog.search(query)) as RawSellingUnits;
    const orderedFallbackProducts = extractProducts(rawSellingUnits);

    let parsedSections: SearchSection[] = [];
    const enrichedProductsById = new Map(
      orderedFallbackProducts.map((product) => [product.id, product])
    );

    try {
      const rawPage = await (client as unknown as SearchMetadataClient).sendRequest(
        "GET",
        `/pages/search-page-results?search_term=${encodeURIComponent(query)}`,
        null,
        true
      );

      const { products: parsedProducts, sections } = parseFusionSearchSections(rawPage);

      parsedSections = sections;
      for (const product of parsedProducts) {
        if (!enrichedProductsById.has(product.id)) {
          enrichedProductsById.set(product.id, product);
        }
      }
    } catch (metadataError) {
      const message =
        metadataError instanceof Error ? metadataError.message : "Unknown metadata parse error";
      console.warn("[search service] Falling back to catalog.search() product metadata:", message);
    }

    const products = orderedFallbackProducts.map(
      (product) => enrichedProductsById.get(product.id) ?? product
    );

    return {
      body: {
        products,
        sections: [
          {
            title: `${t.allResultsFor} "${query}"`,
            products,
          },
          ...parsedSections,
        ],
        query,
      },
    };
  } catch (error) {
    if (isApiAuthError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[search service] Failed to search:", message);

    return {
      body: { error: "Failed to search for products. Please try again later." },
      status: 502,
    };
  }
}
