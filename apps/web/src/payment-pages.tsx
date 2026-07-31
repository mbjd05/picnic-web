import { Link, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getPaymentDisplayName, getPreferredPaymentOption } from "@/lib/payment";
import type {
  CheckoutCancelResponse,
  CheckoutStatusResponse,
  PaymentBank,
  PaymentProfile,
} from "@/lib/types";

import { ErrorView, LoadingView, useDocumentTitle } from "./browsing-components";
import { useTranslations } from "./country-context";
import { ApiClientError, fetchJson } from "./lib/api-client";
import { queryKeys, queryStaleTime } from "./lib/query-config";

const PAYMENT_BANK_STORAGE_KEY = "picnic_payment_option_banks";

const IDEAL_BANKS: PaymentBank[] = [
  { bank_id: "ABNANL2A", name: "ABN AMRO" },
  { bank_id: "ASNBNL21", name: "ASN Bank" },
  { bank_id: "BUNQNL2A", name: "bunq" },
  { bank_id: "INGBNL2A", name: "ING" },
  { bank_id: "KNABNL2H", name: "Knab" },
  { bank_id: "RABONL2U", name: "Rabobank" },
  { bank_id: "RBRBNL21", name: "RegioBank" },
  { bank_id: "SNSBNL2A", name: "SNS" },
  { bank_id: "TRIONL2U", name: "Triodos Bank" },
  { bank_id: "FVLBNL22", name: "Van Lanschot" },
  { bank_id: "REVOLT21", name: "Revolut" },
  { bank_id: "NTSBDEB1", name: "N26" },
  { bank_id: "NNBANL2G", name: "NN" },
  { bank_id: "BITSNL2A", name: "Yoursafe" },
  { bank_id: "ADYBNL2A", name: "Adyen" },
  { bank_id: "FNOMNL22", name: "Finom" },
  { bank_id: "BUUTNL2A", name: "BUUT" },
];

type StoredBankMetadata = Record<string, { bankId: string; bankName: string }>;

function readStoredBankMetadata(): StoredBankMetadata {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_BANK_STORAGE_KEY) ?? "{}") as StoredBankMetadata;
  } catch {
    return {};
  }
}

function writeStoredBankMetadata(metadata: StoredBankMetadata): void {
  localStorage.setItem(PAYMENT_BANK_STORAGE_KEY, JSON.stringify(metadata));
}

