/* eslint-disable @next/next/no-img-element -- Vite has no Next Image component. */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/badge";
import { PriceDisplay } from "@/components/price-display";
import type { CategoryItem, ShortcutItem } from "@/lib/category-types";
import { getTranslations } from "@/lib/i18n";
import { buildImageUrl } from "@/lib/image-url";
import type { BundleProgress, Product, SearchSection } from "@/lib/types";
import { buildSectionId } from "@/lib/types";

import { useCart } from "./cart-context";
import { useCountryCode } from "./country-context";

const PLACEHOLDER_IMAGE = "/placeholder-product.svg";
const STICKY_HEADER_OFFSET_PX = 144;
const VIEWPORT_FOCUS_RATIO = 0.45;

export function LoadingView() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Laden">
      <span className="border-t-picnic-red h-6 w-6 animate-spin rounded-full border-2 border-gray-200" />
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = getTranslations(useCountryCode());
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
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [imageSrc, setImageSrc] = useState(src || PLACEHOLDER_IMAGE);
  return (
    <img
      src={imageSrc}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setImageSrc(PLACEHOLDER_IMAGE)}
    />
  );
}

function activeBundlePrice(progress: BundleProgress | null, quantity: number): number | null {
  if (!progress || quantity === 0) return null;
  return (
    progress.thresholds.filter((threshold) => threshold.quantity <= quantity).at(-1)
      ?.pricePerUnit ?? null
  );
}

function BundleDots({ progress, quantity }: { progress: BundleProgress; quantity: number }) {
  const next = progress.thresholds.find((threshold) => threshold.quantity > quantity);
  const active = progress.thresholds.filter((threshold) => threshold.quantity <= quantity).at(-1);
  const total = next?.quantity ?? active?.quantity ?? 0;
  if (total <= 0) return null;
  return (
    <span className="flex gap-1" aria-label={`Voortgang tot ${total} producten`}>
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
  const t = getTranslations(useCountryCode());
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
          cart.addProduct(product.id, product.maxCount);
        }}
        className="text-text-dark flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold shadow-md hover:bg-gray-100"
        aria-label={t.addToCartAriaLabel}
      >
        +
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1" onClick={stop}>
      <div className="flex items-center rounded-full bg-white shadow-sm">
        <button
          type="button"
          onClick={() => cart.removeProduct(product.id)}
          className="text-text-muted flex h-7 w-7 items-center justify-center text-base font-semibold"
          aria-label={t.removeOneAriaLabel}
        >
          −
        </button>
        <span className="flex min-w-5 flex-col items-center text-sm font-bold">
          {quantity}
          {progress ? <BundleDots progress={progress} quantity={quantity} /> : null}
        </span>
        <button
          type="button"
          onClick={() => cart.addProduct(product.id, product.maxCount)}
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

export function ProductCard({ product }: { product: Product }) {
  const countryCode = useCountryCode();
  const cart = useCart();
  const quantity = cart.getQuantity(product.id);
  const progress = cart.getBundleProgress(product.id);
  const bundlePrice = activeBundlePrice(progress, quantity);

  useEffect(() => {
    if (product.priceRanges) cart.registerBundleData(product.id, product.priceRanges);
  }, [cart, product.id, product.priceRanges]);

  return (
    <div className="group relative h-full">
      <article className="border-card-border bg-card-bg relative flex h-full flex-col rounded-lg border p-4 shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative mb-3 flex h-32 items-center justify-center">
          <ProductImage
            src={product.imageId ? buildImageUrl(product.imageId, countryCode) : PLACEHOLDER_IMAGE}
            alt={product.name}
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
        </div>

        {product.subtitle ? (
          <p className="text-text-muted mb-0.5 truncate text-xs">{product.subtitle}</p>
        ) : null}
        <h3 className="text-text-dark mb-0.5 line-clamp-2 text-sm leading-snug font-medium">
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
        <p className="text-text-muted text-xs">{product.unitQuantity}</p>
        <div className="mt-auto">
          {product.badges.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {product.badges.map((badge, index) => (
                <Badge key={`${badge.variant}-${index}`} badge={badge} />
              ))}
            </div>
          ) : null}
          <div className="mt-1.5">
            <PriceDisplay
              displayPrice={bundlePrice ?? product.displayPrice}
              originalPrice={bundlePrice ? product.displayPrice : product.originalPrice}
            />
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
  if (sections?.length) {
    return (
      <div className="space-y-8">
        {sections.map((section, index) => (
          <section
            key={`${section.title}-${index}`}
            id={buildSectionId(index)}
            className="scroll-mt-36"
          >
            <h2 className="text-foreground mb-3 text-lg font-semibold">{section.title}</h2>
            <ProductTiles products={section.products} />
          </section>
        ))}
      </div>
    );
  }
  return products?.length ? <ProductTiles products={products} /> : null;
}

function ProductTiles({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
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
  const t = getTranslations(useCountryCode());
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
  const t = getTranslations(useCountryCode());
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
  const t = getTranslations(useCountryCode());
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
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef(new Map<number, HTMLAnchorElement>());

  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const focusY = Math.max(STICKY_HEADER_OFFSET_PX, window.innerHeight * VIEWPORT_FOCUS_RATIO);
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

  return (
    <nav
      aria-label="Section navigation"
      className="border-card-border border-t bg-white/95 backdrop-blur-sm"
    >
      <div
        ref={containerRef}
        className="section-nav-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-2"
      >
        {sections.map((section, index) => (
          <a
            key={`${section.title}-${index}`}
            ref={(node) => {
              if (node) badgeRefs.current.set(index, node);
              else badgeRefs.current.delete(index);
            }}
            href={`#${buildSectionId(index)}`}
            aria-current={active === index ? "true" : undefined}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap no-underline ${active === index ? "bg-picnic-red text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {section.title}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | Picnic Web` : "Picnic Web";
  }, [title]);
}

export function useStableSections(sections?: SearchSection[]) {
  return useMemo(() => sections ?? [], [sections]);
}
