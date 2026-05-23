"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { CartToast } from "@/components/cart-toast";
import { CategoryGrid } from "@/components/category-grid";
import { ErrorView } from "@/components/error-view";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ResultsView } from "@/components/results-view";
import { SectionNavBar } from "@/components/section-nav-bar";
import { SharedHeader } from "@/components/shared-header";
import { ShortcutList } from "@/components/shortcut-list";
import { CartProvider } from "@/contexts/cart-context";
import { useTranslations } from "@/contexts/country-context";
import { usePageTitle } from "@/hooks/use-page-title";
import type { CategoryItem, ShortcutItem } from "@/lib/category-types";
import { isApiErrorResponse, readJsonResponse } from "@/lib/client-fetch";
import { TOKEN_EXPIRED_REDIRECT } from "@/lib/constants";
import { parsePageIdFromDeepLink } from "@/lib/parse-deep-link";
import type { ApiErrorResponse, Product, SearchApiResponse, SearchSection } from "@/lib/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | {
      status: "success";
      query: string;
      products: Product[];
      sections: SearchSection[];
    }
  | { status: "error"; query: string; message: string };

type CategoriesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; categories: CategoryItem[]; shortcuts: ShortcutItem[] }
  | { status: "error"; message: string };

async function loadSearchResults(
  query: string,
  fallbackError: string,
  signal?: AbortSignal
): Promise<SearchState> {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    const data = await readJsonResponse<SearchApiResponse>(response, fallbackError);

    if (isApiErrorResponse(data)) {
      if ("code" in data && data.code === "TOKEN_EXPIRED") {
        return { status: "error", query, message: "TOKEN_EXPIRED" };
      }
      return { status: "error", query, message: data.error };
    }

    return {
      status: "success",
      query,
      products: data.products,
      sections: data.sections,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return { status: "error", query, message: fallbackError };
  }
}

