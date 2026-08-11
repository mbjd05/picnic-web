import { useEffect, useMemo, useState } from "react";

import type { WalletTransaction, WalletTransactionDetails } from "@/types/payment";
import { formatEuroPrice } from "@/lib/format/price";

import { ErrorView, LoadingView } from "../../components/page-state";
import { useDocumentTitle } from "../../hooks/use-document-title";
import {
  useWalletSummary,
  useWalletTransactionDetails,
  useWalletTransactions,
} from "../../hooks/use-wallet-transactions";
import { ApiClientError } from "../../lib/api-client";
import { useCountryCode, useTranslations } from "../../providers/country-context";

const WALLET_FIRST_PAGE = 1;

export function WalletTransactionsPage() {
  const t = useTranslations();
  const countryCode = useCountryCode();
  const [page, setPage] = useState(WALLET_FIRST_PAGE);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  useDocumentTitle(t.walletTitle);

  const summaryQuery = useWalletSummary();
  const transactionsQuery = useWalletTransactions(page);
  const transactions = useMemo(
    () => transactionsQuery.data?.transactions ?? [],
    [transactionsQuery.data?.transactions]
  );

  useEffect(() => {
    if (transactions.length === 0) {
      setSelectedTransactionId(null);
      return;
    }
    if (
      !selectedTransactionId ||
      !transactions.some((transaction) => transaction.id === selectedTransactionId)
    ) {
      setSelectedTransactionId(transactions[0]?.id ?? null);
    }
  }, [selectedTransactionId, transactions]);

  const detailsQuery = useWalletTransactionDetails(selectedTransactionId);
  const transactionsError =
    transactionsQuery.error instanceof ApiClientError
      ? transactionsQuery.error.message
      : t.walletTransactionsLoadError;
  const summaryError =
    summaryQuery.error instanceof ApiClientError ? summaryQuery.error.message : t.walletLoadError;
  const detailsError =
    detailsQuery.error instanceof ApiClientError
      ? detailsQuery.error.message
      : t.walletTransactionDetailsLoadError;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t.walletTitle}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.walletSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(WALLET_FIRST_PAGE, current - 1))}
            disabled={page === WALLET_FIRST_PAGE || transactionsQuery.isFetching}
            className="border-card-border hover:text-foreground rounded-full border px-4 py-2 text-sm font-semibold text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.previousPage}
          </button>
          <span className="min-w-12 text-center text-sm font-semibold text-gray-600">
            {t.pageLabel} {page}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={transactionsQuery.isFetching || transactions.length === 0}
            className="border-card-border hover:text-foreground rounded-full border px-4 py-2 text-sm font-semibold text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.nextPage}
          </button>
        </div>
      </div>

      {summaryQuery.isPending ? <LoadingView /> : null}
      {summaryQuery.isError ? (
        <ErrorView message={summaryError} onRetry={() => void summaryQuery.refetch()} />
      ) : null}
      {summaryQuery.data ? <WalletSummaryPanel summary={summaryQuery.data} /> : null}

      {transactionsQuery.isPending ? <LoadingView /> : null}
      {transactionsQuery.isError ? (
        <ErrorView message={transactionsError} onRetry={() => void transactionsQuery.refetch()} />
      ) : null}
      {transactionsQuery.isSuccess && transactions.length === 0 ? (
        <section className="border-card-border mt-5 rounded-xl border bg-white p-8 text-center dark:bg-gray-950">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t.noWalletTransactions}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t.noWalletTransactionsText}
          </p>
        </section>
      ) : null}

      {transactions.length > 0 ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(280px,390px)_1fr]">
          <WalletTransactionList
            countryCode={countryCode}
            transactions={transactions}
            selectedTransactionId={selectedTransactionId}
            onSelect={setSelectedTransactionId}
          />
          <section className="min-w-0">
            {!selectedTransactionId ? (
              <p className="text-sm text-gray-500">{t.walletTransactionSelectPrompt}</p>
            ) : detailsQuery.isPending ? (
              <LoadingView />
            ) : detailsQuery.isError ? (
              <ErrorView message={detailsError} onRetry={() => void detailsQuery.refetch()} />
            ) : detailsQuery.data ? (
              <WalletTransactionDetailPanel
                countryCode={countryCode}
                transaction={transactions.find((item) => item.id === selectedTransactionId)}
                details={detailsQuery.data}
              />
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function WalletSummaryPanel({
  summary,
}: {
  summary: {
    balanceCents: number | null;
    balanceText: string | null;
    settlementText: string | null;
    deliveryDebts: unknown[];
  };
}) {
  const t = useTranslations();
  const hasDebts = summary.deliveryDebts.length > 0;
  const formattedBalance =
    summary.balanceCents !== null
      ? formatEuroPrice(summary.balanceCents)
      : (summary.balanceText ?? "-");

  return (
    <section className="border-card-border grid gap-4 rounded-xl border bg-white p-5 dark:bg-gray-950 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          {t.walletBalanceLabel}
        </p>
        <p className="mt-2 text-4xl font-bold tracking-normal text-gray-900 dark:text-gray-100">
          {formattedBalance}
        </p>
        <p className="mt-3 max-w-xl text-sm text-gray-600 dark:text-gray-300">
          {summary.settlementText ?? t.walletSettlementFallback}
        </p>
      </div>
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t.walletDebtsLabel}
        </p>
        <p
          className={`mt-2 text-sm font-medium ${
            hasDebts ? "text-picnic-red" : "text-gray-600 dark:text-gray-300"
          }`}
        >
          {hasDebts
            ? t.walletDebtsCount.replace("{count}", String(summary.deliveryDebts.length))
            : t.walletNoDebts}
        </p>
      </div>
    </section>
  );
}

function WalletTransactionList({
  countryCode,
  transactions,
  selectedTransactionId,
  onSelect,
}: {
  countryCode: string;
  transactions: WalletTransaction[];
  selectedTransactionId: string | null;
  onSelect: (transactionId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {transactions.map((transaction) => {
        const isSelected = transaction.id === selectedTransactionId;
        return (
          <button
            key={transaction.id}
            type="button"
            onClick={() => onSelect(transaction.id)}
            className={`border-card-border w-full rounded-lg border bg-white p-4 text-left transition-colors dark:bg-gray-950 ${
              isSelected ? "border-picnic-red ring-picnic-red/20 ring-2" : "hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {transaction.display_name || transaction.transaction_type || "-"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formatWalletTimestamp(transaction.timestamp, countryCode)}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${
                  transaction.amount_in_cents < 0
                    ? "text-picnic-red"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {formatSignedPrice(transaction.amount_in_cents)}
              </span>
            </div>
            {transaction.status || transaction.transaction_method ? (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {[transaction.status, transaction.transaction_method].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function WalletTransactionDetailPanel({
  countryCode,
  transaction,
  details,
}: {
  countryCode: string;
  transaction: WalletTransaction | undefined;
  details: WalletTransactionDetails;
}) {
  const t = useTranslations();
  const amount = details.amount_in_cents ?? transaction?.amount_in_cents ?? null;
  const executionTimestamp = details.payment_execution_timestamp ?? transaction?.timestamp ?? null;

  return (
    <div className="space-y-5">
      <section className="border-card-border rounded-lg border bg-white p-4 dark:bg-gray-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {transaction?.display_name ||
                details.payment_option_display_name ||
                details.transaction_type ||
                "-"}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatWalletTimestamp(executionTimestamp, countryCode)}
            </p>
          </div>
          {amount !== null ? (
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatSignedPrice(amount)}
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <InfoItem label={t.walletStatusLabel} value={details.transaction_status ?? "-"} />
          <InfoItem label={t.walletTypeLabel} value={details.transaction_type ?? "-"} />
          <InfoItem label={t.walletMethodLabel} value={details.transaction_method ?? "-"} />
          <InfoItem
            label={t.walletPaymentOptionLabel}
            value={
              [details.payment_option_display_name, details.payment_option_account]
                .filter(Boolean)
                .join(" ") || "-"
            }
          />
          <InfoItem label={t.deliveryOrder} value={details.delivery_id ?? "-"} />
        </dl>
      </section>

      <WalletDetailSection title={t.walletItemsLabel} value={details.shop_items} />
      <WalletDetailSection title={t.walletDepositsLabel} value={details.deposits} />
      <WalletDetailSection
        title={t.walletReturnedContainersLabel}
        value={details.returned_containers}
      />
      <WalletDetailSection title={t.walletRefundsLabel} value={details.refunded_items} />
      <WalletDetailSection title={t.walletFeesLabel} value={details.fees} />
    </div>
  );
}

function WalletDetailSection({ title, value }: { title: string; value: unknown[] | undefined }) {
  if (!value?.length) return null;

  return (
    <section className="border-card-border rounded-lg border bg-white p-4 dark:bg-gray-950">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

function formatSignedPrice(cents: number): string {
  const absolute = formatEuroPrice(Math.abs(cents));
  if (cents < 0) return `-${absolute}`;
  if (cents > 0) return absolute;
  return absolute;
}

function formatWalletTimestamp(timestamp: number | null | undefined, countryCode: string): string {
  if (!timestamp) return "-";
  const milliseconds = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) return String(timestamp);

  return new Intl.DateTimeFormat(localeForCountry(countryCode), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function localeForCountry(countryCode: string): string {
  if (countryCode === "DE") return "de-DE";
  if (countryCode === "FR") return "fr-FR";
  return "nl-NL";
}
