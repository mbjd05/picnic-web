import { isApiTokenExpiredError } from "@/lib/api/error";
import {
  getAvailablePaymentMethod,
  getErrorMessage,
  isEmptyJsonResponseError,
} from "@/lib/payment/options";
import type { PicnicClientInstance } from "@/lib/picnic/client";
import type { ApiErrorResponse } from "@/types/api";
import type { CheckoutPaymentResponse, PaymentProfile } from "@/types/payment";

type SendRequestClient = {
  sendRequest: (
    method: string,
    path: string,
    body: Record<string, unknown> | null,
    includeFusion: boolean
  ) => Promise<unknown>;
};

type CheckoutStartResponse = {
  order_id?: string;
  transaction_expiry?: string | null;
};

type CheckoutInitiateResponse = {
  payment_id?: string | null;
  transaction_id?: string;
  issuer_authentication_url?: string | null;
  action?: {
    type?: string;
    redirect_url?: string | null;
  };
};

export function sendPicnicRequest(
  client: PicnicClientInstance,
  method: string,
  path: string,
  body: Record<string, unknown> | null,
  includeFusion: boolean
): Promise<unknown> {
  return (client as unknown as SendRequestClient).sendRequest(method, path, body, includeFusion);
}

export async function readPaymentProfile(client: PicnicClientInstance): Promise<PaymentProfile> {
  return (await sendPicnicRequest(client, "GET", "/payment-profile", null, true)) as PaymentProfile;
}

export async function createPreferredPaymentOption(
  client: PicnicClientInstance,
  paymentMethod: string,
  bankId: string | null
): Promise<PaymentProfile> {
  const before = await readPaymentProfile(client);

  if (paymentMethod !== "IDEAL") {
    throw new PaymentFlowError(
      "PAYMENT_METHOD_UNAVAILABLE",
      "Alleen iDEAL | Wero wordt momenteel ondersteund in deze webflow.",
      400
    );
  }

  for (const option of before.stored_payment_options ?? []) {
    try {
      await sendPicnicRequest(
        client,
        "DELETE",
        `/payment-profile/payment-options/${encodeURIComponent(option.id)}`,
        null,
        true
      );
    } catch (error) {
      if (!isEmptyJsonResponseError(error)) {
        throw error;
      }
    }
  }

  const profileAfterRemoval = await readPaymentProfile(client);
  const availableMethod = getAvailablePaymentMethod(profileAfterRemoval, paymentMethod);

  if (!availableMethod) {
    throw new PaymentFlowError(
      "PAYMENT_METHOD_UNAVAILABLE",
      "iDEAL | Wero is niet beschikbaar voor dit account.",
      400
    );
  }

  if (availableMethod?.available_banks?.length) {
    const validBank = Boolean(
      bankId && availableMethod.available_banks.some((bank) => bank.bank_id === bankId)
    );

    if (!validBank) {
      throw new PaymentFlowError(
        "PAYMENT_BANK_UNAVAILABLE",
        "Geselecteerde bank is niet beschikbaar voor deze betaalmethode.",
        400
      );
    }
  }

  const payload = bankId
    ? { payment_method: paymentMethod, bank_id: bankId }
    : { payment_method: paymentMethod };

  try {
    await sendPicnicRequest(client, "POST", "/payment-profile/payment-options", payload, true);
  } catch (error) {
    if (!isEmptyJsonResponseError(error)) {
      const message = getErrorMessage(error);
      if (message.includes("Invalid data")) {
        throw new PaymentFlowError(
          "CHECKOUT_PAYMENT_FAILED",
          "Picnic accepteert deze betaalmethode of bank niet via deze webflow.",
          400
        );
      }
      throw error;
    }
  }

  const after = await readPaymentProfile(client);
  const preferredAfter = after.stored_payment_options?.find(
    (option) => option.id === after.preferred_payment_option_id
  );

  if (!preferredAfter || preferredAfter.payment_method !== paymentMethod) {
    throw new PaymentFlowError(
      "CHECKOUT_PAYMENT_FAILED",
      "Betaalmethode kon niet worden opgeslagen.",
      502
    );
  }

  return after;
}

