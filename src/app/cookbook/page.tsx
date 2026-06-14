"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { BookmarkIcon } from "@/components/bookmark-icon";
import { CategoryDropdown } from "@/components/category-dropdown";
import { RecipeSearchInput } from "@/components/recipe-search-input";
import { ErrorView } from "@/components/error-view";
import { LoadingSpinner } from "@/components/loading-spinner";
import { RecipeCard } from "@/components/recipe-card";
import { SharedHeader } from "@/components/shared-header";
import { useTranslations } from "@/contexts/country-context";
import { usePageTitle } from "@/hooks/use-page-title";
import { TOKEN_EXPIRED_REDIRECT } from "@/lib/constants";
import { DEBOUNCE_DELAY_MS } from "@/lib/types";
import type { ApiErrorResponse, CookbookApiResponse, RecipeCategory, RecipeItem } from "@/lib/types";

const PAGE_SIZE = 24;
const VIEW_CACHE_TTL_MS = 15 * 60 * 1000;
const VIEW_CACHE_MAX_ENTRIES = 10;

type RecipesState =
  | { status: "loading" }
  | { status: "success"; recipes: RecipeItem[] }
  | { status: "error"; message: string };

type SearchScope = "current" | "all";

type CachedCookbookView = {
  recipes: RecipeItem[];
  categories?: RecipeCategory[];
  expiresAt: number;
};

