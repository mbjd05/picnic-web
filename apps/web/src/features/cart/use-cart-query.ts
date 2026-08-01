import { useQuery } from "@tanstack/react-query";

import type { CartData } from "@/lib/cart-types";

import { fetchJson } from "../../lib/api-client";
import { queryKeys, queryStaleTime } from "../../lib/query-config";

export function useCartQuery() {
  return useQuery({
    queryKey: queryKeys.cart(),
    queryFn: () => fetchJson<CartData>("/api/cart"),
    staleTime: queryStaleTime.cart,
  });
}