export async function removePaymentOption(
  client: PicnicClientInstance,
  paymentOptionId: string
): Promise<PaymentProfile> {
  const before = await readPaymentProfile(client);
  const existsBefore = before.stored_payment_options?.some(
    (option) => option.id === paymentOptionId
  );

  if (!existsBefore) {
    throw new PaymentFlowError("PAYMENT_OPTION_NOT_FOUND", "Betaaloptie bestaat niet.", 404);
  }

  try {
    await sendPicnicRequest(
      client,
      "DELETE",
      `/payment-profile/payment-options/${encodeURIComponent(paymentOptionId)}`,
      null,
      true
    );
  } catch (error) {
    if (!isEmptyJsonResponseError(error)) {
      throw error;
    }
  }

  const after = await readPaymentProfile(client);
  const stillExists = after.stored_payment_options?.some((option) => option.id === paymentOptionId);

  if (stillExists) {
    throw new PaymentFlowError("CHECKOUT_PAYMENT_FAILED", "Betaaloptie is niet verwijderd.", 502);
  }

  return after;
}

export async function startCheckoutPayment(
  client: PicnicClientInstance,
  appReturnUrl: string
): Promise<CheckoutPaymentResponse> {
  const cart = (await sendPicnicRequest(client, "GET", "/cart", null, true)) as {
    mts?: number;
  };

  const checkout = (await sendPicnicRequest(
    client,
    "POST",
    "/cart/checkout/start",
    {
      mts: cart.mts,
      oos_article_ids: null,
    },
    true
  )) as CheckoutStartResponse;

  if (!checkout.order_id) {
    throw new PaymentFlowError(
      "CHECKOUT_PAYMENT_FAILED",
      "Picnic gaf geen ordernummer terug.",
      502
    );
  }

  const payment = (await sendPicnicRequest(
    client,
    "POST",
    "/cart/checkout/initiate_payment",
    {
      order_id: checkout.order_id,
      app_return_url: appReturnUrl,
    },
    true
  )) as CheckoutInitiateResponse;

  const redirectUrl = payment.action?.redirect_url ?? payment.issuer_authentication_url ?? null;

  if (!payment.transaction_id || !redirectUrl) {
    throw new PaymentFlowError(
      "CHECKOUT_PAYMENT_FAILED",
      "Picnic gaf geen betaalredirect terug.",
      502
    );
  }

  return {
    orderId: checkout.order_id,
    paymentId: payment.payment_id ?? null,
    transactionId: payment.transaction_id,
    redirectUrl,
    transactionExpiry: checkout.transaction_expiry ?? null,
  };
}

export class PaymentFlowError extends Error {
  constructor(
    public readonly code: NonNullable<ApiErrorResponse["code"]>,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export function mapPaymentError(
  error: unknown,
  logPrefix: string,
  fallbackMessage = "Betaling kon niet worden gestart. Probeer het later opnieuw."
): { body: ApiErrorResponse; status: number } {
  if (isApiTokenExpiredError(error)) {
    return {
      body: { error: "Your token has expired", code: "TOKEN_EXPIRED" },
      status: 401,
    };
  }

  if (error instanceof PaymentFlowError) {
    return {
      body: { error: error.message, code: error.code },
      status: error.status,
    };
  }

  const message = getErrorMessage(error);
  console.error(`${logPrefix}:`, message);

  if (message.includes("has no preferred option")) {
    return {
      body: {
        error: "Er is nog geen voorkeursbetaalmethode ingesteld. Kies eerst een betaalmethode.",
        code: "NO_PREFERRED_PAYMENT_OPTION",
      },
      status: 400,
    };
  }

  if (message.includes("Your shopping cart is out of date")) {
    return {
      body: {
        error: "Je winkelwagen is niet meer actueel. Ververs de winkelwagen en probeer opnieuw.",
        code: "CART_OUT_OF_DATE",
      },
      status: 409,
    };
  }

  if (message.includes("beschikbaar vanaf")) {
    return {
      body: {
        error: "Dit bezorgmoment is beschikbaar vanaf de minimale bestelwaarde.",
        code: "MINIMUM_ORDER_VALUE",
      },
      status: 400,
    };
  }

  if (message.includes("payment") || message.includes("Payment")) {
    return {
      body: {
        error: fallbackMessage,
        code: "CHECKOUT_PAYMENT_FAILED",
      },
      status: 400,
    };
  }

  return {
    body: {
      error: fallbackMessage,
      code: "CHECKOUT_PAYMENT_FAILED",
    },
    status: 502,
  };
}
