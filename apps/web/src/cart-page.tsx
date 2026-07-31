import { useCallback, useEffect, useRef, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";

import { Badge } from "@/components/badge";
import { PriceDisplay } from "@/components/price-display";
import { TrashIcon } from "@/components/trash-icon";
import type {
  DeliverySlotData,
  DeliverySlotPickerData,
  SlotDayGroup,
} from "@/lib/delivery-slot-types";
import { formatTime } from "@/lib/format-delivery-window";
import { formatEuroPrice, formatPrice } from "@/lib/format-price";
import { buildImageUrl } from "@/lib/image-url";
import { getPreferredPaymentOption } from "@/lib/payment";
import { estimatedBundleLineTotal } from "@/lib/cart-price-estimates";
import type {
  BundleProgress,
  CartData,
  CartItem,
  CheckoutPaymentResponse,
  DepositEntry,
  FeeEntry,
  PaymentProfile,
  SliderProduct,
} from "@/lib/types";

import { ErrorView, LoadingView, useDocumentTitle } from "./browsing-components";
import { useCart } from "./cart-context";
import { useCountryCode, useTranslations } from "./country-context";
import { ApiClientError, fetchJson } from "./lib/api-client";
import { queryKeys, queryStaleTime } from "./lib/query-config";

const CART_MUTATION_DEBOUNCE_MS = 220;
const PAYMENT_BANK_STORAGE_KEY = "picnic_payment_option_banks";

type CartPageState =
  | { status: "loading" }
  | { status: "success"; cart: CartData; isReconciling?: boolean }
  | { status: "empty" }
  | { status: "error"; message: string };

function PageLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>;
}

async function postCartMutation(
  productId: string,
  action: "add" | "remove",
  count = 1
): Promise<CartData> {
  return fetchJson<CartData>("/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId, action, count }),
  });
}

function estimateLineUnitPrice(item: CartItem): number {
  return item.quantity > 0 ? Math.round(item.displayPrice / item.quantity) : item.displayPrice;
}

function estimateLineBaseUnitPrice(item: CartItem): number {
  if (item.quantity <= 0) return item.displayPrice;
  const baseLinePrice =
    item.originalPrice !== null && item.originalPrice > item.displayPrice
      ? item.originalPrice
      : item.displayPrice;
  return Math.round(baseLinePrice / item.quantity);
}

function estimateLineUnitDiscount(item: CartItem): number {
  if (
    item.originalPrice === null ||
    item.originalPrice <= item.displayPrice ||
    item.quantity <= 0
  ) {
    return 0;
  }
  return Math.round((item.originalPrice - item.displayPrice) / item.quantity);
}

function estimateLineDiscount(item: Pick<CartItem, "displayPrice" | "originalPrice">): number {
  return item.originalPrice !== null && item.originalPrice > item.displayPrice
    ? item.originalPrice - item.displayPrice
    : 0;
}

function estimateCartLinePrices(
  item: CartItem,
  nextQuantity: number,
  bundleProgress: BundleProgress | null
): Pick<CartItem, "displayPrice" | "originalPrice"> {
  const baseUnitPrice = estimateLineBaseUnitPrice(item);
  const bundleThresholds = item.priceRanges ?? bundleProgress?.thresholds ?? null;
  if (bundleThresholds?.length) {
    const displayPrice = estimatedBundleLineTotal(bundleThresholds, nextQuantity, baseUnitPrice);
    const originalPrice = baseUnitPrice * nextQuantity;
    return {
      displayPrice,
      originalPrice: originalPrice > displayPrice ? originalPrice : null,
    };
  }

  const quantityDelta = nextQuantity - item.quantity;
  const unitPrice = estimateLineUnitPrice(item);
  const unitDiscount = estimateLineUnitDiscount(item);
  return {
    displayPrice: Math.max(0, item.displayPrice + quantityDelta * unitPrice),
    originalPrice:
      item.originalPrice === null
        ? null
        : Math.max(0, item.originalPrice + quantityDelta * (unitPrice + unitDiscount)),
  };
}

