# SOLID Improvement Tracker

This document tracks maintainability improvements that apply SOLID principles to the current Vite
React + Hono Worker codebase. The goal is practical clarity, not abstract layering.

## Scope

This tracker covers refactors that make the migrated Cloudflare Worker app easier to maintain
without changing user-facing behavior. It does not define product changes, Picnic API behavior
changes, onboarding work, or visual redesigns.

Refactors should stay behavior-preserving unless a follow-up issue explicitly calls out a bug or
product change. Move-only work should be easy to review by domain.

## Current Assessment

The parser and service layers are already in decent shape:

- `src/lib/api-services/*` separates Picnic API behavior by domain.
- `src/lib/parse-*` keeps raw upstream response parsing out of UI code.
- `src/components/*` contains several narrow presentational components.

The largest remaining SOLID pressure is in oversized page/shell files, broad cross-feature state
interfaces, and route/UI code that still repeats low-level fetch/session wiring.

## Progress

- [x] Create this SOLID tracker and folder-structure direction.
- [x] Split `apps/api/src/index.ts` into domain route modules under `apps/api/src/routes/`.
- [x] Extract cart page sections.
  - [x] Move delivery-slot picker into `apps/web/src/features/cart/`.
  - [x] Move order summary into a focused cart feature component.
  - [x] Move checkout CTA/payment-method panel into a focused cart feature component.
  - [x] Move cart item list/card pieces where this does not disturb mutation behavior.
  - [x] Move delivery-slot banner and product slider.
- [x] Extract recipe pages.
  - [x] Keep cookbook browsing/search/saved-recipes view and recipe detail as separate page exports.
  - [x] Move recipe card/category/search controls into `apps/web/src/features/recipes/`.
  - [x] Move recipe ingredient list into a narrow component.
  - [x] Move recipe save button into a narrow component.
  - [x] Move recipe add-to-cart panel into a narrow component.
  - [x] Move recipe steps/nutrition/allergen sections into narrow components.
- [x] Extract shell feature files.
  - [x] Move mobile header hook/component from `app-shell.tsx` into `features/shell/`.
  - [x] Move header icons into `features/shell/`.
  - [x] Leave typed menu-action/menu-panel config out for now; current branching is clearer.
- [x] Add domain query hooks.
  - [x] `useCartQuery`
  - [x] `usePaymentProfile`
  - [x] `useProductSearch`
  - [x] `useCookbookView`
- [x] Split large domain type file gradually.
  - [x] Move country/language constants and helpers into `src/lib/types/locale-types.ts`.
  - [x] Move payment/checkout types into `src/lib/types/payment-types.ts`.
- [x] Split cart context interfaces after cart extraction.
- [x] Add Worker authenticated route helper where it reduces repeated route boilerplate.

## Completed Chunks

### Worker Route Split

`apps/api/src/index.ts` is now composition-only:

- app creation
- API security middleware
- global error handling
- health endpoint
- route-module registration

Domain routes now live in:

- `apps/api/src/routes/auth-routes.ts`
- `apps/api/src/routes/payment-routes.ts`
- `apps/api/src/routes/category-routes.ts`
- `apps/api/src/routes/product-routes.ts`
- `apps/api/src/routes/cart-routes.ts`
- `apps/api/src/routes/delivery-routes.ts`
- `apps/api/src/routes/checkout-routes.ts`
- `apps/api/src/routes/recipe-routes.ts`

The split intentionally kept repeated auth/session handling in each route module for the first pass.
That made the move easy to compare against the previous monolithic file. A later helper can reduce
duplication once the route boundaries have settled.

### Cart Feature Extraction

`apps/web/src/cart-page.tsx` now owns cart-page orchestration:

- cart query state
- optimistic quantity mutation queue
- rollback/reconciliation
- empty/loading/error/toast shell
- composition of cart feature components

Cart presentation and subflows now live in:

- `apps/web/src/features/cart/cart-item-card.tsx`
- `apps/web/src/features/cart/cart-order-summary.tsx`
- `apps/web/src/features/cart/cart-checkout-cta.tsx`
- `apps/web/src/features/cart/cart-product-slider.tsx`
- `apps/web/src/features/cart/delivery-slot-banner.tsx`
- `apps/web/src/features/cart/delivery-slot-picker.tsx`

This keeps the quantity mutation logic centralized for now, which is deliberate: the cart update
flow has had subtle flicker and bundle-discount edge cases, so it should not be moved at the same
time as presentation components.

### Recipe Feature Extraction

`apps/web/src/recipe-pages.tsx` now owns recipe-page orchestration:

- cookbook query/category/search state
- saved-recipe mutation state
- recipe detail query state
- portions refresh state
- add-to-cart handler

Recipe presentation and subflows now live in:

- `apps/web/src/features/recipes/category-dropdown.tsx`
- `apps/web/src/features/recipes/recipe-search-input.tsx`
- `apps/web/src/features/recipes/recipe-card.tsx`
- `apps/web/src/features/recipes/recipe-icons.tsx`
- `apps/web/src/features/recipes/recipe-save-button.tsx`
- `apps/web/src/features/recipes/recipe-add-to-cart-panel.tsx`
- `apps/web/src/features/recipes/recipe-detail-sections.tsx`
- `apps/web/src/features/recipes/recipe-steps-section.tsx`

