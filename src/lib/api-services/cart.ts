import { isApiTokenExpiredError } from "@/lib/api-error";
import { deliverySlotSchema, validateCartMutation, validateInput } from "@/lib/api-validation";
import type { DeliverySlotPickerData } from "@/lib/delivery-slot-types";
import { parseCartResponse } from "@/lib/parse-cart";
import { parseDeliverySlotsPicker } from "@/lib/parse-delivery-slots";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse } from "@/lib/api-types";
import type { CartData } from "@/lib/cart-types";
import type { CountryCode } from "@/lib/locale-types";

import type { ApiServiceResult } from "./types";

type SendRequestClient = {
  sendRequest: (
    method: string,
    path: string,
    body: Record<string, unknown> | null,
    includeFusion: boolean
  ) => Promise<unknown>;
};

export async function getCartService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<CartData | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawCart = await (client as unknown as SendRequestClient).sendRequest(
      "GET",
      "/cart",
      null,
      true
    );

    return { body: parseCartResponse(rawCart, countryCode) };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[cart service] Failed to fetch cart:", message);

    return {
      body: { error: "Failed to fetch cart. Please try again later." },
      status: 502,
    };
  }
}

export async function mutateCartService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<CartData | ApiErrorResponse>> {
  const validation = validateCartMutation(rawBody);
  if (!validation.ok) {
    return { body: { error: validation.error }, status: 400 };
  }

  const endpoint = validation.data.action === "add" ? "/cart/add_product" : "/cart/remove_product";

  try {
    const client = buildPicnicClient(authToken, countryCode);
    let rawCart: unknown = null;
    for (let index = 0; index < validation.data.count; index += 1) {
      rawCart = await (client as unknown as SendRequestClient).sendRequest(
        "POST",
        endpoint,
        {
          product_id: validation.data.productId,
          count: 1,
        },
        true
      );
    }

    return { body: parseCartResponse(rawCart, countryCode) };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[cart service] Failed to mutate cart:", message);

    return {
      body: { error: "Failed to update cart. Please try again." },
      status: 502,
    };
  }
}

export async function getDeliverySlotsService(
  authToken: string,
  countryCode: CountryCode
): Promise<ApiServiceResult<DeliverySlotPickerData | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawResult = await (client as unknown as SendRequestClient).sendRequest(
      "GET",
      "/cart/delivery_slots",
      null,
      false
    );

    return { body: parseDeliverySlotsPicker(rawResult, countryCode) };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[delivery slots service] Failed to fetch slots:", message);

    return {
      body: { error: "Failed to fetch delivery slots. Please try again later." },
      status: 502,
    };
  }
}

export async function setDeliverySlotService(
  authToken: string,
  countryCode: CountryCode,
  rawBody: unknown
): Promise<ApiServiceResult<CartData | ApiErrorResponse>> {
  const validation = validateInput(deliverySlotSchema, rawBody);
  if (!validation.ok) {
    return { body: { error: validation.error }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawCart = await (client as unknown as SendRequestClient).sendRequest(
      "POST",
      "/cart/set_delivery_slot",
      {
        slot_id: validation.data.slotId,
      },
      false
    );

    return { body: parseCartResponse(rawCart, countryCode) };
  } catch (error) {
    if (isApiTokenExpiredError(error)) {
      return {
        body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
        status: 401,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[delivery slots service] Failed to set slot:", message);

    return {
      body: { error: "Failed to set delivery slot. Please try again." },
      status: 502,
    };
  }
}
