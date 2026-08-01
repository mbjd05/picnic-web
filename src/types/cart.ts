import type { SelectedSlotData } from "@/types/delivery-slot";
import type { Badge, SliderProduct } from "@/types/product";

/** A single line item in the cart, derived from raw order line + article objects. */
export type CartItem = {
  /** Order line identifier. */
  id: string;
  /** Product/article identifier (used for product detail link). */
  productId: string;
  /** Product name. */
  name: string;
  /** Unit quantity string (e.g. "500 g"). */
  unitQuantity: string;
  /** Primary image ID (first in array, or empty string). */
  imageId: string;
  /** Current price in cents (display_price from order line). */
  displayPrice: number;
  /** Original price in cents when discounted, or null. */
  originalPrice: number | null;
  /** Quantity in cart (from QUANTITY decorator, default 1). */
  quantity: number;
  /** Maximum allowed quantity for this product (from API max_count). */
  maxCount: number;
  /** Decorator-derived badges (discount labels, freshness, base price, bundle). */
  badges: Badge[];
  /** Buy-more-pay-less tiers from the cart article, or null if absent. */
  priceRanges: BundleThreshold[] | null;
  /** Whether the item is currently unavailable. */
  isUnavailable: boolean;
  /** Short unavailability reason, or null. */
  unavailableExplanation: string | null;
  /** Replacement product suggestions for unavailable items. */
  replacements: SliderProduct[];
};

/** A single deposit category entry in the deposit breakdown. */
export type DepositEntry = {
  /** Deposit category (e.g. "BAG", "DEFAULT"). */
  type: string;
  /** Price per unit in cents. */
  value: number;
  /** Number of deposit units. */
  count: number;
  /** Total deposit for this category in cents (value × count). */
  total: number;
};

/** A fee or credit line from the cart API (e.g. Picnic credit settlement). */
export type FeeEntry = {
  /** Fee type identifier from the API (e.g. "SALDO"). */
  type: string;
  /** Display label from the API (e.g. "Verrekening Picnic-tegoed"). */
  name: string;
  /** Amount in cents. Negative values represent deductions/credits. */
  amount: number;
};

/** Top-level display model returned by the /api/cart route. */
export type CartData = {
  /** All cart line items with decorator badges merged. */
  items: CartItem[];
  /** Total order price in cents (checkout_total_price, includes fees and deposits). */
  totalPrice: number;
  /** Total number of items in cart. */
  totalCount: number;
  /** Sum of per-line (price − display_price) savings in cents. */
  totalDiscount: number;
  /** Sum of all deposit entries in cents. */
  depositTotal: number;
  /** Per-type deposit breakdown. */
  depositBreakdown: DepositEntry[];
  /** Membership savings in cents (0 if none). */
  membershipSavings: number;
  /** Fee/credit lines from the API (e.g. Picnic credit settlement). */
  fees: FeeEntry[];
  /** Minimum order value in cents for the selected delivery slot, or null. */
  minimumOrderValue: number | null;
  /** "Niets vergeten?" suggestion products; empty array if unavailable. */
  suggestions: SliderProduct[];
  /** Selected delivery slot summary for the banner. Null when no slot data. */
  selectedSlot: SelectedSlotData | null;
  /** Pre-formatted banner text: prompt or formatted time window. */
  deliveryBannerText: string;
};

/** Alias: the /api/cart route returns CartData directly. */
export type CartApiResponse = CartData;

/** Request body for adding or removing products from the cart via POST /api/cart. */
export type CartMutationRequest = {
  /** Selling unit ID (e.g. "s1013635"). */
  productId: string;
  /** Whether to add or remove units. */
  action: "add" | "remove";
  /** Number of units to add or remove (typically 1). */
  count: number;
};

/** A single tier in a bundle pricing scheme. */
export type BundleThreshold = {
  /** Number of units needed to unlock this tier. */
  quantity: number;
  /** Price per unit in cents at this tier. */
  pricePerUnit: number;
};

/** Bundle discount progress for a single product. */
export type BundleProgress = {
  /** The product this bundle applies to. */
  productId: string;
  /** Ordered list of bundle tiers (ascending by quantity). */
  thresholds: BundleThreshold[];
  /** Current quantity in cart. */
  currentQuantity: number;
};
