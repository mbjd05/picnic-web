import { isApiTokenExpiredError } from "@/lib/api-error";
import type { CategoriesApiResponse } from "@/lib/category-types";
import { parseCategoryPage } from "@/lib/parse-categories";
import { parseShortcutsPage } from "@/lib/parse-shortcuts";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse, CountryCode } from "@/lib/types";

import type { ApiServiceResult } from "./types";

const SEARCH_EMPTY_PAGE_ID = "empty-search-page-root";
const HOME_PAGE_ID = "home_page_root";

export async function getCategoriesService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<CategoriesApiResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);

    const [searchPage, homePage] = await Promise.all([
      client.app.getPage(SEARCH_EMPTY_PAGE_ID),
      client.app.getPage(HOME_PAGE_ID),
    ]);

    return {
      body: {
        categories: parseCategoryPage(searchPage),
        shortcuts: parseShortcutsPage(homePage),
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
    console.error("[categories service] Failed to fetch categories:", message);

    return {
      body: { error: "Failed to load categories. Please try again later." },
      status: 502,
    };
  }
}