### Shell Feature Extraction

`apps/web/src/app-shell.tsx` now imports self-contained shell helpers from:

- `apps/web/src/features/shell/mobile-header-menu-panel.tsx`
- `apps/web/src/features/shell/header-icons.tsx`

The header still owns search state, cart link composition, locale/theme/menu state, and menu content
rendering. A typed menu config remains optional; only add it if it reduces branching without making
desktop/mobile behavior harder to follow.

### Domain Query Hooks

Repeated query setup now has domain hooks for the most common app surfaces:

- `apps/web/src/features/cart/use-cart-query.ts`
- `apps/web/src/features/payment/use-payment-profile.ts`
- `apps/web/src/features/products/use-product-search.ts`
- `apps/web/src/features/recipes/use-cookbook-query.ts`

These hooks preserve existing query keys, stale times, and endpoint behavior.

### Worker Authenticated Handler

Simple authenticated JSON routes can now use:

- `apps/api/src/lib/authenticated-handler.ts`

The helper is applied only where it clarifies repeated session/auth/service boilerplate. Routes with
custom auth behavior, body parsing, validation, or image proxy behavior stay explicit.

### Type File Split

The large `src/lib/types.ts` file now re-exports smaller domain files while preserving the existing
`@/lib/types` import surface:

- `src/lib/types/locale-types.ts`
- `src/lib/types/payment-types.ts`

Continue this pattern opportunistically when product, recipe, cart, or delivery domains are touched.

### Cart Context Interface Split

`cart-context.tsx` still owns the cart state provider, but consumers now use narrower hooks:

- `useCartQuantities`
- `useCartTotals`
- `useCartActions`
- `useCartBundles`

The broad `useCart` hook remains as an internal compatibility layer.

## Folder Structure Direction

The current structure is workable, but feature-level grouping would make future extraction easier:

```text
apps/web/src
  features/
    cart/
      cart-item-card.tsx
      cart-order-summary.tsx
      cart-checkout-cta.tsx
      cart-product-slider.tsx
      delivery-slot-banner.tsx
      delivery-slot-picker.tsx
      use-cart-query.ts
    recipes/
      cookbook-page.tsx
      recipe-detail-page.tsx
      recipe-card.tsx
      recipe-ingredient-list.tsx
      use-cookbook-query.ts
    products/
      browsing-pages.tsx
      product-detail-page.tsx
      use-product-search.ts
    shell/
      app-shell.tsx
      mobile-header-menu-panel.tsx
      use-mobile-header-menu-panel.ts
      header-menu-content.tsx

apps/api/src
  routes/
    auth-routes.ts
    cart-routes.ts
    category-routes.ts
    checkout-routes.ts
    delivery-routes.ts
    payment-routes.ts
    product-routes.ts
    recipe-routes.ts
  lib/
    authenticated-handler.ts
    http.ts
    security.ts
    session.ts

src/lib
  types/
    auth-types.ts
    cart-types.ts
    delivery-types.ts
    payment-types.ts
    product-types.ts
    recipe-types.ts
```

Do this gradually. Avoid one giant move-only commit unless there is a clear payoff.

## 1. Single Responsibility Principle

Status: Improved, still partial.

### Current Issues

- `apps/web/src/cart-page.tsx` is much smaller, but still owns optimistic cart mutation,
  reconciliation, toast handling, and page state in one place.
- `apps/web/src/recipe-pages.tsx` mixes cookbook browsing, saved recipes, search, recipe detail,
  ingredient scaling, and add-to-cart behavior.
- `apps/web/src/app-shell.tsx` still mixes shell layout, search, cart link, locale/theme menus, and
  menu content, although mobile panel behavior is now separated into a hook/component.

### Target Improvements

- Extract cart sections:
  - Done for current presentation components.
  - Later: consider `useCartMutationQueue` only after cart behavior has enough regression tests.
- Extract recipe sections:
  - `CookbookBrowser`
  - `RecipeDetail`
  - `RecipeIngredientList`
  - `RecipeSaveButton`
- Move mobile header hook/component from `app-shell.tsx` into `features/shell/`.

## 2. Open/Closed Principle

Status: Good in parsers/services and Worker routes, weaker in shell/UI registration.

### Current Issues

- New API domains now add a route module and one registration line, but route modules still repeat
  authenticated-handler boilerplate.
- Header menu additions require touching `AppHeader` internals.
- Recipe browsing behavior is page-local rather than driven by composable hooks/view models.

### Target Improvements

- Worker routes by domain under `apps/api/src/routes/`. Done.
- Keep `apps/api/src/index.ts` as app composition only:
  - middleware
  - health/dev routes
  - `registerAuthRoutes(app)`
  - `registerCartRoutes(app)`
  - etc. Done.
- Introduce a typed header menu config where possible.
- Add a helper for authenticated JSON routes only where it does not obscure custom behavior.

## 3. Liskov Substitution Principle

Status: Mostly fine.

