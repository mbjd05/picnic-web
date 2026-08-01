export type PaymentBank = {
  bank_id: string;
  name: string;
};

export type AvailablePaymentMethod = {
  payment_method: string;
  available_banks?: PaymentBank[];
};

export type PaymentBrand = {
  brand: string;
  display_name?: string;
  icon_url?: string;
};

export type PaymentMethod = {
  payment_method: string;
  display_name?: string;
  icon_url?: string;
  brands?: PaymentBrand[];
  visibility?: string;
  visibility_reason?: string | null;
};

export type StoredPaymentOption = {
  id: string;
  payment_method: string;
  brand?: string | null;
  account?: string | null;
  display_name?: string;
  icon_url?: string;
};

export type PaymentProfile = {
  stored_payment_options?: StoredPaymentOption[];
  available_payment_methods?: AvailablePaymentMethod[];
  payment_methods?: PaymentMethod[];
  preferred_payment_option_id?: string | null;
  available_payment_method_item?: unknown | null;
  checkout_banner?: unknown | null;
};

export type PaymentOptionRequest = {
  paymentMethod: string;
  bankId?: string | null;
};

export type CheckoutPaymentResponse = {
  orderId: string;
  paymentId: string | null;
  transactionId: string;
  redirectUrl: string;
  transactionExpiry: string | null;
};

export type CheckoutCancelResponse = {
  ok: true;
};

export type CheckoutStatusResponse = {
  inactive?: true;
  status?: string;
  raw?: unknown;
};
