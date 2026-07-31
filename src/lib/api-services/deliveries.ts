import { isApiTokenExpiredError } from "@/lib/api-error";
import type {
  DeliveryActionApiResponse,
  DeliveryDetail,
  DeliveryOrderStatusApiResponse,
  DeliverySummariesApiResponse,
  DeliveryTrackingApiResponse,
} from "@/lib/delivery-types";
import { parseDeliveryDetail, parseDeliverySummaries } from "@/lib/parse-deliveries";
import { buildPicnicClient } from "@/lib/picnic-client";
import type { ApiErrorResponse, CountryCode } from "@/lib/types";

import type { ApiServiceResult } from "./types";

type SendRequestClient = {
  sendRequest: (
    method: string,
    path: string,
    body: unknown,
    includeFusion: boolean
  ) => Promise<unknown>;
};

type DeliveryDomainClient = {
  cart: {
    getOrderStatus: (orderId: string) => Promise<unknown>;
  };
  delivery: {
    cancelDelivery: (deliveryId: string) => Promise<unknown>;
    setDeliveryRating: (deliveryId: string, rating: number) => Promise<unknown>;
    sendDeliveryInvoiceEmail: (deliveryId: string) => Promise<unknown>;
  };
};

function deliveryError(
  error: unknown,
  context: string,
  userMessage = "Failed to fetch deliveries. Please try again later."
): ApiServiceResult<ApiErrorResponse> {
  if (isApiTokenExpiredError(error)) {
    return {
      body: { error: "Your token has expired", code: "TOKEN_EXPIRED" as const },
      status: 401,
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error occurred";
  console.error(`[deliveries service] ${context}:`, message);

  return {
    body: { error: userMessage },
    status: 502,
  };
}

export async function getDeliverySummariesService(
  authToken: string,
  countryCode: CountryCode,
  statuses: string[] = []
): Promise<ApiServiceResult<DeliverySummariesApiResponse | ApiErrorResponse>> {
  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawDeliveries = await (client as unknown as SendRequestClient).sendRequest(
      "POST",
      "/deliveries/summary",
      statuses,
      false
    );

    return { body: { deliveries: parseDeliverySummaries(rawDeliveries) } };
  } catch (error) {
    return deliveryError(error, "Failed to fetch delivery summaries");
  }
}

export async function getDeliveryDetailService(
  authToken: string,
  countryCode: CountryCode,
  deliveryId: string
): Promise<ApiServiceResult<DeliveryDetail | ApiErrorResponse>> {
  if (!deliveryId) {
    return { body: { error: "Missing delivery id" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode);
    const rawDelivery = await (client as unknown as SendRequestClient).sendRequest(
      "GET",
      `/deliveries/${encodeURIComponent(deliveryId)}`,
      null,
      false
    );
    const delivery = parseDeliveryDetail(rawDelivery);

    if (!delivery) {
      return { body: { error: "Delivery not found" }, status: 404 };
    }

    return { body: delivery };
  } catch (error) {
    return deliveryError(error, `Failed to fetch delivery "${deliveryId}"`);
  }
}

export async function getDeliveryTrackingService(
  authToken: string,
  countryCode: CountryCode,
  deliveryId: string
): Promise<ApiServiceResult<DeliveryTrackingApiResponse | ApiErrorResponse>> {
  if (!deliveryId) {
    return { body: { error: "Missing delivery id" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as SendRequestClient;
    const [scenario, position] = await Promise.all([
      client.sendRequest(
        "GET",
        `/deliveries/${encodeURIComponent(deliveryId)}/scenario`,
        null,
        false
      ),
      client.sendRequest(
        "GET",
        `/deliveries/${encodeURIComponent(deliveryId)}/position`,
        null,
        false
      ),
    ]);

    return { body: { scenario, position } };
  } catch (error) {
    return deliveryError(error, `Failed to fetch tracking for delivery "${deliveryId}"`);
  }
}

export async function getDeliveryOrderStatusService(
  authToken: string,
  countryCode: CountryCode,
  orderId: string
): Promise<ApiServiceResult<DeliveryOrderStatusApiResponse | ApiErrorResponse>> {
  if (!orderId) {
    return { body: { error: "Missing order id" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as DeliveryDomainClient;
    const status = await client.cart.getOrderStatus(orderId);
    return { body: { status } };
  } catch (error) {
    return deliveryError(
      error,
      `Failed to fetch order status "${orderId}"`,
      "Failed to fetch order status. Please try again later."
    );
  }
}

export async function cancelDeliveryService(
  authToken: string,
  countryCode: CountryCode,
  deliveryId: string
): Promise<ApiServiceResult<DeliveryActionApiResponse | ApiErrorResponse>> {
  if (!deliveryId) {
    return { body: { error: "Missing delivery id" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as DeliveryDomainClient;
    const result = await client.delivery.cancelDelivery(deliveryId);
    return { body: { success: true, result } };
  } catch (error) {
    return deliveryError(
      error,
      `Failed to cancel delivery "${deliveryId}"`,
      "Failed to cancel delivery. Please try again later."
    );
  }
}

export async function setDeliveryRatingService(
  authToken: string,
  countryCode: CountryCode,
  deliveryId: string,
  rating: number
): Promise<ApiServiceResult<DeliveryActionApiResponse | ApiErrorResponse>> {
  if (!deliveryId) {
    return { body: { error: "Missing delivery id" }, status: 400 };
  }
  if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
    return { body: { error: "Rating must be a whole number from 0 to 10" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as DeliveryDomainClient;
    const result = await client.delivery.setDeliveryRating(deliveryId, rating);
    return { body: { success: true, result } };
  } catch (error) {
    return deliveryError(
      error,
      `Failed to rate delivery "${deliveryId}"`,
      "Failed to save delivery rating. Please try again later."
    );
  }
}

export async function sendDeliveryInvoiceEmailService(
  authToken: string,
  countryCode: CountryCode,
  deliveryId: string
): Promise<ApiServiceResult<DeliveryActionApiResponse | ApiErrorResponse>> {
  if (!deliveryId) {
    return { body: { error: "Missing delivery id" }, status: 400 };
  }

  try {
    const client = buildPicnicClient(authToken, countryCode) as unknown as DeliveryDomainClient;
    const result = await client.delivery.sendDeliveryInvoiceEmail(deliveryId);
    return { body: { success: true, result } };
  } catch (error) {
    return deliveryError(
      error,
      `Failed to resend invoice email for delivery "${deliveryId}"`,
      "Failed to send invoice email. Please try again later."
    );
  }
}
