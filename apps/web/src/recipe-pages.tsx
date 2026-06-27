/* eslint-disable @next/next/no-img-element -- Vite has no Next Image component. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { Link, useNavigate, useParams } from "@tanstack/react-router";

import { NutritionTable } from "@/components/nutrition-table";
import { formatEuroPrice } from "@/lib/format-price";
import { getTranslations } from "@/lib/i18n";
import { buildImageUrl, buildRecipeImageUrl } from "@/lib/image-url";
import { getRecipeIngredientCount } from "@/lib/recipe-quantity";
import { renderMarkdownBold } from "@/lib/render-markdown-bold";
import { DEBOUNCE_DELAY_MS } from "@/lib/types";
import type {
  ApiErrorResponse,
  AllergenInfo,
  CookbookApiResponse,
  CountryCode,
  RecipeCategory,
  RecipeDetail,
  RecipeIngredient,
  RecipeItem,
} from "@/lib/types";

import { ErrorView, LoadingView, useDocumentTitle } from "./browsing-components";
import { useCart } from "./cart-context";
import { useCountryCode } from "./country-context";

const PAGE_SIZE = 24;
const VIEW_CACHE_TTL_MS = 15 * 60 * 1000;
const VIEW_CACHE_MAX_ENTRIES = 10;
const PLACEHOLDER = "/placeholder-product.svg";

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

function isApiError(value: unknown): value is ApiErrorResponse {
  return typeof value === "object" && value !== null && "error" in value;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T | ApiErrorResponse;
  if (!response.ok || isApiError(data)) throw new Error(isApiError(data) ? data.error : "Request failed");
  return data as T;
}

export function CookbookPage() {
  const countryCode = useCountryCode();
  const t = getTranslations(countryCode);
  const navigate = useNavigate();
  useDocumentTitle(t.cookbookTitle);

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rememberView = useCallback((key: string, view: Omit<CachedCookbookView, "expiresAt">) => {
    const cache = viewCacheRef.current;
    cache.delete(key);
    cache.set(key, { ...view, expiresAt: Date.now() + VIEW_CACHE_TTL_MS });
    while (cache.size > VIEW_CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cookbook?category=__saved__", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: CookbookApiResponse & Partial<ApiErrorResponse>) => {
        if (data.error) return;
        const saved = data.recipes ?? [];
        setSavedRecipeIds(new Set(saved.map((recipe) => recipe.id)));
        setCategoryCounts((current) => ({ ...current, __saved__: saved.length }));
        rememberView("__saved__", { recipes: saved });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
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
      .then((response) => response.json())
      .then((data: CookbookApiResponse & Partial<ApiErrorResponse>) => {
        if (data.error) {
          setRecipesState({ status: "error", message: data.error });
          return;
        }
        if (data.categories?.length) setCategories(data.categories);
        const recipes = Array.isArray(data.recipes) ? data.recipes : [];
        if (!useGlobalSearch) {
          const key = selectedCategory ?? "__featured__";
          setCategoryCounts((current) => ({ ...current, [key]: recipes.length }));
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
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRecipesState({ status: "error", message: t.cookbookLoadError });
      });
    return () => controller.abort();
  }, [recipesUrl, retryCount, rememberView, selectedCategory, t.cookbookLoadError, useGlobalSearch, viewCacheKey]);

  const loadedRecipes = recipesState.status === "success" ? recipesState.recipes : [];
  const recipesForDisplay =
    hasActiveQuery && !useGlobalSearch
      ? loadedRecipes.filter((recipe) => recipe.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
      : loadedRecipes;

  useEffect(() => {
    if (recipesForDisplay.length === 0) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount((count) => Math.min(count + PAGE_SIZE, recipesForDisplay.length));
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [recipesForDisplay.length]);

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

  const handleToggleSaved = useCallback(
    async (recipe: RecipeItem) => {
      const wasSaved = savedRecipeIds.has(recipe.id);
      const nextSaved = !wasSaved;
      viewCacheRef.current.delete("__saved__");
      setSavingRecipeIds((current) => new Set(current).add(recipe.id));
      setSavedRecipeIds((current) => {
        const next = new Set(current);
        if (nextSaved) next.add(recipe.id);
        else next.delete(recipe.id);
        return next;
      });
      setCategoryCounts((current) => ({
        ...current,
        __saved__: Math.max(0, (current.__saved__ ?? 0) + (nextSaved ? 1 : -1)),
      }));
      if (wasSaved && selectedCategory === "__saved__") {
        setRecipesState((current) =>
          current.status === "success"
            ? { status: "success", recipes: current.recipes.filter((item) => item.id !== recipe.id) }
            : current
        );
      }
      try {
        const response = await fetch(`/api/recipe/${encodeURIComponent(recipe.id)}/saved`, {
          method: nextSaved ? "POST" : "DELETE",
        });
        if (!response.ok) throw new Error(t.recipeSaveError);
      } catch {
        setSavedRecipeIds((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(recipe.id);
          else next.delete(recipe.id);
          return next;
        });
        setRecipesState({ status: "error", message: t.recipeSaveError });
      } finally {
        setSavingRecipeIds((current) => {
          const next = new Set(current);
          next.delete(recipe.id);
          return next;
        });
      }
    },
    [savedRecipeIds, selectedCategory, t.recipeSaveError]
  );

  const visibleRecipes = recipesForDisplay.slice(0, visibleCount);
  const resultSummary = debouncedQuery
    ? `${recipesForDisplay.length} ${recipesForDisplay.length === 1 ? t.resultSingular : t.resultPlural} ${t.resultFor} "${debouncedQuery}"`
    : `${recipesForDisplay.length} ${recipesForDisplay.length === 1 ? t.recipeSingular : t.recipePlural}`;
  const currentScopeLabel =
    selectedCategory === "__saved__"
      ? t.cookbookSearchScopeSaved
      : selectedCategory === null
        ? t.cookbookSearchScopeFeatured
        : t.cookbookSearchScopeCategory;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void navigate({ to: "/", search: {} })} className="text-text-muted hover:text-foreground shrink-0 text-sm transition-colors">
          ← {t.backButton}
        </button>
        <h1 className="text-foreground text-xl font-bold">{t.cookbookTitle}</h1>
        <button
          type="button"
          onClick={handleSelectSaved}
          className={`ml-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
            selectedCategory === "__saved__" && !debouncedQuery
              ? "border-picnic-red bg-red-50 text-picnic-red"
              : "border-gray-200 bg-white text-foreground hover:border-gray-400"
          }`}
        >
          <BookmarkIcon filled={selectedCategory === "__saved__" && !debouncedQuery} />
          <span>{t.cookbookSaved}</span>
          {categoryCounts.__saved__ !== undefined ? <span className="text-xs text-gray-400">{categoryCounts.__saved__}</span> : null}
        </button>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <CategoryDropdown
          options={[
            { id: null, name: t.cookbookFeatured, count: categoryCounts.__featured__ },
            ...categories.map((category) => ({
              id: category.id as string | null,
              name: category.name,
              section: category.section,
              count: categoryCounts[category.id],
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
          onChange={(value) => {
            setSearchInput(value);
            setVisibleCount(PAGE_SIZE);
            if (searchScope === "all") setRecipesState({ status: "loading" });
          }}
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
                onClick={() => {
                  setSearchScope(option.value);
                  setVisibleCount(PAGE_SIZE);
                  if (debouncedQuery) setRecipesState({ status: "loading" });
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  searchScope === option.value ? "bg-red-50 text-picnic-red" : "text-text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {recipesState.status === "loading" ? <LoadingView /> : null}
      {recipesState.status === "error" ? (
        <ErrorView
          message={recipesState.message}
          onRetry={() => {
            setRecipesState({ status: "loading" });
            setVisibleCount(PAGE_SIZE);
            setRetryCount((count) => count + 1);
          }}
        />
      ) : null}
      {recipesState.status === "success" ? <p className="text-text-muted mb-3 text-sm">{resultSummary}</p> : null}
      {recipesState.status === "success" && recipesForDisplay.length === 0 ? <p className="text-text-muted text-sm">{t.noRecipes}</p> : null}
      {recipesState.status === "success" && recipesForDisplay.length > 0 ? (
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
          {visibleCount < recipesForDisplay.length ? (
            <div ref={sentinelRef} className="mt-8 flex justify-center py-4">
              <LoadingView />
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function RecipeCard({
  recipe,
  isSaved,
  isSaving,
  onToggleSaved,
}: {
  recipe: RecipeItem;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSaved: (recipe: RecipeItem) => void;
}) {
  const countryCode = useCountryCode();
  const t = getTranslations(countryCode);
  const [imageSrc, setImageSrc] = useState(recipe.imageId ? buildRecipeImageUrl(recipe.imageId, countryCode) : PLACEHOLDER);
  return (
    <div className="group relative h-full">
      <div className="border-card-border bg-card-bg flex h-full flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative h-40 w-full bg-gray-50">
          <img src={imageSrc} alt={recipe.name} loading="lazy" className="h-full w-full object-cover" onError={() => setImageSrc(PLACEHOLDER)} />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="text-text-dark line-clamp-2 text-sm leading-snug font-medium">{recipe.name}</h3>
          {recipe.cookingTimeMinutes !== null ? <p className="text-text-muted text-xs">{recipe.cookingTimeMinutes} {t.cookingTimeMinutes}</p> : null}
        </div>
      </div>
      <Link to="/recipe/$id" params={{ id: recipe.id }} className="absolute inset-0 z-10 rounded-lg" aria-label={recipe.name} />
      <button
        type="button"
        onClick={() => onToggleSaved(recipe)}
        disabled={isSaving}
        className={`absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white active:opacity-70 disabled:opacity-50 ${isSaved ? "text-picnic-red" : "text-text-muted"}`}
        aria-label={isSaved ? t.unsaveRecipe : t.saveRecipe}
      >
        <BookmarkIcon filled={isSaved} />
      </button>
    </div>
  );
}

type Option = { id: string | null; name: string; section?: string; count?: number };

function CategoryDropdown({
  options,
  value,
  onChange,
  searchPlaceholder,
  disabled,
}: {
  options: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
  searchPlaceholder: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value) ?? options[0];
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? options.filter((option) => [option.name, option.section ?? ""].some((text) => text.toLowerCase().includes(normalized)))
    : options;
  return (
    <div className="relative inline-block min-w-48">
      <button
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${disabled ? "cursor-not-allowed opacity-40" : "hover:border-gray-400"}`}
      >
        <span className="text-foreground truncate">{selected.name}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-picnic-red" />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.map((option, index) => {
              const previous = filtered[index - 1];
              const showSection = option.section && option.section !== previous?.section;
              const isSelected = option.id === value;
              return (
                <li key={option.id ?? "__featured__"}>
                  {showSection ? <div className="text-text-muted px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">{option.section}</div> : null}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${isSelected ? "bg-red-50 font-semibold text-picnic-red" : "text-foreground hover:bg-gray-50"}`}
                  >
                    <span>{option.name}</span>
                    {option.count !== undefined ? <span className="ml-2 text-xs text-gray-400">{option.count}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RecipeSearchInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="relative flex-1 sm:max-w-xs">
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-4 pl-4 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-picnic-red focus:ring-2 focus:ring-picnic-red focus:outline-none" />
    </div>
  );
}

function BookmarkIcon({ filled, className = "h-5 w-5" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d="M5.75 3.5h8.5v13l-4.25-2.7-4.25 2.7v-13Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

type RecipePageState = { status: "loading" } | { status: "success"; recipe: RecipeDetail } | { status: "error"; message: string };
type AddState = "idle" | "adding" | "done";

export function RecipeDetailPage() {
  const { id } = useParams({ from: "/authenticated/recipe/$id" });
  const t = getTranslations(useCountryCode());
  const countryCode = useCountryCode();
  const { refresh } = useCart();
  const [pageState, setPageState] = useState<RecipePageState>({ status: "loading" });
  const [portions, setPortions] = useState(2);
  const [confirmedPortions, setConfirmedPortions] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [addState, setAddState] = useState<AddState>("idle");
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  useDocumentTitle(pageState.status === "success" ? pageState.recipe.name : t.cookbookTitle);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/recipe/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(readJson<RecipeDetail>)
      .then((recipe) => {
        const p = recipe.portions ?? 2;
        setConfirmedPortions(p);
        setPortions(p);
        setPageState({ status: "success", recipe });
        setCheckedIds(new Set(recipe.ingredients.filter((ingredient) => !ingredient.isCondiment).map((ingredient) => ingredient.id)));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPageState({ status: "error", message: error instanceof Error ? error.message : t.recipeLoadError });
      });
    return () => controller.abort();
  }, [id, t.recipeLoadError]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cookbook?category=__saved__", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { recipes?: { id: string }[] }) => setIsSaved(Boolean(data.recipes?.some((recipe) => recipe.id === id))))
      .catch(() => undefined);
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (pageState.status !== "success" || confirmedPortions === null || confirmedPortions === portions) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/recipe/${encodeURIComponent(id)}?portions=${portions}`, { signal: controller.signal })
        .then(readJson<RecipeDetail>)
        .then((fetched) => {
          setConfirmedPortions(portions);
          setPageState((current) =>
            current.status === "success"
              ? {
                  status: "success",
                  recipe: {
                    ...current.recipe,
                    portions: fetched.portions,
                    ingredients: fetched.ingredients,
                    steps: fetched.steps,
                    stepsPortionWarning: fetched.stepsPortionWarning,
                    recipeNutritionRows: fetched.recipeNutritionRows,
                  },
                }
              : current
          );
          setCheckedIds(new Set(fetched.ingredients.filter((ingredient) => !ingredient.isCondiment).map((ingredient) => ingredient.id)));
        })
        .catch(() => undefined);
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [confirmedPortions, id, pageState.status, portions]);

  const handleToggleSaved = useCallback(async () => {
    if (isSavingRecipe) return;
    const nextSaved = !isSaved;
    setIsSavingRecipe(true);
    setIsSaved(nextSaved);
    try {
      const response = await fetch(`/api/recipe/${encodeURIComponent(id)}/saved`, { method: nextSaved ? "POST" : "DELETE" });
      if (!response.ok) throw new Error(t.recipeSaveError);
    } catch {
      setIsSaved(!nextSaved);
    } finally {
      setIsSavingRecipe(false);
    }
  }, [id, isSaved, isSavingRecipe, t.recipeSaveError]);

  if (pageState.status === "loading") return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8"><LoadingView /></main>;
  if (pageState.status === "error") return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8"><ErrorView message={pageState.message} onRetry={() => setPageState({ status: "loading" })} /></main>;

  const { recipe } = pageState;
  const mainIngredients = recipe.ingredients.filter((ingredient) => !ingredient.isCondiment);
  const condiments = recipe.ingredients.filter((ingredient) => ingredient.isCondiment);
  const refreshing = confirmedPortions !== null && confirmedPortions !== portions;
  const pricePortions = refreshing ? (confirmedPortions ?? portions) : portions;
  const totalCents = mainIngredients.reduce((sum, ingredient) => {
    const qty = getRecipeIngredientCount(ingredient, pricePortions, recipe.portions);
    const bundleTier = ingredient.priceRanges?.filter((tier) => tier.quantity <= qty).at(-1);
    return sum + (bundleTier ? bundleTier.pricePerUnit : ingredient.displayPrice) * qty;
  }, 0);
  const pricePerServing = pricePortions > 0 ? formatEuroPrice(Math.round(totalCents / pricePortions)) : null;
  const buttonLabel = addState === "adding" ? t.recipeAddingToCart : addState === "done" ? t.recipeAddedToCart : t.recipeAddToCart;

  async function handleAddToCart() {
    if (addState !== "idle") return;
    setAddState("adding");
    const selectedIngredients = recipe.ingredients.filter((ingredient) => checkedIds.has(ingredient.id)).map((ingredient) => ({
      id: ingredient.id,
      count: getRecipeIngredientCount(ingredient, portions, recipe.portions),
    }));
    try {
      const response = await fetch(`/api/recipe/${encodeURIComponent(id)}/add-to-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portions, selectedIngredients }),
      });
      if (!response.ok) throw new Error("failed");
      refresh();
      setAddState("done");
      setTimeout(() => setAddState("idle"), 2500);
    } catch {
      setAddState("idle");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <Link to="/cookbook" className="text-text-muted hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm transition-colors">← {t.cookbookTitle}</Link>
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gray-50">
        {recipe.imageId ? <RecipeHeroImage imageId={recipe.imageId} countryCode={countryCode} alt={recipe.name} /> : <div className="aspect-video w-full bg-gray-100" />}
        <button type="button" onClick={() => void handleToggleSaved()} disabled={isSavingRecipe} className={`absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-sm ${isSaved ? "text-picnic-red" : "text-text-muted"}`} aria-label={isSaved ? t.unsaveRecipe : t.saveRecipe}>
          <BookmarkIcon filled={isSaved} />
        </button>
      </div>
      <h1 className="text-foreground mb-3 text-2xl font-bold">{recipe.name}</h1>
      <div className="text-text-muted mb-6 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          {t.recipePortions}: <button type="button" onClick={() => setPortions((p) => Math.max(1, p - 1))} className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs">−</button>
          <span className="text-foreground mx-1 font-medium">{portions}</span>
          <button type="button" onClick={() => setPortions((p) => p + 1)} className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs">+</button>
        </span>
        {pricePerServing ? <span className={refreshing ? "opacity-40" : ""}><span className="text-foreground font-medium">{pricePerServing}</span> <span className="text-gray-400">{t.recipePricePerServing}</span><span className="mx-1.5 text-gray-300">·</span><span className="text-foreground font-medium">{formatEuroPrice(totalCents)}</span> <span className="text-gray-400">{t.recipePriceTotal}</span>{recipe.cookingTimeMinutes !== null ? <><span className="mx-1.5 text-gray-300">·</span><span>{recipe.cookingTimeMinutes} {t.cookingTimeMinutes}</span></> : null}</span> : null}
      </div>
      {mainIngredients.length > 0 ? <button type="button" onClick={() => void handleAddToCart()} disabled={addState !== "idle" || refreshing || checkedIds.size === 0} className={`mb-8 w-full rounded-xl px-6 py-3 text-sm font-semibold text-white ${addState === "done" ? "bg-green-500" : "bg-picnic-red hover:bg-red-700 disabled:opacity-60"}`}>{buttonLabel}</button> : null}
      <div className={refreshing ? "pointer-events-none opacity-40" : ""}>
        <IngredientSection title={t.recipeIngredients} ingredients={mainIngredients} portions={pricePortions} basePortion={recipe.portions} checkedIds={checkedIds} setCheckedIds={setCheckedIds} />
        <IngredientSection title={t.recipeCondiments} ingredients={condiments} portions={pricePortions} basePortion={recipe.portions} checkedIds={checkedIds} setCheckedIds={setCheckedIds} muted />
        {recipe.steps.length > 0 ? <section className="mb-6"><h2 className="text-foreground mb-3 text-base font-semibold">{t.recipeSteps}</h2>{recipe.stepsPortionWarning ? <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">{recipe.stepsPortionWarning}</p> : null}<ol className="space-y-4">{recipe.steps.map((step, index) => <li key={index} className="flex gap-3"><span className="bg-picnic-red mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">{index + 1}</span><p className="text-text-dark text-sm leading-relaxed">{renderMarkdownBold(step)}</p></li>)}</ol></section> : null}
        {recipe.recipeNutritionRows.length > 0 ? <section className="mb-6"><h2 className="text-foreground mb-2 text-base font-semibold">{t.recipeNutrition}</h2><div className="overflow-hidden rounded-xl border border-gray-200 bg-white"><NutritionTable rows={recipe.recipeNutritionRows} /></div></section> : null}
      </div>
      {recipe.allergens.confirmed.length || recipe.allergens.mayContain.length ? (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <RecipeAllergenBadges allergens={recipe.allergens} confirmedLabel={t.recipeAllergens} mayContainLabel={t.recipeMayContain} />
        </section>
      ) : null}
    </main>
  );
}

function RecipeHeroImage({ imageId, countryCode, alt }: { imageId: string; countryCode: CountryCode; alt: string }) {
  const [show, setShow] = useState(true);
  if (!show) return <div className="aspect-video w-full bg-gray-100" />;
  return <img src={buildRecipeImageUrl(imageId, countryCode)} alt={alt} className="aspect-video w-full object-cover" onError={() => setShow(false)} />;
}

function RecipeAllergenBadges({
  allergens,
  confirmedLabel,
  mayContainLabel,
}: {
  allergens: AllergenInfo;
  confirmedLabel: string;
  mayContainLabel: string;
}) {
  const sections = [
    { label: confirmedLabel, items: allergens.confirmed },
    { label: mayContainLabel, items: allergens.mayContain },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.label}>
          <h2 className="text-foreground mb-2 text-base font-semibold">{section.label}</h2>
          <div className="flex flex-wrap gap-2">
            {section.items.map((allergen) => (
              <span
                key={`${section.label}-${allergen.text}`}
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: allergen.backgroundColor, color: allergen.textColor }}
              >
                {allergen.text}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IngredientSection({
  title,
  ingredients,
  portions,
  basePortion,
  checkedIds,
  setCheckedIds,
  muted = false,
}: {
  title: string;
  ingredients: RecipeIngredient[];
  portions: number;
  basePortion: number;
  checkedIds: Set<string>;
  setCheckedIds: Dispatch<SetStateAction<Set<string>>>;
  muted?: boolean;
}) {
  if (!ingredients.length) return null;
  return (
    <section className="mb-6">
      <h2 className={`${muted ? "text-text-muted text-sm" : "text-foreground text-base"} mb-2 font-semibold`}>{title}</h2>
      <div className={`divide-y divide-gray-100 rounded-xl border ${muted ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"} px-4`}>
        {ingredients.map((ingredient) => (
          <RecipeIngredientRow
            key={ingredient.id}
            ingredient={ingredient}
            qty={getRecipeIngredientCount(ingredient, portions, basePortion)}
            portions={portions}
            basePortion={basePortion}
            checked={checkedIds.has(ingredient.id)}
            onToggle={() =>
              setCheckedIds((current) => {
                const next = new Set(current);
                if (next.has(ingredient.id)) next.delete(ingredient.id);
                else next.add(ingredient.id);
                return next;
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

function RecipeIngredientRow({
  ingredient,
  qty,
  portions,
  basePortion,
  checked,
  onToggle,
}: {
  ingredient: RecipeIngredient;
  qty: number;
  portions: number;
  basePortion: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const countryCode = useCountryCode();
  const [imgSrc, setImgSrc] = useState(ingredient.imageId ? buildImageUrl(ingredient.imageId, countryCode) : PLACEHOLDER);
  const scaledNeeded = ingredient.recipeQuantityText ? scaleNeededText(ingredient.recipeQuantityText, portions, basePortion) : null;
  const packageLabel = qty > 1 ? `${qty} × ${ingredient.recipePackageSize ?? ingredient.unitQuantity}` : ingredient.recipePackageSize ?? ingredient.unitQuantity;
  const title = scaledNeeded ? `${scaledNeeded.replace(/^\((.*)\)$/, "$1").replace(/\s+(nodig|benötigt|benodigd|required)$/i, "")} ${ingredient.name}` : ingredient.name;
  const bundleTier = ingredient.priceRanges?.filter((tier) => tier.quantity <= qty).at(-1);
  const totalPrice = (bundleTier ? bundleTier.pricePerUnit : ingredient.displayPrice) * qty;
  const rawStrike = bundleTier ? ingredient.displayPrice * qty : ingredient.originalPrice !== null ? ingredient.originalPrice * qty : null;
  const strike = rawStrike !== null && rawStrike > totalPrice ? rawStrike : null;
  return (
    <div className={`flex items-center gap-3 py-3 ${strike ? "-mx-4 rounded-lg bg-yellow-50 px-4" : ""}`}>
      <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${checked ? "border-picnic-red bg-picnic-red" : "border-gray-300 bg-white"}`}>{checked ? <span className="text-xs text-white">✓</span> : null}</button>
      <img src={imgSrc} alt={ingredient.name} loading="lazy" className={`h-12 w-12 shrink-0 rounded-lg bg-gray-50 object-contain p-1 ${checked ? "" : "opacity-40"}`} onError={() => setImgSrc(PLACEHOLDER)} />
      <div className={`min-w-0 flex-1 ${checked ? "" : "opacity-40"}`}><p className="text-text-dark line-clamp-2 text-sm font-medium">{title}</p><p className="text-text-muted text-xs">{packageLabel}</p></div>
      <div className={`shrink-0 text-right ${checked ? "" : "opacity-40"}`}><p className={`text-sm font-medium ${strike ? "text-amber-600" : "text-text-dark"}`}>{formatEuroPrice(totalPrice)}</p>{strike ? <p className="text-xs text-gray-400 line-through">{formatEuroPrice(strike)}</p> : null}</div>
    </div>
  );
}

function scaleNeededText(text: string, portions: number, basePortion: number): string {
  if (basePortion === 0) return text;
  const match = /^\((\d+(?:[.,]\d+)?)\s+(.+)\)$/.exec(text);
  if (!match) return text;
  const scaled = (parseFloat(match[1].replace(",", ".")) * portions) / basePortion;
  return `(${Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace(".", ",")} ${match[2]})`;
}
