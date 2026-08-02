import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/badge";
import { PriceDisplay } from "@/components/price-display";
import { estimatedProgressPriceDelta } from "@/lib/cart/price-estimates";
import type { CategoryItem, ShortcutItem } from "@/types/category";
import { buildImageUrl } from "@/lib/media/image-url";
import { localizeApiSectionTitle } from "@/lib/i18n/localize-api-label";
import type { BundleProgress, BundleThreshold } from "@/types/cart";
import type { CountryCode } from "@/types/locale";
import type { Product } from "@/types/product";
import type { SearchSection } from "@/types/search";
import { buildSectionId } from "@/lib/config/app-constants";

import { useCartActions, useCartBundles, useCartQuantities } from "../../providers/cart-context";
import { useCountryCode, useTranslations } from "../../providers/country-context";
import { LoadingView } from "../../components/page-state";
import { useWheelQuantityAdjust } from "../../hooks/use-wheel-quantity-adjust";

const PLACEHOLDER_IMAGE = "/placeholder-product.svg";
const STICKY_HEADER_OFFSET_PX = 144;
const INITIAL_PRODUCT_IMAGE_PRELOAD_COUNT = 12;
const BACKGROUND_PRODUCT_IMAGE_PRELOAD_LIMIT = 120;
const BACKGROUND_PRODUCT_IMAGE_PRELOAD_CONCURRENCY = 4;
const SECTION_LEAD_IMAGE_PRELOAD_COUNT = 24;
const SECTION_LEAD_IMAGE_PRELOAD_CONCURRENCY = 4;
const SECTION_INTENT_IMAGE_PRELOAD_COUNT = 30;
const SECTION_INTENT_IMAGE_PRELOAD_CONCURRENCY = 8;
const PRODUCT_IMAGE_PRELOAD_TIMEOUT_MS = 1200;
const SECTION_SCROLL_GAP_PX = 12;
const SECTION_ACTIVE_VIEWPORT_RATIO = 0.38;
const MAX_LOADED_PRODUCT_IMAGE_URLS = 500;
const loadedProductImageUrls = new Set<string>();
const pendingProductImagePreloads = new Map<string, Promise<void>>();
const activeSectionByLocation = new Map<string, number>();

function getSectionIndexFromHash(sectionCount: number): number | null {
  const id = window.location.hash.slice(1);
  if (!id.startsWith("section-")) return null;
  const index = Number(id.slice("section-".length));
  return Number.isInteger(index) && index >= 0 && index < sectionCount ? index : null;
}

function getSectionLocationKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function getSavedSectionIndex(sectionCount: number): number | null {
  const index = activeSectionByLocation.get(getSectionLocationKey());
  return typeof index === "number" && index >= 0 && index < sectionCount ? index : null;
}

function saveSectionIndex(index: number) {
  activeSectionByLocation.set(getSectionLocationKey(), index);
}

function replaceUrlSectionHash(index: number) {
  const nextHash = `#${buildSectionId(index)}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}${nextHash}`
  );
}

function ProductImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  fetchPriority,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = failedSrc === src ? PLACEHOLDER_IMAGE : src || PLACEHOLDER_IMAGE;
  return (
    <img
      src={imageSrc}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      className={className}
      onLoad={() => markProductImageLoaded(imageSrc)}
      onError={() => setFailedSrc(src)}
    />
  );
}

function activeBundlePrice(
  progress: BundleProgress | null,
  quantity: number,
  displayPrice: number
): number | null {
  if (!progress || quantity === 0) return null;
  const activePrice = progress.thresholds
    .filter((threshold) => threshold.quantity <= quantity)
    .at(-1)?.pricePerUnit;
  return activePrice !== undefined && activePrice < displayPrice ? activePrice : null;
}