export function PaymentAccountPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/authenticated/account/payment" });
  useDocumentTitle(t.paymentMethodsPageTitle);
  const showBackToCart = search.from === "cart";

  const [selectedBank, setSelectedBank] = useState("");
  const [storedBankMetadata, setStoredBankMetadata] = useState<StoredBankMetadata>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const profileQuery = useQuery({
    queryKey: queryKeys.paymentProfile(),
    queryFn: () => fetchJson<PaymentProfile>("/api/account/payment-profile"),
    staleTime: queryStaleTime.paymentProfile,
  });
  const profileErrorMessage =
    profileQuery.error instanceof ApiClientError
      ? profileQuery.error.message
      : t.paymentProfileLoadError;

  useEffect(() => {
    setStoredBankMetadata(readStoredBankMetadata());
  }, []);

  const profile = profileQuery.data ?? null;
  const preferredOption = profile ? getPreferredPaymentOption(profile) : null;
  const idealMethod = useMemo(
    () =>
      profile?.available_payment_methods?.find((method) => method.payment_method === "IDEAL") ?? {
        payment_method: "IDEAL",
        available_banks: IDEAL_BANKS,
      },
    [profile]
  );
  const selectedBanks = idealMethod.available_banks ?? IDEAL_BANKS;
  const activeSelectedBank = selectedBanks.some((bank) => bank.bank_id === selectedBank)
    ? selectedBank
    : selectedBanks[0]?.bank_id || "";

  async function handleSavePaymentOption() {
    setIsSaving(true);
    setActionError(null);

    try {
      const data = await fetchJson<PaymentProfile>("/api/account/payment-profile/payment-options", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "IDEAL",
          bankId: activeSelectedBank || null,
        }),
      });

      const previousIds = new Set(profile?.stored_payment_options?.map((option) => option.id));
      const createdOption =
        data.stored_payment_options?.find((option) => !previousIds.has(option.id)) ??
        data.stored_payment_options?.find(
          (option) => option.id === data.preferred_payment_option_id
        );
      const selectedBankName = selectedBanks.find(
        (bank) => bank.bank_id === activeSelectedBank
      )?.name;

      if (createdOption && activeSelectedBank && selectedBankName) {
        const nextMetadata = {
          [createdOption.id]: {
            bankId: activeSelectedBank,
            bankName: selectedBankName,
          },
        };
        setStoredBankMetadata(nextMetadata);
        writeStoredBankMetadata(nextMetadata);
      }

      queryClient.setQueryData(queryKeys.paymentProfile(), data);
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : t.paymentOptionSaveError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemovePaymentOption(paymentOptionId: string) {
    setIsSaving(true);
    setActionError(null);

    try {
      const data = await fetchJson<PaymentProfile>(
        `/api/account/payment-profile/payment-options/${encodeURIComponent(paymentOptionId)}`,
        { method: "DELETE" }
      );
      const { [paymentOptionId]: _removed, ...nextMetadata } = storedBankMetadata;
      void _removed;
      setStoredBankMetadata(nextMetadata);
      writeStoredBankMetadata(nextMetadata);
      queryClient.setQueryData(queryKeys.paymentProfile(), data);
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : t.paymentOptionRemoveError);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t.paymentMethodsPageTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.paymentMethodsPageSubtitle}</p>
        </div>
        {showBackToCart ? (
          <Link to="/cart" className="text-picnic-red text-sm font-semibold">
            {t.backToCart}
          </Link>
        ) : null}
      </div>

      {profileQuery.isPending ? <LoadingView /> : null}
      {profileQuery.isError ? (
        <ErrorView message={profileErrorMessage} onRetry={() => void profileQuery.refetch()} />
      ) : null}
      {profile ? (
        <div className="space-y-6">
          <section className="border-card-border rounded-xl border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{t.preferredPaymentMethod}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {preferredOption?.display_name ?? t.noPreferredPaymentMethod}
            </p>
          </section>

          <section className="border-card-border rounded-xl border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{t.addPaymentMethod}</h2>
            <p className="mt-2 text-sm text-gray-600">{t.addPaymentMethodEffectNote}</p>
            {selectedBanks.length ? (
              <div className="mt-4 space-y-4">
                <div className="block text-sm font-medium text-gray-700">
                  {t.paymentMethodTitle}
                  <div className="border-input-border mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm font-normal text-gray-900">
                    {getPaymentDisplayName(profile, "IDEAL")}
                  </div>
                </div>

                <label className="block text-sm font-medium text-gray-700">
                  {t.paymentBankLabel}
                  <select
                    value={activeSelectedBank}
                    onChange={(event) => setSelectedBank(event.target.value)}
                    className="border-input-border mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    {selectedBanks.map((bank) => (
                      <option key={bank.bank_id} value={bank.bank_id}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => void handleSavePaymentOption()}
                  disabled={isSaving}
                  className="bg-picnic-red rounded-lg px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isSaving ? t.savingPaymentMethod : t.addAndUsePaymentMethod}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">{t.noAvailablePaymentMethods}</p>
            )}
          </section>

          <section className="border-card-border rounded-xl border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{t.storedPaymentMethods}</h2>
            {profile.stored_payment_options?.length ? (
              <div className="mt-3 divide-y divide-gray-100">
                {profile.stored_payment_options.slice(0, 1).map((option) => (
                  <div
                    key={option.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {option.display_name ?? option.payment_method}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {storedBankMetadata[option.id]?.bankName ??
                          option.account ??
                          option.brand ??
                          t.paymentBankUnknown}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemovePaymentOption(option.id)}
                      disabled={isSaving}
                      className="text-sm font-semibold text-red-600 disabled:text-gray-400"
                    >
                      {t.removePaymentMethod}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">{t.noStoredPaymentMethods}</p>
            )}
          </section>

          {actionError ? (
            <p className="text-sm text-red-600" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

type ReturnState =
  | { status: "loading" }
  | { status: "missing"; providerResult?: string | null; paymentId?: string | null }
  | { status: "ready"; transactionId: string; orderId: string | null; paymentStatus: string }
  | { status: "cancelled"; transactionId?: string; paymentId?: string | null }
  | { status: "error"; message: string };

function describeStatus(status: CheckoutStatusResponse): string {
  if (status.inactive) return "NOT_FOUND";
  if (typeof status.raw === "object" && status.raw !== null && "status" in status.raw) {
    const rawStatus = (status.raw as { status?: unknown }).status;
    if (typeof rawStatus === "string") return rawStatus;
  }
  return "PENDING";
}

export function PaymentReturnPage() {
  const t = useTranslations();
  useDocumentTitle(t.paymentReturnTitle);

  const [returnState, setReturnState] = useState<ReturnState>({ status: "loading" });
  const [isCancelling, setIsCancelling] = useState(false);

  const loadStatus = useCallback(async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const providerResult = searchParams.get("result");
    const paymentId =
      searchParams.get("payment_id") ?? localStorage.getItem("picnic_checkout_payment_id");
    const transactionId =
      searchParams.get("tx_id") ||
      sessionStorage.getItem("picnic_checkout_transaction_id") ||
      localStorage.getItem("picnic_checkout_transaction_id");
    const orderId =
      sessionStorage.getItem("picnic_checkout_order_id") ||
      localStorage.getItem("picnic_checkout_order_id");

    if (providerResult === "CANCELLED") {
      const cancelId = transactionId || paymentId || orderId;

      if (cancelId) {
        try {
          await fetchJson<CheckoutCancelResponse>("/api/checkout/cancel", {
            method: "POST",
            body: JSON.stringify({ transactionId: cancelId }),
          });
        } catch {
          // The cancelled provider result is still authoritative for UI state.
        }
      }

      localStorage.removeItem("picnic_checkout_transaction_id");
      localStorage.removeItem("picnic_checkout_order_id");
      localStorage.removeItem("picnic_checkout_payment_id");
      setReturnState({ status: "cancelled", transactionId: transactionId ?? undefined, paymentId });
      return;
    }

    if (!transactionId) {
      setReturnState({ status: "missing", providerResult, paymentId });
      return;
    }

    setReturnState({ status: "loading" });

    try {
      const data = await fetchJson<CheckoutStatusResponse>(
        `/api/checkout/status/${encodeURIComponent(transactionId)}`
      );
      setReturnState({
        status: "ready",
        transactionId,
        orderId,
        paymentStatus: describeStatus(data),
      });
    } catch (error) {
      setReturnState({
        status: "error",
        message: error instanceof ApiClientError ? error.message : t.paymentStatusLoadError,
      });
    }
  }, [t.paymentStatusLoadError]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleCancel() {
    if (returnState.status !== "ready") return;
    setIsCancelling(true);

    try {
      await fetchJson<CheckoutCancelResponse>("/api/checkout/cancel", {
        method: "POST",
        body: JSON.stringify({ transactionId: returnState.transactionId }),
      });
      localStorage.removeItem("picnic_checkout_transaction_id");
      localStorage.removeItem("picnic_checkout_order_id");
      localStorage.removeItem("picnic_checkout_payment_id");
      setReturnState({ status: "cancelled", transactionId: returnState.transactionId });
    } catch (error) {
      setReturnState({
        status: "error",
        message: error instanceof ApiClientError ? error.message : t.paymentCancelError,
      });
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      {returnState.status === "loading" ? <LoadingView /> : null}
      {returnState.status === "error" ? (
        <ErrorView message={returnState.message} onRetry={loadStatus} />
      ) : null}
      {returnState.status === "missing" ? (
        <section className="border-card-border rounded-xl border bg-white p-6">
          <h1 className="text-foreground text-2xl font-bold">{t.paymentReturnTitle}</h1>
          <p className="mt-3 text-sm text-gray-600">{t.paymentReturnMissing}</p>
          {returnState.providerResult ? (
            <p className="mt-2 text-sm text-gray-500">
              {t.paymentProviderResultLabel}: {returnState.providerResult}
            </p>
          ) : null}
          <Link to="/cart" className="text-picnic-red mt-4 inline-block text-sm font-semibold">
            {t.backToCart}
          </Link>
        </section>
      ) : null}
      {returnState.status === "ready" ? (
        <section className="border-card-border rounded-xl border bg-white p-6">
          <h1 className="text-foreground text-2xl font-bold">{t.paymentReturnTitle}</h1>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">{t.paymentStatusLabel}</dt>
              <dd className="font-semibold text-gray-900">{returnState.paymentStatus}</dd>
            </div>
            {returnState.orderId ? (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t.orderIdLabel}</dt>
                <dd className="font-semibold text-gray-900">{returnState.orderId}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="border-card-border rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              {t.retryButton}
            </button>
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={isCancelling}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
            >
              {isCancelling ? t.paymentCancelling : t.cancelPayment}
            </button>
            <Link
              to="/cart"
              className="bg-picnic-red rounded-lg px-4 py-2 text-sm font-semibold text-white"
            >
              {t.backToCart}
            </Link>
          </div>
        </section>
      ) : null}
      {returnState.status === "cancelled" ? (
        <section className="border-card-border rounded-xl border bg-white p-6">
          <h1 className="text-foreground text-2xl font-bold">{t.paymentCancelledTitle}</h1>
          <p className="mt-3 text-sm text-gray-600">{t.paymentCancelledText}</p>
          {returnState.paymentId ? (
            <p className="mt-2 text-sm text-gray-500">
              {t.paymentIdLabel}: {returnState.paymentId}
            </p>
          ) : null}
          <Link to="/cart" className="text-picnic-red mt-4 inline-block text-sm font-semibold">
            {t.backToCart}
          </Link>
        </section>
      ) : null}
    </main>
  );
}