export default function CookbookPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageTitle(t.cookbookTitle);

  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [retryCount, setRetryCount] = useState(0);
  const [recipesState, setRecipesState] = useState<RecipesState>({ status: "loading" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(() => new Set());
  const [savingRecipeIds, setSavingRecipeIds] = useState<Set<string>>(() => new Set());
  const [lastBrowseCategory, setLastBrowseCategory] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewCacheRef = useRef<Map<string, CachedCookbookView>>(new Map());

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rememberView = useCallback(
    (key: string, view: Omit<CachedCookbookView, "expiresAt">) => {
      const cache = viewCacheRef.current;
      cache.delete(key);
      cache.set(key, { ...view, expiresAt: Date.now() + VIEW_CACHE_TTL_MS });

      while (cache.size > VIEW_CACHE_MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        cache.delete(oldestKey);
      }
    },
    []
  );

  // Fetch saved recipe ids once so recipe cards can show their saved state.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cookbook?category=__saved__", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: CookbookApiResponse & Partial<ApiErrorResponse>) => {
        if ("error" in data && data.error) return;
        const savedRecipes = data.recipes ?? [];
        setSavedRecipeIds(new Set(savedRecipes.map((recipe) => recipe.id)));
        setCategoryCounts((prev) => ({ ...prev, __saved__: savedRecipes.length }));
        rememberView("__saved__", { recipes: savedRecipes });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [rememberView]);

  const hasActiveQuery = debouncedQuery.length > 0;
  const useGlobalSearch = hasActiveQuery && searchScope === "all";
  const recipesUrl = useGlobalSearch
    ? `/api/cookbook/search?q=${encodeURIComponent(debouncedQuery)}`
    : selectedCategory
      ? `/api/cookbook?category=${encodeURIComponent(selectedCategory)}`
      : "/api/cookbook";
  const viewCacheKey = useGlobalSearch ? null : (selectedCategory ?? "__featured__");

  // Fetch recipes. Global search hits the search endpoint; scoped search filters the loaded view.
  useEffect(() => {
    if (viewCacheKey) {
      const cached = viewCacheRef.current.get(viewCacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (cached.categories?.length) setCategories(cached.categories);
        setRecipesState({ status: "success", recipes: cached.recipes });
        setVisibleCount(PAGE_SIZE);
        return;
      }
      if (cached) viewCacheRef.current.delete(viewCacheKey);
    }

    const controller = new AbortController();

    fetch(recipesUrl, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: CookbookApiResponse & Partial<ApiErrorResponse>) => {
        if ("error" in data && data.error) {
          if (data.code === "TOKEN_EXPIRED") {
            window.location.href = TOKEN_EXPIRED_REDIRECT;
            return;
          }
          setRecipesState({ status: "error", message: data.error });
          return;
        }
        if (data.categories?.length) setCategories(data.categories);
        const recipes = Array.isArray(data.recipes) ? data.recipes : [];
        if (!useGlobalSearch) {
          const countKey = selectedCategory ?? "__featured__";
          setCategoryCounts((prev) => ({ ...prev, [countKey]: recipes.length }));
        }
        if (selectedCategory === "__saved__" && !useGlobalSearch) {
          setSavedRecipeIds(new Set(recipes.map((recipe) => recipe.id)));
        }
        if (viewCacheKey) {
          rememberView(viewCacheKey, {
            recipes,
            categories: data.categories?.length ? data.categories : undefined,
          });
        }
        setRecipesState({ status: "success", recipes });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setRecipesState({ status: "error", message: t.cookbookLoadError });
      });

    return () => controller.abort();
  }, [
    recipesUrl,
    retryCount,
    rememberView,
    selectedCategory,
    t.cookbookLoadError,
    useGlobalSearch,
    viewCacheKey,
  ]);

  // Infinite scroll: reveal PAGE_SIZE more recipes when sentinel enters viewport
  const loadedRecipes = recipesState.status === "success" ? recipesState.recipes : [];
  const recipesForDisplay =
    hasActiveQuery && !useGlobalSearch
      ? loadedRecipes.filter((recipe) =>
          recipe.name.toLowerCase().includes(debouncedQuery.toLowerCase())
        )
      : loadedRecipes;

  useEffect(() => {
    if (recipesForDisplay.length === 0) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, recipesForDisplay.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [recipesForDisplay.length]);

  const handleBack = useCallback(() => router.push("/"), [router]);

  const handleRetry = useCallback(() => {
    setRecipesState({ status: "loading" });
    setVisibleCount(PAGE_SIZE);
    setRetryCount((c) => c + 1);
  }, []);

  const handleSelectCategory = useCallback((catId: string | null) => {
    setLastBrowseCategory(catId);
    setSearchScope("all");
    setSelectedCategory(catId);
    setRecipesState({ status: "loading" });
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleSelectSaved = useCallback(() => {
    if (selectedCategory === "__saved__" && !searchInput && !debouncedQuery) {
      setSelectedCategory(lastBrowseCategory);
      setRecipesState({ status: "loading" });
      setVisibleCount(PAGE_SIZE);
      return;
    }

    setSearchInput("");
    setDebouncedQuery("");
    setSearchScope("all");
    setSelectedCategory("__saved__");
    setRecipesState({ status: "loading" });
    setVisibleCount(PAGE_SIZE);
  }, [debouncedQuery, lastBrowseCategory, searchInput, selectedCategory]);

  const handleSearchScopeChange = useCallback(
    (scope: SearchScope) => {
      if (scope === searchScope) return;
      setSearchScope(scope);
      setVisibleCount(PAGE_SIZE);
      if (debouncedQuery) setRecipesState({ status: "loading" });
    },
    [debouncedQuery, searchScope]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      setVisibleCount(PAGE_SIZE);
      if (searchScope === "all") {
        setRecipesState({ status: "loading" });
      }
    },
    [searchScope]
  );

  const handleToggleSaved = useCallback(
    async (recipe: RecipeItem) => {
      const wasSaved = savedRecipeIds.has(recipe.id);
      const nextSaved = !wasSaved;

      viewCacheRef.current.delete("__saved__");
      setSavingRecipeIds((prev) => new Set(prev).add(recipe.id));
      setSavedRecipeIds((prev) => {
        const next = new Set(prev);
        if (nextSaved) next.add(recipe.id);
        else next.delete(recipe.id);
        return next;
      });
      setCategoryCounts((prev) => ({
        ...prev,
        __saved__: Math.max(0, (prev.__saved__ ?? 0) + (nextSaved ? 1 : -1)),
      }));

      if (wasSaved && selectedCategory === "__saved__") {
        setRecipesState((prev) =>
          prev.status === "success"
            ? { status: "success", recipes: prev.recipes.filter((item) => item.id !== recipe.id) }
            : prev
        );
      }

      try {
        const response = await fetch(`/api/recipe/${encodeURIComponent(recipe.id)}/saved`, {
          method: nextSaved ? "POST" : "DELETE",
        });
        const data = (await response.json()) as Partial<ApiErrorResponse>;
        if (data.code === "TOKEN_EXPIRED") {
          window.location.href = TOKEN_EXPIRED_REDIRECT;
          return;
        }
        if (!response.ok || data.error) {
          throw new Error(data.error ?? t.recipeSaveError);
        }
      } catch {
        setSavedRecipeIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(recipe.id);
          else next.delete(recipe.id);
          return next;
        });
        setCategoryCounts((prev) => ({
          ...prev,
          __saved__: Math.max(0, (prev.__saved__ ?? 0) + (nextSaved ? -1 : 1)),
        }));
        setRecipesState({ status: "error", message: t.recipeSaveError });
      } finally {
        setSavingRecipeIds((prev) => {
          const next = new Set(prev);
          next.delete(recipe.id);
          return next;
        });
      }
    },
    [savedRecipeIds, selectedCategory, t.recipeSaveError]
  );

  const visibleRecipes = recipesForDisplay.slice(0, visibleCount);
  const recipeCountLabel = recipesForDisplay.length === 1 ? t.recipeSingular : t.recipePlural;
  const resultCountLabel = recipesForDisplay.length === 1 ? t.resultSingular : t.resultPlural;
  const resultSummary = debouncedQuery
    ? `${recipesForDisplay.length} ${resultCountLabel} ${t.resultFor} "${debouncedQuery}"`
    : `${recipesForDisplay.length} ${recipeCountLabel}`;
  const currentScopeLabel =
    selectedCategory === "__saved__"
      ? t.cookbookSearchScopeSaved
      : selectedCategory === null
        ? t.cookbookSearchScopeFeatured
        : t.cookbookSearchScopeCategory;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SharedHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {/* Header row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="text-text-muted hover:text-foreground shrink-0 text-sm transition-colors"
          >
            ← {t.backButton}
          </button>
          <h1 className="text-foreground text-xl font-bold">{t.cookbookTitle}</h1>
          <button
            type="button"
            onClick={handleSelectSaved}
            className={`focus:ring-picnic-red ml-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors focus:ring-2 focus:outline-none ${
              selectedCategory === "__saved__" && !debouncedQuery
                ? "border-picnic-red bg-red-50 text-picnic-red"
                : "border-gray-200 bg-white text-foreground hover:border-gray-400"
            }`}
          >
            <BookmarkIcon filled={selectedCategory === "__saved__" && !debouncedQuery} />
            <span>{t.cookbookSaved}</span>
            {categoryCounts.__saved__ !== undefined && (
              <span
                className={`text-xs font-medium ${
                  selectedCategory === "__saved__" && !debouncedQuery
                    ? "text-picnic-red/70"
                    : "text-gray-400"
                }`}
              >
                {categoryCounts.__saved__}
              </span>
            )}
          </button>
        </div>

        {/* Controls row: category dropdown + search */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <CategoryDropdown
            options={[
              { id: null, name: t.cookbookFeatured, count: categoryCounts["__featured__"] },
              ...categories.map((c) => ({
                id: c.id as string | null,
                name: c.name,
                section: c.section,
                count: categoryCounts[c.id],
              })),
            ]}
            value={selectedCategory === "__saved__" ? lastBrowseCategory : selectedCategory}
            onChange={handleSelectCategory}
            searchPlaceholder={t.cookbookCategorySearchPlaceholder}
            disabled={useGlobalSearch}
          />
          <RecipeSearchInput
            value={searchInput}
            placeholder={t.cookbookSearchPlaceholder}
            onChange={handleSearchChange}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-text-muted text-sm font-medium">{t.cookbookSearchWithin}</span>
            <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              {[
                { value: "all" as const, label: t.cookbookSearchScopeAll },
                { value: "current" as const, label: currentScopeLabel },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSearchScopeChange(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    searchScope === option.value
                      ? "bg-red-50 text-picnic-red"
                      : "text-text-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {recipesState.status === "loading" && <LoadingSpinner />}

        {recipesState.status === "error" && (
          <ErrorView message={recipesState.message} onRetry={handleRetry} />
        )}

        {recipesState.status === "success" && (
          <p className="text-text-muted mb-3 text-sm">{resultSummary}</p>
        )}

        {recipesState.status === "success" && recipesForDisplay.length === 0 && (
          <p className="text-text-muted text-sm">{t.noRecipes}</p>
        )}

        {recipesState.status === "success" && recipesForDisplay.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isSaved={savedRecipeIds.has(recipe.id)}
                  isSaving={savingRecipeIds.has(recipe.id)}
                  onToggleSaved={handleToggleSaved}
                />
              ))}
            </div>

            {/* Sentinel div: when visible, triggers next batch */}
            {visibleCount < recipesForDisplay.length && (
              <div ref={sentinelRef} className="mt-8 flex justify-center py-4">
                <LoadingSpinner />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
