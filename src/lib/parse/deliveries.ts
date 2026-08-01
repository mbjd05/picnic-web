import type {
  DeliveryDetail,
  DeliveryEta,
  DeliveryLineItem,
  DeliveryOrderSummary,
  DeliverySummary,
  DeliveryWindow,
} from "@/types/delivery";
import { asArray, isObject } from "@/lib/utils/type-guards";

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseSlot(rawSlot: unknown): DeliveryWindow | null {
  if (!isObject(rawSlot)) return null;

  return {
    slotId: stringOrNull(rawSlot["slot_id"]),
    windowStart: stringOrNull(rawSlot["window_start"]),
    windowEnd: stringOrNull(rawSlot["window_end"]),
    cutOffTime: stringOrNull(rawSlot["cut_off_time"]),
    isAvailable: booleanOrNull(rawSlot["is_available"]),
    isSelected: booleanOrNull(rawSlot["selected"]),
    isReserved: booleanOrNull(rawSlot["reserved"]),
  };
}

function parseEta(rawEta: unknown): DeliveryEta | null {
  if (!isObject(rawEta)) return null;

  return {
    start: stringOrNull(rawEta["start"]),
    end: stringOrNull(rawEta["end"]),
  };
}

function parseOrder(rawOrder: unknown): DeliveryOrderSummary | null {
  if (!isObject(rawOrder)) return null;

  const transactionInfo = isObject(rawOrder["transaction_info"])
    ? rawOrder["transaction_info"]
    : null;

  return {
    id: stringOrNull(rawOrder["id"]),
    status: stringOrNull(rawOrder["status"]),
    creationTime: stringOrNull(rawOrder["creation_time"]),
    totalPrice: numberOrNull(rawOrder["total_price"]),
    checkoutTotalPrice: numberOrNull(rawOrder["checkout_total_price"]),
    totalSavings: numberOrNull(rawOrder["total_savings"]),
    totalDeposit: numberOrNull(rawOrder["total_deposit"]),
    cancellable: booleanOrNull(rawOrder["cancellable"]),
    cancellationTime: stringOrNull(rawOrder["cancellation_time"]),
    paymentType: transactionInfo ? stringOrNull(transactionInfo["payment_type"]) : null,
    redactedIban: transactionInfo ? stringOrNull(transactionInfo["redacted_iban"]) : null,
    membershipSavings: numberOrNull(rawOrder["membership_savings"]),
  };
}

function quantityFromDecorators(rawArticle: Record<string, unknown>): number {
  for (const decorator of asArray(rawArticle["decorators"]).filter(isObject)) {
    if (stringOrNull(decorator["type"]) === "QUANTITY") {
      return numberOrNull(decorator["quantity"]) ?? 1;
    }
  }
  return 1;
}

function parseOrderLine(rawLine: unknown): DeliveryLineItem | null {
  if (!isObject(rawLine)) return null;

  const article = asArray(rawLine["items"]).find(isObject);
  if (!article) return null;

  const imageId =
    asArray(article["image_ids"]).find((value): value is string => typeof value === "string") ??
    null;

  return {
    id: stringOrNull(rawLine["id"]),
    productId: stringOrNull(article["id"]),
    name: stringOrNull(article["name"]) ?? "",
    imageId,
    unitQuantity: stringOrNull(article["unit_quantity"]),
    quantity: quantityFromDecorators(article),
    displayPrice: numberOrNull(rawLine["display_price"]),
    originalPrice: numberOrNull(rawLine["price"]),
  };
}

export function parseDeliverySummary(rawDelivery: unknown): DeliverySummary | null {
  if (!isObject(rawDelivery)) return null;

  const deliveryId = stringOrNull(rawDelivery["delivery_id"]) ?? stringOrNull(rawDelivery["id"]);
  if (!deliveryId) return null;

  return {
    deliveryId,
    creationTime: stringOrNull(rawDelivery["creation_time"]),
    status: stringOrNull(rawDelivery["status"]),
    slot: parseSlot(rawDelivery["slot"]),
    eta: parseEta(rawDelivery["eta2"]),
    orders: asArray(rawDelivery["orders"])
      .map(parseOrder)
      .filter((order): order is DeliveryOrderSummary => order !== null),
  };
}

export function parseDeliverySummaries(rawDeliveries: unknown): DeliverySummary[] {
  return asArray(rawDeliveries)
    .map(parseDeliverySummary)
    .filter((delivery): delivery is DeliverySummary => delivery !== null);
}

export function parseDeliveryDetail(rawDelivery: unknown): DeliveryDetail | null {
  const summary = parseDeliverySummary(rawDelivery);
  if (!summary || !isObject(rawDelivery)) return null;

  const lineItems = asArray(rawDelivery["orders"])
    .filter(isObject)
    .flatMap((order) => asArray(order["items"]).map(parseOrderLine))
    .filter((item): item is DeliveryLineItem => item !== null);

  return {
    ...summary,
    lineItems,
    returnedContainers: asArray(rawDelivery["returned_containers"]),
    parcels: asArray(rawDelivery["parcels"]),
  };
}
