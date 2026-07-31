// Fusion product page parser.
// Extracts a ProductDetail from the raw product-details-page-root response.
import {
  extractBundles,
  extractPromotion,
  extractSimilarProducts,
  findMainSellingUnit,
  resolveDisplayPrice,
} from "./extract-product-data";
import {
  cleanMarkdown,
  collectMarkdowns,
  collectPropertyValues,
  extractInnerColor,
  findNodeById,
  findNodeByIdPrefix,
  stripColorTags,
} from "./pml-helpers";
import {
  collectAllergenGroups,
  collectHighlightRows,
  collectLabels,
  collectNutritionRows,
  collectPriceNodes,
} from "./pml-product-helpers";
import type {
  AllergenBadge,
  AllergenInfo,
  BundleThreshold,
  NutritionRow,
  ProductDetail,
  ProductHighlightItem,
  ProductInfoSection,
  ProductLabel,
} from "./types";
import {
  PRODUCT_ACCORDION_ID,
  PRODUCT_ALLERGIES_ID,
  PRODUCT_CATEGORY_BUTTON_ID,
  PRODUCT_DESCRIPTION_ID,
  PRODUCT_GALLERY_CONTAINER_ID,
  PRODUCT_HIGHLIGHTS_ID,
  PRODUCT_LABELS_PREFIX,
  PRODUCT_MAIN_CONTAINER_ID,
} from "./types";

// ─── Internal extraction helpers ─────────────────────────────────────────────

const CURRENCY_PREFIXES = new Set(["€", "$", "£"]);
const CATEGORY_DEEPLINK_PATTERN = /^app\.picnic:\/\/categories\/(\d+)\/l2\/(\d+)\/l3\/(\d+)/;

function walkRecords(node: unknown): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  if (typeof node !== "object" || node === null) return results;

  if (Array.isArray(node)) {
    for (const item of node) {
      results.push(...walkRecords(item));
    }
    return results;
  }

  const record = node as Record<string, unknown>;
  results.push(record);
  for (const value of Object.values(record)) {
    results.push(...walkRecords(value));
  }
  return results;
}

function getRawText(node: Record<string, unknown>): string | null {
  if (typeof node.markdown === "string") return node.markdown;
  if (typeof node.text === "string") return node.text;
  return null;
}

function extractMainTextRoles(container: unknown): {
  name: string | null;
  brand: string | null;
  unitQuantity: string | null;
  unitPrice: string | null;
} {
  let name: string | null = null;
  let brand: string | null = null;
  let unitQuantity: string | null = null;
  let unitPrice: string | null = null;
  let fallbackName: string | null = null;

  for (const node of walkRecords(container)) {
    const raw = getRawText(node);
    if (!raw) continue;

    const text = cleanMarkdown(raw);
    if (!text) continue;

    fallbackName ??= text;
    if (node.textType === "HEADER1" && name === null) {
      name = text;
      continue;
    }

    const first = text[0];
    const colorCoded = raw.includes("#(");
    if (CURRENCY_PREFIXES.has(first)) {
      unitPrice ??= text;
    } else if (colorCoded && /\d/.test(first)) {
      unitQuantity ??= text;
    } else if (!colorCoded && brand === null && text !== fallbackName) {
      brand = text;
    }
  }

  return { name: name ?? fallbackName, brand, unitQuantity, unitPrice };
}

function extractCategoryTagFromTexts(
  texts: string[],
  knownValues: Array<string | null>
): { text: string; color: string } | null {
  const known = new Set(knownValues.filter((value): value is string => Boolean(value)));

  for (const raw of texts) {
    const text = cleanMarkdown(raw);
    if (!text || known.has(text)) continue;

    const color = extractInnerColor(raw);
    if (color) {
      return { text, color };
    }
  }

  return null;
}

