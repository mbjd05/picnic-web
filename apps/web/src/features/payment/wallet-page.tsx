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
          <p className="text-text-muted mt-1 text-sm">{t.walletSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(WALLET_FIRST_PAGE, current - 1))}
            disabled={page === WALLET_FIRST_PAGE || transactionsQuery.isFetching}
            className="border-card-border text-text-muted hover:text-foreground rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.previousPage}
          </button>
          <span className="text-text-muted min-w-12 text-center text-sm font-semibold">
            {t.pageLabel} {page}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={transactionsQuery.isFetching || transactions.length === 0}
            className="border-card-border text-text-muted hover:text-foreground rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
        <section className="border-card-border bg-card-bg mt-5 rounded-xl border p-8 text-center">
          <h2 className="text-foreground text-lg font-semibold">
            {t.noWalletTransactions}
          </h2>
          <p className="text-text-muted mt-2 text-sm">
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
              <p className="text-text-muted text-sm">{t.walletTransactionSelectPrompt}</p>
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
    <section className="border-card-border bg-card-bg grid gap-4 rounded-xl border p-5 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="text-text-muted text-sm font-semibold">
          {t.walletBalanceLabel}
        </p>
        <p className="text-foreground mt-2 text-4xl font-bold tracking-normal">
          {formattedBalance}
        </p>
        <p className="text-text-muted mt-3 max-w-xl text-sm">{t.walletSettlementFallback}</p>
      </div>
      <div className="bg-background rounded-lg p-4">
        <p className="text-foreground text-sm font-semibold">
          {t.walletDebtsLabel}
        </p>
        <p
          className={`mt-2 text-sm font-medium ${
            hasDebts ? "text-picnic-red" : "text-text-muted"
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
            className={`border-card-border bg-card-bg w-full rounded-lg border p-4 text-left transition-colors ${
              isSelected ? "border-picnic-red ring-picnic-red/20 ring-2" : "hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-semibold">
                  {transaction.display_name || transaction.transaction_type || "-"}
                </p>
                <p className="text-text-muted mt-1 text-xs">
                  {formatWalletTimestamp(transaction.timestamp, countryCode)}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${
                  transaction.amount_in_cents < 0
                    ? "text-picnic-red"
                    : "text-foreground"
                }`}
              >
                {formatSignedPrice(transaction.amount_in_cents)}
              </span>
            </div>
            {transaction.status || transaction.transaction_method ? (
              <p className="text-text-muted mt-2 text-xs">
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
      <section className="border-card-border bg-card-bg rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-foreground text-lg font-semibold">
              {transaction?.display_name ||
                details.payment_option_display_name ||
                details.transaction_type ||
                "-"}
            </h2>
            <p className="text-text-muted mt-1 text-sm">
              {formatWalletTimestamp(executionTimestamp, countryCode)}
            </p>
          </div>
          {amount !== null ? (
            <span className="text-foreground text-lg font-bold">
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
    <section className="border-card-border bg-card-bg rounded-lg border p-4">
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      <pre className="bg-background text-foreground mt-3 max-h-80 overflow-auto rounded-md p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-muted text-xs font-medium">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm">{value}</dd>
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
