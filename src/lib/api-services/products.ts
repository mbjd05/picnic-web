import { isApiTokenExpiredError } from "@/lib/api/error";
import type { SubcategoriesApiResponse } from "@/lib/types/category";
import { parseProductDetailPage } from "@/lib/parse/fusion-product";
import { parseCategoryPageSections } from "@/lib/parse/fusion-search";
import { extractPageTitle, parseSubcategoryPage } from "@/lib/parse/subcategories";
import { buildPicnicClient } from "@/lib/picnic/client";
import type { ApiErrorResponse } from "@/lib/types/api";
import type {
  CategoryProductsApiResponse,
  SearchSuggestion,
  SuggestionsApiResponse,
} from "@/lib/types/search";
import type { CountryCode } from "@/lib/types/locale";
import type { ProductDetail } from "@/lib/types/product";

import type { ApiServiceResult } from "./types";

const L1_PAGE_PREFIX = "L1-category-page-root?category_id=";
const L2_PAGE_PREFIX = "L2-category-page-root?category_id=";

type FusionRequestClient = {
  sendRequest: (
    method: string,
    path: string,
    body: null,
    includeFusion: boolean
  ) => Promise<unknown>;
};

export async function getProductDetailService(
  authToken: string,
  countryCode: CountryCode,
  productId: string
): Promise<ApiServiceResult<ProductDetail | ApiErrorResponse>> {
  if (!productId) {
    return { body: { error: "Product not found" }, status: 404 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawPage = await (client as unknown as FusionRequestClient).sendRequest(
      "GET",
      `/pages/product-details-page-root?id=${encodeURIComponent(productId)}&show_category_action=true&show_remove_from_purchases_page_action=true`,
      null,
      true
    );

    const productDetail = parseProductDetailPage(rawPage, productId);
    if (!productDetail.name) {
      return { body: { error: "Product not found" }, status: 404 };
    }

    return { body: productDetail };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[product service] Failed for productId="${productId}":`, message);

    return {
      body: { error: "Failed to fetch product details. Please try again later." },
      status: 502,
    };
  }
}

export async function getSuggestionsService(
  authToken: string,
  countryCode: CountryCode,
  rawQuery: string
): Promise<ApiServiceResult<SuggestionsApiResponse | ApiErrorResponse>> {
  const query = rawQuery.trim();
  if (query === "") {
    return { body: { suggestions: [], query: "" } };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawSuggestions: Array<{ id: string; suggestion: string }> =
      await client.catalog.getSuggestions(query);

    const suggestions: SearchSuggestion[] = rawSuggestions.map((suggestion) => ({
      id: suggestion.id,
      suggestion: suggestion.suggestion,
    }));

    return { body: { suggestions, query } };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[suggestions service] Failed:", message);

    return {
      body: { error: "Failed to fetch suggestions. Please try again later." },
      status: 502,
    };
  }
}

export async function getSubcategoriesService(
  authToken: string,
  countryCode: CountryCode,
  categoryId: string
): Promise<ApiServiceResult<SubcategoriesApiResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawPage = await client.app.getPage(`${L1_PAGE_PREFIX}${categoryId}`);
    const title = extractPageTitle(rawPage) ?? categoryId;
    const subcategories = parseSubcategoryPage(rawPage);

    return { body: { title, subcategories } };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[subcategories service] Failed for categoryId="${categoryId}":`, message);

    return {
      body: { error: "Subcategories are not loading. Please try again later." },
      status: 502,
    };
  }
}

export async function getCategoryProductsService(
  authToken: string,
  countryCode: CountryCode,
  categoryId: string
): Promise<ApiServiceResult<CategoryProductsApiResponse | ApiErrorResponse>> {
  return getProductsPageService(authToken, countryCode, `${L2_PAGE_PREFIX}${categoryId}`, {
    logContext: `categoryId="${categoryId}"`,
  });
}

export async function getArbitraryProductsPageService(
  authToken: string,
  countryCode: CountryCode,
  pageId: string | null
): Promise<ApiServiceResult<CategoryProductsApiResponse | ApiErrorResponse>> {
  if (!pageId) {
    return { body: { error: "Missing pageId parameter" }, status: 400 };
  }

  return getProductsPageService(authToken, countryCode, pageId, {
    logContext: `pageId="${pageId}"`,
  });
}

async function getProductsPageService(
  authToken: string,
  countryCode: CountryCode,
  pageId: string,
  options: { logContext: string }
): Promise<ApiServiceResult<CategoryProductsApiResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawPage = await client.app.getPage(pageId);
    const title = extractPageTitle(rawPage);
    const { sections, products } = parseCategoryPageSections(rawPage);

    return { body: { title, products, sections } };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[products page service] Failed for ${options.logContext}:`, message);

    return {
      body: { error: "Failed to load products. Please try again later." },
      status: 502,
    };
  }
}
