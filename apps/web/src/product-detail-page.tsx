import { useCallback, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";

import { AccordionSection } from "@/components/accordion-section";
import { NutritionTable } from "@/components/nutrition-table";
import { ProductDescription } from "@/components/product-description";
import { ProductHighlights } from "@/components/product-highlights";
import { ProductInfoHeader } from "@/components/product-info-header";
import { ProductLabels } from "@/components/product-labels";
import { formatPrice } from "@/lib/format-price";
import { buildImageUrl } from "@/lib/image-url";
import type {
  AllergenInfo,
  BundleOption,
  ProductDetail,
  ProductPromotion,
  SliderProduct,
} from "@/lib/types";

import { BackButton, ErrorView, LoadingView, useDocumentTitle } from "./browsing-components";
import { useCart } from "./cart-context";
import { useCountryCode, useTranslations } from "./country-context";
import { ApiClientError, fetchJson } from "./lib/api-client";
import { queryKeys, queryStaleTime } from "./lib/query-config";

const PLACEHOLDER_IMAGE = "/placeholder-product.svg";
const GALLERY_IMAGE_SIZE = "large";
const THUMBNAIL_IMAGE_SIZE = "small";

function PageLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>;
}

export function ProductDetailPage() {
  const { id } = useParams({ from: "/authenticated/product/$id" });
  const navigate = useNavigate();
  const countryCode = useCountryCode();
  const t = useTranslations();
  const query = useQuery({
    queryKey: queryKeys.productDetail(id, countryCode),
    queryFn: () => fetchJson<ProductDetail>(`/api/product/${encodeURIComponent(id)}`),
    staleTime: queryStaleTime.productDetail,
  });

  useDocumentTitle(query.data?.name);

  return (
    <PageLayout>
      <BackButton onClick={() => void navigate({ to: "/", search: {} })} />
      {query.isPending ? (
        <LoadingView />
      ) : query.error instanceof ApiClientError && query.error.status === 404 ? (
        <NotFoundView />
      ) : query.isError ? (
        <ProductErrorView
          message={query.error.message || t.productsLoadError}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ProductDetailContent product={query.data} />
      )}
    </PageLayout>
  );
}

function ProductErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <ErrorView message={message} onRetry={onRetry} />;
}

function NotFoundView() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">:(</div>
      <p className="text-lg text-gray-600">Product niet gevonden</p>
      <Link to="/" search={{}} className="text-picnic-red mt-4 text-sm hover:underline">
        Terug naar zoeken
      </Link>
    </div>
  );
}

function ProductDetailContent({ product }: { product: ProductDetail }) {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const cart = useCart();
  const cartQuantity = cart.getQuantity(product.id);
  const hasAllergens =
    product.allergens.confirmed.length > 0 || product.allergens.mayContain.length > 0;
  const hasNutritionRows = product.nutritionRows.length > 0;

  const setQuantity = useCallback(
    (target: number) => {
      const current = cart.getQuantity(product.id);
      const next = Math.max(0, Math.min(target, product.maxCount));
      const diff = next - current;
      if (diff > 0) {
        for (let index = 0; index < diff; index += 1) cart.addProduct(product.id, product.maxCount);
      } else if (diff < 0) {
        for (let index = 0; index < Math.abs(diff); index += 1) cart.removeProduct(product.id);
      }
    },
    [cart, product.id, product.maxCount]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="md:w-1/2">
          <ProductGallery imageIds={product.imageIds} />
        </div>

        <div className="space-y-4 md:w-1/2">
          <ProductLabels labels={product.labels} />
          <ProductInfoHeader
            name={product.name}
            brand={product.brand}
            unitQuantity={product.unitQuantity}
            unitPrice={product.unitPrice}
            categoryTag={product.categoryTag}
          />
          <ProductPriceSection
            displayPrice={product.displayPrice}
            originalPrice={product.originalPrice}
            promotion={product.promotion}
            bundles={product.bundles}
            cartQuantity={cartQuantity}
            maxCount={product.maxCount}
            onIncrement={() => cart.addProduct(product.id, product.maxCount)}
            onDecrement={() => cart.removeProduct(product.id)}
            onSetQuantity={setQuantity}
          />
          <ProductDescription description={product.description} />
          <ProductHighlights highlights={product.highlights} />
        </div>
      </div>

      {hasAllergens ? <AllergenBadges allergens={product.allergens} /> : null}

      {product.infoSections.length > 0 ? (
        <div className="border-card-border border-t">
          {product.infoSections.map((section) => {
            const isNutrition =
              section.title.toLowerCase().includes("voedingswaarde") ||
              section.title.toLowerCase().includes("nährwert");
            if (isNutrition && hasNutritionRows) {
              return (
                <AccordionSection key={section.title} title={section.title}>
                  <NutritionTable rows={product.nutritionRows} />
                </AccordionSection>
              );
            }
            return (
              <AccordionSection
                key={section.title}
                title={section.title}
                content={section.content}
              />
            );
          })}
        </div>
      ) : null}

      <ProductSlider title={t.similarProductsTitle} products={product.similarProducts} />
    </div>
  );
}

