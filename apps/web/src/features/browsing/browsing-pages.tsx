import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";

import type {
  CategoriesApiResponse,
  CategoryItem,
  ShortcutItem,
  SubcategoriesApiResponse,
} from "@/types/category";
import { parsePageIdFromDeepLink } from "@/lib/parse/deep-link";
import type { CategoryProductsApiResponse, SearchSection } from "@/types/search";

import { HeaderBottomBar } from "../../app/app-shell";
import { BackButton, ErrorView, LoadingView } from "../../components/page-state";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { CategoryBrowser, ProductGrid, ResultsView, SectionNavBar } from "./browsing-components";
import { useCountryCode, useTranslations } from "../../app/providers/country-context";
import { useProductSearch } from "../../hooks/use-product-search";
import { fetchJson } from "../../lib/api-client";
import { queryGcTime, queryKeys, queryStaleTime } from "../../lib/query-config";

function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
  );
}

export function HomePage() {
  const { q } = useSearch({ from: "/authenticated/" });
  const navigate = useNavigate();
  const countryCode = useCountryCode();
  const t = useTranslations();
  const query = q?.trim() ?? "";

  const categories = useQuery({
    queryKey: queryKeys.categories(countryCode),
    queryFn: () => fetchJson<CategoriesApiResponse>("/api/categories"),
    enabled: !query,
    staleTime: queryStaleTime.categories,
  });
  const search = useProductSearch(query, countryCode);

  useDocumentTitle(query ? `"${query}"` : undefined);

  function openCategory(category: CategoryItem) {
    void navigate({ to: "/categories/$categoryId", params: { categoryId: category.id } });
  }

  function openShortcut(shortcut: ShortcutItem) {
    const pageId = parsePageIdFromDeepLink(shortcut.deepLinkTarget);
    if (!pageId) return;
    if (pageId.startsWith("meals-page-root")) {
      void navigate({ to: "/cookbook" });
      return;
    }
    void navigate({ to: "/pages", search: { pageId, title: shortcut.name } });
  }

  const sections = search.data?.sections ?? [];
  return (
    <>
      {sections.length ? (
        <HeaderBottomBar>
          <SectionNavBar sections={sections} />
        </HeaderBottomBar>
      ) : null}
      <PageLayout>
        {query ? (
          search.isPending ? (
            <LoadingView />
          ) : search.isError ? (
            <ErrorView message={t.searchError} onRetry={() => void search.refetch()} />
          ) : (
            <ResultsView query={query} products={search.data.products} sections={sections} />
          )
        ) : categories.isPending ? (
          <LoadingView />
        ) : categories.isError ? (
          <ErrorView message={t.categoriesLoadError} onRetry={() => void categories.refetch()} />
        ) : (
          <CategoryBrowser
            categories={categories.data.categories}
            shortcuts={categories.data.shortcuts}
            onCategory={openCategory}
            onShortcut={openShortcut}
          />
        )}
      </PageLayout>
    </>
  );
}

