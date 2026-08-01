import { isApiTokenExpiredError } from "@/lib/api/error";
import { extractProducts } from "@/lib/extract/products";
import { getTranslations } from "@/lib/i18n/translations";
import { parseFusionSearchSections } from "@/lib/parse/fusion-search";
import { buildPicnicClient } from "@/lib/picnic/client";
import type { ApiErrorResponse } from "@/types/api";
import type { CountryCode } from "@/types/locale";
import type { SearchApiResponse, SearchSection } from "@/types/search";

import type { ApiServiceResult } from "./types";

type RawSellingUnits = Parameters<typeof extractProducts>[0];

const ALL_RESULTS_SECTION_TITLES = new Set([
  "alle resultaten",
  "alle ergebnisse",
  "tous les résultats",
  "all results",
]);

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
    const sections = buildMergedSearchSections(
      parsedSections,
      products,
      `${t.allResultsFor} "${query}"`
    );

    return {
      body: {
        products,
        sections,
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

function buildMergedSearchSections(
  parsedSections: SearchSection[],
  catalogProducts: SearchApiResponse["products"],
  allResultsTitle: string
): SearchSection[] {
  if (parsedSections.length === 0) {
    return [{ title: allResultsTitle, products: catalogProducts }];
  }

  const seenIds = new Set(parsedSections.flatMap((section) => section.products.map((p) => p.id)));
  const catalogOnlyProducts = catalogProducts.filter((product) => !seenIds.has(product.id));
  const allResultsIndex = parsedSections.findIndex((section) => isAllResultsSection(section.title));
  if (allResultsIndex === -1) {
    return catalogOnlyProducts.length
      ? [{ title: allResultsTitle, products: catalogOnlyProducts }, ...parsedSections]
      : parsedSections;
  }

  return parsedSections.map((section, index) =>
    index === allResultsIndex
      ? { title: allResultsTitle, products: [...section.products, ...catalogOnlyProducts] }
      : section
  );
}

function isAllResultsSection(title: string): boolean {
  return ALL_RESULTS_SECTION_TITLES.has(title.trim().toLocaleLowerCase());
}
