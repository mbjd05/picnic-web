import { getErrorMessage } from "@/lib/payment";
import { buildPicnicClient } from "@/lib/picnic-client";
import {
  createPreferredPaymentOption,
  mapPaymentError,
  readPaymentProfile,
  removePaymentOption,
  sendPicnicRequest,
  startCheckoutPayment,
} from "@/lib/picnic-payment";
import type {
  ApiErrorResponse,
  CheckoutCancelResponse,
  CheckoutPaymentResponse,
  CheckoutStatusResponse,
  CountryCode,
  PaymentProfile,
} from "@/lib/types";

import type { ApiServiceResult } from "./types";

export async function getPaymentProfileService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<PaymentProfile | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);
    return { body: await readPaymentProfile(client) };
  } catch (error) {
    return mapPaymentError(
      error,
      "[payment profile service] Failed to fetch profile",
      "Kan betaalmethoden niet laden. Probeer het later opnieuw."
    );
  }
}

export async function createPaymentOptionService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<PaymentProfile | ApiErrorResponse>> {
  if (!rawBody || typeof rawBody !== "object") {
    return { body: { error: "Invalid JSON body" }, status: 400 };
  }

  const body = rawBody as { paymentMethod?: unknown; bankId?: unknown };
  if (!body.paymentMethod || typeof body.paymentMethod !== "string") {
    return { body: { error: "Missing required field: paymentMethod" }, status: 400 };
  }

  const bankId = typeof body.bankId === "string" ? body.bankId : null;

  try {
    const client = buildPicnicClient(authToken, countryCode);
    return {
      body: await createPreferredPaymentOption(client, body.paymentMethod, bankId),
    };
  } catch (error) {
    return mapPaymentError(
      error,
      "[payment option service] Failed to save option",
      "Kan betaalmethode niet opslaan. Probeer het opnieuw."
    );
  }
}

export async function removePaymentOptionService(
  authToken: string,
  countryCode: CountryCode,
  paymentOptionId: string
): Promise<ApiServiceResult<PaymentProfile | ApiErrorResponse>> {
  if (!paymentOptionId) {
    return {
      body: { error: "Missing required route parameter: paymentOptionId" },
      status: 400,
    };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    return { body: await removePaymentOption(client, paymentOptionId) };
  } catch (error) {
    return mapPaymentError(
      error,
      "[payment option service] Failed to delete option",
      "Kan betaalmethode niet verwijderen. Probeer het opnieuw."
    );
  }
}

export async function startCheckoutPaymentService(
  authToken: string,
  countryCode: CountryCode,
  appReturnUrl: string
): Promise<ApiServiceResult<CheckoutPaymentResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);
    return { body: await startCheckoutPayment(client, appReturnUrl) };
  } catch (error) {
    return mapPaymentError(error, "[checkout service] Failed to start payment");
  }
}

export async function cancelCheckoutService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<CheckoutCancelResponse | ApiErrorResponse>> {
  if (!rawBody || typeof rawBody !== "object") {
    return { body: { error: "Invalid JSON body" }, status: 400 };
  }

  const transactionId = (rawBody as { transactionId?: unknown }).transactionId;
  if (!transactionId || typeof transactionId !== "string") {
    return { body: { error: "Missing required field: transactionId" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    await sendPicnicRequest(
      client,
      "POST",
      "/cart/checkout/cancel",
      { transaction_id: transactionId },
      true
    );

    return { body: { ok: true } };
  } catch (error) {
    return mapPaymentError(error, "[checkout service] Failed to cancel payment");
  }
}

export async function getCheckoutStatusService(
  authToken: string,
  countryCode: CountryCode,
  transactionId: string
): Promise<ApiServiceResult<CheckoutStatusResponse | ApiErrorResponse>> {
  if (!transactionId) {
    return {
      body: { error: "Missing required route parameter: transactionId" },
      status: 400,
    };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const raw = await sendPicnicRequest(
      client,
      "GET",
      `/cart/checkout/${encodeURIComponent(transactionId)}/status`,
      null,
      false
    );

    return { body: { raw } };
  } catch (error) {
    const message = getErrorMessage(error);
    const status = (error as { response?: { status?: number } }).response?.status;

    if (status === 404 || message === "Not Found" || message.includes("Not Found")) {
      return { body: { inactive: true, status: "NOT_FOUND" } };
    }

    return mapPaymentError(error, "[checkout service] Failed to fetch status");
  }
}
