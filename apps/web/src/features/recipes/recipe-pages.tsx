import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";

import { formatEuroPrice } from "@/lib/format/price";
import { buildRecipeImageUrl } from "@/lib/media/image-url";
import { getRecipeIngredientCount } from "@/lib/recipes/quantity";
import { DEBOUNCE_DELAY_MS } from "@/lib/config/app-constants";
import type { CountryCode } from "@/types/locale";
import type { CookbookApiResponse, RecipeCategory, RecipeDetail, RecipeItem } from "@/types/recipe";

import { ErrorView, LoadingView } from "../../components/page-state";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { useCartActions, useCartToast } from "../../providers/cart-context";
import { useCountryCode, useTranslations } from "../../providers/country-context";
import { useInAppBack } from "../../providers/navigation-history-context";
import { CategoryDropdown } from "./category-dropdown";
import { RecipeAddToCartPanel } from "./recipe-add-to-cart-panel";
import { RecipeCard } from "./recipe-card";
import {
  IngredientSection,
  RecipeAllergenSection,
  RecipeHeroImage,
  RecipeNutritionSection,
} from "./recipe-detail-sections";
import { BookmarkIcon } from "./recipe-icons";
import { RecipeSaveButton } from "./recipe-save-button";
import { RecipeSearchInput } from "./recipe-search-input";
import { RecipeStepsSection } from "./recipe-steps-section";
import { useCookbookSearch, useCookbookView, useSavedRecipes } from "./use-cookbook-query";
import { fetchJson } from "../../lib/api-client";
import { queryGcTime, queryKeys, queryStaleTime } from "../../lib/query-config";

const PAGE_SIZE = 24;
const INITIAL_RECIPE_IMAGE_COUNT = 20;
const BACKGROUND_RECIPE_IMAGE_PRELOAD_LIMIT = 72;
const RECIPE_IMAGE_PRELOAD_CONCURRENCY = 4;
const MAX_LOADED_RECIPE_IMAGE_URLS = 700;
const loadedRecipeImageUrls = new Set<string>();
const pendingRecipeImagePreloads = new Map<string, Promise<void>>();

type RecipesState =
  | { status: "loading" }
  | { status: "success"; recipes: RecipeItem[] }
  | { status: "error"; message: string };
type SearchScope = "current" | "all";

function updateSavedRecipesInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  countryCode: CountryCode,
  recipe: RecipeItem,
  saved: boolean
) {
  const update = (current: CookbookApiResponse | undefined): CookbookApiResponse | undefined => {
    if (!current) return current;
    const hasRecipe = current.recipes.some((item) => item.id === recipe.id);
    if (saved && !hasRecipe) return { ...current, recipes: [recipe, ...current.recipes] };
    if (!saved && hasRecipe)
      return { ...current, recipes: current.recipes.filter((item) => item.id !== recipe.id) };
    return current;
  };

  queryClient.setQueryData<CookbookApiResponse>(queryKeys.savedRecipes(countryCode), update);
  queryClient.setQueryData<CookbookApiResponse>(
    queryKeys.cookbookView("__saved__", countryCode),
    update
  );
}

