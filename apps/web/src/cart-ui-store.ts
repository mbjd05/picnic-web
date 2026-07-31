import { create } from "zustand";

import type { BundleThreshold, CartData } from "@/lib/types";

type CartTotals = Pick<CartData, "totalPrice" | "totalCount">;

type CartUiStore = {
  quantities: Map<string, number>;
  totalPrice: number;
  totalCount: number;
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

export const useCartUiStore = create<CartUiStore>((set) => ({
  quantities: new Map(),
  totalPrice: 0,
  totalCount: 0,
  bundleData: new Map(),
  isLoading: true,
  toast: null,
  applyQuantities: (next) => set({ quantities: new Map(next) }),
  applyTotals: (next) => set({ totalPrice: next.totalPrice, totalCount: next.totalCount }),
  applyVisibleCart: (cart) =>
    set({
      quantities: quantitiesFromCart(cart),
      totalPrice: cart.totalPrice,
      totalCount: cart.totalCount,
    }),
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
