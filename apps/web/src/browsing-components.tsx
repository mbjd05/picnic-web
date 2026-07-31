import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/badge";
import { PriceDisplay } from "@/components/price-display";
import { estimatedProgressPriceDelta } from "@/lib/cart-price-estimates";
import type { CategoryItem, ShortcutItem } from "@/lib/category-types";
import { buildImageUrl } from "@/lib/image-url";
import { localizeApiSectionTitle } from "@/lib/localize-api-label";
import type {
  BundleProgress,
  BundleThreshold,
  CountryCode,
  Product,
  SearchSection,
} from "@/lib/types";
import { buildSectionId } from "@/lib/types";

import { useCart } from "./cart-context";
import { useCountryCode, useTranslations } from "./country-context";
import { useWheelQuantityAdjust } from "./lib/use-wheel-quantity-adjust";

const PLACEHOLDER_IMAGE = "/placeholder-product.svg";
const STICKY_HEADER_OFFSET_PX = 144;
const VIEWPORT_FOCUS_RATIO = 0.45;
const INITIAL_PRODUCT_IMAGE_PRELOAD_COUNT = 12;
const PRODUCT_IMAGE_PRELOAD_TIMEOUT_MS = 1200;
const SECTION_SCROLL_GAP_PX = 12;
const MAX_LOADED_PRODUCT_IMAGE_URLS = 500;
const loadedProductImageUrls = new Set<string>();

export function LoadingView() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Laden">
      <span className="border-t-picnic-red h-6 w-6 animate-spin rounded-full border-2 border-gray-200" />
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-picnic-red mt-3 text-sm font-semibold hover:underline"
        >
          {t.retryButton}
        </button>
      ) : null}
    </div>
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
  const cart = useCart();
  const t = useTranslations();
  const increment = useCallback(
    () =>
      cart.addProduct(
        product.id,
        product.maxCount,
        estimatedProgressPriceDelta(progress, quantity, quantity + 1, product.displayPrice)
      ),
    [cart, product.displayPrice, product.id, product.maxCount, progress, quantity]
  );
  const decrement = useCallback(
    () =>
      cart.removeProduct(
        product.id,
        estimatedProgressPriceDelta(progress, quantity, quantity - 1, product.displayPrice)
      ),
    [cart, product.displayPrice, product.id, progress, quantity]
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
        <span className="translate-y-px leading-none">+</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1" ref={wheelAdjustRef} onClick={stop}>
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
  const cart = useCart();
  const quantity = cart.getQuantity(product.id);
  const progress = cart.getBundleProgress(product.id);
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
        <h3 className="text-text-dark mb-0.5 line-clamp-2 text-sm leading-snug font-medium break-words">
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
  const { registerBundleDataBatch } = useCart();
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

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    if (loadedProductImageUrls.has(src)) {
      resolve();
      return;
    }
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
  });
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

export function BackButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-picnic-red mb-4 flex items-center gap-1 text-sm font-medium hover:underline"
    >
      <span aria-hidden="true">←</span> {t.backButton}
    </button>
  );
}

export function SectionNavBar({ sections }: { sections: SearchSection[] }) {
  const t = useTranslations();
  const [active, setActive] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef(new Map<number, HTMLButtonElement>());
  const manualSectionRef = useRef<number | null>(null);
  const sectionSignature = useMemo(
    () => sections.map((section) => section.title).join("\n"),
    [sections]
  );

  function stickyOffset() {
    const navBottom = navRef.current?.getBoundingClientRect().bottom;
    return (
      (navBottom && navBottom > 0 ? navBottom : STICKY_HEADER_OFFSET_PX) + SECTION_SCROLL_GAP_PX
    );
  }

  useEffect(() => {
    manualSectionRef.current = null;
    containerRef.current?.scrollTo({ left: 0 });
    const frame = requestAnimationFrame(() => setActive(0));
    return () => cancelAnimationFrame(frame);
  }, [sectionSignature]);

  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      if (manualSectionRef.current !== null) {
        setActive(manualSectionRef.current);
        return;
      }
      const focusY = Math.max(stickyOffset(), window.innerHeight * VIEWPORT_FOCUS_RATIO);
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        setActive(sections.length - 1);
        return;
      }
      let best = 0;
      let distance = Number.POSITIVE_INFINITY;
      sections.forEach((_, index) => {
        const element = document.getElementById(buildSectionId(index));
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const nextDistance =
          rect.top <= focusY && rect.bottom > focusY
            ? 0
            : Math.min(Math.abs(rect.top - focusY), Math.abs(rect.bottom - focusY));
        if (nextDistance < distance) {
          distance = nextDistance;
          best = index;
        }
      });
      setActive(best);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [sections]);

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
    const badge = badgeRefs.current.get(active);
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
      });
    }
  }, [active]);

  function selectSection(index: number) {
    const section = document.getElementById(buildSectionId(index));
    if (!section) return;

    manualSectionRef.current = index;
    setActive(index);
    window.scrollTo({
      top: section.getBoundingClientRect().top + window.scrollY - stickyOffset(),
      behavior: "smooth",
    });
  }

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

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const context = title && title.length > 60 ? `${title.slice(0, 57)}...` : title;
    document.title = context ? `${context} - Picnic Web` : "Picnic Web";
  }, [title]);
}

export function useStableSections(sections?: SearchSection[]) {
  return useMemo(() => sections ?? [], [sections]);
}
