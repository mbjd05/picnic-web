import type { BundleThreshold } from "@/lib/cart-types";

export type BadgeVariant =
  "promo" | "discount" | "size" | "freshness" | "availability" | "info" | "unit-price" | "bundle";

export type Badge = {
  text: string;
  variant: BadgeVariant;
  backgroundColor?: string;
  textColor?: string;
};

export type Highlight = {
  /** The text to display (e.g. "Prijskampioen"). */
  text: string;
  /** Hex color for the text (e.g. "#B40117" for red). */
  color: string;
};

export type PromoPlacement = "image" | "inline";

export type SubtitleIcon = {
  /** Fallback CDN image ID for the icon, when Picnic provides one. */
  imageId: string;
  /** API-provided icon tint color, or null. */
  color: string | null;
};

export type Product = {
  id: string;
  name: string;
  /** Prefix shown before the name in a distinct style (e.g. "Bio" in green). */
  namePrefix: string | null;
  /** Small subtitle above the product name (e.g. "D.O.P. Sarnese-Nocerino"). */
  subtitle: string | null;
  /** Optional API-provided color for the subtitle text. */
  subtitleColor: string | null;
  /** Optional decorative icon before the subtitle text. */
  subtitleLeadingIcon: SubtitleIcon | null;
  /** Optional decorative icon after the subtitle text. */
  subtitleTrailingIcon: SubtitleIcon | null;
  /** Brand name shown below the product name (e.g. "Mutti"). */
  brand: string | null;
  /** Colored subtext like "Prijskampioen" shown in the brand/subtext row. */
  highlight: Highlight | null;
  /** Icon key for a flag shown next to the brand (e.g. "flagGermany"). */
  flagIconKey: string | null;
  /** Fallback image ID for the flag icon, from the CDN. */
  flagFallbackImageId: string | null;
  imageId: string;
  /** Current display price in cents. */
  displayPrice: number;
  /** Optional API-provided display price color. */
  displayPriceColor: string | null;
  /** Original price in cents when discounted, or null. */
  originalPrice: number | null;
  /** Human-readable unit/quantity string (e.g. "500 g", "6 x 300 ml"). */
  unitQuantity: string;
  /** Maximum number of units a user can order. */
  maxCount: number;
  /** Bundle price ranges from the API, or null if no bundle. */
  priceRanges: BundleThreshold[] | null;
  /** Non-promotion labels/badges extracted from decorators. */
  badges: Badge[];
  /** API-colored promotion badge extracted from the PML label surface. */
  promoBadge: Badge | null;
  /** Preferred placement for the promotion badge. */
  promoPlacement: PromoPlacement | null;
  /** Whether the product is currently unavailable. */
  isUnavailable: boolean;
  /** Reason for unavailability, if applicable. */
  unavailableReason: string | null;
};

/** Fusion page node IDs used by the product detail parser. */
export const PRODUCT_MAIN_CONTAINER_ID = "product-details-page-root-main-container";
export const PRODUCT_GALLERY_CONTAINER_ID = "product-page-image-gallery-main-image-container";
export const PRODUCT_DESCRIPTION_ID = "description";
export const PRODUCT_HIGHLIGHTS_ID = "product-page-highlights";
export const PRODUCT_ALLERGIES_ID = "product-page-allergies";
export const PRODUCT_ACCORDION_ID = "accordion-list";
export const PRODUCT_BUNDLES_PREFIX = "product-page-bundles-";
export const PRODUCT_ALTERNATIVES_ID = "alternatives-container";
export const PRODUCT_LABELS_PREFIX = "product-page-labels-";
export const PRODUCT_CATEGORY_BUTTON_ID = "category-button";

/** A single allergen badge with its display color. */
export type AllergenBadge = {
  /** Allergen name (e.g. "Selderij", "Ei"). */
  text: string;
  /** Background hex color for the badge (e.g. "#1a9d63"). */
  backgroundColor: string;
  /** Text hex color for the badge (e.g. "#ffffff"). */
  textColor: string;
};

/** Categorized allergen data for a product. */
export type AllergenInfo = {
  /** Confirmed allergens (under "Bevat" heading). */
  confirmed: AllergenBadge[];
  /** "May contain" allergens (under "Bevat mogelijk" heading). */
  mayContain: AllergenBadge[];
};