export function CartPage() {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { applyVisibleCart, getBundleProgress } = useCart();
  const search = useSearch({ from: "/authenticated/cart" });
  useDocumentTitle(t.cartTitle);

  const [pageState, setPageState] = useState<CartPageState>({ status: "loading" });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const confirmedCartRef = useRef<CartData | null>(null);
  const pendingDeltasRef = useRef(new Map<string, number>());
  const pendingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingRequestCountRef = useRef(0);

  const hasPendingCartMutations = useCallback(
    () =>
      pendingDeltasRef.current.size > 0 ||
      pendingTimersRef.current.size > 0 ||
      pendingRequestCountRef.current > 0,
    []
  );

  const reconcileFromServer = useCallback(
    (cart: CartData) => {
      confirmedCartRef.current = cart;
      queryClient.setQueryData(queryKeys.cart(), cart);
      setPageState(
        cart.totalCount === 0
          ? { status: "empty" }
          : { status: "success", cart, isReconciling: false }
      );
    },
    [queryClient]
  );

  const rollbackProduct = useCallback(() => {
    const confirmed = confirmedCartRef.current;
    if (!confirmed) return;
    setPageState(
      confirmed.totalCount === 0
        ? { status: "empty" }
        : { status: "success", cart: confirmed, isReconciling: false }
    );
  }, []);

  const cartQuery = useQuery({
    queryKey: queryKeys.cart(),
    queryFn: () => fetchJson<CartData>("/api/cart"),
    staleTime: queryStaleTime.cart,
  });

  useEffect(() => {
    if (cartQuery.data) {
      confirmedCartRef.current = cartQuery.data;
      if (hasPendingCartMutations()) return;
      setPageState(
        cartQuery.data.totalCount === 0
          ? { status: "empty" }
          : { status: "success", cart: cartQuery.data, isReconciling: false }
      );
      return;
    }
    if (cartQuery.isError) {
      setPageState({
        status: "error",
        message:
          cartQuery.error instanceof Error
            ? cartQuery.error.message
            : "Er is iets misgegaan. Probeer het later opnieuw.",
      });
    }
  }, [cartQuery.data, cartQuery.error, cartQuery.isError, hasPendingCartMutations]);

  useEffect(() => {
    if (pageState.status === "success") {
      applyVisibleCart(pageState.cart);
      return;
    }
    if (pageState.status === "empty") {
      applyVisibleCart({ items: [], totalPrice: 0, totalCount: 0 });
    }
  }, [applyVisibleCart, pageState]);

  const flushProductDelta = useCallback(
    async (productId: string) => {
      const delta = pendingDeltasRef.current.get(productId) ?? 0;
      pendingDeltasRef.current.delete(productId);
      pendingTimersRef.current.delete(productId);

      if (delta === 0) {
        if (!hasPendingCartMutations()) {
          setPageState((current) =>
            current.status === "success" ? { ...current, isReconciling: false } : current
          );
        }
        return;
      }

      pendingRequestCountRef.current += 1;
      let result: CartData | null = null;
      try {
        result = await postCartMutation(productId, delta > 0 ? "add" : "remove", Math.abs(delta));
        queryClient.setQueryData(queryKeys.cart(), result);
        confirmedCartRef.current = result;
      } catch {
        rollbackProduct();
        setToastMessage(t.cartMutationError);
      } finally {
        pendingRequestCountRef.current -= 1;
        if (result && !hasPendingCartMutations()) reconcileFromServer(result);
      }
    },
    [
      hasPendingCartMutations,
      queryClient,
      reconcileFromServer,
      rollbackProduct,
      t.cartMutationError,
    ]
  );

  const enqueueDelta = useCallback(
    (productId: string, delta: number) => {
      pendingDeltasRef.current.set(
        productId,
        (pendingDeltasRef.current.get(productId) ?? 0) + delta
      );
      const existingTimer = pendingTimersRef.current.get(productId);
      if (existingTimer) clearTimeout(existingTimer);
      pendingTimersRef.current.set(
        productId,
        setTimeout(() => void flushProductDelta(productId), CART_MUTATION_DEBOUNCE_MS)
      );
    },
    [flushProductDelta]
  );

  useEffect(() => {
    const timers = pendingTimersRef.current;
    const deltas = pendingDeltasRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      deltas.clear();
    };
  }, []);

  const handleIncrement = useCallback(
    (productId: string) => {
      const current = pageState;
      if (current.status !== "success") return;
      const item = current.cart.items.find((line) => line.productId === productId);
      if (!item || item.isUnavailable || item.quantity >= item.maxCount) return;

      setPageState((previous) => {
        if (previous.status !== "success") return previous;
        const previousItem = previous.cart.items.find((line) => line.productId === productId);
        if (!previousItem || previousItem.quantity >= previousItem.maxCount) return previous;
        const nextQuantity = previousItem.quantity + 1;
        const nextLinePrices = estimateCartLinePrices(
          previousItem,
          nextQuantity,
          getBundleProgress(productId)
        );
        const priceDelta = nextLinePrices.displayPrice - previousItem.displayPrice;
        const discountDelta =
          estimateLineDiscount(nextLinePrices) - estimateLineDiscount(previousItem);
        return {
          status: "success",
          isReconciling: true,
          cart: {
            ...previous.cart,
            totalPrice: previous.cart.totalPrice + priceDelta,
            totalCount: previous.cart.totalCount + 1,
            totalDiscount: Math.max(0, previous.cart.totalDiscount + discountDelta),
            items: previous.cart.items.map((line) =>
              line.productId === productId
                ? {
                    ...line,
                    ...nextLinePrices,
                    quantity: nextQuantity,
                  }
                : line
            ),
          },
        };
      });
      enqueueDelta(productId, 1);
    },
    [enqueueDelta, pageState]
  );

  const handleDecrement = useCallback(
    (productId: string) => {
      const current = pageState;
      if (current.status !== "success") return;
      const item = current.cart.items.find((line) => line.productId === productId);
      if (!item || item.isUnavailable || item.quantity <= 0) return;

      setPageState((previous) => {
        if (previous.status !== "success") return previous;
        const previousItem = previous.cart.items.find((line) => line.productId === productId);
        if (!previousItem || previousItem.quantity <= 0) return previous;
        const nextQuantity = previousItem.quantity - 1;
        const nextLinePrices = estimateCartLinePrices(
          previousItem,
          nextQuantity,
          getBundleProgress(productId)
        );
        const priceDelta = previousItem.displayPrice - nextLinePrices.displayPrice;
        const discountDelta =
          estimateLineDiscount(previousItem) - estimateLineDiscount(nextLinePrices);
        const nextItems =
          nextQuantity === 0
            ? previous.cart.items.filter((line) => line.productId !== productId)
            : previous.cart.items.map((line) =>
                line.productId === productId
                  ? {
                      ...line,
                      ...nextLinePrices,
                      quantity: nextQuantity,
                    }
                  : line
              );
        const nextCount = Math.max(0, previous.cart.totalCount - 1);
        const nextTotalPrice = Math.max(0, previous.cart.totalPrice - priceDelta);
        const nextTotalDiscount = Math.max(0, previous.cart.totalDiscount - discountDelta);
        return nextCount === 0 || nextItems.length === 0
          ? { status: "empty" }
          : {
              status: "success",
              isReconciling: true,
              cart: {
                ...previous.cart,
                totalPrice: nextTotalPrice,
                totalCount: nextCount,
                totalDiscount: nextTotalDiscount,
                items: nextItems,
              },
            };
      });
      enqueueDelta(productId, -1);
    },
    [enqueueDelta, pageState]
  );

  const handleRemoveAll = useCallback(
    (productId: string) => {
      const current = pageState;
      if (current.status !== "success") return;
      const item = current.cart.items.find((line) => line.productId === productId);
      if (!item || item.isUnavailable || item.quantity <= 0) return;

      setPageState((previous) => {
        if (previous.status !== "success") return previous;
        const previousItem = previous.cart.items.find((line) => line.productId === productId);
        if (!previousItem || previousItem.quantity <= 0) return previous;
        const nextItems = previous.cart.items.filter((line) => line.productId !== productId);
        const nextCount = Math.max(0, previous.cart.totalCount - previousItem.quantity);
        const lineDiscount = estimateLineDiscount(previousItem);
        const nextTotalPrice = Math.max(0, previous.cart.totalPrice - previousItem.displayPrice);
        const nextTotalDiscount = Math.max(0, previous.cart.totalDiscount - lineDiscount);
        return nextCount === 0 || nextItems.length === 0
          ? { status: "empty" }
          : {
              status: "success",
              isReconciling: true,
              cart: {
                ...previous.cart,
                totalPrice: nextTotalPrice,
                totalCount: nextCount,
                totalDiscount: nextTotalDiscount,
                items: nextItems,
              },
            };
      });
      enqueueDelta(productId, -item.quantity);
    },
    [enqueueDelta, pageState]
  );

  return (
    <PageLayout>
      {pageState.status === "loading" ? <LoadingView /> : null}
      {pageState.status === "error" ? (
        <ErrorView
          message={pageState.message || t.cartLoadError}
          onRetry={() => {
            setPageState({ status: "loading" });
            void cartQuery.refetch();
          }}
        />
      ) : null}
      {pageState.status === "empty" ? <EmptyCartView returnSearch={search.returnSearch} /> : null}
      {pageState.status === "success" ? (
        <CartContent
          cart={pageState.cart}
          isReconciling={pageState.isReconciling ?? false}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemoveAll={handleRemoveAll}
          onOpenPicker={() => setIsPickerOpen(true)}
        />
      ) : null}

      {isPickerOpen ? (
        <DeliverySlotPicker
          onClose={() => setIsPickerOpen(false)}
          onSlotSelected={(updatedCart) => {
            reconcileFromServer(updatedCart);
            setIsPickerOpen(false);
          }}
        />
      ) : null}

      <CartToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </PageLayout>
  );
}

