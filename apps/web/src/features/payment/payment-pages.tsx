import { Link, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getPaymentDisplayName, getPreferredPaymentOption } from "@/lib/payment/options";
import type {
  AvailablePaymentMethod,
  CheckoutCancelResponse,
  CheckoutStatusResponse,
  PaymentProfile,
  PaymentBank,
} from "@/types/payment";

import { ErrorView, LoadingView } from "../../components/page-state";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { useTranslations } from "../../providers/country-context";
import { usePaymentProfile } from "../../hooks/use-payment-profile";
import { ApiClientError, fetchJson } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-config";

const PAYMENT_BANK_STORAGE_KEY = "picnic_payment_option_banks";
const EMPTY_BANKS: [] = [];
const EMPTY_AVAILABLE_METHODS: [] = [];

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

  const [storedBankMetadata, setStoredBankMetadata] = useState<StoredBankMetadata>({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const profileQuery = usePaymentProfile();
  const profileErrorMessage =
    profileQuery.error instanceof ApiClientError
      ? profileQuery.error.message
      : t.paymentProfileLoadError;

  useEffect(() => {
    setStoredBankMetadata(readStoredBankMetadata());
  }, []);

  const profile = profileQuery.data ?? null;
  const preferredOption = profile ? getPreferredPaymentOption(profile) : null;
  const availableMethods = useMemo(
    () => profile?.available_payment_methods ?? EMPTY_AVAILABLE_METHODS,
    [profile]
  );
  const selectedMethod = useMemo(
    () =>
      availableMethods.find((method) => method.payment_method === selectedPaymentMethod) ??
      availableMethods[0] ??
      null,
    [availableMethods, selectedPaymentMethod]
  );
  const selectedBanks = selectedMethod?.available_banks ?? EMPTY_BANKS;
  const resolveSelectedBank = useCallback(
    (bankId: string) =>
      selectedBanks.some((bank) => bank.bank_id === bankId)
        ? bankId
        : selectedBanks[0]?.bank_id || "",
    [selectedBanks]
  );

  useEffect(() => {
    if (!availableMethods.length) {
      setSelectedPaymentMethod("");
      setSelectedBankId("");
      return;
    }

    setSelectedPaymentMethod((current) =>
      availableMethods.some((method) => method.payment_method === current)
        ? current
        : (availableMethods[0]?.payment_method ?? "")
    );
  }, [availableMethods]);

  useEffect(() => {
    setSelectedBankId((current) => resolveSelectedBank(current));
  }, [resolveSelectedBank]);

  async function handleSavePaymentOption() {
    setIsSaving(true);
    setActionError(null);
    const activeMethod = selectedMethod;
    const activeSelectedBank = resolveSelectedBank(selectedBankId);

    try {
      if (!activeMethod) {
        setActionError(t.paymentMethodUnsupported);
        return;
      }

      const data = await fetchJson<PaymentProfile>("/api/account/payment-profile/payment-options", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: activeMethod.payment_method,
          bankId: activeSelectedBank || null,
        }),
      });

      const previousIds = new Set(profile?.stored_payment_options?.map((option) => option.id));
      const createdOption =
        data.stored_payment_options?.find((option) => !previousIds.has(option.id)) ??
        data.stored_payment_options?.find(
          (option) => option.id === data.preferred_payment_option_id
        );
      const selectedBankName = findBank(activeMethod, activeSelectedBank)?.name;

      if (createdOption && activeSelectedBank && selectedBankName) {
        const nextMetadata = {
          ...storedBankMetadata,
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

  async function handleSetPreferredPaymentOption(paymentOptionId: string) {
    setIsSaving(true);
    setActionError(null);

    try {
      const data = await fetchJson<PaymentProfile>(
        `/api/account/payment-profile/payment-options/${encodeURIComponent(paymentOptionId)}/preferred`,
        { method: "PUT" }
      );
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
          <Link
            to="/cart"
            search={{ returnSearch: undefined }}
            className="text-picnic-red text-sm font-semibold"
          >
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
            {availableMethods.length ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleSavePaymentOption();
                }}
              >
                <label className="block text-sm font-medium text-gray-700">
                  {t.paymentMethodTitle}
                  <select
                    value={selectedMethod?.payment_method ?? ""}
                    onChange={(event) => {
                      setSelectedPaymentMethod(event.target.value);
                      setSelectedBankId("");
                    }}
                    className="border-input-border mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    {availableMethods.map((method) => (
                      <option key={method.payment_method} value={method.payment_method}>
                        {getPaymentDisplayName(profile, method.payment_method)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedBanks.length ? (
                  <label className="block text-sm font-medium text-gray-700">
                    {t.paymentBankLabel}
                    <select
                      value={resolveSelectedBank(selectedBankId)}
                      onChange={(event) => setSelectedBankId(event.target.value)}
                      className="border-input-border mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      {selectedBanks.map((bank) => (
                        <option key={bank.bank_id} value={bank.bank_id}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-picnic-red hover:bg-picnic-red-dark rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isSaving ? t.savingPaymentMethod : t.addAndUsePaymentMethod}
                </button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-gray-600">{t.paymentMethodUnsupported}</p>
            )}
          </section>

          <section className="border-card-border rounded-xl border bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{t.storedPaymentMethods}</h2>
            {profile.stored_payment_options?.length ? (
              <div className="mt-3 divide-y divide-gray-100">
                {profile.stored_payment_options.map((option) => (
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
                      {option.id === profile.preferred_payment_option_id ? (
                        <p className="text-picnic-red mt-1 text-xs font-semibold">
                          {t.preferredPaymentMethod}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3 sm:justify-end">
                      {option.id !== profile.preferred_payment_option_id ? (
                        <button
                          type="button"
                          onClick={() => void handleSetPreferredPaymentOption(option.id)}
                          disabled={isSaving}
                          className="text-picnic-red text-sm font-semibold disabled:text-gray-400"
                        >
                          {t.useAsPreferredPaymentMethod}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleRemovePaymentOption(option.id)}
                        disabled={isSaving}
                        className="text-sm font-semibold text-red-600 disabled:text-gray-400 dark:text-red-300"
                      >
                        {t.removePaymentMethod}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">{t.noStoredPaymentMethods}</p>
            )}
          </section>

          {actionError ? (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function findBank(method: AvailablePaymentMethod, bankId: string): PaymentBank | null {
  if (!bankId) return null;
  return method.available_banks?.find((bank) => bank.bank_id === bankId) ?? null;
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
          <Link
            to="/cart"
            search={{ returnSearch: undefined }}
            className="text-picnic-red mt-4 inline-block text-sm font-semibold"
          >
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
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-gray-300 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {isCancelling ? t.paymentCancelling : t.cancelPayment}
            </button>
            <Link
              to="/cart"
              search={{ returnSearch: undefined }}
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
          <Link
            to="/cart"
            search={{ returnSearch: undefined }}
            className="text-picnic-red mt-4 inline-block text-sm font-semibold"
          >
            {t.backToCart}
          </Link>
        </section>
      ) : null}
    </main>
  );
}
