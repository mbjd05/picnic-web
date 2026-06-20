import { isApiAuthError, isApiTokenExpiredError } from "@/lib/api-error";
import { parseCookbookPage } from "@/lib/parse-cookbook";
import { extractProductNutritionRows, extractProductTileData } from "@/lib/parse-fusion-product";
import { parseRecipeDetail } from "@/lib/parse-recipe-detail";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { PicnicClientInstance } from "@/lib/picnic-client";
import type {
  ApiErrorResponse,
  CountryCode,
  RecipeDetailApiResponse,
  RecipeIngredient,
} from "@/lib/types";

import type { ApiServiceResult } from "./types";

const RECIPE_ID_RE = /^[0-9a-f]{24}$/;
const COUNTS_CACHE_TTL_MS = 5 * 60 * 1000;
const countsCache = new Map<string, { counts: Record<string, number>; expiresAt: number }>();

type SendRequestClient = PicnicClientInstance & {
  sendRequest: (method: string, path: string, body: unknown, fusion: boolean) => Promise<unknown>;
};

type SelectedIngredient = { id: string; count: number };

type AddRecipeRequest = {
  portions?: unknown;
  selectedIngredients?: unknown;
};

export async function getRecipeDetailService(
  authToken: string,
  countryCode: CountryCode,
  recipeId: string,
  rawPortions: string | null
): Promise<ApiServiceResult<RecipeDetailApiResponse | { error: string }>> {
  if (!RECIPE_ID_RE.test(recipeId)) {
    return { body: { error: "Invalid recipe ID" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const parsedPortions = rawPortions ? Number.parseInt(rawPortions, 10) : undefined;
    const portions = parsedPortions && parsedPortions > 0 ? parsedPortions : undefined;
    const rawPage = await fetchRecipePage(client, recipeId, portions);
    const detail = parseRecipeDetail(rawPage, recipeId);
    const ingredients = await enrichIngredients(
      client as unknown as SendRequestClient,
      detail.ingredients
    );

    return { body: { ...detail, ingredients } };
  } catch (error) {
    if (isApiAuthError(error)) {
      return { body: { error: "Your token has expired" }, status: 401 };
    }

    return { body: { error: "Failed to load recipe" }, status: 502 };
  }
}

export async function updateSavedRecipeService(
  authToken: string,
  countryCode: CountryCode,
  recipeId: string,
  shouldSave: boolean
): Promise<ApiServiceResult<{ saved: boolean } | ApiErrorResponse>> {
  if (!RECIPE_ID_RE.test(recipeId)) {
    return { body: { error: "Invalid recipe ID" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);

    if (shouldSave) {
      await client.recipe.saveRecipe(recipeId);
    } else {
      await client.recipe.unsaveRecipe(recipeId);
    }

    await invalidateCookbookCounts(authToken, countryCode);
    return { body: { saved: shouldSave } };
  } catch (error) {
    if (isApiAuthError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[saved recipe service] Failed:", message);

    return {
      body: { error: "Failed to update saved recipe. Please try again later." },
      status: 502,
    };
  }
}

export async function addRecipeToCartService(
  authToken: string,
  countryCode: CountryCode,
  recipeId: string,
  rawBody: unknown
): Promise<ApiServiceResult<{ success: true } | { error: string }>> {
  if (!RECIPE_ID_RE.test(recipeId)) {
    return { body: { error: "Invalid recipe ID" }, status: 400 };
  }

  if (!rawBody || typeof rawBody !== "object") {
    return { body: { error: "Invalid request body" }, status: 400 };
  }

  const body = rawBody as AddRecipeRequest;
  const portions = typeof body.portions === "number" && body.portions > 0 ? body.portions : 2;
  const selectedIngredients = parseSelectedIngredients(body.selectedIngredients);

  if (body.selectedIngredients !== undefined && selectedIngredients === null) {
    return { body: { error: "Invalid request body" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);

    if (selectedIngredients) {
      const rawClient = client as unknown as SendRequestClient;
      for (const item of selectedIngredients) {
        if (item.count <= 0) continue;
        await rawClient.sendRequest(
          "POST",
          "/cart/add_product",
          { product_id: item.id, count: item.count },
          true
        );
      }
    } else {
      await client.recipe.assignSellingGroupToBasket(recipeId, 0, portions);
    }

    return { body: { success: true } };
  } catch (error) {
    if (isApiAuthError(error)) {
      return { body: { error: "Your token has expired" }, status: 401 };
    }

    return { body: { error: "Failed to add recipe to cart" }, status: 502 };
  }
}

export async function getCookbookCountsService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<Record<string, number> | { error: string }>> {
  const cacheKey = await getCountsCacheKey(authToken, countryCode);
  const cached = countsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { body: cached.counts };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
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
    countsCache.set(cacheKey, { counts, expiresAt: Date.now() + COUNTS_CACHE_TTL_MS });

    return { body: counts };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return { body: { error: "Your token has expired" }, status: 401 };
    }

    return { body: { error: "Failed to load counts" }, status: 502 };
  }
}

async function fetchRecipePage(
  client: PicnicClientInstance,
  recipeId: string,
  portions?: number
): Promise<unknown> {
  const portionsParam = portions ? `&portions=${portions}` : "";

  try {
    return await (client as unknown as SendRequestClient).sendRequest(
      "GET",
      `/pages/selling-group-details-page?selling_group_id=${encodeURIComponent(recipeId)}${portionsParam}`,
      null,
      true
    );
  } catch {
    return (client as unknown as SendRequestClient).sendRequest(
      "GET",
      `/pages/recipe-details-page-root?recipe_id=${encodeURIComponent(recipeId)}${portionsParam}`,
      null,
      true
    );
  }
}

async function enrichIngredients(
  client: SendRequestClient,
  ingredients: RecipeIngredient[]
): Promise<RecipeIngredient[]> {
  const uniqueIds = [...new Set(ingredients.map((ingredient) => ingredient.id))];

  type TileEntry = ReturnType<typeof extractProductTileData> & {
    nutritionRows: ReturnType<typeof extractProductNutritionRows>;
  };
  const tileMap = new Map<string, TileEntry>();

  await Promise.all(
    uniqueIds.map(async (unitId) => {
      try {
        const rawPage = await client.sendRequest(
          "GET",
          `/pages/product-details-page-root?id=${encodeURIComponent(unitId)}`,
          null,
          true
        );
        const tile = extractProductTileData(rawPage, unitId);
        const nutritionRows = extractProductNutritionRows(rawPage);
        if (tile.name) tileMap.set(unitId, { ...tile, nutritionRows });
      } catch {
        // Keep the ingredient data from the recipe page when enrichment fails.
      }
    })
  );

  return ingredients.map((ingredient) => {
    const data = tileMap.get(ingredient.id);
    if (!data) return ingredient;

    return {
      ...ingredient,
      name: ingredient.name || data.name,
      imageId: data.imageId || ingredient.imageId,
      displayPrice: data.displayPrice ?? ingredient.displayPrice,
      unitQuantity: data.unitQuantity || ingredient.unitQuantity,
      maxCount: data.maxCount || ingredient.maxCount,
      nutritionRows: data.nutritionRows,
      originalPrice: data.originalPrice,
      priceRanges: data.priceRanges,
    };
  });
}

function parseSelectedIngredients(value: unknown): SelectedIngredient[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;

  const selectedIngredients: SelectedIngredient[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { id, count } = item as { id?: unknown; count?: unknown };
    if (typeof id !== "string" || !id || typeof count !== "number" || !Number.isFinite(count)) {
      return null;
    }
    selectedIngredients.push({ id, count });
  }

  return selectedIngredients;
}

async function invalidateCookbookCounts(
  authToken: string,
  countryCode: CountryCode
): Promise<void> {
  countsCache.delete(await getCountsCacheKey(authToken, countryCode));
}

async function getCountsCacheKey(authToken: string, countryCode: CountryCode): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(authToken)
  );
  const hash = Array.from(new Uint8Array(digest).slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return `${countryCode}:${hash}`;
}