async function loadCategories(
  fallbackError: string,
  signal?: AbortSignal
): Promise<CategoriesState> {
  try {
    const response = await fetch("/api/categories", { signal });
    const data = await readJsonResponse<
      {
        categories?: CategoryItem[];
        shortcuts?: ShortcutItem[];
      } & Partial<ApiErrorResponse>
    >(response, fallbackError);

    if (isApiErrorResponse(data)) {
      if (data.code === "TOKEN_EXPIRED") {
        return { status: "error", message: "TOKEN_EXPIRED" };
      }
      return { status: "error", message: data.error };
    }

    return {
      status: "success",
      categories: Array.isArray(data.categories) ? data.categories : [],
      shortcuts: Array.isArray(data.shortcuts) ? data.shortcuts : [],
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return { status: "error", message: fallbackError };
  }
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlQuery = searchParams.get("q") ?? "";

  const [searchState, setSearchState] = useState<SearchState>({
    status: "idle",
  });

  const [categoriesState, setCategoriesState] = useState<CategoriesState>({
    status: "idle",
  });

  const titleContext = searchState.status !== "idle" ? `"${searchState.query}"` : undefined;
  usePageTitle(titleContext);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToastMessage(null), []);

  // Auto-search when the page loads with ?q= or when URL changes (back/forward)
  useEffect(() => {
    const trimmed = urlQuery.trim();
    const controller = new AbortController();
    let cancelled = false;

    async function syncSearchFromUrl() {
      if (!trimmed) {
        if (!cancelled) setSearchState({ status: "idle" });
        return;
      }

      setSearchState({ status: "loading", query: trimmed });

      try {
        const result = await loadSearchResults(trimmed, t.searchError, controller.signal);
        if (cancelled) return;
        if (result.status === "error" && result.message === "TOKEN_EXPIRED") {
          window.location.href = TOKEN_EXPIRED_REDIRECT;
          return;
        }
        setSearchState(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    void syncSearchFromUrl();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [t.searchError, urlQuery]);

  // Fetch categories when idle — use a ref to prevent re-triggering on status changes
  const categoriesFetchedRef = useRef(false);
  useEffect(() => {
    if (searchState.status !== "idle") return;
    if (categoriesFetchedRef.current) return;

    categoriesFetchedRef.current = true;
    const controller = new AbortController();

    async function fetchIdleCategories() {
      setCategoriesState({ status: "loading" });

      try {
        const result = await loadCategories(t.categoriesLoadError, controller.signal);
        if (result.status === "error" && result.message === "TOKEN_EXPIRED") {
          window.location.href = TOKEN_EXPIRED_REDIRECT;
          return;
        }
        setCategoriesState(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    void fetchIdleCategories();

    return () => {
      controller.abort();
    };
  }, [searchState.status, t.categoriesLoadError]);

  const handleCategoryTap = useCallback(
    (category: CategoryItem) => {
      router.push(`/categories/${encodeURIComponent(category.id)}`);
    },
    [router]
  );

  const handleShortcutTap = useCallback(
    (shortcut: ShortcutItem) => {
      const pageId = parsePageIdFromDeepLink(shortcut.deepLinkTarget);
      if (!pageId) {
        return;
      }
      if (pageId.startsWith("meals-page-root")) {
        router.push("/cookbook");
        return;
      }
      const params = new URLSearchParams({ pageId, title: shortcut.name });
      router.push(`/pages?${params.toString()}`);
    },
    [router]
  );

  const handleSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (trimmed === "") {
        setSearchState({ status: "idle" });
        router.push("/");
        return;
      }
      const currentQ = new URLSearchParams(window.location.search).get("q") ?? "";
      if (currentQ !== trimmed) {
        router.push(`/?q=${encodeURIComponent(trimmed)}`);
      }

      setSearchState({ status: "loading", query: trimmed });

      try {
        const result = await loadSearchResults(trimmed, t.searchError);
        if (result.status === "error" && result.message === "TOKEN_EXPIRED") {
          window.location.href = TOKEN_EXPIRED_REDIRECT;
          return;
        }
        setSearchState(result);
      } catch {
        setSearchState({ status: "error", query: trimmed, message: t.searchError });
      }
    },
    [router, t.searchError]
  );

  return (
    <CartProvider showToast={setToastMessage}>
      <div className="flex min-h-full flex-1 flex-col">
        <SharedHeader
          onSearch={handleSearch}
          bottomBar={
            searchState.status === "success" && searchState.sections.length > 0 ? (
              <SectionNavBar sections={searchState.sections} />
            ) : undefined
          }
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          {searchState.status === "idle" && (
            <CategoryBrowser
              categoriesState={categoriesState}
              onCategoryTap={handleCategoryTap}
              onShortcutTap={handleShortcutTap}
            />
          )}
          {searchState.status === "loading" && <LoadingSpinner />}
          {searchState.status === "error" && <ErrorView message={searchState.message} />}
          {searchState.status === "success" && (
            <ResultsView
              query={searchState.query}
              products={searchState.products}
              sections={searchState.sections}
            />
          )}
        </main>

        <CartToast message={toastMessage} onDismiss={dismissToast} />
      </div>
    </CartProvider>
  );
}

// ─── Category browser sub-view ───────────────────────────────────────────────

type CategoryBrowserProps = {
  categoriesState: CategoriesState;
  onCategoryTap: (category: CategoryItem) => void;
  onShortcutTap: (shortcut: ShortcutItem) => void;
};

function CategoryBrowser({ categoriesState, onCategoryTap, onShortcutTap }: CategoryBrowserProps) {
  if (categoriesState.status === "loading") return <LoadingSpinner />;
  if (categoriesState.status === "error") {
    return <ErrorView message={categoriesState.message} />;
  }
  if (categoriesState.status !== "success") return null;

  return (
    <>
      <ShortcutList shortcuts={categoriesState.shortcuts} onShortcutTap={onShortcutTap} />
      <CategoryGrid categories={categoriesState.categories} onCategoryTap={onCategoryTap} />
    </>
  );
}
