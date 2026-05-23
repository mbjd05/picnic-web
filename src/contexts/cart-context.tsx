"use client";

/**
 * Cart context for the search results page (PLP).
 *
 * Manages client-side cart state: product quantities, totals, and bundle data.
 * Provides optimistic updates with per-product mutation queuing and rollback
 * on failure. Components consume this via the `useCart` hook.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { isApiErrorResponse, readJsonResponse } from "@/lib/client-fetch";
import type { BundleProgress, BundleThreshold, CartData } from "@/lib/types";

const CART_MUTATION_DEBOUNCE_MS = 220;

// ─── Toast callback type ──────────────────────────────────────────────────────

type ToastFn = (message: string) => void;

// ─── Context shape ────────────────────────────────────────────────────────────

type CartContextValue = {
  /** Product ID → current quantity in cart. */
  quantities: Map<string, number>;
  /** Total cart price in cents. */
  totalPrice: number;
  /** Total item count. */
  totalCount: number;
  /** Product ID → bundle thresholds (empty until data is registered). */
  bundleData: Map<string, BundleThreshold[]>;
  /** Whether the initial cart fetch is in progress. */
  isLoading: boolean;
  /** Add 1 unit of a product (optimistic). */
  addProduct: (productId: string, maxCount: number) => void;
  /** Remove 1 unit of a product (optimistic). */
  removeProduct: (productId: string) => void;
  /** Get current quantity for a product (0 if not in cart). */
  getQuantity: (productId: string) => number;
  /** Get bundle progress for a product, or null. */
  getBundleProgress: (productId: string) => BundleProgress | null;
  /** Register bundle thresholds for a product (from search results). */
  registerBundleData: (productId: string, thresholds: BundleThreshold[]) => void;
  /** Re-fetch /api/cart and reconcile state. Used after bulk operations like recipe add. */
  refresh: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}

/**
 * Optional hook: returns CartContextValue if inside a CartProvider, else null.
 * Used by SharedHeader to optionally consume cart state.
 */
export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQuantitiesMap(cart: CartData): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of cart.items) {
    map.set(item.productId, item.quantity);
  }
  return map;
}

async function postCartMutation(
  productId: string,
  action: "add" | "remove",
  count: number
): Promise<CartData> {
  const response = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, action, count }),
  });

  const data = await readJsonResponse<CartData>(response, "Cart mutation failed");

  if (isApiErrorResponse(data)) {
    throw new Error(data.error);
  }

  return data as CartData;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type CartProviderProps = {
  children: ReactNode;
  showToast?: ToastFn;
};

