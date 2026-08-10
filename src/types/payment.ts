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

export type WalletTransaction = {
  account?: string | null;
  amount_in_cents: number;
  brand?: string | null;
  display_name?: string | null;
  domains?: string[];
  icon_url?: string | null;
  id: string;
  status?: string | null;
  timestamp?: number | null;
  transaction_method?: string | null;
  transaction_type?: string | null;
};

export type ReturnedContainer = {
  localized_name?: string | null;
  price?: number | null;
  quantity?: number | null;
  type?: string | null;
};

export type WalletDeposit = {
  count?: number | null;
  type?: string | null;
  value?: number | null;
};

export type WalletTransactionDetails = {
  amount_in_cents?: number | null;
  article_issue_refunds?: unknown[];
  debt_resolution?: unknown | null;
  delivery_debt?: unknown | null;
  delivery_id?: string | null;
  deposits?: WalletDeposit[];
  fees?: unknown[];
  payment_execution_timestamp?: number | null;
  payment_method_icon_url?: string | null;
  payment_option_account?: string | null;
  payment_option_display_name?: string | null;
  refunded_items?: unknown[];
  returned_containers?: ReturnedContainer[];
  shop_items?: unknown[];
  transaction_method?: string | null;
  transaction_status?: string | null;
  transaction_type?: string | null;
};

export type WalletTransactionsResponse = {
  page: number;
  transactions: WalletTransaction[];
};
