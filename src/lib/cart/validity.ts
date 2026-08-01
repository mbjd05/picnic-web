import type { CartData } from "@/types/cart";

export type CartQuantityCorrection = {
  productId: string;
  removeCount: number;
};

export function getCartQuantityCorrections(cart: CartData): CartQuantityCorrection[] {
  return cart.items
    .map((item) => ({
      productId: item.productId,
      removeCount: Math.max(0, item.quantity - Math.max(0, item.maxCount)),
    }))
    .filter((correction) => correction.removeCount > 0);
}