export function CartProvider({ children, showToast }: CartProviderProps) {
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [totalPrice, setTotalPrice] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [bundleData, setBundleData] = useState<Map<string, BundleThreshold[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Track the last server-confirmed quantities for rollback.
  const confirmedRef = useRef<Map<string, number>>(new Map());
  const confirmedTotalPriceRef = useRef(0);
  const confirmedTotalCountRef = useRef(0);
  const showToastRef = useRef(showToast);
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

  // Keep the toast ref in sync without accessing during render.
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Reconcile state from a server response.
  const reconcileFromServer = useCallback((cart: CartData) => {
    const newQuantities = buildQuantitiesMap(cart);
    confirmedRef.current = new Map(newQuantities);
    confirmedTotalPriceRef.current = cart.totalPrice;
    confirmedTotalCountRef.current = cart.totalCount;
    setQuantities(newQuantities);
    setTotalPrice(cart.totalPrice);
    setTotalCount(cart.totalCount);
  }, []);

  // Rollback to last confirmed state for a specific product.
  const rollbackProduct = useCallback((productId: string) => {
    setQuantities((prev) => {
      const next = new Map(prev);
      const confirmedQty = confirmedRef.current.get(productId) ?? 0;
      if (confirmedQty === 0) {
        next.delete(productId);
      } else {
        next.set(productId, confirmedQty);
      }
      return next;
    });
    setTotalPrice(confirmedTotalPriceRef.current);
    setTotalCount(confirmedTotalCountRef.current);
  }, []);

  // Initial cart fetch.
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/cart", { signal: controller.signal })
      .then((res) => readJsonResponse<CartData>(res, "Cart load failed"))
      .then((data) => {
        if (isApiErrorResponse(data)) {
          setIsLoading(false);
          return;
        }
        reconcileFromServer(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [reconcileFromServer]);

  const flushProductDelta = useCallback(
    async (productId: string) => {
      const delta = pendingDeltasRef.current.get(productId) ?? 0;
      pendingDeltasRef.current.delete(productId);
      pendingTimersRef.current.delete(productId);

      if (delta === 0) return;

      pendingRequestCountRef.current += 1;
      let result: CartData | null = null;

      try {
        result = await postCartMutation(
          productId,
          delta > 0 ? "add" : "remove",
          Math.abs(delta)
        );
        confirmedRef.current = buildQuantitiesMap(result);
        confirmedTotalPriceRef.current = result.totalPrice;
        confirmedTotalCountRef.current = result.totalCount;
      } catch {
        rollbackProduct(productId);
        showToastRef.current?.("Er ging iets mis. Probeer het opnieuw.");
      } finally {
        pendingRequestCountRef.current -= 1;
        if (result && !hasPendingCartMutations()) {
          reconcileFromServer(result);
        }
      }
    },
    [hasPendingCartMutations, reconcileFromServer, rollbackProduct]
  );

  const enqueueDelta = useCallback(
    (productId: string, delta: number) => {
      const nextDelta = (pendingDeltasRef.current.get(productId) ?? 0) + delta;
      pendingDeltasRef.current.set(productId, nextDelta);

      const existingTimer = pendingTimersRef.current.get(productId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        void flushProductDelta(productId);
      }, CART_MUTATION_DEBOUNCE_MS);

      pendingTimersRef.current.set(productId, timer);
    },
    [flushProductDelta]
  );

  useEffect(() => {
    const timers = pendingTimersRef.current;
    const deltas = pendingDeltasRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      deltas.clear();
    };
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────

  const addProduct = useCallback((productId: string, maxCount: number) => {
    setQuantities((prev) => {
      const current = prev.get(productId) ?? 0;
      if (current >= maxCount) return prev;
      const next = new Map(prev);
      next.set(productId, current + 1);
      return next;
    });

    // Optimistic total bump (+1 item — actual price reconciled on response).
    setTotalCount((c) => c + 1);

    enqueueDelta(productId, 1);
  }, [enqueueDelta]);

  const removeProduct = useCallback((productId: string) => {
    setQuantities((prev) => {
      const current = prev.get(productId) ?? 0;
      if (current <= 0) return prev;
      const next = new Map(prev);
      const newQty = current - 1;
      if (newQty === 0) {
        next.delete(productId);
      } else {
        next.set(productId, newQty);
      }
      return next;
    });

    setTotalCount((c) => Math.max(0, c - 1));

    enqueueDelta(productId, -1);
  }, [enqueueDelta]);

  const getQuantity = useCallback(
    (productId: string): number => quantities.get(productId) ?? 0,
    [quantities]
  );

  const getBundleProgress = useCallback(
    (productId: string): BundleProgress | null => {
      const thresholds = bundleData.get(productId);
      if (!thresholds || thresholds.length === 0) return null;
      return {
        productId,
        thresholds,
        currentQuantity: quantities.get(productId) ?? 0,
      };
    },
    [bundleData, quantities]
  );

  const registerBundleData = useCallback((productId: string, thresholds: BundleThreshold[]) => {
    if (thresholds.length === 0) return;
    setBundleData((prev) => {
      if (prev.has(productId)) return prev;
      const next = new Map(prev);
      next.set(productId, thresholds);
      return next;
    });
  }, []);

  const refresh = useCallback(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data: CartData) => {
        if (!("error" in data)) reconcileFromServer(data);
      })
      .catch(() => {});
  }, [reconcileFromServer]);

  const value = useMemo<CartContextValue>(
    () => ({
      quantities,
      totalPrice,
      totalCount,
      bundleData,
      isLoading,
      addProduct,
      removeProduct,
      getQuantity,
      getBundleProgress,
      registerBundleData,
      refresh,
    }),
    [
      quantities,
      totalPrice,
      totalCount,
      bundleData,
      isLoading,
      addProduct,
      removeProduct,
      getQuantity,
      getBundleProgress,
      registerBundleData,
      refresh,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