### Current Issues

- Some reusable UI components still accept richer domain objects than they need.
- A few components depend on exact normalized object shapes instead of narrower capabilities.
- Cart presentation components still accept full `CartItem` and `SliderProduct` shapes.

### Target Improvements

- Prefer narrow props for reusable components:
  - `Pick<Product, "id" | "name" | "imageId">`
  - small view models for cards, rows, buttons, and summaries.
- Keep raw Picnic payload assumptions inside parsers and service modules.
- Move toward explicit view models when a component becomes shared across product, cart, and recipe
  surfaces.

## 4. Interface Segregation Principle

Status: Mixed.

### Current Issues

- `CartContextValue` exposes quantities, totals, bundle progress, mutation actions, refresh, and
  visible-cart sync through one context.
- `src/lib/types.ts` is large and acts as a general type dumping ground.
- Some large pages still pass broad objects down through many subcomponents.

### Target Improvements

- After cart page extraction, split cart-facing hooks:
  - `useCartQuantities`
  - `useCartTotals`
  - `useCartActions`
  - `useCartBundles`
- Split `src/lib/types.ts` into domain type files.
- Use small view model types for UI sections.
- Keep type moves opportunistic and domain-scoped to avoid churn.

## 5. Dependency Inversion Principle

Status: Decent at service/parser layer, weaker in UI and Worker route wiring.

### Current Issues

- Worker route handlers directly import concrete service functions.
- UI pages directly call literal `/api/...` endpoints through `useQuery`.
- Testing pages requires working around query setup and route-specific fetch details.
- Cart mutations still couple page state directly to low-level API calls.

### Target Improvements

- Add domain hooks:
  - `useProductSearch`
  - `useCartQuery`
  - `useCookbookView`
  - `usePaymentProfile`
- Add Worker helper for authenticated handlers to reduce repeated:
  - `readSession(c)`
  - auth check
  - service invocation
  - `jsonStatus(...)`
- Prefer hooks and route helpers that expose domain operations, not generic abstraction layers.

## Implementation Order

1. Split `apps/api/src/index.ts` into route modules. Done.
   - Low UI risk.
   - Large readability gain.
   - Keep behavior identical.

2. Extract cart page sections. Done for current presentation/subflow components.
   - Highest UI maintainability gain.
   - Started with the delivery-slot picker because it owns a self-contained query and modal flow.
   - Kept mutation queue in `cart-page.tsx` deliberately.

3. Extract recipe pages. Done for current presentation/subflow components.
   - Separate cookbook browsing from recipe detail first.
   - Then split ingredient list/save/add-to-cart subcomponents.
   - Keep cookbook search/category/saved-recipe behavior unchanged.

4. Extract shell feature files. Done for the mobile panel and icons.
   - Move mobile menu panel logic under `features/shell/`.
   - Typed menu config intentionally skipped for now.

5. Add domain query hooks. Done.
   - Do this after page extraction so hooks match real feature boundaries.
   - Start with hooks that wrap existing query keys and fetchers without changing cache semantics.

6. Add Worker authenticated handler helper. Done.
   - Apply first to simple GET routes.
   - Avoid forcing custom auth/login/image routes through the helper.

7. Split large domain type file. Started with locale and payment domain files.
   - Move types only when touching related features.
   - Avoid churn-heavy all-at-once type moves.

8. Split cart context interfaces. Done.
   - Do this after cart page extraction clarifies consumers.
   - Preserve current update robustness before moving mutation orchestration out of `cart-page.tsx`.

## Chunk Acceptance Criteria

Every chunk should satisfy these conditions:

- It has one dominant purpose.
- It avoids behavior changes unless explicitly called out.
- It moves files before changing logic.
- It leaves route names, query keys, local storage keys, cookie behavior, and Picnic API payloads
  unchanged unless the chunk is specifically about those contracts.
- It updates this tracker when a checkbox changes.
- It includes the validation commands that match the affected surface.

## Validation Checklist

For each refactor chunk:

- Run `pnpm format:check`.
- Run `pnpm typecheck`.
- Run `pnpm test:unit`.
- Run `pnpm build:web` for web-facing changes.
- Run `pnpm build:api` or `pnpm validate` for Worker route changes.
- Use Playwright for affected user flows when UI behavior changes.

Current validated state for the completed SOLID chunks:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build:web`
- `pnpm build:api`

## Public Repo Hygiene

- Do not commit `.env`, tokens, local logs, generated repo dumps, build output, or Playwright
  artifacts.
- Keep `.env.example` placeholder-only.
- Avoid production logging of Picnic tokens, passwords, email addresses, request bodies, and raw
  authenticated Picnic payloads.
- Keep auth tokens in HTTP-only cookies; do not introduce browser-visible token storage.
- Keep Picnic API region (`CountryCode`) separate from display language (`LanguageCode`).

## Notes

- Prefer behavior-preserving extractions before changing logic.
- Keep commits grouped by domain.
- Avoid moving files and changing behavior in the same commit unless the change is very small.
- The next best stopping point is recipe page extraction plus validation. After that, hooks and
  route helpers become easier to design from actual feature boundaries.
