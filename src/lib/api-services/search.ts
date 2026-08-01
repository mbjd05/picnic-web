import { isApiTokenExpiredError } from "@/lib/api/error";
import { extractProducts } from "@/lib/extract/products";
import { getTranslations } from "@/lib/i18n/translations";
import { parseFusionSearchSections } from "@/lib/parse/fusion-search";
import { buildPicnicClient } from "@/lib/picnic/client";
import type { ApiErrorResponse } from "@/lib/types/api";
import type { CountryCode } from "@/lib/types/locale";
import type { SearchApiResponse, SearchSection } from "@/lib/types/search";

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

    const metadataPromise = (client as unknown as SearchMetadataClient)
      .sendRequest(
        "GET",
        `/pages/search-page-results?search_term=${encodeURIComponent(query)}`,
        null,
        true
      )
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({ ok: false as const, error }));

    const [rawSellingUnits, metadataResult] = await Promise.all([
      client.catalog.search(query) as Promise<RawSellingUnits>,
      metadataPromise,
    ]);
    const orderedFallbackProducts = extractProducts(rawSellingUnits);

    let parsedSections: SearchSection[] = [];
    const enrichedProductsById = new Map(
      orderedFallbackProducts.map((product) => [product.id, product])
    );

    try {
      if (!metadataResult.ok) throw metadataResult.error;

      const { products: parsedProducts, sections } = parseFusionSearchSections(
        metadataResult.value
      );

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
    if (isApiTokenExpiredError(error)) {
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