/** A collapsible info section from the product detail accordion. */
export type ProductInfoSection = {
  /** Section header (e.g. "Ingrediënten", "Voedingswaarde"). */
  title: string;
  /** Section body as raw text (may contain markdown table syntax). */
  content: string;
};

/** An active promotion on a product. */
export type ProductPromotion = {
  /** Promotion identifier. */
  id: string;
  /** Human-readable promotion label (e.g. "1+1 gratis"). */
  label: string;
};

/** A bundle pricing option (buy-more-pay-less). */
export type BundleOption = {
  /** Selling unit ID for this bundle option. */
  id: string;
  /** Number of items in this bundle (1-indexed). */
  quantity: number;
  /** Price per unit in euro cents. */
  pricePerUnit: number;
  /** Product image ID for this bundle option. */
  imageId: string;
  /** Maximum cart quantity for this bundle. */
  maxCount: number;
};

/** A condensed product reference for slider displays. */
export type SliderProduct = {
  /** Selling unit ID. */
  id: string;
  /** Product name. */
  name: string;
  /** Product image ID. */
  imageId: string;
  /** Price in euro cents. */
  displayPrice: number;
  /** Unit quantity description (e.g. "6 x 330 ml"). */
  unitQuantity: string;
  /** Maximum cart quantity. */
  maxCount: number;
  /** Deposit amount in cents, if applicable. */
  deposit?: number;
};

/** A label/badge displayed on the product detail page (e.g. "Biologisch", "50% korting"). */
export type ProductLabel = {
  /** Label text. */
  text: string;
  /** Text hex color (e.g. "#4B8505"). */
  textColor: string;
  /** Background hex color (e.g. "#fbd92b"). */
  backgroundColor: string;
};

/** A highlight item with optional icon and link. */
export type ProductHighlightItem = {
  /** Display text (may contain **bold** markdown). */
  text: string;
  /** PML icon key (e.g. "starsOutlined", "pin"). Null if no icon. */
  iconKey: string | null;
  /** Deep-link target for TOUCHABLE highlights. Null if not a link. */
  linkTarget: string | null;
};

/** A row in a structured nutrition table. */
export type NutritionRow = {
  /** Left label (e.g. "Energie", "Vet"). */
  label: string;
  /** Right value (e.g. "557 kJ /", "5,7g"). Null for header-only rows. */
  value: string | null;
  /** Whether this is a main category (HEADLINE2) vs sub-item (BODY2). */
  isCategory: boolean;
  /** Background color for zebra striping, or null. */
  backgroundColor: string | null;
};

/** Comprehensive product detail displayed on the product detail page. */
export type ProductDetail = {
  /** Selling unit ID (e.g. "s1001524"). */
  id: string;
  /** Product name. */
  name: string;
  /** Brand/producer name. Empty string if unavailable. */
  brand: string;
  /** Unit quantity description (e.g. "6 x 300 ml"). */
  unitQuantity: string;
  /** Unit price description (e.g. "€4.81/l"). Null if not available. */
  unitPrice: string | null;
  /** Category tag text (e.g. "Diepvries") with color. Null if not available. */
  categoryTag: { text: string; color: string } | null;
  /** Category ids from the product page category deep-link. Null if unavailable. */
  categoryIds: { l1: number; l2: number; l3: number } | null;
  /** Selling price in euro cents. */
  displayPrice: number;
  /** Original price in cents before discount, or null. */
  originalPrice: number | null;
  /** Maximum items that can be added to cart. */
  maxCount: number;
  /** Gallery image IDs. May be empty. */
  imageIds: string[];
  /** Product labels/badges (e.g. "Biologisch", "50% korting"). */
  labels: ProductLabel[];
  /** Product description text. Null if not available. */
  description: string | null;
  /** Highlight items with icons and optional links. May be empty. */
  highlights: ProductHighlightItem[];
  /** Categorized allergen data. */
  allergens: AllergenInfo;
  /** Collapsible accordion sections. May be empty. */
  infoSections: ProductInfoSection[];
  /** Active promotion, if any. */
  promotion: ProductPromotion | null;
  /** Bundle pricing options. May be empty. */
  bundles: BundleOption[];
  /** Alternative/similar products. May be empty. */
  similarProducts: SliderProduct[];
  /** Structured nutrition rows (extracted from Voedingswaarde). May be empty. */
  nutritionRows: NutritionRow[];
};
