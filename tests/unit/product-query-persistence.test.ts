import { describe, expect, it } from "vitest";

import {
  PRODUCT_BROWSING_CACHE_KEY,
  isFreshProductQueryCache,
  isPersistableProductBrowsingQuery,
} from "../../apps/web/src/lib/product-query-persistence";

describe("product query persistence", () => {
  it("persists only product browsing and navigation query roots", () => {
    expect(isPersistableProductBrowsingQuery(["categories", "NL"])).toBe(true);
    expect(isPersistableProductBrowsingQuery(["subcategories", "fruit", "NL"])).toBe(true);
    expect(isPersistableProductBrowsingQuery(["product-search", "banana", "NL"])).toBe(true);
    expect(isPersistableProductBrowsingQuery(["category-products", "21724", "NL"])).toBe(true);
    expect(isPersistableProductBrowsingQuery(["shortcut-products", "offers", "NL"])).toBe(true);
    expect(isPersistableProductBrowsingQuery(["product-detail", "s1", "NL"])).toBe(true);
    expect(isPersistableProductBrowsingQuery(["cookbook", "view", "__featured__", "NL"])).toBe(
      true
    );
    expect(isPersistableProductBrowsingQuery(["cookbook", "search", "pasta", "NL"])).toBe(true);
    expect(isPersistableProductBrowsingQuery(["recipe-detail", "r1", "default", "NL"])).toBe(true);
  });

  it("does not persist private or fast-changing account data", () => {
    expect(isPersistableProductBrowsingQuery(["cart"])).toBe(false);
    expect(isPersistableProductBrowsingQuery(["payment-profile"])).toBe(false);
    expect(isPersistableProductBrowsingQuery(["deliveries", "current", "NL"])).toBe(false);
    expect(isPersistableProductBrowsingQuery(["cookbook", "saved", "NL"])).toBe(false);
  });

  it("treats persisted entries older than thirty minutes as stale", () => {
    const now = 10_000_000;
    expect(isFreshProductQueryCache(now - 30 * 60 * 1000, now)).toBe(true);
    expect(isFreshProductQueryCache(now - 30 * 60 * 1000 - 1, now)).toBe(false);
  });

  it("versions the cache key when persisted product payload shape changes", () => {
    expect(PRODUCT_BROWSING_CACHE_KEY).toBe("product-browsing-v3-detail-content");
  });
});
