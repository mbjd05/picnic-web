import { useQuery } from "@tanstack/react-query";

import type {
  WalletSummary,
  WalletTransactionDetails,
  WalletTransactionsResponse,
} from "@/types/payment";

import { fetchJson } from "../lib/api-client";
import { queryKeys, queryStaleTime } from "../lib/query-config";
import { useCountryCode } from "../providers/country-context";

export function useWalletSummary() {
  const countryCode = useCountryCode();

  return useQuery({
    queryKey: queryKeys.walletSummary(countryCode),
    queryFn: () => fetchJson<WalletSummary>("/api/account/wallet"),
    staleTime: queryStaleTime.walletSummary,
  });
}

export function useWalletTransactions(page: number) {
  const countryCode = useCountryCode();

  return useQuery({
    queryKey: queryKeys.walletTransactions(page, countryCode),
    queryFn: () =>
      fetchJson<WalletTransactionsResponse>(
        `/api/account/wallet/transactions?page=${encodeURIComponent(String(page))}`
      ),
    staleTime: queryStaleTime.walletTransactions,
  });
}

export function useWalletTransactionDetails(transactionId: string | null) {
  const countryCode = useCountryCode();

  return useQuery({
    queryKey: transactionId
      ? queryKeys.walletTransactionDetails(transactionId, countryCode)
      : ["wallet-transaction-details", "none", countryCode],
    queryFn: () =>
      fetchJson<WalletTransactionDetails>(
        `/api/account/wallet/transactions/${encodeURIComponent(transactionId ?? "")}`
      ),
    enabled: Boolean(transactionId),
    staleTime: queryStaleTime.walletTransactionDetails,
  });
}
