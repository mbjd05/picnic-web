import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { BundleProgress, BundleThreshold, CartData } from "@/lib/types";

import { fetchJson } from "./lib/api-client";
import { queryKeys, queryStaleTime } from "./lib/query-config";

const CART_MUTATION_DEBOUNCE_MS = 220;

type CartContextValue = {
  quantities: Map<string, number>;
  totalPrice: number;
  totalCount: number;
  isLoading: boolean;
  addProduct: (productId: string, maxCount: number, priceDelta?: number) => void;
  removeProduct: (productId: string, priceDelta?: number) => void;
  getQuantity: (productId: string) => number;
  getBundleProgress: (productId: string) => BundleProgress | null;
  registerBundleDataBatch: (entries: ReadonlyArray<readonly [string, BundleThreshold[]]>) => void;
  applyVisibleCart: (cart: Pick<CartData, "items" | "totalPrice" | "totalCount">) => void;
  refresh: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const ToastContext = createContext<(message: string) => void>(() => undefined);

function quantitiesFromCart(cart: Pick<CartData, "items">): Map<string, number> {
  return new Map(cart.items.map((item) => [item.productId, item.quantity]));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [totalPrice, setTotalPrice] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [bundleData, setBundleData] = useState<Map<string, BundleThreshold[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const confirmedRef = useRef(new Map<string, number>());
  const confirmedTotalsRef = useRef({ totalPrice: 0, totalCount: 0 });
  const visibleQuantitiesRef = useRef(new Map<string, number>());
  const visibleTotalsRef = useRef({ totalPrice: 0, totalCount: 0 });
  const pendingDeltasRef = useRef(new Map<string, number>());
  const pendingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const requestCountRef = useRef(0);
  const cartQuery = useQuery({
    queryKey: queryKeys.cart(),
    queryFn: () => fetchJson<CartData>("/api/cart"),
    staleTime: queryStaleTime.cart,
  });

  const hasPendingCartWork = useCallback(
    () => pendingDeltasRef.current.size > 0 || requestCountRef.current > 0,
    []
  );

  const applyQuantities = useCallback((next: Map<string, number>) => {
    visibleQuantitiesRef.current = new Map(next);
    setQuantities(next);
  }, []);

  const applyTotals = useCallback((next: { totalPrice: number; totalCount: number }) => {
    visibleTotalsRef.current = next;
    setTotalPrice(next.totalPrice);
    setTotalCount(next.totalCount);
  }, []);

  const applyVisibleCart = useCallback(
    (cart: Pick<CartData, "items" | "totalPrice" | "totalCount">) => {
      applyQuantities(quantitiesFromCart(cart));
      applyTotals({ totalPrice: cart.totalPrice, totalCount: cart.totalCount });
    },
    [applyQuantities, applyTotals]
  );

  const reconcile = useCallback(
    (cart: CartData) => {
      const next = quantitiesFromCart(cart);
      confirmedRef.current = new Map(next);
      confirmedTotalsRef.current = { totalPrice: cart.totalPrice, totalCount: cart.totalCount };
      applyVisibleCart(cart);
    },
    [applyVisibleCart]
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart() });
    void cartQuery
      .refetch()
      .then((result) => {
        if (!result.data) return;
        confirmedRef.current = quantitiesFromCart(result.data);
        confirmedTotalsRef.current = {
          totalPrice: result.data.totalPrice,
          totalCount: result.data.totalCount,
        };
        if (!hasPendingCartWork()) reconcile(result.data);
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, [cartQuery, hasPendingCartWork, queryClient, reconcile]);

  useEffect(() => {
    if (cartQuery.data) {
      confirmedRef.current = quantitiesFromCart(cartQuery.data);
      confirmedTotalsRef.current = {
        totalPrice: cartQuery.data.totalPrice,
        totalCount: cartQuery.data.totalCount,
      };
      if (!hasPendingCartWork()) reconcile(cartQuery.data);
      setIsLoading(false);
    } else if (cartQuery.isError) {
      setIsLoading(false);
    }
  }, [cartQuery.data, cartQuery.isError, hasPendingCartWork, reconcile]);

  const flush = useCallback(
    async (productId: string) => {
      const delta = pendingDeltasRef.current.get(productId) ?? 0;
      pendingDeltasRef.current.delete(productId);
      pendingTimersRef.current.delete(productId);
      if (delta === 0) return;

      requestCountRef.current += 1;
      try {
        const cart = await fetchJson<CartData>("/api/cart", {
          method: "POST",
          body: JSON.stringify({
            productId,
            action: delta > 0 ? "add" : "remove",
            count: Math.abs(delta),
          }),
        });
        queryClient.setQueryData(queryKeys.cart(), cart);
        confirmedRef.current = quantitiesFromCart(cart);
        confirmedTotalsRef.current = { totalPrice: cart.totalPrice, totalCount: cart.totalCount };
        if (pendingDeltasRef.current.size === 0 && requestCountRef.current === 1) reconcile(cart);
      } catch {
        const next = new Map(visibleQuantitiesRef.current);
        const confirmed = confirmedRef.current.get(productId) ?? 0;
        if (confirmed === 0) next.delete(productId);
        else next.set(productId, confirmed);
        applyQuantities(next);
        applyTotals(confirmedTotalsRef.current);
        setToast("Er ging iets mis. Probeer het opnieuw.");
        refresh();
      } finally {
        requestCountRef.current -= 1;
      }
    },
    [queryClient, reconcile, refresh]
  );

  const enqueue = useCallback(
    (productId: string, delta: number) => {
      pendingDeltasRef.current.set(
        productId,
        (pendingDeltasRef.current.get(productId) ?? 0) + delta
      );
      const currentTimer = pendingTimersRef.current.get(productId);
      if (currentTimer) clearTimeout(currentTimer);
      pendingTimersRef.current.set(
        productId,
        setTimeout(() => void flush(productId), CART_MUTATION_DEBOUNCE_MS)
      );
    },
    [flush]
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

  const addProduct = useCallback(
    (productId: string, maxCount: number, priceDelta = 0) => {
      const quantity = visibleQuantitiesRef.current.get(productId) ?? 0;
      if (quantity >= maxCount) return;
      const next = new Map(visibleQuantitiesRef.current);
      next.set(productId, quantity + 1);
      applyQuantities(next);
      applyTotals({
        totalPrice: visibleTotalsRef.current.totalPrice + priceDelta,
        totalCount: visibleTotalsRef.current.totalCount + 1,
      });
      enqueue(productId, 1);
    },
    [applyQuantities, applyTotals, enqueue]
  );

  const removeProduct = useCallback(
    (productId: string, priceDelta = 0) => {
      const quantity = visibleQuantitiesRef.current.get(productId) ?? 0;
      if (quantity === 0) return;
      const next = new Map(visibleQuantitiesRef.current);
      if (quantity <= 1) next.delete(productId);
      else next.set(productId, quantity - 1);
      applyQuantities(next);
      applyTotals({
        totalPrice: Math.max(0, visibleTotalsRef.current.totalPrice - priceDelta),
        totalCount: Math.max(0, visibleTotalsRef.current.totalCount - 1),
      });
      enqueue(productId, -1);
    },
    [applyQuantities, applyTotals, enqueue]
  );

  const getQuantity = useCallback(
    (productId: string) => quantities.get(productId) ?? 0,
    [quantities]
  );
  const getBundleProgress = useCallback(
    (productId: string) => {
      const thresholds = bundleData.get(productId);
      return thresholds?.length
        ? { productId, thresholds, currentQuantity: quantities.get(productId) ?? 0 }
        : null;
    },
    [bundleData, quantities]
  );
  const registerBundleDataBatch = useCallback(
    (entries: ReadonlyArray<readonly [string, BundleThreshold[]]>) => {
      if (entries.length === 0) return;
      setBundleData((current) => {
        let next: Map<string, BundleThreshold[]> | null = null;
        for (const [productId, thresholds] of entries) {
          if (thresholds.length === 0 || current.has(productId) || next?.has(productId)) continue;
          next ??= new Map(current);
          next.set(productId, thresholds);
        }
        return next ?? current;
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      quantities,
      totalPrice,
      totalCount,
      isLoading,
      addProduct,
      removeProduct,
      getQuantity,
      getBundleProgress,
      registerBundleDataBatch,
      applyVisibleCart,
      refresh,
    }),
    [
      quantities,
      totalPrice,
      totalCount,
      isLoading,
      addProduct,
      removeProduct,
      getQuantity,
      getBundleProgress,
      registerBundleDataBatch,
      applyVisibleCart,
      refresh,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      <ToastContext.Provider value={setToast}>{children}</ToastContext.Provider>
      {toast ? (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-[100] max-w-sm rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
          onClick={() => setToast(null)}
        >
          {toast}
        </div>
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}

export function useCartToast(): (message: string) => void {
  return useContext(ToastContext);
}