export function CookbookPage() {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const showToast = useCartToast();
  const navigate = useNavigate();
  const handleAppBack = useInAppBack(() => void navigate({ to: "/", search: {} }));

  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [recipesState, setRecipesState] = useState<RecipesState>({ status: "loading" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(() => new Set());
  const [savingRecipeIds, setSavingRecipeIds] = useState<Set<string>>(() => new Set());
  const [lastBrowseCategory, setLastBrowseCategory] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageTitle = selectedCategory === "__saved__" ? t.cookbookSaved : t.cookbookTitle;
  useDocumentTitle(pageTitle);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const hasActiveQuery = debouncedQuery.length > 0;
  const useGlobalSearch = hasActiveQuery && searchScope === "all";
  const savedRecipesQuery = useSavedRecipes(countryCode);
  const cookbookViewQuery = useCookbookView(selectedCategory, countryCode, !useGlobalSearch);
  const cookbookSearchQuery = useCookbookSearch(debouncedQuery, countryCode, useGlobalSearch);
  const recipesQuery = useGlobalSearch ? cookbookSearchQuery : cookbookViewQuery;

  useEffect(() => {
    const saved = savedRecipesQuery.data?.recipes;
    if (!saved) return;
    setSavedRecipeIds(new Set(saved.map((recipe) => recipe.id)));
    setCategoryCounts((current) => ({ ...current, __saved__: saved.length }));
  }, [savedRecipesQuery.data]);

  useEffect(() => {
    if (recipesQuery.isPending) {
      setRecipesState({ status: "loading" });
      return;
    }
    if (recipesQuery.isError) {
      setRecipesState({
        status: "error",
        message:
          recipesQuery.error instanceof Error ? recipesQuery.error.message : t.cookbookLoadError,
      });
      return;
    }
    if (!recipesQuery.data) return;

    if (recipesQuery.data.categories?.length) setCategories(recipesQuery.data.categories);
    const recipes = Array.isArray(recipesQuery.data.recipes) ? recipesQuery.data.recipes : [];
    if (!useGlobalSearch) {
      const key = selectedCategory ?? "__featured__";
      setCategoryCounts((current) => ({ ...current, [key]: recipes.length }));
    }
    if (selectedCategory === "__saved__" && !useGlobalSearch) {
      setSavedRecipeIds(new Set(recipes.map((recipe) => recipe.id)));
    }
    setRecipesState({ status: "success", recipes });
  }, [
    recipesQuery.data,
    recipesQuery.error,
    recipesQuery.isError,
    recipesQuery.isPending,
    selectedCategory,
    t.cookbookLoadError,
    useGlobalSearch,
  ]);

  const recipesForDisplay = useMemo(() => {
    const loadedRecipes = recipesState.status === "success" ? recipesState.recipes : [];
    return hasActiveQuery && !useGlobalSearch
      ? loadedRecipes.filter((recipe) =>
          recipe.name.toLowerCase().includes(debouncedQuery.toLowerCase())
        )
      : loadedRecipes;
  }, [debouncedQuery, hasActiveQuery, recipesState, useGlobalSearch]);

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

  const handleBack = useCallback(() => {
    if (selectedCategory === "__saved__") {
      setSearchInput("");
      setDebouncedQuery("");
      setSearchScope("all");
      setSelectedCategory(lastBrowseCategory);
      setRecipesState({ status: "loading" });
      setVisibleCount(PAGE_SIZE);
      return;
    }

    handleAppBack();
  }, [handleAppBack, lastBrowseCategory, selectedCategory]);

  const handleToggleSaved = useCallback(
    async (recipe: RecipeItem) => {
      const wasSaved = savedRecipeIds.has(recipe.id);
      const nextSaved = !wasSaved;
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
      updateSavedRecipesInCache(queryClient, countryCode, recipe, nextSaved);
      if (wasSaved && selectedCategory === "__saved__") {
        setRecipesState((current) =>
          current.status === "success"
            ? {
                status: "success",
                recipes: current.recipes.filter((item) => item.id !== recipe.id),
              }
            : current
        );
      }
      try {
        await fetchJson<unknown>(`/api/recipe/${encodeURIComponent(recipe.id)}/saved`, {
          method: nextSaved ? "POST" : "DELETE",
        });
      } catch {
        setSavedRecipeIds((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(recipe.id);
          else next.delete(recipe.id);
          return next;
        });
        setCategoryCounts((current) => ({
          ...current,
          __saved__: Math.max(0, (current.__saved__ ?? 0) + (wasSaved ? 1 : -1)),
        }));
        updateSavedRecipesInCache(queryClient, countryCode, recipe, wasSaved);
        if (wasSaved && selectedCategory === "__saved__") {
          setRecipesState((current) =>
            current.status === "success" && !current.recipes.some((item) => item.id === recipe.id)
              ? { status: "success", recipes: [recipe, ...current.recipes] }
              : current
          );
        }
        showToast(t.recipeSaveError);
      } finally {
        setSavingRecipeIds((current) => {
          const next = new Set(current);
          next.delete(recipe.id);
          return next;
        });
      }
    },
    [countryCode, queryClient, savedRecipeIds, selectedCategory, showToast, t.recipeSaveError]
  );

  const visibleRecipes = recipesForDisplay.slice(0, visibleCount);
  const initialImagesReady = useInitialRecipeImagesReady(recipesForDisplay, countryCode);
  useBackgroundRecipeImagePreload(recipesForDisplay, countryCode, initialImagesReady, visibleCount);
  useEffect(() => {
    if (!initialImagesReady || recipesForDisplay.length === 0) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting)
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, recipesForDisplay.length));
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [initialImagesReady, recipesForDisplay.length]);
  const priorityRecipeIds = useMemo(
    () =>
      new Set(recipesForDisplay.slice(0, INITIAL_RECIPE_IMAGE_COUNT).map((recipe) => recipe.id)),
    [recipesForDisplay]
  );
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
        <button
          type="button"
          onClick={handleBack}
          className="text-picnic-red inline-flex shrink-0 items-center gap-1 self-center text-sm font-medium transition-colors hover:underline"
        >
          <span aria-hidden="true">←</span> {t.backButton}
        </button>
        <h1 className="text-foreground text-xl font-bold">{pageTitle}</h1>
        <button
          type="button"
          onClick={handleSelectSaved}
          className={`ml-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
            selectedCategory === "__saved__" && !debouncedQuery
              ? "border-picnic-red recipe-selection-highlight"
              : "text-foreground dark:border-card-border dark:bg-card-bg border-gray-200 bg-white hover:border-gray-400"
          }`}
        >
          <BookmarkIcon filled={selectedCategory === "__saved__" && !debouncedQuery} />
          <span>{t.cookbookSaved}</span>
          {categoryCounts.__saved__ !== undefined ? (
            <span className="text-xs text-gray-400">{categoryCounts.__saved__}</span>
          ) : null}
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
          <div className="dark:border-card-border dark:bg-card-bg flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
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
                  searchScope === option.value
                    ? "recipe-selection-highlight"
                    : "text-text-muted hover:text-foreground hover:bg-gray-50 dark:hover:bg-white/5"
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
            void recipesQuery.refetch();
          }}
        />
      ) : null}
      {recipesState.status === "success" ? (
        <p className="text-text-muted mb-3 text-sm">{resultSummary}</p>
      ) : null}
      {recipesState.status === "success" && recipesForDisplay.length === 0 ? (
        <p className="text-text-muted text-sm">{t.noRecipes}</p>
      ) : null}
      {recipesState.status === "success" && recipesForDisplay.length > 0 && !initialImagesReady ? (
        <LoadingView />
      ) : null}
      {recipesState.status === "success" && recipesForDisplay.length > 0 && initialImagesReady ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isSaved={savedRecipeIds.has(recipe.id)}
                isSaving={savingRecipeIds.has(recipe.id)}
                priorityImage={priorityRecipeIds.has(recipe.id)}
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

function useInitialRecipeImagesReady(recipes: RecipeItem[], countryCode: CountryCode) {
  const imageSignature = useMemo(() => {
    const urls = buildRecipeImageUrls(recipes, countryCode, 0, INITIAL_RECIPE_IMAGE_COUNT);
    return urls.join("\n");
  }, [countryCode, recipes]);
  const [readySignature, setReadySignature] = useState(() =>
    areRecipeImagesLoaded(imageSignature.split("\n").filter(Boolean)) ? imageSignature : ""
  );

  useEffect(() => {
    const urls = buildRecipeImageUrls(recipes, countryCode, 0, INITIAL_RECIPE_IMAGE_COUNT);
    const nextSignature = urls.join("\n");
    if (!nextSignature || areRecipeImagesLoaded(urls)) {
      setReadySignature(nextSignature);
      return;
    }

    let cancelled = false;
    setReadySignature("");
    preloadRecipeImageUrls(urls, RECIPE_IMAGE_PRELOAD_CONCURRENCY, () => cancelled).then(() => {
      if (!cancelled) setReadySignature(nextSignature);
    });
    return () => {
      cancelled = true;
    };
  }, [countryCode, recipes]);

  return !imageSignature || readySignature === imageSignature;
}

function useBackgroundRecipeImagePreload(
  recipes: RecipeItem[],
  countryCode: CountryCode,
  enabled: boolean,
  visibleCount: number
) {
  useEffect(() => {
    if (!enabled || recipes.length === 0) return;
    let cancelled = false;
    const limit = Math.min(
      Math.max(visibleCount + PAGE_SIZE, INITIAL_RECIPE_IMAGE_COUNT),
      BACKGROUND_RECIPE_IMAGE_PRELOAD_LIMIT
    );
    const urls = buildRecipeImageUrls(recipes, countryCode, 0, limit);
    void preloadRecipeImageUrls(urls, RECIPE_IMAGE_PRELOAD_CONCURRENCY, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [countryCode, enabled, recipes, visibleCount]);
}

function buildRecipeImageUrls(
  recipes: RecipeItem[],
  countryCode: CountryCode,
  start: number,
  limit: number
) {
  return recipes
    .slice(start, start + limit)
    .map((recipe) =>
      recipe.imageId ? buildRecipeImageUrl(recipe.imageId, countryCode) : "/placeholder-product.svg"
    );
}

async function preloadRecipeImageUrls(
  urls: string[],
  concurrency: number,
  isCancelled: () => boolean = () => false
) {
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
      while (!isCancelled()) {
        const url = urls[nextIndex];
        nextIndex += 1;
        if (!url) return;
        if (loadedRecipeImageUrls.has(url)) continue;
        await preloadRecipeImage(url);
      }
    })
  );
}

