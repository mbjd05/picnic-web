"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useTranslations } from "@/contexts/country-context";
import { isApiErrorResponse, readJsonResponse } from "@/lib/client-fetch";
import { TOKEN_EXPIRED_REDIRECT } from "@/lib/constants";
import { formatPrice } from "@/lib/format-price";
import { getPreferredPaymentOption } from "@/lib/payment";
import type { CheckoutPaymentResponse, PaymentProfile } from "@/lib/types";

const PAYMENT_BANK_STORAGE_KEY = "picnic_payment_option_banks";

function readStoredBankMetadata(): Record<string, { bankName: string }> {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(PAYMENT_BANK_STORAGE_KEY) ?? "{}") as Record<
      string,
      { bankName: string }
    >;
  } catch {
    return {};
  }
}

type CheckoutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; code?: string };

/**
 * Checkout button for direct Picnic payment.
 * Only shown when the cart has items (rendered conditionally by the cart page).
 */
export function CheckoutCta({
  totalPrice,
  minimumOrderValue,
}: {
  totalPrice: number;
  minimumOrderValue: number | null;
}) {
  const t = useTranslations();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ status: "idle" });
  const [paymentProfile, setPaymentProfile] = useState<PaymentProfile | null>(null);
  const [storedBankMetadata] = useState(readStoredBankMetadata);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/account/payment-profile", { signal: controller.signal })
      .then((response) =>
        readJsonResponse<PaymentProfile>(response, t.paymentProfileLoadError)
      )
      .then((data) => {
        if (isApiErrorResponse(data)) return;
        setPaymentProfile(data);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [t.paymentProfileLoadError]);

  const preferredOption = paymentProfile ? getPreferredPaymentOption(paymentProfile) : null;
  const hasKnownMissingPayment =
    paymentProfile !== null && paymentProfile.preferred_payment_option_id === null;
  const isBelowMinimum =
    minimumOrderValue !== null && minimumOrderValue > 0 && totalPrice < minimumOrderValue;
  const bankName = preferredOption ? storedBankMetadata[preferredOption.id]?.bankName : null;

  async function handleCheckout() {
    if (isBelowMinimum || hasKnownMissingPayment) return;

    setCheckoutState({ status: "loading" });

    try {
      const response = await fetch("/api/checkout/start-payment", { method: "POST" });
      const data = await readJsonResponse<CheckoutPaymentResponse>(
        response,
        t.checkoutStartError
      );

      if (isApiErrorResponse(data)) {
        if (data.code === "TOKEN_EXPIRED") {
          window.location.href = TOKEN_EXPIRED_REDIRECT;
          return;
        }

        setCheckoutState({ status: "error", message: data.error, code: data.code });
        return;
      }

      sessionStorage.setItem("picnic_checkout_transaction_id", data.transactionId);
      sessionStorage.setItem("picnic_checkout_order_id", data.orderId);
      localStorage.setItem("picnic_checkout_transaction_id", data.transactionId);
      localStorage.setItem("picnic_checkout_order_id", data.orderId);
      if (data.paymentId) {
        localStorage.setItem("picnic_checkout_payment_id", data.paymentId);
      }
      window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      setCheckoutState({ status: "idle" });
    } catch {
      setCheckoutState({ status: "error", message: t.checkoutStartError });
    }
  }

  return (
    <div className="space-y-3">
      <div className="border-card-border rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">{t.paymentMethodTitle}</p>
            <p className="mt-1 text-sm text-gray-500">
              {preferredOption?.display_name ?? t.noPreferredPaymentMethod}
              {bankName ? ` · ${bankName}` : ""}
            </p>
          </div>
          <Link href="/account/payment" className="text-picnic-red text-sm font-semibold">
            {t.managePaymentMethods}
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={checkoutState.status === "loading" || hasKnownMissingPayment || isBelowMinimum}
        className="bg-picnic-red block w-full rounded-xl py-4 text-center text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {checkoutState.status === "loading" ? t.checkoutStarting : t.checkoutLabel}
      </button>

      {hasKnownMissingPayment && (
        <p className="text-sm text-gray-600">
          {t.noPreferredPaymentMethod}{" "}
          <Link href="/account/payment" className="text-picnic-red font-semibold">
            {t.choosePaymentMethod}
          </Link>
        </p>
      )}

      {isBelowMinimum && (
        <p className="text-sm text-gray-600">
          {t.minimumCheckoutMessage
            .replace("{minimum}", formatPrice(minimumOrderValue ?? 0))
            .replace("{current}", formatPrice(totalPrice))}
        </p>
      )}

      {checkoutState.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {checkoutState.message}
        </p>
      )}
    </div>
  );
}
