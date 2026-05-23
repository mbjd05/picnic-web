"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ErrorView } from "@/components/error-view";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SharedHeader } from "@/components/shared-header";
import { useTranslations } from "@/contexts/country-context";
import { usePageTitle } from "@/hooks/use-page-title";
import { isApiErrorResponse, readJsonResponse } from "@/lib/client-fetch";
import type { CheckoutCancelResponse, CheckoutStatusResponse } from "@/lib/types";

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

export default function PaymentReturnPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  usePageTitle(t.paymentReturnTitle);

  const [returnState, setReturnState] = useState<ReturnState>({ status: "loading" });
  const [isCancelling, setIsCancelling] = useState(false);

  const loadStatus = useCallback(async () => {
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
          await fetch("/api/checkout/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
      const response = await fetch(`/api/checkout/status/${encodeURIComponent(transactionId)}`);
      const data = await readJsonResponse<CheckoutStatusResponse>(
        response,
        t.paymentStatusLoadError
      );

      if (isApiErrorResponse(data)) {
        setReturnState({ status: "error", message: data.error });
        return;
      }

      setReturnState({
        status: "ready",
        transactionId,
        orderId,
        paymentStatus: describeStatus(data),
      });
    } catch {
      setReturnState({ status: "error", message: t.paymentStatusLoadError });
    }
  }, [searchParams, t.paymentStatusLoadError]);

  useEffect(() => {
    void Promise.resolve().then(loadStatus);
  }, [loadStatus]);

  async function handleCancel() {
    if (returnState.status !== "ready") return;

    setIsCancelling(true);

    try {
      const response = await fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: returnState.transactionId }),
      });
      const data = await readJsonResponse<CheckoutCancelResponse>(
        response,
        t.paymentCancelError
      );

      if (isApiErrorResponse(data)) {
        setReturnState({ status: "error", message: data.error });
        return;
      }

      localStorage.removeItem("picnic_checkout_transaction_id");
      localStorage.removeItem("picnic_checkout_order_id");
      localStorage.removeItem("picnic_checkout_payment_id");
      setReturnState({ status: "cancelled", transactionId: returnState.transactionId });
    } catch {
      setReturnState({ status: "error", message: t.paymentCancelError });
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SharedHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {returnState.status === "loading" && <LoadingSpinner />}
        {returnState.status === "error" && (
          <ErrorView message={returnState.message} onRetry={loadStatus} />
        )}
        {returnState.status === "missing" && (
          <section className="border-card-border rounded-xl border bg-white p-6">
            <h1 className="text-foreground text-2xl font-bold">{t.paymentReturnTitle}</h1>
            <p className="mt-3 text-sm text-gray-600">{t.paymentReturnMissing}</p>
            {returnState.providerResult && (
              <p className="mt-2 text-sm text-gray-500">
                {t.paymentProviderResultLabel}: {returnState.providerResult}
              </p>
            )}
            <Link href="/cart" className="text-picnic-red mt-4 inline-block text-sm font-semibold">
              {t.backToCart}
            </Link>
          </section>
        )}
        {returnState.status === "ready" && (
          <section className="border-card-border rounded-xl border bg-white p-6">
            <h1 className="text-foreground text-2xl font-bold">{t.paymentReturnTitle}</h1>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t.paymentStatusLabel}</dt>
                <dd className="font-semibold text-gray-900">{returnState.paymentStatus}</dd>
              </div>
              {returnState.orderId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t.orderIdLabel}</dt>
                  <dd className="font-semibold text-gray-900">{returnState.orderId}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadStatus}
                className="border-card-border rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                {t.retryButton}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
              >
                {isCancelling ? t.paymentCancelling : t.cancelPayment}
              </button>
              <Link
                href="/cart"
                className="bg-picnic-red rounded-lg px-4 py-2 text-sm font-semibold text-white"
              >
                {t.backToCart}
              </Link>
            </div>
          </section>
        )}
        {returnState.status === "cancelled" && (
          <section className="border-card-border rounded-xl border bg-white p-6">
            <h1 className="text-foreground text-2xl font-bold">{t.paymentCancelledTitle}</h1>
            <p className="mt-3 text-sm text-gray-600">{t.paymentCancelledText}</p>
            {returnState.paymentId && (
              <p className="mt-2 text-sm text-gray-500">
                {t.paymentIdLabel}: {returnState.paymentId}
              </p>
            )}
            <Link href="/cart" className="text-picnic-red mt-4 inline-block text-sm font-semibold">
              {t.backToCart}
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