function preloadRecipeImage(src: string) {
  if (loadedRecipeImageUrls.has(src)) return Promise.resolve();
  const pending = pendingRecipeImagePreloads.get(src);
  if (pending) return pending;

  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => {
      markRecipeImageLoaded(src);
      resolve();
    };
    image.onerror = () => {
      markRecipeImageLoaded(src);
      resolve();
    };
    image.src = src;
    if (image.complete) {
      markRecipeImageLoaded(src);
      resolve();
    }
  }).finally(() => pendingRecipeImagePreloads.delete(src));
  pendingRecipeImagePreloads.set(src, promise);
  return promise;
}

function markRecipeImageLoaded(src: string) {
  if (loadedRecipeImageUrls.has(src)) return;
  if (loadedRecipeImageUrls.size >= MAX_LOADED_RECIPE_IMAGE_URLS) {
    const oldest = loadedRecipeImageUrls.values().next().value;
    if (oldest) loadedRecipeImageUrls.delete(oldest);
  }
  loadedRecipeImageUrls.add(src);
}

function areRecipeImagesLoaded(urls: string[]) {
  return urls.every((url) => loadedRecipeImageUrls.has(url));
}

type RecipePageState =
  | { status: "loading" }
  | { status: "success"; recipe: RecipeDetail }
  | { status: "error"; message: string };
