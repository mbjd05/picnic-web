import { createStore, useSelector } from "@tanstack/react-store";

import type { BundleThreshold, CartData } from "@/lib/cart-types";

type CartTotals = Pick<CartData, "totalPrice" | "totalCount">;
type StoredCartSummary = CartTotals & { hasStoredSummary: boolean };

const CART_SUMMARY_STORAGE_KEY = "picnic_cart_summary_v1";
const CART_QUANTITIES_STORAGE_KEY = "picnic_cart_quantities_v1";

function readCartSummary(): StoredCartSummary {
  try {
    const value = localStorage.getItem(CART_SUMMARY_STORAGE_KEY);
    if (!value) return { totalPrice: 0, totalCount: 0, hasStoredSummary: false };
    const parsed = JSON.parse(value);
    return typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.totalPrice === "number" &&
      typeof parsed.totalCount === "number"
      ? { totalPrice: parsed.totalPrice, totalCount: parsed.totalCount, hasStoredSummary: true }
      : { totalPrice: 0, totalCount: 0, hasStoredSummary: false };
  } catch {
    return { totalPrice: 0, totalCount: 0, hasStoredSummary: false };
  }
}

function writeCartSummary(totals: CartTotals) {
  try {
    localStorage.setItem(CART_SUMMARY_STORAGE_KEY, JSON.stringify(totals));
  } catch {
    // The summary only prevents header flicker; ignore storage failures.
  }
}

function readCartQuantities(): Map<string, number> {
  try {
    const value = sessionStorage.getItem(CART_QUANTITIES_STORAGE_KEY);
    if (!value) return new Map();
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed.filter(
        (entry): entry is [string, number] =>
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          Number.isInteger(entry[1]) &&
          entry[1] > 0
      )
    );
  } catch {
    return new Map();
  }
}

function writeCartQuantities(quantities: Map<string, number>) {
  try {
    sessionStorage.setItem(CART_QUANTITIES_STORAGE_KEY, JSON.stringify([...quantities]));
  } catch {
    // Per-tab quantities only prevent reload flicker; ignore storage failures.
  }
}

type CartUiStore = {
  quantities: Map<string, number>;
  totalPrice: number;
  totalCount: number;
  hasStoredSummary: boolean;
  bundleData: Map<string, BundleThreshold[]>;
  isLoading: boolean;
  toast: string | null;
  applyQuantities: (next: Map<string, number>) => void;
  applyTotals: (next: CartTotals) => void;
  applyVisibleCart: (cart: Pick<CartData, "items" | "totalPrice" | "totalCount">) => void;
  registerBundleDataBatch: (entries: ReadonlyArray<readonly [string, BundleThreshold[]]>) => void;
  setIsLoading: (isLoading: boolean) => void;
  setToast: (toast: string | null) => void;
};

export function quantitiesFromCart(cart: Pick<CartData, "items">): Map<string, number> {
  return new Map(cart.items.map((item) => [item.productId, item.quantity]));
}

const initialCartSummary = readCartSummary();
const initialQuantities = readCartQuantities();

export const cartUiStore = createStore<CartUiStore>({
  quantities: initialQuantities,
  totalPrice: initialCartSummary.totalPrice,
  totalCount: initialCartSummary.totalCount,
  hasStoredSummary: initialCartSummary.hasStoredSummary,
  bundleData: new Map(),
  isLoading: true,
  toast: null,
  applyQuantities: (next) => {
    const quantities = new Map(next);
    writeCartQuantities(quantities);
    cartUiStore.setState((state) => ({ ...state, quantities }));
  },
  applyTotals: (next) => {
    writeCartSummary(next);
    cartUiStore.setState((state) => ({
      ...state,
      totalPrice: next.totalPrice,
      totalCount: next.totalCount,
      hasStoredSummary: true,
    }));
  },
  applyVisibleCart: (cart) => {
    const quantities = quantitiesFromCart(cart);
    writeCartSummary(cart);
    writeCartQuantities(quantities);
    cartUiStore.setState((state) => ({
      ...state,
      quantities,
      totalPrice: cart.totalPrice,
      totalCount: cart.totalCount,
      hasStoredSummary: true,
    }));
  },
  registerBundleDataBatch: (entries) => {
    if (entries.length === 0) return;
    cartUiStore.setState((state) => {
      let next: Map<string, BundleThreshold[]> | null = null;
      for (const [productId, thresholds] of entries) {
        if (thresholds.length === 0 || state.bundleData.has(productId) || next?.has(productId)) {
          continue;
        }
        next ??= new Map(state.bundleData);
        next.set(productId, thresholds);
      }
      return next ? { ...state, bundleData: next } : state;
    });
  },
  setIsLoading: (isLoading) => cartUiStore.setState((state) => ({ ...state, isLoading })),
  setToast: (toast) => cartUiStore.setState((state) => ({ ...state, toast })),
});

export function useCartUiStore<TSelected>(selector: (state: CartUiStore) => TSelected): TSelected {
  return useSelector(cartUiStore, selector);
}