function BundleDots({ progress, quantity }: { progress: BundleProgress; quantity: number }) {
  const next = progress.thresholds.find((threshold) => threshold.quantity > quantity);
  const active = progress.thresholds.filter((threshold) => threshold.quantity <= quantity).at(-1);
  const total = next?.quantity ?? active?.quantity ?? 0;
  if (total <= 0) return null;
  return (
    <span
      className="flex max-w-10 flex-wrap justify-center gap-0.5"
      aria-label={`Voortgang tot ${total} producten`}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-1.5 rounded-full ${
            index < quantity ? "bg-picnic-red" : "border border-gray-300"
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function QuantityControl({
  product,
  quantity,
  progress,
}: {
  product: Product;
  quantity: number;
  progress: BundleProgress | null;
}) {
  const { addProduct, removeProduct } = useCartActions();
  const t = useTranslations();
  const increment = useCallback(
    () =>
      addProduct(
        product.id,
        product.maxCount,
        estimatedProgressPriceDelta(progress, quantity, quantity + 1, product.displayPrice)
      ),
    [addProduct, product.displayPrice, product.id, product.maxCount, progress, quantity]
  );
  const decrement = useCallback(
    () =>
      removeProduct(
        product.id,
        estimatedProgressPriceDelta(progress, quantity, quantity - 1, product.displayPrice)
      ),
    [product.displayPrice, product.id, progress, quantity, removeProduct]
  );
  const wheelAdjustRef = useWheelQuantityAdjust({
    canIncrement: quantity < product.maxCount,
    canDecrement: quantity > 0,
    onIncrement: increment,
    onDecrement: decrement,
  });
  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={(event) => {
          stop(event);
          increment();
        }}
        ref={wheelAdjustRef}
        className="quantity-control-surface text-text-dark flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold hover:bg-gray-100"
        aria-label={t.addToCartAriaLabel}
      >
        <span className="-translate-y-px leading-none">+</span>
      </button>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-1"
      ref={wheelAdjustRef}
      onClick={stop}
      aria-label={t.inCartLabel}
    >
      <div className="quantity-control-surface grid w-24 grid-cols-[1.75rem_2.5rem_1.75rem] items-center rounded-full">
        <button
          type="button"
          onClick={decrement}
          className="text-text-muted flex h-7 w-7 items-center justify-center text-base font-semibold"
          aria-label={t.removeOneAriaLabel}
        >
          −
        </button>
        <span className="flex w-10 flex-col items-center text-sm leading-none font-bold">
          {quantity}
          {progress ? <BundleDots progress={progress} quantity={quantity} /> : null}
        </span>
        <button
          type="button"
          onClick={increment}
          disabled={quantity >= product.maxCount}
          className="text-text-muted flex h-7 w-7 items-center justify-center text-base font-semibold disabled:text-gray-300"
          aria-label={t.addOneAriaLabel}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ProductCard({
  product,
  priorityImage = false,
}: {
  product: Product;
  priorityImage?: boolean;
}) {
  const countryCode = useCountryCode();
  const { getQuantity } = useCartQuantities();
  const { getBundleProgress } = useCartBundles();
  const quantity = getQuantity(product.id);
  const registeredProgress = getBundleProgress(product.id);
  const progress =
    registeredProgress ??
    (product.priceRanges?.length
      ? { productId: product.id, thresholds: product.priceRanges, currentQuantity: quantity }
      : null);
  const bundlePrice = activeBundlePrice(progress, quantity, product.displayPrice);

  return (
    <div className="group relative h-full">
      <article className="border-card-border bg-card-bg relative flex h-full flex-col rounded-lg border p-3 shadow-sm transition-shadow group-hover:shadow-md sm:p-4">
        <div className="relative mb-3 flex h-28 items-center justify-center sm:h-32">
          <ProductImage
            src={product.imageId ? buildImageUrl(product.imageId, countryCode) : PLACEHOLDER_IMAGE}
            alt={product.name}
            loading={priorityImage ? "eager" : "lazy"}
            fetchPriority={priorityImage ? "high" : "auto"}
            className="h-full w-full object-contain"
          />
          {product.isUnavailable && product.unavailableReason ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[rgba(231,236,215,0.55)] px-2 text-center">
              <span className="text-text-muted text-sm font-medium">
                {product.unavailableReason}
              </span>
            </div>
          ) : null}
          {!product.isUnavailable ? (
            <div className="absolute right-1 bottom-1 z-20">
              <QuantityControl product={product} quantity={quantity} progress={progress} />
            </div>
          ) : null}
          {product.promoBadge && product.promoPlacement === "image" ? (
            <div className="absolute bottom-1 left-1 z-20">
              <Badge badge={product.promoBadge} />
            </div>
          ) : null}
        </div>

        {product.subtitle ? (
          <p
            className={`mb-0.5 truncate text-xs ${product.subtitleColor ? "" : "text-text-muted"}`}
            style={product.subtitleColor ? { color: product.subtitleColor } : undefined}
          >
            {product.subtitleLeadingIcon ? "« " : ""}
            {product.subtitle}
            {product.subtitleTrailingIcon ? " »" : ""}
          </p>
        ) : null}
        <h3 className="text-text-dark mb-0.5 line-clamp-2 text-sm leading-snug font-medium wrap-break-word">
          {product.namePrefix ? (
            <span className="text-text-bio-green font-bold">{product.namePrefix} </span>
          ) : null}
          {product.name}
        </h3>
        {product.brand || product.highlight || product.flagFallbackImageId ? (
          <div className="mb-0.5 flex items-center gap-1">
            {product.flagFallbackImageId ? (
              <ProductImage
                src={buildImageUrl(product.flagFallbackImageId, countryCode, "small")}
                alt={product.flagIconKey ?? ""}
                className="h-3.5 w-3.5 object-contain"
              />
            ) : null}
            {product.brand ? <span className="text-text-dark text-sm">{product.brand}</span> : null}
            {product.highlight ? (
              <span className="text-sm font-medium" style={{ color: product.highlight.color }}>
                {product.highlight.text}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-text-muted text-xs">{product.unitQuantity}</p>
          {product.badges.map((badge, index) => (
            <Badge key={`${badge.variant}-${index}`} badge={badge} />
          ))}
        </div>
        <div className="mt-auto">
          <div className="mt-1.5 flex flex-wrap items-end justify-between gap-1.5">
            <PriceDisplay
              displayPrice={bundlePrice ?? product.displayPrice}
              originalPrice={bundlePrice ? product.displayPrice : product.originalPrice}
              displayPriceColor={product.displayPriceColor}
            />
            {product.promoBadge && product.promoPlacement === "inline" ? (
              <Badge badge={product.promoBadge} />
            ) : null}
          </div>
        </div>
        {product.isUnavailable ? (
          <div className="pointer-events-none absolute inset-0 rounded-lg bg-white/40" />
        ) : null}
      </article>
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="absolute inset-0 z-10 rounded-lg"
        aria-label={product.name}
      />
    </div>
  );
}

export function ProductGrid({
  products,
  sections,
}: {
  products?: Product[];
  sections?: SearchSection[];
}) {
  const { registerBundleDataBatch } = useCartBundles();
  const countryCode = useCountryCode();
  const t = useTranslations();
  const gridProducts = useMemo(
    () => (sections?.length ? sections.flatMap((section) => section.products) : (products ?? [])),
    [products, sections]
  );
  const priorityProductIds = useMemo(
    () =>
      new Set(
        gridProducts.slice(0, INITIAL_PRODUCT_IMAGE_PRELOAD_COUNT).map((product) => product.id)
      ),
    [gridProducts]
  );
  const initialImagesReady = useInitialProductImagesReady(gridProducts, countryCode);
  useBackgroundProductImagePreload(gridProducts, countryCode, initialImagesReady);
  useSectionLeadImagePreload(sections ?? [], countryCode, initialImagesReady);

  useEffect(() => {
    const entries = new Map<string, BundleThreshold[]>();
    for (const product of gridProducts) {
      if (product.priceRanges?.length) entries.set(product.id, product.priceRanges);
    }
    registerBundleDataBatch([...entries]);
  }, [gridProducts, registerBundleDataBatch]);

  if (gridProducts.length && !initialImagesReady) return <LoadingView />;

  if (sections?.length) {
    return (
      <div className="space-y-8">
        {sections.map((section, index) => (
          <section
            key={`${section.title}-${index}`}
            id={buildSectionId(index)}
            className="scroll-mt-36"
          >
            <h2 className="text-foreground mb-3 text-lg font-semibold">
              {localizeApiSectionTitle(section.title, t)}
            </h2>
            <ProductTiles products={section.products} priorityProductIds={priorityProductIds} />
          </section>
        ))}
      </div>
    );
  }
  return products?.length ? (
    <ProductTiles products={products} priorityProductIds={priorityProductIds} />
  ) : null;
}

function ProductTiles({
  products,
  priorityProductIds,
}: {
  products: Product[];
  priorityProductIds: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          priorityImage={priorityProductIds.has(product.id)}
        />
      ))}
    </div>
  );
}

function useInitialProductImagesReady(products: Product[], countryCode: CountryCode) {
  const imageSignature = useMemo(() => {
    const urls = products
      .slice(0, INITIAL_PRODUCT_IMAGE_PRELOAD_COUNT)
      .map((product) =>
        product.imageId ? buildImageUrl(product.imageId, countryCode) : PLACEHOLDER_IMAGE
      );
    return [...new Set(urls)].join("\n");
  }, [countryCode, products]);
  const [readySignature, setReadySignature] = useState(() =>
    areProductImagesLoaded(imageSignature) ? imageSignature : ""
  );

  useEffect(() => {
    if (!imageSignature || areProductImagesLoaded(imageSignature)) {
      setReadySignature(imageSignature);
      return;
    }

    let cancelled = false;
    const urls = imageSignature.split("\n");
    const timeout = window.setTimeout(() => {
      if (!cancelled) setReadySignature(imageSignature);
    }, PRODUCT_IMAGE_PRELOAD_TIMEOUT_MS);

    Promise.all(urls.map(preloadImage)).then(() => {
      window.clearTimeout(timeout);
      if (!cancelled) setReadySignature(imageSignature);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [imageSignature]);

  return readySignature === imageSignature;
}

function useBackgroundProductImagePreload(
  products: Product[],
  countryCode: CountryCode,
  enabled: boolean
) {
  const imageUrls = useMemo(() => {
    return buildProductImageUrls(
      products,
      countryCode,
      INITIAL_PRODUCT_IMAGE_PRELOAD_COUNT,
      BACKGROUND_PRODUCT_IMAGE_PRELOAD_LIMIT
    );
  }, [countryCode, products]);

  useEffect(() => {
    if (!enabled || imageUrls.length === 0) return;

    let cancelled = false;
    let idleCallbackId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedule = (callback: () => void) => {
      if ("requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(callback, { timeout: 1200 });
      } else {
        timeoutId = globalThis.setTimeout(callback, 100);
      }
    };

    schedule(() => {
      void preloadImageUrls(
        imageUrls,
        BACKGROUND_PRODUCT_IMAGE_PRELOAD_CONCURRENCY,
        () => cancelled
      );
    });

    return () => {
      cancelled = true;
      if (idleCallbackId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [enabled, imageUrls]);
}

function useSectionLeadImagePreload(
  sections: SearchSection[],
  countryCode: CountryCode,
  enabled: boolean
) {
  const imageUrls = useMemo(() => {
    const urls = sections.flatMap((section) =>
      buildProductImageUrls(section.products, countryCode, 0, SECTION_LEAD_IMAGE_PRELOAD_COUNT)
    );
    return [...new Set(urls)];
  }, [countryCode, sections]);

  useEffect(() => {
    if (!enabled || imageUrls.length === 0) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void preloadImageUrls(imageUrls, SECTION_LEAD_IMAGE_PRELOAD_CONCURRENCY, () => cancelled);
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, imageUrls]);
}

function preloadProductImages(
  products: Product[],
  countryCode: CountryCode,
  limit: number,
  concurrency: number
) {
  const imageUrls = buildProductImageUrls(products, countryCode, 0, limit);
  return preloadImageUrls(imageUrls, concurrency);
}

function buildProductImageUrls(
  products: Product[],
  countryCode: CountryCode,
  start: number,
  end: number
) {
  const urls = products
    .slice(start, end)
    .map((product) =>
      product.imageId ? buildImageUrl(product.imageId, countryCode) : PLACEHOLDER_IMAGE
    );
  return [...new Set(urls)].filter(
    (url) => !loadedProductImageUrls.has(url) && !pendingProductImagePreloads.has(url)
  );
}

function preloadImageUrls(
  imageUrls: string[],
  concurrency: number,
  isCancelled: () => boolean = () => false
) {
  return new Promise<void>((resolve) => {
    let cursor = 0;
    let active = 0;

    const pump = () => {
      if (isCancelled()) {
        resolve();
        return;
      }
      while (active < concurrency && cursor < imageUrls.length) {
        const url = imageUrls[cursor];
        cursor++;
        if (!url || loadedProductImageUrls.has(url)) continue;
        active++;
        preloadImage(url).finally(() => {
          active--;
          pump();
        });
      }
      if (cursor >= imageUrls.length && active === 0) resolve();
    };

    pump();
  });
}

function preloadImage(src: string) {
  if (loadedProductImageUrls.has(src)) {
    return Promise.resolve();
  }
  const pending = pendingProductImagePreloads.get(src);
  if (pending) return pending;

  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      markProductImageLoaded(src);
      if (image.decode) {
        image.decode().then(resolve, resolve);
        return;
      }
      resolve();
    };
    image.onerror = () => resolve();
    image.src = src;
    if (image.complete) {
      markProductImageLoaded(src);
      resolve();
    }
  }).finally(() => pendingProductImagePreloads.delete(src));
  pendingProductImagePreloads.set(src, promise);
  return promise;
}

function markProductImageLoaded(src: string) {
  if (loadedProductImageUrls.has(src)) return;
  if (loadedProductImageUrls.size >= MAX_LOADED_PRODUCT_IMAGE_URLS) {
    const oldest = loadedProductImageUrls.values().next().value;
    if (oldest) loadedProductImageUrls.delete(oldest);
  }
  loadedProductImageUrls.add(src);
}

function areProductImagesLoaded(imageSignature: string) {
  return (
    !imageSignature || imageSignature.split("\n").every((url) => loadedProductImageUrls.has(url))
  );
}

export function ResultsView({
  query,
  products,
  sections,
}: {
  query: string;
  products: Product[];
  sections: SearchSection[];
}) {
  const t = useTranslations();
  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-gray-600">
          {t.noResultsFor} &ldquo;{query}&rdquo;
        </p>
        <p className="mt-1 text-sm text-gray-400">{t.tryAnotherTerm}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        {products.length} {products.length === 1 ? t.resultSingular : t.resultPlural} {t.resultFor}{" "}
        &ldquo;{query}&rdquo;
      </p>
      <ProductGrid products={products} sections={sections} />
    </div>
  );
}

function Row({
  imageId,
  name,
  badge,
  onClick,
  last,
}: {
  imageId: string;
  name: string;
  badge?: string | null;
  onClick: () => void;
  last: boolean;
}) {
  const countryCode = useCountryCode();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-gray-50 ${last ? "" : "border-b border-gray-100"}`}
    >
      <ProductImage
        src={buildImageUrl(imageId, countryCode)}
        alt={name}
        className="h-14 w-14 shrink-0 object-contain"
      />
      <span className="text-foreground min-w-0 flex-1 text-left text-[15px] leading-tight font-medium">
        {name}
        {badge ? (
          <span className="ml-2 rounded bg-[#fbd92b] px-1.5 py-0.5 text-xs text-black">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-gray-400" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

export function CategoryBrowser({
  categories,
  shortcuts,
  onCategory,
  onShortcut,
}: {
  categories: CategoryItem[];
  shortcuts: ShortcutItem[];
  onCategory: (item: CategoryItem) => void;
  onShortcut: (item: ShortcutItem) => void;
}) {
  const t = useTranslations();
  return (
    <>
      {shortcuts.length ? (
        <List title={t.shortcutSectionTitle}>
          {shortcuts.map((item, index) => (
            <Row
              key={item.id}
              imageId={item.imageId}
              name={item.name}
              badge={item.badge}
              onClick={() => onShortcut(item)}
              last={index === shortcuts.length - 1}
            />
          ))}
        </List>
      ) : null}
      <List title={t.allCategoriesTitle}>
        {categories.map((item, index) => (
          <Row
            key={item.id}
            imageId={item.imageId}
            name={item.name}
            onClick={() => onCategory(item)}
            last={index === categories.length - 1}
          />
        ))}
      </List>
    </>
  );
}

function List({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-foreground mb-3 text-lg font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">{children}</div>
    </section>
  );
}

export function SectionNavBar({ sections }: { sections: SearchSection[] }) {
  const t = useTranslations();
  const countryCode = useCountryCode();
  const [active, setActive] = useState(() =>
    typeof window === "undefined"
      ? 0
      : (getSectionIndexFromHash(sections.length) ?? getSavedSectionIndex(sections.length) ?? 0)
  );
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef(new Map<number, HTMLButtonElement>());
  const manualSectionRef = useRef<number | null>(null);
  const canSyncHashRef = useRef(false);
  const sectionSignature = useMemo(
    () => sections.map((section) => section.title).join("\n"),
    [sections]
  );

  const stickyOffset = useCallback(() => {
    const navBottom = navRef.current?.getBoundingClientRect().bottom;
    return (
      (navBottom && navBottom > 0 ? navBottom : STICKY_HEADER_OFFSET_PX) + SECTION_SCROLL_GAP_PX
    );
  }, []);

  const findViewportSectionIndex = useCallback(() => {
    if (window.scrollY <= 2) return 0;

    const offset = stickyOffset();
    const focusY =
      offset + Math.max(80, (window.innerHeight - offset) * SECTION_ACTIVE_VIEWPORT_RATIO);
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      return sections.length - 1;
    }

    let best = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    sections.forEach((_, index) => {
      const element = document.getElementById(buildSectionId(index));
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.top <= focusY && rect.bottom > focusY) {
        best = index;
        nearestDistance = 0;
        return;
      }

      const distance = Math.min(Math.abs(rect.top - focusY), Math.abs(rect.bottom - focusY));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        best = index;
      }
    });
    return best;
  }, [sections, stickyOffset]);

  const scrollBadgeIntoView = useCallback((index: number, behavior: ScrollBehavior = "auto") => {
    const badge = badgeRefs.current.get(index);
    const container = containerRef.current;
    if (!badge || !container) return;
    const badgeRect = badge.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (badgeRect.left < containerRect.left + 16 || badgeRect.right > containerRect.right - 16) {
      container.scrollTo({
        left:
          container.scrollLeft +
          badgeRect.left -
          containerRect.left -
          containerRect.width / 2 +
          badgeRect.width / 2,
        behavior,
      });
    }
  }, []);

  const scrollSectionIntoView = useCallback(
    (index: number, behavior: ScrollBehavior = "auto") => {
      const section = document.getElementById(buildSectionId(index));
      if (!section) return;
      window.scrollTo({
        top: section.getBoundingClientRect().top + window.scrollY - stickyOffset(),
        behavior,
      });
    },
    [stickyOffset]
  );

  const preloadSectionImages = useCallback(
    (index: number) => {
      const section = sections[index];
      if (!section) return Promise.resolve();
      return preloadProductImages(
        section.products,
        countryCode,
        SECTION_INTENT_IMAGE_PRELOAD_COUNT,
        SECTION_INTENT_IMAGE_PRELOAD_CONCURRENCY
      );
    },
    [countryCode, sections]
  );

  function selectSection(index: number) {
    const section = document.getElementById(buildSectionId(index));
    if (!section) return;

    void preloadSectionImages(index);
    manualSectionRef.current = index;
    setActive(index);
    saveSectionIndex(index);
    replaceUrlSectionHash(index);
    scrollSectionIntoView(index, "smooth");
  }

  useLayoutEffect(() => {
    manualSectionRef.current = null;
    canSyncHashRef.current = false;

    const hashIndex = getSectionIndexFromHash(sections.length);
    const nextActive = hashIndex ?? getSavedSectionIndex(sections.length) ?? 0;
    setActive(nextActive);
    saveSectionIndex(nextActive);
    scrollBadgeIntoView(nextActive);

    if (hashIndex !== null) {
      scrollSectionIntoView(hashIndex);
    }

    let innerFrame: number | null = null;
    const frame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        canSyncHashRef.current = true;
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (innerFrame !== null) cancelAnimationFrame(innerFrame);
    };
  }, [
    findViewportSectionIndex,
    scrollBadgeIntoView,
    scrollSectionIntoView,
    sectionSignature,
    sections.length,
  ]);

  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      if (manualSectionRef.current !== null) {
        setActive(manualSectionRef.current);
        return;
      }
      const nextActive = findViewportSectionIndex();
      setActive(nextActive);
      saveSectionIndex(nextActive);
      if (canSyncHashRef.current) replaceUrlSectionHash(nextActive);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    if (
      getSectionIndexFromHash(sections.length) === null &&
      getSavedSectionIndex(sections.length) === null
    ) {
      update();
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [findViewportSectionIndex, sections]);

  useEffect(() => {
    const scrollToHashSection = () => {
      const index = getSectionIndexFromHash(sections.length);
      if (index === null) return;
      manualSectionRef.current = index;
      setActive(index);
      saveSectionIndex(index);
      scrollBadgeIntoView(index);
      scrollSectionIntoView(index);
    };

    window.addEventListener("hashchange", scrollToHashSection);
    return () => window.removeEventListener("hashchange", scrollToHashSection);
  }, [scrollBadgeIntoView, scrollSectionIntoView, sections]);

  useEffect(() => {
    const clearManualSelection = () => {
      manualSectionRef.current = null;
    };
    const clearFromPointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) clearManualSelection();
    };
    const clearFromKeyboard = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
        clearManualSelection();
      }
    };

    window.addEventListener("wheel", clearManualSelection, { passive: true });
    window.addEventListener("touchstart", clearManualSelection, { passive: true });
    window.addEventListener("pointerdown", clearFromPointer);
    window.addEventListener("keydown", clearFromKeyboard);
    return () => {
      window.removeEventListener("wheel", clearManualSelection);
      window.removeEventListener("touchstart", clearManualSelection);
      window.removeEventListener("pointerdown", clearFromPointer);
      window.removeEventListener("keydown", clearFromKeyboard);
    };
  }, []);

  useEffect(() => {
    scrollBadgeIntoView(active, "smooth");
  }, [active, scrollBadgeIntoView]);

  return (
    <nav
      ref={navRef}
      aria-label="Section navigation"
      className="border-card-border border-t bg-white/95 backdrop-blur-sm"
    >
      <div
        ref={containerRef}
        className="section-nav-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-2"
      >
        {sections.map((section, index) => (
          <button
            key={`${section.title}-${index}`}
            type="button"
            ref={(node) => {
              if (node) badgeRefs.current.set(index, node);
              else badgeRefs.current.delete(index);
            }}
            onPointerEnter={() => void preloadSectionImages(index)}
            onFocus={() => void preloadSectionImages(index)}
            onClick={() => selectSection(index)}
            aria-current={active === index ? "true" : undefined}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${active === index ? "bg-picnic-red text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {localizeApiSectionTitle(section.title, t)}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function useStableSections(sections?: SearchSection[]) {
  return useMemo(() => sections ?? [], [sections]);
}
