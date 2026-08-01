import { useCallback, useEffect, useRef, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";

import { formatEuroPrice } from "@/lib/format/price";
import { getRecipeIngredientCount } from "@/lib/recipes/quantity";
import { DEBOUNCE_DELAY_MS } from "@/lib/config/app-constants";
import type {
  CookbookApiResponse,
  RecipeCategory,
  RecipeDetail,
  RecipeItem,
} from "@/lib/types/recipe";

import { ErrorView, LoadingView, useDocumentTitle } from "./browsing-components";
import { useCartActions } from "./cart-context";
import { useCountryCode, useTranslations } from "./country-context";
import { CategoryDropdown, type RecipeCategoryOption } from "./features/recipes/category-dropdown";
import { RecipeAddToCartPanel } from "./features/recipes/recipe-add-to-cart-panel";
import { RecipeCard } from "./features/recipes/recipe-card";
import {
  IngredientSection,
  RecipeAllergenSection,
  RecipeHeroImage,
  RecipeNutritionSection,
} from "./features/recipes/recipe-detail-sections";
import { BookmarkIcon } from "./features/recipes/recipe-icons";
import { RecipeSaveButton } from "./features/recipes/recipe-save-button";
import { RecipeSearchInput } from "./features/recipes/recipe-search-input";
import { RecipeStepsSection } from "./features/recipes/recipe-steps-section";
import {
  useCookbookSearch,
  useCookbookView,
  useSavedRecipes,
} from "./features/recipes/use-cookbook-query";
import { fetchJson } from "./lib/api-client";
import { queryKeys, queryStaleTime } from "./lib/query-config";

const PAGE_SIZE = 24;

type RecipesState =
  | { status: "loading" }
  | { status: "success"; recipes: RecipeItem[] }
  | { status: "error"; message: string };
type SearchScope = "current" | "all";

export function CookbookPage() {
  const countryCode = useCountryCode();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useDocumentTitle(t.cookbookTitle);

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
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting)
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, recipesForDisplay.length));
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
        void queryClient.invalidateQueries({ queryKey: ["cookbook"] });
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
    [queryClient, savedRecipeIds, selectedCategory, t.recipeSaveError]
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
        <button
          type="button"
          onClick={() => void navigate({ to: "/", search: {} })}
          className="text-text-muted hover:text-foreground shrink-0 text-sm transition-colors"
        >
          ← {t.backButton}
        </button>
        <h1 className="text-foreground text-xl font-bold">{t.cookbookTitle}</h1>
        <button
          type="button"
          onClick={handleSelectSaved}
          className={`ml-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
            selectedCategory === "__saved__" && !debouncedQuery
              ? "border-picnic-red text-picnic-red bg-red-50"
              : "text-foreground border-gray-200 bg-white hover:border-gray-400"
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
                  searchScope === option.value
                    ? "text-picnic-red bg-red-50"
                    : "text-text-muted hover:text-foreground"
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

type RecipePageState =
  | { status: "loading" }
  | { status: "success"; recipe: RecipeDetail }
  | { status: "error"; message: string };
type AddState = "idle" | "adding" | "done";

export function RecipeDetailPage() {
  const { id } = useParams({ from: "/authenticated/recipe/$id" });
  const countryCode = useCountryCode();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { refresh } = useCartActions();
  const [pageState, setPageState] = useState<RecipePageState>({ status: "loading" });
  const [portions, setPortions] = useState(2);
  const [confirmedPortions, setConfirmedPortions] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [addState, setAddState] = useState<AddState>("idle");
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const recipeQuery = useQuery({
    queryKey: queryKeys.recipeDetail(id, null, countryCode),
    queryFn: () => fetchJson<RecipeDetail>(`/api/recipe/${encodeURIComponent(id)}`),
    staleTime: queryStaleTime.cookbookView,
  });
  const detailSavedQuery = useSavedRecipes(countryCode);
  useDocumentTitle(pageState.status === "success" ? pageState.recipe.name : t.cookbookTitle);

  useEffect(() => {
    if (recipeQuery.isPending) {
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
          queryClient.setQueryData(queryKeys.recipeDetail(id, portions, countryCode), fetched);
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
    setIsSavingRecipe(true);
    setIsSaved(nextSaved);
    try {
      await fetchJson<unknown>(`/api/recipe/${encodeURIComponent(id)}/saved`, {
        method: nextSaved ? "POST" : "DELETE",
      });
      void queryClient.invalidateQueries({ queryKey: ["cookbook"] });
    } catch {
      setIsSaved(!nextSaved);
    } finally {
      setIsSavingRecipe(false);
    }
  }, [id, isSaved, isSavingRecipe, queryClient]);

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
      <Link
        to="/cookbook"
        className="text-text-muted hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm transition-colors"
      >
        ← {t.cookbookTitle}
      </Link>
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
