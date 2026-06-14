import { isApiAuthError } from "@/lib/api-error";
import type { DeliverySlotPickerData } from "@/lib/delivery-slot-types";
import { parseCartResponse } from "@/lib/parse-cart";
import { parseDeliverySlotsPicker } from "@/lib/parse-delivery-slots";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse, CartData, CartMutationRequest, CountryCode } from "@/lib/types";

import type { ApiServiceResult } from "./types";

type SendRequestClient = {
  sendRequest: (
    method: string,
    path: string,
    body: Record<string, unknown> | null,
    includeFusion: boolean
  ) => Promise<unknown>;
};

type CartMutationValidation =
  | { ok: true; body: CartMutationRequest }
  | { ok: false; error: string };

type DeliverySlotValidation = { ok: true; slotId: string } | { ok: false; error: string };

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

    return { body: parseCartResponse(rawCart) };
  } catch (error) {
    if (isApiAuthError(error)) {
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

  const endpoint = validation.body.action === "add" ? "/cart/add_product" : "/cart/remove_product";

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawCart = await (client as unknown as SendRequestClient).sendRequest(
      "POST",
      endpoint,
      {
        product_id: validation.body.productId,
        count: validation.body.count,
      },
      true
    );

    return { body: parseCartResponse(rawCart) };
  } catch (error) {
    if (isApiAuthError(error)) {
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

    return { body: parseDeliverySlotsPicker(rawResult) };
  } catch (error) {
    if (isApiAuthError(error)) {
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
  const validation = validateDeliverySlot(rawBody);
  if (!validation.ok) {
    return { body: { error: validation.error }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawCart = await (client as unknown as SendRequestClient).sendRequest(
      "POST",
      "/cart/set_delivery_slot",
      {
        slot_id: validation.slotId,
      },
      false
    );

    return { body: parseCartResponse(rawCart) };
  } catch (error) {
    if (isApiAuthError(error)) {
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

function validateCartMutation(rawBody: unknown): CartMutationValidation {
  if (!rawBody || typeof rawBody !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }

  const body = rawBody as Partial<CartMutationRequest>;
  if (!body.productId || !body.action || typeof body.count !== "number") {
    return { ok: false, error: "Missing required fields: productId, action, count" };
  }

  if (body.action !== "add" && body.action !== "remove") {
    return { ok: false, error: 'action must be "add" or "remove"' };
  }

  return { ok: true, body: body as CartMutationRequest };
}

function validateDeliverySlot(rawBody: unknown): DeliverySlotValidation {
  if (!rawBody || typeof rawBody !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }

  const slotId = (rawBody as { slotId?: unknown }).slotId;
  if (!slotId || typeof slotId !== "string") {
    return { ok: false, error: "Missing required field: slotId" };
  }

  return { ok: true, slotId };
}