/** Extract name, brand, unitQuantity, unitPrice, and category tag from the main container. */
function extractMainContainerInfo(page: unknown): {
  name: string;
  brand: string;
  unitQuantity: string;
  unitPrice: string | null;
  categoryTag: { text: string; color: string } | null;
} {
  const mainContainer = findNodeById(page, PRODUCT_MAIN_CONTAINER_ID);
  const texts = collectMarkdowns(mainContainer).map((md) => md);
  const roles = extractMainTextRoles(mainContainer);

  const name = roles.name ?? stripColorTags(texts[0] ?? "");
  const brand = roles.brand ?? "";
  const unitQuantity = roles.unitQuantity ?? stripColorTags(texts[2] ?? "");
  const fallbackUnitPrice = texts[3] ? stripColorTags(texts[3]) : "";
  const unitPrice =
    roles.unitPrice ??
    (fallbackUnitPrice && CURRENCY_PREFIXES.has(fallbackUnitPrice[0])
      ? fallbackUnitPrice
      : null);
  const categoryTag = extractCategoryTagFromTexts(texts, [name, brand, unitQuantity, unitPrice]);

  return { name, brand, unitQuantity, unitPrice, categoryTag };
}

function extractCategoryIds(page: unknown): ProductDetail["categoryIds"] {
  const button = findNodeById(page, PRODUCT_CATEGORY_BUTTON_ID);
  if (!button) return null;

  const onPressTargets = collectPropertyValues(button, "onPress")
    .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null)
    .map((value) => value.target)
    .filter((target): target is string => typeof target === "string");

  for (const target of onPressTargets) {
    const match = target.match(CATEGORY_DEEPLINK_PATTERN);
    if (!match) continue;

    return {
      l1: Number(match[1]),
      l2: Number(match[2]),
      l3: Number(match[3]),
    };
  }

  return null;
}

/** Extract gallery image IDs from the image gallery container. */
function extractImageIds(page: unknown, fallbackImageId: string): string[] {
  const gallery = findNodeById(page, PRODUCT_GALLERY_CONTAINER_ID);
  if (!gallery) {
    return fallbackImageId ? [fallbackImageId] : [];
  }

  const sourceIds = collectPropertyValues(gallery, "source")
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => s.id)
    .filter((id): id is string => typeof id === "string");

  const uniqueIds = [...new Set(sourceIds)];
  return uniqueIds.length > 0 ? uniqueIds : fallbackImageId ? [fallbackImageId] : [];
}

/** Extract product description text. */
function extractDescription(page: unknown): string | null {
  const descBlock = findNodeById(page, PRODUCT_DESCRIPTION_ID);
  const markdowns = collectMarkdowns(descBlock);
  return markdowns.length > 0 ? markdowns.join("\n") : null;
}

/** Extract highlight items with icons and optional links. */
function extractHighlights(page: unknown): ProductHighlightItem[] {
  const highlightsBlock = findNodeById(page, PRODUCT_HIGHLIGHTS_ID);
  if (!highlightsBlock) return [];

  const rows = collectHighlightRows(highlightsBlock);
  return rows.map((row) => ({
    text: row.markdown,
    iconKey: row.iconKey,
    linkTarget: row.linkTarget,
  }));
}

/** Extract allergens with confirmed/mayContain categorization and badge colors. */
function extractAllergens(page: unknown): AllergenInfo {
  const allergiesBlock = findNodeById(page, PRODUCT_ALLERGIES_ID);
  if (!allergiesBlock) return { confirmed: [], mayContain: [] };

  const groups = collectAllergenGroups(allergiesBlock);

  const confirmed: AllergenBadge[] = [];
  const mayContain: AllergenBadge[] = [];

  for (const group of groups) {
    const target = group.category === "mayContain" ? mayContain : confirmed;
    for (const badge of group.badges) {
      target.push({
        text: badge.text,
        backgroundColor: badge.backgroundColor,
        textColor: badge.textColor,
      });
    }
  }

  return { confirmed, mayContain };
}

/** Extract accordion info sections. */
function extractInfoSections(page: unknown): ProductInfoSection[] {
  const accordionBlock = findNodeById(page, PRODUCT_ACCORDION_ID);
  if (!accordionBlock) return [];

  const itemsArrays = collectPropertyValues(accordionBlock, "items");
  const items = Array.isArray(itemsArrays[0]) ? itemsArrays[0] : [];
  const sections: ProductInfoSection[] = [];

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;

    const headerTexts = collectMarkdowns(record.header).map(cleanMarkdown);
    const bodyTexts = collectMarkdowns(record.body).map(stripColorTags);

    const title = headerTexts[0] ?? "";
    const content = bodyTexts.join("\n");

    if (title) {
      sections.push({ title, content });
    }
  }

  return sections;
}

