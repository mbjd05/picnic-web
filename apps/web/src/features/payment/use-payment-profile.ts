import { useQuery } from "@tanstack/react-query";

import type { PaymentProfile } from "@/lib/payment-types";

import { fetchJson } from "../../lib/api-client";
import { queryKeys, queryStaleTime } from "../../lib/query-config";

export function usePaymentProfile() {
  return useQuery({
    queryKey: queryKeys.paymentProfile(),
    queryFn: () => fetchJson<PaymentProfile>("/api/account/payment-profile"),
    staleTime: queryStaleTime.paymentProfile,
  });
}
