export type DeliveryWindow = {
  slotId: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  cutOffTime: string | null;
  isAvailable: boolean | null;
  isSelected: boolean | null;
  isReserved: boolean | null;
};

export type DeliveryEta = {
  start: string | null;
  end: string | null;
};

export type DeliveryOrderSummary = {
  id: string | null;
  status: string | null;
  creationTime: string | null;
  totalPrice: number | null;
  checkoutTotalPrice: number | null;
  totalSavings: number | null;
  totalDeposit: number | null;
  cancellable: boolean | null;
  cancellationTime: string | null;
  paymentType: string | null;
  redactedIban: string | null;
  membershipSavings: number | null;
};

export type DeliveryLineItem = {
  id: string | null;
  productId: string | null;
  name: string;
  imageId: string | null;
  unitQuantity: string | null;
  quantity: number;
  displayPrice: number | null;
  originalPrice: number | null;
};

export type DeliverySummary = {
  deliveryId: string;
  creationTime: string | null;
  status: string | null;
  slot: DeliveryWindow | null;
  eta: DeliveryEta | null;
  orders: DeliveryOrderSummary[];
};

export type DeliveryDetail = DeliverySummary & {
  lineItems: DeliveryLineItem[];
  returnedContainers: unknown[];
  parcels: unknown[];
};

export type DeliverySummariesApiResponse = {
  deliveries: DeliverySummary[];
};

export type DeliveryTrackingApiResponse = {
  scenario: unknown | null;
  position: unknown | null;
};