/** Extract product labels from the labels container. */
function extractLabels(page: unknown): ProductLabel[] {
  const labelsNode = findNodeByIdPrefix(page, PRODUCT_LABELS_PREFIX);
  if (!labelsNode) return [];

  return collectLabels(labelsNode);
}

/** Extract original (crossed-out) price from the main container. */
function extractOriginalPrice(page: unknown): number | null {
  const mainContainer = findNodeById(page, PRODUCT_MAIN_CONTAINER_ID);
  if (!mainContainer) return null;

  const priceNodes = collectPriceNodes(mainContainer);
  const crossedPrice = priceNodes.find((p) => p.isCrossed);
  return crossedPrice?.price ?? null;
}

/** Extract structured nutrition rows from the Voedingswaarde accordion item. */
function extractNutritionRows(page: unknown): NutritionRow[] {
  const accordionBlock = findNodeById(page, PRODUCT_ACCORDION_ID);
  if (!accordionBlock) return [];

  const itemsArrays = collectPropertyValues(accordionBlock, "items");
  const items = Array.isArray(itemsArrays[0]) ? itemsArrays[0] : [];

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const headerTexts = collectMarkdowns(record.header).map(cleanMarkdown);
    const title = headerTexts[0] ?? "";

    if (
      title.toLowerCase().includes("voedingswaarde") ||
      title.toLowerCase().includes("nährwert")
    ) {
      return collectNutritionRows(record.body);
    }
  }

  return [];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Extract allergen info from a product page — used for recipe allergen aggregation. */
export function extractProductAllergenData(rawPage: unknown): AllergenInfo {
  const page = (rawPage as Record<string, unknown>)?.body ?? rawPage;
  return extractAllergens(page);
}

/** Extract nutrition rows from a product page — used per-ingredient in recipe detail. */
export function extractProductNutritionRows(rawPage: unknown): NutritionRow[] {
  const page = (rawPage as Record<string, unknown>)?.body ?? rawPage;
  return extractNutritionRows(page);
}

/**
 * Extract the minimal fields needed to display a product as a recipe ingredient tile:
 * name, unitQuantity, imageId, displayPrice, maxCount.
 *
 * Used by the recipe detail route to enrich ingredient stubs with product data.
 */
