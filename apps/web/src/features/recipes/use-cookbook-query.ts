import { useQuery } from "@tanstack/react-query";

import type { CookbookApiResponse } from "@/lib/types/recipe";
import type { CountryCode } from "@/lib/types/locale";

import { fetchJson } from "../../lib/api-client";
import { queryKeys, queryStaleTime } from "../../lib/query-config";

export function useCookbookView(
  categoryId: string | null,
  countryCode: CountryCode,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.cookbookView(categoryId, countryCode),
    queryFn: () =>
      fetchJson<CookbookApiResponse>(
        categoryId ? `/api/cookbook?category=${encodeURIComponent(categoryId)}` : "/api/cookbook"
      ),
    enabled,
    staleTime: queryStaleTime.cookbookView,
  });
}

export function useCookbookSearch(query: string, countryCode: CountryCode, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cookbookSearch(query, countryCode),
    queryFn: () =>
      fetchJson<CookbookApiResponse>(`/api/cookbook/search?q=${encodeURIComponent(query)}`),
    enabled,
    staleTime: queryStaleTime.search,
  });
}

export function useSavedRecipes(countryCode: CountryCode) {
  return useQuery({
    queryKey: queryKeys.savedRecipes(countryCode),
    queryFn: () => fetchJson<CookbookApiResponse>("/api/cookbook?category=__saved__"),
    staleTime: queryStaleTime.savedRecipes,
  });
}
