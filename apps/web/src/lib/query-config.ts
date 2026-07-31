import type { CountryCode } from "@/lib/types";

export const queryStaleTime = {
  categories: 20 * 60 * 1000,
  productDetail: 15 * 60 * 1000,
  search: 2 * 60 * 1000,
  suggestions: 60 * 1000,
  cart: 30 * 1000,
  deliverySlots: 30 * 1000,
  cookbookCategories: 20 * 60 * 1000,
  cookbookView: 15 * 60 * 1000,
  savedRecipes: 2 * 60 * 1000,
  paymentProfile: 2 * 60 * 1000,
} as const;

export const queryKeys = {
  categories: (countryCode: CountryCode) => ["categories", countryCode] as const,
  suggestions: (query: string, countryCode: CountryCode) =>
    ["suggestions", query, countryCode] as const,
  productSearch: (query: string, countryCode: CountryCode) =>
    ["product-search", query, countryCode] as const,
  subcategories: (categoryId: string, countryCode: CountryCode) =>
    ["subcategories", categoryId, countryCode] as const,
  categoryProducts: (subcategoryId: string, countryCode: CountryCode) =>
    ["category-products", subcategoryId, countryCode] as const,
  shortcutProducts: (pageId: string, countryCode: CountryCode) =>
    ["shortcut-products", pageId, countryCode] as const,
  productDetail: (productId: string, countryCode: CountryCode) =>
    ["product-detail", productId, countryCode] as const,
  cart: () => ["cart"] as const,
  deliverySlots: () => ["delivery-slots"] as const,
  paymentProfile: () => ["payment-profile"] as const,
  cookbookView: (categoryId: string | null, countryCode: CountryCode) =>
    ["cookbook", "view", categoryId ?? "__featured__", countryCode] as const,
  cookbookSearch: (query: string, countryCode: CountryCode) =>
    ["cookbook", "search", query, countryCode] as const,
  savedRecipes: (countryCode: CountryCode) => ["cookbook", "saved", countryCode] as const,
  recipeDetail: (recipeId: string, portions: number | null, countryCode: CountryCode) =>
    ["recipe-detail", recipeId, portions ?? "default", countryCode] as const,
};