export function CategoryPage() {
  const { categoryId } = useParams({ from: "/authenticated/categories/$categoryId" });
  const navigate = useNavigate();
  const countryCode = useCountryCode();
  const t = useTranslations();
  const categories = useQuery({
    queryKey: queryKeys.categories(countryCode),
    queryFn: () => fetchJson<CategoriesApiResponse>("/api/categories"),
    staleTime: queryStaleTime.categories,
  });
  const query = useQuery({
    queryKey: queryKeys.subcategories(categoryId, countryCode),
    queryFn: () =>
      fetchJson<SubcategoriesApiResponse>(
        `/api/categories/${encodeURIComponent(categoryId)}/subcategories`
      ),
    staleTime: queryStaleTime.categories,
  });
  const categoryName = categories.data?.categories.find(
    (category) => category.id === categoryId
  )?.name;
  const title =
    query.data?.title && query.data.title !== categoryId ? query.data.title : categoryName;

  useDocumentTitle(title);

  return (
    <PageLayout>
      <BackButton onClick={() => void navigate({ to: "/", search: {} })} />
      <h2 className="text-foreground mb-3 text-lg font-semibold">
        {title ?? t.categoryFallbackTitle}
      </h2>
      {query.isPending ? (
        <LoadingView />
      ) : query.isError ? (
        <ErrorView message={t.subcategoriesLoadError} onRetry={() => void query.refetch()} />
      ) : query.data.subcategories.length ? (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {query.data.subcategories.map((subcategory, index) => (
            <SubcategoryRow
              key={subcategory.id}
              item={subcategory}
              last={index === query.data.subcategories.length - 1}
              onClick={() =>
                void navigate({
                  to: "/categories/$categoryId/$subcategoryId",
                  params: { categoryId, subcategoryId: subcategory.id },
                })
              }
            />
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-gray-500">Geen subcategorieën gevonden.</p>
      )}
    </PageLayout>
  );
}

function SubcategoryRow({
  item,
  last,
  onClick,
}: {
  item: CategoryItem;
  last: boolean;
  onClick: () => void;
}) {
  const countryCode = useCountryCode();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-2 hover:bg-gray-50 ${last ? "" : "border-b border-gray-100"}`}
    >
      <img
        src={`https://storefront-prod.${countryCode.toLowerCase()}.picnicinternational.com/static/images/${item.imageId}/medium.png`}
        alt={item.name}
        loading="lazy"
        className="h-14 w-14 shrink-0 object-contain"
      />
      <span className="text-foreground min-w-0 flex-1 text-left text-[15px] font-medium">
        {item.name}
      </span>
      <span className="text-gray-400" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

function ProductsPageView({
  query,
  fallbackTitle,
  back,
}: {
  query: ReturnType<typeof useProductsQuery>;
  fallbackTitle: string;
  back: () => void;
}) {
  const t = useTranslations();
  const sections = useMemo<SearchSection[]>(() => query.data?.sections ?? [], [query.data]);
  useDocumentTitle(query.data?.title ?? fallbackTitle);

  return (
    <>
      {sections.length ? (
        <HeaderBottomBar>
          <SectionNavBar sections={sections} />
        </HeaderBottomBar>
      ) : null}
      <PageLayout>
        <BackButton onClick={back} />
        <h2 className="text-foreground mb-3 text-lg font-semibold">
          {query.data?.title ?? fallbackTitle}
        </h2>
        {query.isPending ? (
          <LoadingView />
        ) : query.isError ? (
          <ErrorView message={t.productsLoadError} onRetry={() => void query.refetch()} />
        ) : query.data.products.length ? (
          <>
            <p className="mb-4 text-sm text-gray-500">
              {query.data.products.length}{" "}
              {query.data.products.length === 1 ? t.productSingular : t.productPlural}
            </p>
            <ProductGrid products={query.data.products} sections={sections} />
          </>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">{t.noProductsInCategory}</p>
        )}
      </PageLayout>
    </>
  );
}

function useProductsQuery(key: string[], url: string, enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: () => fetchJson<CategoryProductsApiResponse>(url),
    enabled,
    staleTime: queryStaleTime.search,
    gcTime: queryGcTime.productLists,
  });
}

export function SubcategoryProductsPage() {
  const { categoryId, subcategoryId } = useParams({
    from: "/authenticated/categories/$categoryId/$subcategoryId",
  });
  const navigate = useNavigate();
  const countryCode = useCountryCode();
  const t = useTranslations();
  const query = useProductsQuery(
    [...queryKeys.categoryProducts(subcategoryId, countryCode)],
    `/api/categories/${encodeURIComponent(subcategoryId)}/products`
  );
  return (
    <ProductsPageView
      query={query}
      fallbackTitle={t.defaultPageTitle}
      back={() => void navigate({ to: "/categories/$categoryId", params: { categoryId } })}
    />
  );
}

export function ShortcutProductsPage() {
  const { pageId, title } = useSearch({ from: "/authenticated/pages" });
  const navigate = useNavigate();
  const countryCode = useCountryCode();
  const t = useTranslations();
  const query = useProductsQuery(
    [...queryKeys.shortcutProducts(pageId ?? "", countryCode)],
    `/api/pages/products?pageId=${encodeURIComponent(pageId ?? "")}`,
    Boolean(pageId)
  );

  if (!pageId) {
    return (
      <PageLayout>
        <BackButton onClick={() => void navigate({ to: "/", search: {} })} />
        <ErrorView message={t.noPageSpecified} />
      </PageLayout>
    );
  }

  return (
    <ProductsPageView
      query={query}
      fallbackTitle={title ?? t.defaultPageTitle}
      back={() => void navigate({ to: "/", search: {} })}
    />
  );
}
