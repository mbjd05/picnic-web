import type { CountryCode } from "@/types/locale";

export const queryStaleTime = {
  categories: 20 * 60 * 1000,
  productDetail: 15 * 60 * 1000,
  search: 10 * 60 * 1000,
  suggestions: 60 * 1000,
  cart: 30 * 1000,
  deliverySlots: 30 * 1000,
  deliveries: 60 * 1000,
  deliveryDetail: 60 * 1000,
  deliveryTracking: 10 * 1000,
  deliveryOrderStatus: 10 * 1000,
  cookbookCategories: 20 * 60 * 1000,
  cookbookView: 15 * 60 * 1000,
  savedRecipes: 2 * 60 * 1000,
  accountProfile: 2 * 60 * 1000,
  paymentProfile: 2 * 60 * 1000,
  walletTransactions: 60 * 1000,
  walletTransactionDetails: 60 * 1000,
} as const;

export const queryGcTime = {
  productLists: 30 * 60 * 1000,
  productDetail: 30 * 60 * 1000,
  search: 30 * 60 * 1000,
  cookbook: 30 * 60 * 1000,
  recipeDetail: 30 * 60 * 1000,
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
  deliveries: (filter: string, countryCode: CountryCode) =>
    ["deliveries", filter, countryCode] as const,
  deliveryDetail: (deliveryId: string, countryCode: CountryCode) =>
    ["delivery-detail", deliveryId, countryCode] as const,
  deliveryTracking: (deliveryId: string, countryCode: CountryCode) =>
    ["delivery-tracking", deliveryId, countryCode] as const,
  deliveryOrderStatus: (orderId: string, countryCode: CountryCode) =>
    ["delivery-order-status", orderId, countryCode] as const,
  accountProfile: (countryCode: CountryCode) => ["account-profile", countryCode] as const,
  paymentProfile: () => ["payment-profile"] as const,
  walletTransactions: (page: number, countryCode: CountryCode) =>
    ["wallet-transactions", page, countryCode] as const,
  walletTransactionDetails: (transactionId: string, countryCode: CountryCode) =>
    ["wallet-transaction-details", transactionId, countryCode] as const,
  cookbookView: (categoryId: string | null, countryCode: CountryCode) =>
    ["cookbook", "view", categoryId ?? "__featured__", countryCode] as const,
  cookbookSearch: (query: string, countryCode: CountryCode) =>
    ["cookbook", "search", query, countryCode] as const,
  savedRecipes: (countryCode: CountryCode) => ["cookbook", "saved", countryCode] as const,
  recipeDetail: (recipeId: string, portions: number | null, countryCode: CountryCode) =>
    ["recipe-detail", recipeId, portions ?? "default", countryCode] as const,
};