export function extractProductTileData(
  rawPage: unknown,
  productId: string
): { name: string; unitQuantity: string; imageId: string; displayPrice: number; maxCount: number; originalPrice: number | null; priceRanges: BundleThreshold[] | null } {
  const page = (rawPage as Record<string, unknown>)?.body ?? rawPage;

  const mainContainer = findNodeById(page, PRODUCT_MAIN_CONTAINER_ID);
  const mainInfo = extractMainContainerInfo(page);
  const texts = collectMarkdowns(mainContainer).map(stripColorTags);
  const name = mainInfo.name;
  const unitQuantity = mainInfo.unitQuantity;

  // Find the selling unit by ID — don't require max_count to be set (unlike
  // findMainSellingUnit which gates on max_count !== undefined and misses some units)
  const allUnits = collectPropertyValues(rawPage, "sellingUnit").filter(
    (u): u is Record<string, unknown> => typeof u === "object" && u !== null
  );
  const unit = allUnits.find((u) => u.id === productId) ?? allUnits[0] ?? null;

  const rawPrice = (unit?.display_price as number | undefined) ?? 0;
  const maxCount = (unit?.max_count as number | undefined) ?? 99;
  const unitImageId = (unit?.image_id as string | undefined) ?? "";

  // Image fallback: gallery container (same as parseProductDetailPage uses)
  const imageId = unitImageId || (() => {
    const gallery = findNodeById(page, PRODUCT_GALLERY_CONTAINER_ID);
    const ids = collectPropertyValues(gallery, "source")
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => s.id)
      .filter((id): id is string => typeof id === "string");
    return ids[0] ?? "";
  })();

  // Price resolution with multiple fallbacks
  let displayPrice = resolveDisplayPrice(page, productId, rawPrice);

  // Fallback: scan ALL PRICE-type nodes in the full page tree. Covers promotional
  // products where display_price=0 but the rendered price is in a PRICE node.
  if (!displayPrice) {
    const allPriceNodes = collectPriceNodes(rawPage);
    const active = allPriceNodes.find((p) => !p.isCrossed && p.price > 0);
    if (active) displayPrice = active.price;
  }

  // Last resort: parse the display price from the markdown text at position 3,
  // e.g. "€ 1.99" or "€1,99" → 199
  if (!displayPrice && texts[3]) {
    const m = texts[3].match(/(\d+)[.,](\d{2})/);
    if (m) displayPrice = parseInt(m[1]) * 100 + parseInt(m[2]);
  }

  const originalPrice = extractOriginalPrice(page);

  // Bundle pricing comes from extractBundles (via __ep1.v1 tier arrays or legacy bundle container),
  // not from price_ranges on the selling unit (which doesn't exist in the Picnic API).
  const bundleOptions = extractBundles(rawPage);

  // When the bundle container uses real IDs (Strategy 2), detect whether this product
  // is itself one of the bundle SKUs (e.g. s1089939 = 3-pack). In that case the
  // per-pack price (191) must be multiplied by the bundle count to get the total (573),
  // and per-quantity tier scaling must NOT be applied — the item is always bought once.
  const selfBundle = bundleOptions.find((b) => b.id === productId && b.quantity > 1);
  if (selfBundle) {
    const baseOption = bundleOptions.find((b) => b.quantity === 1);
    const singlePackPrice = baseOption?.pricePerUnit ?? 0;
    const bundleTotal = selfBundle.quantity * selfBundle.pricePerUnit;
    const originalTotal = singlePackPrice > 0 ? selfBundle.quantity * singlePackPrice : null;
    return {
      name,
      unitQuantity,
      imageId,
      displayPrice: bundleTotal,
      maxCount,
      originalPrice: originalTotal !== null && originalTotal > bundleTotal ? originalTotal : null,
      priceRanges: null,
    };
  }

  let priceRanges: BundleThreshold[] | null = null;
  if (bundleOptions.length > 0) {
    const thresholds: BundleThreshold[] = bundleOptions
      .filter((b) => b.pricePerUnit > 0)
      .map((b) => ({ quantity: b.quantity, pricePerUnit: b.pricePerUnit }))
      .sort((a, b) => a.quantity - b.quantity);
    if (thresholds.length > 0) priceRanges = thresholds;
  }

  return { name, unitQuantity, imageId, displayPrice, maxCount, originalPrice, priceRanges };
}

/**
 * Parse a raw product-details-page-root Fusion page into a ProductDetail.
 *
 * Navigates the PML tree using known node IDs and positional markdown
 * extraction, following the same patterns as picnic-api's extractProductDetails
 * but using local pml-helpers utilities instead of jsonpath-plus.
 */
export function parseProductDetailPage(rawPage: unknown, productId: string): ProductDetail {
  // The page has a `.body` wrapper from the Fusion response
  const page = (rawPage as Record<string, unknown>)?.body ?? rawPage;

  const mainInfo = extractMainContainerInfo(page);
  const mainUnit = findMainSellingUnit(rawPage, productId);
  const displayPrice = resolveDisplayPrice(page, productId, mainUnit.displayPrice);

  const promotion = extractPromotion(rawPage);

  // Filter out promotion badges from labels — the promotion is already
  // rendered separately in ProductPriceSection, so showing it in labels
  // too would duplicate it.
  const labels = extractLabels(page).filter((l) => !promotion || l.text !== promotion.label);

  return {
    id: productId,
    name: mainInfo.name,
    brand: mainInfo.brand,
    unitQuantity: mainInfo.unitQuantity,
    unitPrice: mainInfo.unitPrice,
    categoryTag: mainInfo.categoryTag,
    categoryIds: extractCategoryIds(page),
    displayPrice,
    originalPrice: extractOriginalPrice(page),
    maxCount: mainUnit.maxCount,
    imageIds: extractImageIds(page, mainUnit.imageId),
    labels,
    description: extractDescription(page),
    highlights: extractHighlights(page),
    allergens: extractAllergens(page),
    infoSections: extractInfoSections(page),
    promotion,
    bundles: extractBundles(page),
    similarProducts: extractSimilarProducts(page),
    nutritionRows: extractNutritionRows(page),
  };
}
