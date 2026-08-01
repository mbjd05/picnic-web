import { useQuery } from "@tanstack/react-query";

import type { CountryCode } from "@/lib/types/locale";
import type { SearchApiResponse } from "@/lib/types/search";

import { fetchJson } from "../../lib/api-client";
import { queryGcTime, queryKeys, queryStaleTime } from "../../lib/query-config";

export function useProductSearch(query: string, countryCode: CountryCode) {
  return useQuery({
    queryKey: queryKeys.productSearch(query, countryCode),
    queryFn: () => fetchJson<SearchApiResponse>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
    staleTime: queryStaleTime.search,
    gcTime: queryGcTime.search,
  });
}
