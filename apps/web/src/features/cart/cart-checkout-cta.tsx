import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { formatEuroPrice } from "@/lib/format/price";
import { getPreferredPaymentOption } from "@/lib/payment/options";
import type { CheckoutPaymentResponse } from "@/lib/types/payment";

import { useTranslations } from "../../country-context";
import { ApiClientError, fetchJson } from "../../lib/api-client";
import { usePaymentProfile } from "../payment/use-payment-profile";

const PAYMENT_BANK_STORAGE_KEY = "picnic_payment_option_banks";

export function CartCheckoutCta({
  totalPrice,
  minimumOrderValue,
}: {
  totalPrice: number;
  minimumOrderValue: number | null;
}) {
  const t = useTranslations();
  const [checkoutState, setCheckoutState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "error"; message: string }
  >({ status: "idle" });
  const [storedBankMetadata] = useState(readStoredBankMetadata);
  const paymentProfileQuery = usePaymentProfile();
  const paymentProfile = paymentProfileQuery.data ?? null;

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
      const data = await fetchJson<CheckoutPaymentResponse>("/api/checkout/start-payment", {
        method: "POST",
      });
      sessionStorage.setItem("picnic_checkout_transaction_id", data.transactionId);
      sessionStorage.setItem("picnic_checkout_order_id", data.orderId);
      localStorage.setItem("picnic_checkout_transaction_id", data.transactionId);
      localStorage.setItem("picnic_checkout_order_id", data.orderId);
      if (data.paymentId) localStorage.setItem("picnic_checkout_payment_id", data.paymentId);
      window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      setCheckoutState({ status: "idle" });
    } catch (error) {
      setCheckoutState({
        status: "error",
        message: error instanceof ApiClientError ? error.message : t.checkoutStartError,
      });
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
          <Link
            to="/account/payment"
            search={{ from: "cart" }}
            className="text-picnic-red text-sm font-semibold"
          >
            {t.managePaymentMethods}
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleCheckout()}
        disabled={checkoutState.status === "loading" || hasKnownMissingPayment || isBelowMinimum}
        className="bg-picnic-red block w-full rounded-xl py-4 text-center text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {checkoutState.status === "loading" ? t.checkoutStarting : t.checkoutLabel}
      </button>
      {hasKnownMissingPayment ? (
        <p className="text-sm text-gray-600">
          {t.noPreferredPaymentMethod}{" "}
          <Link
            to="/account/payment"
            search={{ from: "cart" }}
            className="text-picnic-red font-semibold"
          >
            {t.choosePaymentMethod}
          </Link>
        </p>
      ) : null}
      {isBelowMinimum ? (
        <p className="text-sm text-gray-600">
          {t.minimumCheckoutMessage
            .replace("{minimum}", formatEuroPrice(minimumOrderValue ?? 0))
            .replace("{current}", formatEuroPrice(totalPrice))}
        </p>
      ) : null}
      {checkoutState.status === "error" ? (
        <p className="text-sm text-red-600" role="alert">
          {checkoutState.message}
        </p>
      ) : null}
    </div>
  );
}

function readStoredBankMetadata(): Record<string, { bankName: string }> {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_BANK_STORAGE_KEY) ?? "{}") as Record<
      string,
      { bankName: string }
    >;
  } catch {
    return {};
  }
}