function ProductGallery({ imageIds }: { imageIds: string[] }) {
  const countryCode = useCountryCode();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const selectedId = imageIds[selectedIndex] ?? null;
  const mainImageSrc =
    selectedId && !failedIds.has(selectedId)
      ? buildImageUrl(selectedId, countryCode, GALLERY_IMAGE_SIZE)
      : PLACEHOLDER_IMAGE;

  function markFailed(imageId: string) {
    setFailedIds((current) => {
      if (current.has(imageId)) return current;
      const next = new Set(current);
      next.add(imageId);
      return next;
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-64 w-full max-w-md sm:h-80">
        <img
          src={mainImageSrc}
          alt="Product image"
          loading="eager"
          fetchPriority="high"
          className="h-full w-full object-contain"
          onError={() => {
            if (selectedId) markFailed(selectedId);
          }}
        />
      </div>

      {imageIds.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {imageIds.map((imageId, index) => (
            <button
              key={imageId}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`relative h-16 w-16 shrink-0 rounded-md border-2 transition-colors ${
                index === selectedIndex
                  ? "border-picnic-red"
                  : "border-card-border hover:border-gray-400"
              }`}
            >
              <img
                src={
                  failedIds.has(imageId)
                    ? PLACEHOLDER_IMAGE
                    : buildImageUrl(imageId, countryCode, THUMBNAIL_IMAGE_SIZE)
                }
                alt={`Thumbnail ${index + 1}`}
                loading="lazy"
                className="h-full w-full rounded-md object-contain p-1"
                onError={() => markFailed(imageId)}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductPriceSection({
  displayPrice,
  originalPrice,
  promotion,
  bundles,
  cartQuantity,
  maxCount,
  onIncrement,
  onDecrement,
  onSetQuantity,
}: {
  displayPrice: number;
  originalPrice: number | null;
  promotion: ProductPromotion | null;
  bundles: BundleOption[];
  cartQuantity: number;
  maxCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onSetQuantity: (quantity: number) => void;
}) {
  const t = useTranslations();
  const hasDiscount = originalPrice !== null && originalPrice > displayPrice;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold ${
              hasDiscount ? "text-price-discount" : "text-foreground"
            }`}
          >
            €{formatPrice(displayPrice)}
          </span>
          {hasDiscount ? (
            <span className="text-price-original text-base line-through">
              €{formatPrice(originalPrice)}
            </span>
          ) : null}
        </div>
        {promotion ? (
          <span className="rounded bg-[#fbd92b] px-2 py-0.5 text-sm font-medium text-[#333333]">
            {promotion.label}
          </span>
        ) : null}
      </div>

      {bundles.length > 0 ? (
        <BundleTierGrid
          bundles={bundles}
          cartQuantity={cartQuantity}
          onSetQuantity={onSetQuantity}
        />
      ) : null}

      <PdpStepper
        quantity={cartQuantity}
        maxCount={maxCount}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        addLabel={t.addToCartButton}
        inCartLabel={t.inCartLabel}
      />
    </div>
  );
}

function BundleTierGrid({
  bundles,
  cartQuantity,
  onSetQuantity,
}: {
  bundles: BundleOption[];
  cartQuantity: number;
  onSetQuantity: (quantity: number) => void;
}) {
  const t = useTranslations();
  const activeTierIndex = findActiveTierIndex(bundles, cartQuantity);

  return (
    <div className="flex flex-wrap gap-2">
      {bundles.map((bundle, index) => {
        const isActive = index === activeTierIndex;
        return (
          <button
            key={bundle.id || index}
            type="button"
            onClick={() => onSetQuantity(bundle.quantity)}
            className={`flex min-w-[70px] flex-1 cursor-pointer flex-col items-center rounded-lg px-3 py-2 transition-colors ${
              isActive ? "bg-[#d6e6cd] ring-1 ring-[#b0cfb0]" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            <span className="text-xs text-gray-500">
              {t.bundleFromLabel} {bundle.quantity}
            </span>
            <span
              className={`text-sm font-bold ${
                isActive ? "text-price-discount" : "text-foreground"
              }`}
            >
              €{formatPrice(bundle.pricePerUnit)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function findActiveTierIndex(bundles: BundleOption[], cartQuantity: number): number {
  if (cartQuantity === 0) return -1;
  let activeIndex = -1;
  for (let index = 0; index < bundles.length; index += 1) {
    if (bundles[index].quantity <= cartQuantity) activeIndex = index;
  }
  return activeIndex;
}

function PdpStepper({
  quantity,
  maxCount,
  onIncrement,
  onDecrement,
  addLabel,
  inCartLabel,
}: {
  quantity: number;
  maxCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  addLabel: string;
  inCartLabel: string;
}) {
  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={onIncrement}
        disabled={maxCount <= 0}
        className="border-card-border text-foreground w-full rounded-lg border bg-white py-3 text-center text-sm font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {addLabel}
      </button>
    );
  }

  return (
    <div className="border-card-border flex items-center rounded-lg border bg-white">
      <button
        type="button"
        onClick={onDecrement}
        className="text-foreground flex-none px-5 py-3 text-lg font-bold transition-colors hover:bg-gray-50"
      >
        &minus;
      </button>
      <span className="text-foreground flex-1 text-center text-sm font-semibold">
        {quantity} {inCartLabel}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={quantity >= maxCount}
        className="text-foreground flex-none px-5 py-3 text-lg font-bold transition-colors hover:bg-gray-50 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

function AllergenBadges({ allergens }: { allergens: AllergenInfo }) {
  const t = useTranslations();

  return (
    <div className="space-y-3">
      <h2 className="text-foreground text-lg font-semibold">{t.allergenTitle}</h2>
      {allergens.confirmed.length ? (
        <AllergenBadgeGroup label={t.recipeAllergens} badges={allergens.confirmed} />
      ) : null}
      {allergens.mayContain.length ? (
        <AllergenBadgeGroup label={t.recipeMayContain} badges={allergens.mayContain} />
      ) : null}
    </div>
  );
}

function AllergenBadgeGroup({
  label,
  badges,
}: {
  label: string;
  badges: AllergenInfo["confirmed"];
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-600">{label}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge.text}
            className="rounded px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: badge.backgroundColor, color: badge.textColor }}
          >
            {badge.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProductSlider({ title, products }: { title: string; products: SliderProduct[] }) {
  if (products.length === 0) return null;

  return (
    <div>
      <h2 className="text-foreground mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((product) => (
          <ProductSliderCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductSliderCard({ product }: { product: SliderProduct }) {
  const countryCode = useCountryCode();
  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="border-card-border bg-card-bg flex w-36 shrink-0 flex-col rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative mb-2 h-24 w-full">
        <img
          src={buildImageUrl(product.imageId, countryCode)}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </div>
      <p className="text-foreground line-clamp-2 text-xs leading-snug font-medium">
        {product.name}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{product.unitQuantity}</p>
      <p className="text-foreground mt-auto pt-1 text-sm font-bold">
        €{formatPrice(product.displayPrice)}
      </p>
    </Link>
  );
}
