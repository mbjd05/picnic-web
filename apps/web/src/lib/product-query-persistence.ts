import {
  type DehydratedState,
  type Query,
  type QueryClient,
  dehydrate,
  hydrate,
} from "@tanstack/react-query";
import { openDB } from "idb";

const DB_NAME = "picnic-web-product-browsing";
const DB_VERSION = 1;
const STORE_NAME = "query-cache";
export const PRODUCT_BROWSING_CACHE_KEY = "product-browsing-v3-detail-content";
const OLD_PRODUCT_BROWSING_CACHE_KEYS = [
  "product-browsing-v1",
  "product-browsing-v2-fusion-sections",
];
const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const PERSIST_DEBOUNCE_MS = 750;

const PERSISTED_QUERY_ROOTS = new Set([
  "categories",
  "subcategories",
  "product-search",
  "category-products",
  "shortcut-products",
  "product-detail",
  "recipe-detail",
]);

const PERSISTED_COOKBOOK_QUERY_TYPES = new Set(["view", "search"]);

type PersistedProductQueryCache = {
  savedAt: number;
  state: DehydratedState;
};

export function isPersistableProductBrowsingQuery(queryKey: readonly unknown[]): boolean {
  if (typeof queryKey[0] !== "string") return false;
  if (PERSISTED_QUERY_ROOTS.has(queryKey[0])) return true;
  return queryKey[0] === "cookbook" && PERSISTED_COOKBOOK_QUERY_TYPES.has(String(queryKey[1]));
}

export function isFreshProductQueryCache(savedAt: number, now = Date.now()): boolean {
  return now - savedAt <= CACHE_MAX_AGE_MS;
}

export async function installProductQueryPersistence(queryClient: QueryClient): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });

  const persisted = await db.get(STORE_NAME, PRODUCT_BROWSING_CACHE_KEY);
  await Promise.all(OLD_PRODUCT_BROWSING_CACHE_KEYS.map((key) => db.delete(STORE_NAME, key)));
  if (isPersistedProductQueryCache(persisted) && isFreshProductQueryCache(persisted.savedAt)) {
    hydrate(queryClient, persisted.state);
  } else if (persisted) {
    await db.delete(STORE_NAME, PRODUCT_BROWSING_CACHE_KEY);
  }

  let timer: number | null = null;
  const persist = () => {
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === "success" && isPersistableProductBrowsingQuery(query.queryKey),
    });

    void db
      .put(STORE_NAME, { savedAt: Date.now(), state }, PRODUCT_BROWSING_CACHE_KEY)
      .catch(() => undefined);
  };

  queryClient.getQueryCache().subscribe(() => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(persist, PERSIST_DEBOUNCE_MS);
  });
}

function isPersistedProductQueryCache(value: unknown): value is PersistedProductQueryCache {
  return (
    typeof value === "object" &&
    value !== null &&
    "savedAt" in value &&
    "state" in value &&
    typeof value.savedAt === "number"
  );
}
