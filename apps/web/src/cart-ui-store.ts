import { create } from "zustand";

import type { BundleThreshold, CartData } from "@/lib/types";

type CartTotals = Pick<CartData, "totalPrice" | "totalCount">;
type StoredCartSummary = CartTotals & { hasStoredSummary: boolean };

const CART_SUMMARY_STORAGE_KEY = "picnic_cart_summary_v1";

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

export const useCartUiStore = create<CartUiStore>((set) => ({
  quantities: new Map(),
  totalPrice: initialCartSummary.totalPrice,
  totalCount: initialCartSummary.totalCount,
  hasStoredSummary: initialCartSummary.hasStoredSummary,
  bundleData: new Map(),
  isLoading: true,
  toast: null,
  applyQuantities: (next) => set({ quantities: new Map(next) }),
  applyTotals: (next) => {
    writeCartSummary(next);
    set({ totalPrice: next.totalPrice, totalCount: next.totalCount, hasStoredSummary: true });
  },
  applyVisibleCart: (cart) => {
    writeCartSummary(cart);
    set({
      quantities: quantitiesFromCart(cart),
      totalPrice: cart.totalPrice,
      totalCount: cart.totalCount,
      hasStoredSummary: true,
    });
  },
  registerBundleDataBatch: (entries) => {
    if (entries.length === 0) return;
    set((state) => {
      let next: Map<string, BundleThreshold[]> | null = null;
      for (const [productId, thresholds] of entries) {
        if (thresholds.length === 0 || state.bundleData.has(productId) || next?.has(productId)) {
          continue;
        }
        next ??= new Map(state.bundleData);
        next.set(productId, thresholds);
      }
      return next ? { bundleData: next } : {};
    });
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  setToast: (toast) => set({ toast }),
}));