type AddState = "idle" | "adding" | "done";

export function RecipeDetailPage() {
  const { id } = useParams({ from: "/authenticated/recipe/$id" });
  const countryCode = useCountryCode();
  const t = useTranslations();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refresh } = useCartActions();
  const handleBack = useInAppBack(() => void navigate({ to: "/cookbook" }));
  const recipeQuery = useQuery({
    queryKey: queryKeys.recipeDetail(id, null, countryCode),
    queryFn: () => fetchJson<RecipeDetail>(`/api/recipe/${encodeURIComponent(id)}`),
    staleTime: queryStaleTime.cookbookView,
    gcTime: queryGcTime.recipeDetail,
  });
  const [pageState, setPageState] = useState<RecipePageState>(() =>
    recipeQuery.data ? { status: "success", recipe: recipeQuery.data } : { status: "loading" }
  );
  const [portions, setPortions] = useState(recipeQuery.data?.portions ?? 2);
  const [confirmedPortions, setConfirmedPortions] = useState<number | null>(
    recipeQuery.data?.portions ?? null
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () =>
      new Set(
        recipeQuery.data?.ingredients
          .filter((ingredient) => !ingredient.isCondiment)
          .map((ingredient) => ingredient.id) ?? []
      )
  );
  const [addState, setAddState] = useState<AddState>("idle");
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const detailSavedQuery = useSavedRecipes(countryCode);
  useDocumentTitle(pageState.status === "success" ? pageState.recipe.name : t.cookbookTitle);

  useEffect(() => {
    if (recipeQuery.isPending && !recipeQuery.data) {
      setPageState({ status: "loading" });
      return;
    }
    if (recipeQuery.isError) {
      setPageState({
        status: "error",
        message: recipeQuery.error instanceof Error ? recipeQuery.error.message : t.recipeLoadError,
      });
      return;
    }
    if (!recipeQuery.data) return;

    const p = recipeQuery.data.portions ?? 2;
    setConfirmedPortions(p);
    setPortions(p);
    setPageState({ status: "success", recipe: recipeQuery.data });
    setCheckedIds(
      new Set(
        recipeQuery.data.ingredients
          .filter((ingredient) => !ingredient.isCondiment)
          .map((ingredient) => ingredient.id)
      )
    );
  }, [
    recipeQuery.data,
    recipeQuery.error,
    recipeQuery.isError,
    recipeQuery.isPending,
    t.recipeLoadError,
  ]);

  useEffect(() => {
    setIsSaved(Boolean(detailSavedQuery.data?.recipes?.some((recipe) => recipe.id === id)));
  }, [detailSavedQuery.data, id]);

  useEffect(() => {
    if (
      pageState.status !== "success" ||
      confirmedPortions === null ||
      confirmedPortions === portions
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchJson<RecipeDetail>(`/api/recipe/${encodeURIComponent(id)}?portions=${portions}`, {
        signal: controller.signal,
      })
        .then((fetched) => {
          queryClient.setQueryData(queryKeys.recipeDetail(id, portions, countryCode), fetched, {
            updatedAt: Date.now(),
          });
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
          setCheckedIds(
            new Set(
              fetched.ingredients
                .filter((ingredient) => !ingredient.isCondiment)
                .map((ingredient) => ingredient.id)
            )
          );
        })
        .catch(() => undefined);
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [confirmedPortions, countryCode, id, pageState.status, portions, queryClient]);

  const handleToggleSaved = useCallback(async () => {
    if (isSavingRecipe) return;
    const nextSaved = !isSaved;
    const recipeItem =
      pageState.status === "success"
        ? {
            id: pageState.recipe.id,
            name: pageState.recipe.name,
            imageId: pageState.recipe.imageId,
            cookingTimeMinutes: pageState.recipe.cookingTimeMinutes,
          }
        : null;
    setIsSavingRecipe(true);
    setIsSaved(nextSaved);
    if (recipeItem) updateSavedRecipesInCache(queryClient, countryCode, recipeItem, nextSaved);
    try {
      await fetchJson<unknown>(`/api/recipe/${encodeURIComponent(id)}/saved`, {
        method: nextSaved ? "POST" : "DELETE",
      });
    } catch {
      setIsSaved(!nextSaved);
      if (recipeItem) updateSavedRecipesInCache(queryClient, countryCode, recipeItem, !nextSaved);
    } finally {
      setIsSavingRecipe(false);
    }
  }, [countryCode, id, isSaved, isSavingRecipe, pageState, queryClient]);

  if (pageState.status === "loading")
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <LoadingView />
      </main>
    );
  if (pageState.status === "error")
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <ErrorView message={pageState.message} onRetry={() => void recipeQuery.refetch()} />
      </main>
    );

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
  const pricePerServing =
    pricePortions > 0 ? formatEuroPrice(Math.round(totalCents / pricePortions)) : null;
  const buttonLabel =
    addState === "adding"
      ? t.recipeAddingToCart
      : addState === "done"
        ? t.recipeAddedToCart
        : t.recipeAddToCart;

  async function handleAddToCart() {
    if (addState !== "idle") return;
    setAddState("adding");
    const selectedIngredients = recipe.ingredients
      .filter((ingredient) => checkedIds.has(ingredient.id))
      .map((ingredient) => ({
        id: ingredient.id,
        count: getRecipeIngredientCount(ingredient, portions, recipe.portions),
      }));
    try {
      await fetchJson<unknown>(`/api/recipe/${encodeURIComponent(id)}/add-to-cart`, {
        method: "POST",
        body: JSON.stringify({ portions, selectedIngredients }),
      });
      refresh();
      setAddState("done");
      setTimeout(() => setAddState("idle"), 2500);
    } catch {
      setAddState("idle");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={handleBack}
        className="text-picnic-red mb-6 inline-flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
      >
        ← {t.cookbookTitle}
      </button>
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gray-50">
        {recipe.imageId ? (
          <RecipeHeroImage imageId={recipe.imageId} countryCode={countryCode} alt={recipe.name} />
        ) : (
          <div className="aspect-video w-full bg-gray-100" />
        )}
        <RecipeSaveButton
          isSaved={isSaved}
          isSaving={isSavingRecipe}
          onToggle={() => void handleToggleSaved()}
        />
      </div>
      <h1 className="text-foreground mb-3 text-2xl leading-tight font-bold">{recipe.name}</h1>
      <RecipeAddToCartPanel
        portions={portions}
        setPortions={setPortions}
        pricePerServing={pricePerServing}
        totalCents={totalCents}
        cookingTimeMinutes={recipe.cookingTimeMinutes}
        refreshing={refreshing}
        showAddButton={mainIngredients.length > 0}
        isAddDisabled={addState !== "idle" || refreshing || checkedIds.size === 0}
        buttonLabel={buttonLabel}
        isDone={addState === "done"}
        onAddToCart={() => void handleAddToCart()}
      />
      <div className={refreshing ? "pointer-events-none opacity-40" : ""}>
        <IngredientSection
          title={t.recipeIngredients}
          ingredients={mainIngredients}
          portions={pricePortions}
          basePortion={recipe.portions}
          checkedIds={checkedIds}
          setCheckedIds={setCheckedIds}
        />
        <IngredientSection
          title={t.recipeCondiments}
          ingredients={condiments}
          portions={pricePortions}
          basePortion={recipe.portions}
          checkedIds={checkedIds}
          setCheckedIds={setCheckedIds}
          muted
        />
        <RecipeStepsSection recipe={recipe} />
        <RecipeNutritionSection recipe={recipe} />
      </div>
      <RecipeAllergenSection recipe={recipe} />
    </main>
  );
}