function EmptyCartView({ returnSearch }: { returnSearch?: string }) {
  const t = useTranslations();
  const trimmedSearch = returnSearch?.trim();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <CartIcon className="text-text-muted mb-4 h-12 w-12" />
      <p className="text-foreground text-lg font-semibold">{t.emptyCartTitle}</p>
      <p className="mt-1 text-sm text-gray-500">{t.emptyCartText}</p>
      <Link
        to="/"
        search={trimmedSearch ? { q: trimmedSearch } : {}}
        className="text-picnic-red mt-4 text-sm hover:underline"
      >
        {trimmedSearch ? t.backToSearchTerm.replace("{term}", trimmedSearch) : t.goToStartPage}
      </Link>
    </div>
  );
}

function CartContent({
  cart,
  isReconciling,
  onIncrement,
  onDecrement,
  onRemoveAll,
  onOpenPicker,
}: {
  cart: CartData;
  isReconciling: boolean;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemoveAll: (productId: string) => void;
  onOpenPicker: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-bold">{t.cartTitle}</h1>
      <DeliverySlotBanner
        bannerText={cart.deliveryBannerText}
        isExplicit={cart.selectedSlot?.isExplicitSelection ?? false}
        onTap={onOpenPicker}
      />
      <div>
        {cart.items.map((item) => (
          <CartItemCard
            key={item.id}
            item={item}
            onIncrement={item.isUnavailable ? undefined : () => onIncrement(item.productId)}
            onDecrement={item.isUnavailable ? undefined : () => onDecrement(item.productId)}
            onRemoveAll={item.isUnavailable ? undefined : () => onRemoveAll(item.productId)}
          />
        ))}
      </div>
      <OrderSummary
        totalPrice={cart.totalPrice}
        totalCount={cart.totalCount}
        totalDiscount={cart.totalDiscount}
        depositBreakdown={cart.depositBreakdown}
        membershipSavings={cart.membershipSavings}
        fees={cart.fees}
        minimumOrderValue={cart.minimumOrderValue}
        isUpdating={isReconciling}
      />
      <ProductSlider title={t.nothingForgotten} products={cart.suggestions} />
      <CheckoutCta totalPrice={cart.totalPrice} minimumOrderValue={cart.minimumOrderValue} />
    </div>
  );
}

