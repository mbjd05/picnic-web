import { useQuery } from "@tanstack/react-query";

import type { AccountProfileResponse } from "@/types/account";

import { useCountryCode } from "../providers/country-context";
import { fetchJson } from "../lib/api-client";
import { queryKeys, queryStaleTime } from "../lib/query-config";

export function useAccountProfile() {
  const countryCode = useCountryCode();

  return useQuery({
    queryKey: queryKeys.accountProfile(countryCode),
    queryFn: () => fetchJson<AccountProfileResponse>("/api/account/profile"),
    staleTime: queryStaleTime.accountProfile,
  });
}
