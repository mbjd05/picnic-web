import type { BundleThreshold } from "@/types/cart";
import type { AllergenInfo, NutritionRow } from "@/types/product";

export type RecipeItem = {
  id: string;
  name: string;
  imageId: string | null;
  cookingTimeMinutes: number | null;
};

export type RecipeCategory = {
  id: string;
  name: string;
  section?: string;
  count?: number;
};

export type CookbookApiResponse = {
  categories: RecipeCategory[];
  recipes: RecipeItem[];
};

export type RecipeIngredient = {
  /** selling_unit_id — used for cart mutations */
  id: string;
  name: string;
  imageId: string | null;
  /** Price in cents */
  displayPrice: number;
  /** Package size description, e.g. "500 g" */
  unitQuantity: string;
  maxCount: number;
  /** Number of packages the recipe needs (for default portion count) */
  quantity: number;
  /** True for staples the user likely already has (salt, oil, spices) */
  isCondiment: boolean;
  /** Nutrition rows from the product detail page; empty when unavailable */
  nutritionRows: NutritionRow[];
  /** Recipe quantity text from the ingredient tile (e.g. "100 g"), for base portions */
  recipeQuantityText: string | null;
  /** Package size as shown on the recipe page (e.g. "500g"), may differ from unitQuantity */
  recipePackageSize: string | null;
  /** Original (crossed-out) price in cents for regular sale products, or null */
  originalPrice: number | null;
  /** Buy-more-pay-less tiers, or null if no bundle deal */
  priceRanges: BundleThreshold[] | null;
};

export type RecipeDetail = {
  id: string;
  name: string;
  imageId: string | null;
  cookingTimeMinutes: number | null;
  /** Default serving size this recipe is written for */
  portions: number;
  ingredients: RecipeIngredient[];
  /** Step-by-step instructions; empty when not available in the API response */
  steps: string[];
  /** Warning shown by Picnic when portions exceed what the recipe steps cover, e.g. "Achtung: ..." */
  stepsPortionWarning: string | null;
  /** Per-serving nutrition extracted from the recipe page; empty when unavailable */
  recipeNutritionRows: NutritionRow[];
  /** Allergen names aggregated across all ingredients, extracted from the recipe page */
  allergens: AllergenInfo;
};

export type RecipeDetailApiResponse = RecipeDetail;