function CartItemCard({
  item,
  onIncrement,
  onDecrement,
  onRemoveAll,
}: {
  item: CartItem;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemoveAll?: () => void;
}) {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const [imgError, setImgError] = useState(false);
  const imageSrc =
    imgError || !item.imageId
      ? "/placeholder-product.svg"
      : buildImageUrl(item.imageId, countryCode);

  return (
    <div className={`border-card-border border-b py-2${item.isUnavailable ? "bg-gray-50" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/product/$id"
          params={{ id: item.productId }}
          className={`flex min-w-0 flex-1 gap-3 transition-colors hover:bg-gray-50${
            item.isUnavailable ? "opacity-60" : ""
          }`}
        >
          <div className="relative h-14 w-14 shrink-0 md:h-16 md:w-16">
            <img
              src={imageSrc}
              alt={item.name}
              loading="lazy"
              className="h-full w-full rounded-md object-contain"
              onError={() => setImgError(true)}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div>
              <p className="text-foreground line-clamp-2 text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-gray-500">{item.unitQuantity}</p>
            </div>
            {item.badges.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {item.badges.map((badge, index) => (
                  <Badge key={`${badge.variant}-${index}`} badge={badge} />
                ))}
              </div>
            ) : null}
          </div>
        </Link>

        <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
          {!item.isUnavailable && onIncrement && onDecrement && onRemoveAll ? (
            <>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onRemoveAll}
                  className="text-text-muted hover:text-picnic-red flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-red-50 active:opacity-70"
                  aria-label={`${t.removeItemAriaLabel}: ${item.name}`}
                  title={t.removeItemAriaLabel}
                >
                  <TrashIcon />
                </button>
                <QuantityStepper
                  quantity={item.quantity}
                  maxCount={item.maxCount}
                  onIncrement={onIncrement}
                  onDecrement={onDecrement}
                />
              </div>
              <PriceDisplay displayPrice={item.displayPrice} originalPrice={item.originalPrice} />
            </>
          ) : (
            <>
              <span className="text-text-muted text-xs font-semibold">{item.quantity}x</span>
              <PriceDisplay displayPrice={item.displayPrice} originalPrice={item.originalPrice} />
            </>
          )}
        </div>
      </div>
      {item.isUnavailable && item.unavailableExplanation ? (
        <div className="mt-2">
          <p className="text-picnic-orange text-sm">{item.unavailableExplanation}</p>
        </div>
      ) : null}
    </div>
  );
}

function QuantityStepper({
  quantity,
  maxCount,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  maxCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const t = useTranslations();
  const isAtMax = quantity >= maxCount;
  return (
    <div className="flex items-center gap-0 rounded-full bg-gray-100 px-0.5 py-0.5">
      <button
        type="button"
        onClick={onDecrement}
        className="text-foreground flex h-8 w-8 items-center justify-center text-base font-semibold transition-opacity active:opacity-60"
        aria-label={t.removeOneAriaLabel}
      >
        −
      </button>
      <span className="text-foreground min-w-[1.5rem] text-center text-sm font-bold">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={isAtMax}
        className={`flex h-8 w-8 items-center justify-center text-base font-semibold transition-opacity ${
          isAtMax ? "cursor-not-allowed text-gray-300" : "text-foreground active:opacity-60"
        }`}
        aria-label={t.addOneAriaLabel}
      >
        +
      </button>
    </div>
  );
}

function DeliverySlotBanner({
  bannerText,
  isExplicit,
  onTap,
}: {
  bannerText: string;
  isExplicit: boolean;
  onTap: () => void;
}) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onTap}
      className="group flex w-full items-center gap-3 rounded-2xl bg-gray-100 px-4 py-3 text-left transition-all hover:bg-gray-200 hover:shadow-md active:scale-[0.99] sm:gap-3.5 sm:px-5 sm:py-4"
    >
      <div className="relative shrink-0 rounded-xl bg-white p-2 shadow-sm">
        <TruckIcon />
        <div className="absolute -right-0.5 -bottom-0.5">
          <ClockIcon />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`text-sm ${isExplicit ? "text-foreground font-semibold" : "font-medium text-gray-500"}`}
        >
          {bannerText}
        </span>
        {!isExplicit ? <span className="text-xs text-gray-400">{t.tapToChoose}</span> : null}
      </div>
      <ChevronRightIcon />
    </button>
  );
}

function OrderSummary({
  totalPrice,
  totalCount,
  totalDiscount,
  depositBreakdown,
  membershipSavings,
  fees,
  minimumOrderValue,
  isUpdating,
}: {
  totalPrice: number;
  totalCount: number;
  totalDiscount: number;
  depositBreakdown: DepositEntry[];
  membershipSavings: number;
  fees: FeeEntry[];
  minimumOrderValue: number | null;
  isUpdating: boolean;
}) {
  const t = useTranslations();
  if (totalCount === 0) return null;

  function depositLabel(type: string): string {
    switch (type.toUpperCase()) {
      case "BAG":
        return t.depositBag;
      case "BOTTLE":
        return t.depositBottle;
      default:
        return t.depositGeneric;
    }
  }

  return (
    <div
      className={`border-card-border bg-card-bg rounded-xl border p-4 transition-opacity ${
        isUpdating ? "opacity-70" : "opacity-100"
      }`}
      aria-busy={isUpdating}
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold">{t.orderSummaryTitle}</h2>
        {isUpdating ? (
          <span className="text-xs text-gray-500">{t.orderSummaryUpdating}</span>
        ) : null}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-700">
          <span>
            {t.itemsLabel} ({totalCount})
          </span>
        </div>
        {totalDiscount > 0 ? (
          <SummaryDiscountRow label={t.discountLabel} amount={totalDiscount} />
        ) : null}
        {depositBreakdown
          .filter((entry) => entry.total > 0)
          .map((entry) => (
            <div key={entry.type} className="flex justify-between text-gray-700">
              <span>{depositLabel(entry.type)}</span>
              <span>{formatPrice(entry.total)}</span>
            </div>
          ))}
        {membershipSavings > 0 ? (
          <SummaryDiscountRow label={t.membershipSavingsLabel} amount={membershipSavings} />
        ) : null}
        {fees.map((fee) => (
          <div
            key={fee.type}
            className={`flex justify-between ${fee.amount < 0 ? "text-picnic-green" : "text-gray-700"}`}
          >
            <span>{fee.name}</span>
            <span>
              {fee.amount < 0 ? `−${formatPrice(Math.abs(fee.amount))}` : formatPrice(fee.amount)}
            </span>
          </div>
        ))}
        {minimumOrderValue !== null && minimumOrderValue > 0 ? (
          <div className="flex justify-between text-gray-700">
            <span>{t.minimumOrderLabel}</span>
            <span className={totalPrice >= minimumOrderValue ? "text-picnic-green" : ""}>
              {totalPrice >= minimumOrderValue ? <span className="mr-1">&#10003;</span> : null}
              {formatPrice(minimumOrderValue)}
            </span>
          </div>
        ) : null}
        <div className="border-card-border text-foreground flex justify-between border-t pt-2 font-bold">
          <span>{t.totalLabel}</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryDiscountRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="text-picnic-green flex justify-between">
      <span>{label}</span>
      <span>−{formatPrice(amount)}</span>
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
        {formatPrice(product.displayPrice)}
      </p>
    </Link>
  );
}

function readStoredBankMetadata(): Record<string, { bankName: string }> {
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_BANK_STORAGE_KEY) ?? "{}") as Record<
      string,
      { bankName: string }
    >;
  } catch {
    return {};
  }
}

function CheckoutCta({
  totalPrice,
  minimumOrderValue,
}: {
  totalPrice: number;
  minimumOrderValue: number | null;
}) {
  const t = useTranslations();
  const [checkoutState, setCheckoutState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "error"; message: string }
  >({ status: "idle" });
  const [storedBankMetadata] = useState(readStoredBankMetadata);
  const paymentProfileQuery = useQuery({
    queryKey: queryKeys.paymentProfile(),
    queryFn: () => fetchJson<PaymentProfile>("/api/account/payment-profile"),
    staleTime: queryStaleTime.paymentProfile,
  });
  const paymentProfile = paymentProfileQuery.data ?? null;

  const preferredOption = paymentProfile ? getPreferredPaymentOption(paymentProfile) : null;
  const hasKnownMissingPayment =
    paymentProfile !== null && paymentProfile.preferred_payment_option_id === null;
  const isBelowMinimum =
    minimumOrderValue !== null && minimumOrderValue > 0 && totalPrice < minimumOrderValue;
  const bankName = preferredOption ? storedBankMetadata[preferredOption.id]?.bankName : null;

  async function handleCheckout() {
    if (isBelowMinimum || hasKnownMissingPayment) return;
    setCheckoutState({ status: "loading" });
    try {
      const data = await fetchJson<CheckoutPaymentResponse>("/api/checkout/start-payment", {
        method: "POST",
      });
      sessionStorage.setItem("picnic_checkout_transaction_id", data.transactionId);
      sessionStorage.setItem("picnic_checkout_order_id", data.orderId);
      localStorage.setItem("picnic_checkout_transaction_id", data.transactionId);
      localStorage.setItem("picnic_checkout_order_id", data.orderId);
      if (data.paymentId) localStorage.setItem("picnic_checkout_payment_id", data.paymentId);
      window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      setCheckoutState({ status: "idle" });
    } catch (error) {
      setCheckoutState({
        status: "error",
        message: error instanceof ApiClientError ? error.message : t.checkoutStartError,
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="border-card-border rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">{t.paymentMethodTitle}</p>
            <p className="mt-1 text-sm text-gray-500">
              {preferredOption?.display_name ?? t.noPreferredPaymentMethod}
              {bankName ? ` · ${bankName}` : ""}
            </p>
          </div>
          <Link
            to="/account/payment"
            search={{ from: "cart" }}
            className="text-picnic-red text-sm font-semibold"
          >
            {t.managePaymentMethods}
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleCheckout()}
        disabled={checkoutState.status === "loading" || hasKnownMissingPayment || isBelowMinimum}
        className="bg-picnic-red block w-full rounded-xl py-4 text-center text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {checkoutState.status === "loading" ? t.checkoutStarting : t.checkoutLabel}
      </button>
      {hasKnownMissingPayment ? (
        <p className="text-sm text-gray-600">
          {t.noPreferredPaymentMethod}{" "}
          <Link
            to="/account/payment"
            search={{ from: "cart" }}
            className="text-picnic-red font-semibold"
          >
            {t.choosePaymentMethod}
          </Link>
        </p>
      ) : null}
      {isBelowMinimum ? (
        <p className="text-sm text-gray-600">
          {t.minimumCheckoutMessage
            .replace("{minimum}", formatEuroPrice(minimumOrderValue ?? 0))
            .replace("{current}", formatEuroPrice(totalPrice))}
        </p>
      ) : null}
      {checkoutState.status === "error" ? (
        <p className="text-sm text-red-600" role="alert">
          {checkoutState.message}
        </p>
      ) : null}
    </div>
  );
}

function DeliverySlotPicker({
  onClose,
  onSlotSelected,
}: {
  onClose: () => void;
  onSlotSelected: (updatedCart: CartData) => void;
}) {
  const queryClient = useQueryClient();
  const [dayIndex, setDayIndex] = useState(0);
  const [selectingSlotId, setSelectingSlotId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | undefined>(undefined);
  const slotsQuery = useQuery({
    queryKey: queryKeys.deliverySlots(),
    queryFn: () => fetchJson<DeliverySlotPickerData>("/api/cart/delivery-slots"),
    staleTime: queryStaleTime.deliverySlots,
  });

  const loadSlots = useCallback(() => {
    setSelectionError(undefined);
    void slotsQuery.refetch();
  }, [slotsQuery]);

  const handleSelectSlot = useCallback(
    (slotId: string) => {
      setSelectingSlotId(slotId);
      setSelectionError(undefined);
      fetchJson<CartData>("/api/cart/delivery-slots", {
        method: "POST",
        body: JSON.stringify({ slotId }),
      })
        .then((cart) => {
          queryClient.setQueryData(queryKeys.cart(), cart);
          void queryClient.invalidateQueries({ queryKey: queryKeys.deliverySlots() });
          onSlotSelected(cart);
        })
        .catch((error) => {
          setSelectionError(
            error instanceof Error ? error.message : "Kan bezorgmoment niet kiezen."
          );
        })
        .finally(() => {
          setSelectingSlotId(null);
        });
    },
    [onSlotSelected, queryClient]
  );

  const handleDayChange = useCallback((dayIndex: number) => {
    setDayIndex(dayIndex);
    setSelectionError(undefined);
  }, []);

  const slotErrorMessage =
    slotsQuery.error instanceof Error ? slotsQuery.error.message : "Kan bezorgmomenten niet laden.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[min(600px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <PickerHeader onClose={onClose} />
        {slotsQuery.isPending ? <PickerLoading /> : null}
        {slotsQuery.isError ? <PickerError message={slotErrorMessage} onRetry={loadSlots} /> : null}
        {slotsQuery.data ? (
          <SlotListBody
            data={slotsQuery.data}
            dayIndex={Math.min(dayIndex, Math.max(0, slotsQuery.data.dayGroups.length - 1))}
            selectingSlotId={selectingSlotId}
            selectionError={selectionError}
            onDayChange={handleDayChange}
            onSelectSlot={handleSelectSlot}
          />
        ) : null}
      </div>
    </div>
  );
}

function PickerHeader({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  return (
    <div className="border-b border-gray-200 px-4 pt-4 pb-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-foreground text-lg font-bold">{t.pickerTitle}</h2>
          <p className="text-sm text-green-700">{t.freeDeliveryLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          aria-label={t.closeAriaLabel}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function PickerLoading() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center">
      <div className="border-t-picnic-red h-8 w-8 animate-spin rounded-full border-4 border-gray-200" />
    </div>
  );
}

function PickerError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-gray-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-picnic-red rounded-lg px-4 py-2 text-sm font-medium text-white"
      >
        {t.retryLabel}
      </button>
    </div>
  );
}

function SlotListBody({
  data,
  dayIndex,
  selectingSlotId,
  selectionError,
  onDayChange,
  onSelectSlot,
}: {
  data: DeliverySlotPickerData;
  dayIndex: number;
  selectingSlotId: string | null;
  selectionError?: string;
  onDayChange: (index: number) => void;
  onSelectSlot: (slotId: string) => void;
}) {
  const t = useTranslations();
  if (data.dayGroups.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm text-gray-500">{t.noSlotsLabel}</p>
      </div>
    );
  }
  const currentDay = data.dayGroups[dayIndex];
  const selectedOnThisDay = data.selectedSlot
    ? findSlotInDay(currentDay, data.selectedSlot.slotId)
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DayTabs groups={data.dayGroups} activeIndex={dayIndex} onChange={onDayChange} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {selectionError ? (
          <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {selectionError}
          </div>
        ) : null}
        {selectedOnThisDay ? (
          <SelectedDayView
            selectedSlot={selectedOnThisDay}
            otherSlots={getAllSlots(currentDay).filter(
              (slot) => slot.slotId !== selectedOnThisDay.slotId
            )}
            selectingSlotId={selectingSlotId}
            onSelectSlot={onSelectSlot}
          />
        ) : (
          <DefaultDayView
            day={currentDay}
            selectingSlotId={selectingSlotId}
            onSelectSlot={onSelectSlot}
          />
        )}
      </div>
    </div>
  );
}

function DayTabs({
  groups,
  activeIndex,
  onChange,
}: {
  groups: SlotDayGroup[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4 py-2">
      {groups.map((group, index) => (
        <button
          key={group.date}
          type="button"
          onClick={() => onChange(index)}
          className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-xs transition-colors ${
            index === activeIndex
              ? "bg-picnic-red text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <span className="font-medium">{group.dayLabel}</span>
          <span className="opacity-75">{group.dateLabel}</span>
        </button>
      ))}
    </div>
  );
}

function SelectedDayView({
  selectedSlot,
  otherSlots,
  selectingSlotId,
  onSelectSlot,
}: {
  selectedSlot: DeliverySlotData;
  otherSlots: DeliverySlotData[];
  selectingSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  const t = useTranslations();
  return (
    <>
      <SectionHeader text={t.selectedSectionLabel} />
      <SlotRow
        slot={selectedSlot}
        isSelecting={selectingSlotId === selectedSlot.slotId}
        isDisabled={selectingSlotId !== null}
        isCurrentlySelected
        onSelect={onSelectSlot}
      />
      {otherSlots.length > 0 ? (
        <>
          <SectionHeader text={t.otherMomentLabel} />
          {otherSlots.map((slot) => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              isSelecting={selectingSlotId === slot.slotId}
              isDisabled={selectingSlotId !== null}
              isCurrentlySelected={false}
              onSelect={onSelectSlot}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function DefaultDayView({
  day,
  selectingSlotId,
  onSelectSlot,
}: {
  day: SlotDayGroup;
  selectingSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  const t = useTranslations();
  return (
    <>
      {day.greenSlots.length > 0 ? (
        <>
          <SectionHeader text={t.greenChoiceLabel} icon="leaf" />
          {day.greenSlots.map((slot) => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              isSelecting={selectingSlotId === slot.slotId}
              isDisabled={selectingSlotId !== null}
              isCurrentlySelected={false}
              onSelect={onSelectSlot}
            />
          ))}
        </>
      ) : null}
      {day.regularSlots.length > 0 ? (
        <>
          <SectionHeader text={t.otherMomentLabel} />
          {day.regularSlots.map((slot) => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              isSelecting={selectingSlotId === slot.slotId}
              isDisabled={selectingSlotId !== null}
              isCurrentlySelected={false}
              onSelect={onSelectSlot}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function SectionHeader({ text, icon }: { text: string; icon?: "leaf" }) {
  return (
    <div className="mt-4 mb-2 flex items-center gap-1.5">
      {icon === "leaf" ? <LeafIcon /> : null}
      <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{text}</span>
    </div>
  );
}

function SlotRow({
  slot,
  isSelecting,
  isDisabled,
  isCurrentlySelected,
  onSelect,
}: {
  slot: DeliverySlotData;
  isSelecting: boolean;
  isDisabled: boolean;
  isCurrentlySelected: boolean;
  onSelect: (slotId: string) => void;
}) {
  const startTime = formatTime(new Date(slot.windowStart));
  const endTime = formatTime(new Date(slot.windowEnd));
  return (
    <button
      type="button"
      onClick={() => onSelect(slot.slotId)}
      disabled={isDisabled || !slot.isAvailable}
      className={`mb-1.5 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
        isCurrentlySelected
          ? "border-green-500 bg-green-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      } ${isDisabled || !slot.isAvailable ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        {slot.isGreenChoice ? <LeafIcon /> : null}
        <span className="text-foreground text-sm font-medium">
          {startTime} - {endTime}
        </span>
      </div>
      <div className="flex items-center">
        {isSelecting ? (
          <div className="border-t-picnic-red h-4 w-4 animate-spin rounded-full border-2 border-gray-300" />
        ) : null}
        {isCurrentlySelected && !isSelecting ? <CheckIcon /> : null}
      </div>
    </button>
  );
}

function findSlotInDay(day: SlotDayGroup, slotId: string): DeliverySlotData | null {
  return getAllSlots(day).find((slot) => slot.slotId === slotId) ?? null;
}

function getAllSlots(day: SlotDayGroup): DeliverySlotData[] {
  return [...day.greenSlots, ...day.regularSlots];
}

function CartToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-[100] max-w-sm rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
      onClick={onDismiss}
    >
      {message}
    </div>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h13v10H3V4Zm13 4h3l2 3v3h-5V8ZM6.5 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
        stroke="#1f2937"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill="white" stroke="#1f2937" strokeWidth="1" />
      <path
        d="M6 3.5V6l2 1"
        stroke="#1f2937"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5"
    >
      <path
        d="M7 4.5l4.5 4.5-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 3s-1 5-5 7C4 12 3 13 3 13s0-5 4-7c1.5-1 3.5-2 6-3Z"
        fill="#22c55e"
        stroke="#16a34a"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#22c55e" />
      <path
        d="M6 10l3 3 5-6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
