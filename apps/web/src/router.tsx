import { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { AuthenticatedShell, StandaloneShell } from "./app-shell";
import { LoadingSurface } from "./app-surfaces";
import {
  CategoryPage,
  HomePage,
  ShortcutProductsPage,
  SubcategoryProductsPage,
} from "./browsing-pages";
import { CountryProvider } from "./country-context";
import { ApiClientError } from "./lib/api-client";
import { LoginPage } from "./login-page";
import { AppShellError, RootNotFound } from "./router-surfaces";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiClientError && error.status === 401) && failureCount < 2,
    },
  },
});

const rootRoute = createRootRoute({
  component: Outlet,
  errorComponent: AppShellError,
  notFoundComponent: RootNotFound,
});

const standaloneRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "standalone",
  component: StandaloneShell,
});

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AuthenticatedShell,
});

function pendingPage(title?: string) {
  return function PendingPage() {
    return <LoadingSurface title={title} />;
  };
}

const loginRoute = createRoute({
  getParentRoute: () => standaloneRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    expired: search.expired === true || search.expired === "true" ? (true as const) : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

const homeRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
  }),
  component: HomePage,
});

const pagesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/pages",
  validateSearch: (search: Record<string, unknown>) => ({
    pageId: typeof search.pageId === "string" ? search.pageId : undefined,
    title: typeof search.title === "string" ? search.title : undefined,
  }),
  component: ShortcutProductsPage,
});
const cartRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/cart",
  component: pendingPage("Winkelwagen"),
});
const paymentReturnRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/cart/payment-return",
  component: pendingPage("Betaling"),
});
const categoryRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/categories/$categoryId",
  component: CategoryPage,
});
const subcategoryRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/categories/$categoryId/$subcategoryId",
  component: SubcategoryProductsPage,
});
const cookbookRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/cookbook",
  component: pendingPage("Recepten"),
});
const paymentRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/account/payment",
  component: pendingPage("Betaalmethoden"),
});
const productRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/product/$id",
  component: pendingPage("Product"),
});
const recipeRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/recipe/$id",
  component: pendingPage("Recept"),
});

const routeTree = rootRoute.addChildren([
  standaloneRoute.addChildren([loginRoute]),
  authenticatedRoute.addChildren([
    homeRoute,
    pagesRoute,
    cartRoute,
    paymentReturnRoute,
    categoryRoute,
    subcategoryRoute,
    cookbookRoute,
    paymentRoute,
    productRoute,
    recipeRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPendingComponent: () => (
    <CountryProvider>
      <div className="flex min-h-screen flex-col">
        <LoadingSurface />
      </div>
    </CountryProvider>
  ),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
