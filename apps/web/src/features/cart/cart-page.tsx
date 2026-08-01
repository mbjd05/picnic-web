import { useCallback, useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";

import { estimatedBundleLineTotal } from "@/lib/cart/price-estimates";
import type { BundleProgress, CartData, CartItem } from "@/types/cart";

import { ErrorView, LoadingView } from "../../components/page-state";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { useCartActions, useCartBundles } from "../../providers/cart-context";
import { useTranslations } from "../../providers/country-context";
import { CartCheckoutCta } from "./cart-checkout-cta";
import { CartItemCard } from "./cart-item-card";
import { CartOrderSummary } from "./cart-order-summary";
import { CartProductSlider } from "./cart-product-slider";
import { DeliverySlotBanner } from "./delivery-slot-banner";
import { DeliverySlotPicker } from "./delivery-slot-picker";
import { useCartQuery } from "../../hooks/use-cart-query";
import { fetchJson } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-config";

const CART_MUTATION_DEBOUNCE_MS = 220;

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
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { applyVisibleCart } = useCartActions();
  const { getBundleProgress } = useCartBundles();
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

  const cartQuery = useCartQuery();

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
    [enqueueDelta, getBundleProgress, pageState]
  );

  const handleDecrement = useCallback(
    (productId: string) => {
      const current = pageState;
      if (current.status !== "success") return;
      const item = current.cart.items.find((line) => line.productId === productId);
      if (!item || item.isUnavailable || item.quantity <= 1) return;

      setPageState((previous) => {
        if (previous.status !== "success") return previous;
        const previousItem = previous.cart.items.find((line) => line.productId === productId);
        if (!previousItem || previousItem.quantity <= 1) return previous;
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
    [enqueueDelta, getBundleProgress, pageState]
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
      <CartOrderSummary
        totalPrice={cart.totalPrice}
        totalCount={cart.totalCount}
        totalDiscount={cart.totalDiscount}
        depositBreakdown={cart.depositBreakdown}
        membershipSavings={cart.membershipSavings}
        fees={cart.fees}
        minimumOrderValue={cart.minimumOrderValue}
        isUpdating={isReconciling}
      />
      <CartProductSlider title={t.nothingForgotten} products={cart.suggestions} />
      <CartCheckoutCta totalPrice={cart.totalPrice} minimumOrderValue={cart.minimumOrderValue} />
    </div>
  );
}

function CartToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const t = useTranslations();
  if (!message) return null;
  return (
    <div
      role="status"
      className="app-toast fixed right-4 bottom-4 z-[100] flex max-w-sm items-center gap-3 rounded-lg px-4 py-3 text-sm"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-current/80 transition-colors hover:bg-white/10 hover:text-current"
        aria-label={t.dismissAriaLabel}
      >
        <ToastDismissIcon />
      </button>
    </div>
  );
}

function ToastDismissIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
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
