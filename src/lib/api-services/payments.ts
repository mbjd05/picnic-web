import { checkoutCancelSchema, paymentOptionSchema, validateInput } from "@/lib/api/validation";
import { getErrorMessage } from "@/lib/payment/options";
import { buildPicnicClient } from "@/lib/picnic/client";
import {
  createPreferredPaymentOption,
  mapPaymentError,
  readPaymentProfile,
  removePaymentOption,
  sendPicnicRequest,
  setPreferredPaymentOption,
  startCheckoutPayment,
} from "@/lib/payment/checkout";
import type { ApiErrorResponse } from "@/types/api";
import type {
  CheckoutCancelResponse,
  CheckoutPaymentResponse,
  CheckoutStatusResponse,
  PaymentProfile,
} from "@/types/payment";
import type { CountryCode } from "@/types/locale";

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
  const validation = validateInput(paymentOptionSchema, rawBody);
  if (!validation.ok) {
    return { body: { error: validation.error }, status: 400 };
  }

  const bankId = typeof validation.data.bankId === "string" ? validation.data.bankId : null;

  try {
    const client = buildPicnicClient(authToken, countryCode);
    return {
      body: await createPreferredPaymentOption(client, validation.data.paymentMethod, bankId),
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

export async function setPreferredPaymentOptionService(
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
    return { body: await setPreferredPaymentOption(client, paymentOptionId) };
  } catch (error) {
    return mapPaymentError(
      error,
      "[payment option service] Failed to set preferred option",
      "Kan standaard betaalmethode niet aanpassen. Probeer het opnieuw."
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
  const validation = validateInput(checkoutCancelSchema, rawBody);
  if (!validation.ok) {
    return { body: { error: validation.error }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    await sendPicnicRequest(
      client,
      "POST",
      "/cart/checkout/cancel",
      { transaction_id: validation.data.transactionId },
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
