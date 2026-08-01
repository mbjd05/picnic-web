import { isApiTokenExpiredError } from "@/lib/api-error";
import { parseCookbookPage } from "@/lib/parse-cookbook";
import { buildPicnicClient } from "@/lib/picnic-client";
import {
  discoverRecipeCategories,
  fetchRecipeCategoryPage,
  isRecipeCategoryId,
} from "@/lib/recipe-categories";
import type { ApiErrorResponse } from "@/lib/types/api";
import type { CookbookApiResponse } from "@/lib/types/recipe";
import type { CountryCode } from "@/lib/types/locale";

import type { ApiServiceResult } from "./types";

const SAVED_PAGE_ID = "saved-deep-dive-page-content";

type SendRequestClient = {
  sendRequest: (method: string, path: string, body: unknown, fusion: boolean) => Promise<unknown>;
};

export async function getCookbookService(
  authToken: string,
  countryCode: CountryCode,
  categoryId: string | null
): Promise<ApiServiceResult<CookbookApiResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);

    if (categoryId === "__saved__") {
      const rawPage = await (client as unknown as SendRequestClient).sendRequest(
        "GET",
        `/pages/${SAVED_PAGE_ID}`,
        null,
        true
      );
      return { body: { categories: [], recipes: parseCookbookPage(rawPage) } };
    }

    if (categoryId) {
      if (!isRecipeCategoryId(categoryId)) {
        return { body: { error: "Invalid category ID" }, status: 400 };
      }
      const rawPage = await fetchRecipeCategoryPage(client, categoryId);
      return { body: { categories: [], recipes: parseCookbookPage(rawPage) } };
    }

    const rawPage = await client.recipe.getRecipesPage();
    return {
      body: {
        categories: await discoverRecipeCategories(client, rawPage, countryCode),
        recipes: parseCookbookPage(rawPage),
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
    console.error("[cookbook service] Failed:", message);

    return {
      body: { error: "Failed to load recipes. Please try again later." },
      status: 502,
    };
  }
}

export async function searchCookbookService(
  authToken: string,
  countryCode: CountryCode,
  rawQuery: string
): Promise<ApiServiceResult<CookbookApiResponse | ApiErrorResponse>> {
  const query = rawQuery.trim();
  if (!query) {
    return { body: { categories: [], recipes: [] } };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const path = `/pages/search-page-results?search_term=${encodeURIComponent(query)}&page_context=MEALS&is_recipe=true`;
    const rawPage = await (client as unknown as SendRequestClient).sendRequest(
      "GET",
      path,
      null,
      true
    );

    return { body: { categories: [], recipes: parseCookbookPage(rawPage) } };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[cookbook search service] Failed:", message);

    return {
      body: { error: "Failed to search recipes. Please try again later." },
      status: 502,
    };
  }
}
