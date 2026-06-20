# Cloudflare Migration Todo

This file tracks the migration from the current Next.js app to the target Cloudflare Worker architecture:

```text
apps/web  Vite + React + Tailwind + TanStack Router + TanStack Query
apps/api  Hono Worker + Picnic API proxy + auth cookies + payment routes
```

Each chunk is sized to be implemented and validated in one focused response. Keep this file updated whenever a chunk is completed, split, reordered, or intentionally deferred.

The current Next app is the visual source of truth. Ported UI should preserve the existing layout, spacing, typography scale, colors, component states, labels, and interaction affordances as closely as practical. This migration should not redesign screens or introduce a new visual language unless a targeted visual change is explicitly requested.

## Progress

- [x] Chunk 1: Scaffold the target apps and extract first reusable API services.
- [x] Chunk 2: Port the first read-only API routes to Hono.
- [x] Chunk 3: Port auth/session routes to Hono.
- [x] Chunk 4: Port product/category detail API routes to Hono.
- [x] Chunk 5: Port cart and delivery-slot API routes to Hono.
- [x] Chunk 6: Port recipe detail, saved recipe, and recipe add-to-cart API routes to Hono.
- [ ] Chunk 7: Port payment profile and checkout API routes to Hono.
- [ ] Chunk 8: Add Worker API security, headers, and response helpers.
- [ ] Chunk 9: Establish the Vite web app shell, styling baseline, and API client.
- [ ] Chunk 10: Port login UI and session handling.
- [ ] Chunk 11: Port home, search, categories, and product listing UI.
- [ ] Chunk 12: Port product detail UI.
- [ ] Chunk 13: Port cart UI.
- [ ] Chunk 14: Port cookbook and recipe UI.
- [ ] Chunk 15: Port payment UI and payment return flow.
- [ ] Chunk 16: Add query caching, invalidation, and request de-duplication.
- [ ] Chunk 17: Verify feature parity against current app behavior and specs.
- [ ] Chunk 18: Finalize Cloudflare deployment configuration.
- [ ] Chunk 19: Stability, performance, and deployment smoke testing.
- [ ] Chunk 20: Remove or archive the old Next app after parity is proven.

## Completed Chunks

### Chunk 1: Migration Foundation

Commit: `7b10409 Start Cloudflare migration foundation`

Implemented:

- Created `platform/cloudflare-worker-migration`.
- Added `apps/web` with Vite, React, TanStack Router, and TanStack Query.
- Added `apps/api` with Hono, Wrangler, Worker assets config, and `/api/health`.
- Added migration scripts: `dev:web`, `dev:api`, `build:web`, `build:api`.
- Extracted framework-neutral service functions for categories, product search, cookbook browse, and cookbook search.
- Kept the existing Next route handlers as thin adapters over those services.

Validated:

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run build:web`
- `npm run build:api`

### Chunk 2: First Hono API Routes

Commit: `f27787a Port read-only API routes to Hono`

Implemented:

- Added Hono routes for `GET /api/categories`, `GET /api/search`, `GET /api/cookbook`, and `GET /api/cookbook/search`.
- Added framework-neutral cookie parsing in `src/lib/session-cookies.ts`.
- Kept `src/lib/auth.ts` as the Next-specific cookie wrapper.
- Enabled `nodejs_compat` because `picnic-api` currently imports Node `crypto`.

Validated:

- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run build:api`
- `npm run build:web`
- `npm run build`

### Chunk 3: Auth/Session Routes

Commit: `cdf242f Port auth routes to Hono`

Implemented:

- Extracted framework-neutral auth services for token login, credential login, and 2FA verification.
- Added Hono routes for `POST /api/auth/login`, `POST /api/auth/login-credentials`, `POST /api/auth/verify-2fa`, and `POST /api/auth/logout`.
- Preserved auth token cookies as `HttpOnly`, same-site strict cookies.
- Preserved country cookie behavior for login and 2FA continuation.
- Added Hono same-origin checks for unsafe auth requests.
- Added no-store headers for Hono auth responses.
- Kept the existing Next auth routes working as adapters over the same shared auth services.

Validated:

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build:web`
- `npm run build:api`
- `npm run build`

### Chunk 4: Product And Category Detail API Routes

Commit: `3abe6ba Port product browsing routes to Hono`

Implemented:

- Extracted framework-neutral services for product detail, suggestions, subcategories, category products, arbitrary product pages, and image proxying.
- Added Hono routes for `GET /api/product/:id`, `GET /api/suggestions`, `GET /api/image`, `GET /api/pages/products`, `GET /api/categories/:categoryId/subcategories`, and `GET /api/categories/:categoryId/products`.
- Kept the existing Next routes as thin adapters over the shared services.
- Preserved product parsing, category page section parsing, search suggestions, Picnic image proxy headers, and auth error semantics.
- Preserved the existing missing-`pageId` response ordering for `/api/pages/products`.

Validated:

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build:web`
- `npm run build:api`
- `npm run build`

### Chunk 5: Cart And Delivery-Slot API Routes

Commit: `73661ce Port cart routes to Hono`

Implemented:

- Extracted framework-neutral cart services for cart reads, cart mutations, delivery-slot listing, and delivery-slot selection.
- Added Hono routes for `GET /api/cart`, `POST /api/cart`, `GET /api/cart/delivery-slots`, and `POST /api/cart/delivery-slots`.
- Kept the existing Next cart routes as thin adapters over the shared services.
- Preserved cart parsing, decorator override handling, bundle discount data, unavailable item handling, delivery slot parsing, and selected-slot cart reconciliation.
- Preserved same-origin checks on cart and delivery-slot POST routes.

Validated:

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build:web`
- `npm run build:api`
- `npm run build`

### Chunk 6: Recipe API Routes

Commit: `e74f90e Port recipe routes to Hono`

Implemented:

- Extracted framework-neutral services for recipe detail, ingredient enrichment, save/unsave, recipe add-to-cart, and cookbook counts.
- Added Hono routes for `GET /api/recipe/:id`, `POST/DELETE /api/recipe/:id/saved`, `POST /api/recipe/:id/add-to-cart`, and `GET /api/cookbook/counts`.
- Kept the existing Next recipe routes as thin adapters over the shared services.
- Preserved the NL/DE recipe endpoint fallback, portion handling, ingredient names and product enrichment, allergen/parser output, and sequential selected-ingredient cart mutations.
- Preserved token-scoped five-minute cookbook count caching and invalidated it immediately after save/unsave.
- Preserved same-origin checks on recipe mutations.

Validated:

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build:web`
- `npm run build:api`
- `npm run build`
- Authenticated manual recipe mutation smoke tests remain scheduled for Chunk 19 because no test session is available in the shell environment.

## Remaining Chunks

### Chunk 7: Port Payment And Checkout API Routes To Hono

Goal:

Move payment profile and checkout routes into Hono without weakening security or changing response shape.

Scope:

- Port `GET/PATCH /api/account/payment-profile`.
- Port `GET/POST /api/account/payment-profile/payment-options`.
- Port payment option deletion/update route.
- Port `POST /api/checkout/start-payment`.
- Port `POST /api/checkout/cancel`.
- Port `GET /api/checkout/status/[transactionId]`.
- Preserve iDEAL/WERO naming, preferred payment option handling, direct order payment support, status polling, cancellation behavior, and error codes.
- Keep payment logic server-side.

Validation:

- Typecheck, lint, Next build, Worker dry-run build.
- Manual payment profile smoke test.
- Manual checkout start/status/cancel smoke test in a non-destructive flow where possible.

### Chunk 8: Worker Security And Response Helpers

Goal:

Make the Hono API consistent, auditable, and production-ready before the UI starts depending on it.

Scope:

- Add shared Hono response helpers for JSON status, auth-required, no-store, and upstream errors.
- Apply `Cache-Control: no-store` to all private API responses.
- Add same-origin checks for all unsafe authenticated methods.
- Add clear auth-expired vs generic upstream failure handling.
- Add security headers for Worker-served app responses where appropriate.
- Keep logging useful without exposing tokens or credentials.

Validation:

- Typecheck, lint, Next build, Worker dry-run build.
- Inspect representative response headers.
- Confirm no token/credential data is logged.

### Chunk 9: Vite Web App Shell And API Client

Goal:

Turn the placeholder Vite app into the real app shell foundation.

Scope:

- Add Tailwind setup for `apps/web`.
- Port global styles needed by existing UI.
- Add shared layout shell, header, navigation, loading, and error surfaces.
- Match the current app's visual baseline instead of inventing a new shell design.
- Add a typed `fetchJson` API client.
- Add auth-expired handling and redirect behavior.
- Set up TanStack Router route structure matching current URLs.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Browser smoke test for direct URL fallback and basic navigation.

### Chunk 10: Port Login UI

Goal:

Make the Vite app capable of authenticating against the Hono API.

Scope:

- Port login page UI.
- Preserve token login, credential login, password visibility toggle, country selection, 2FA verification, and normal-person wording.
- Use Hono auth endpoints only.
- Confirm cookies are set as expected.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Manual token login smoke test.
- Manual credential login smoke test where possible.
- Manual 2FA flow using the existing auth probe if SMS/email delivery is available.

### Chunk 11: Port Home, Search, Categories, And Product Listing UI

Goal:

Port the main grocery browsing workflow to Vite.

Scope:

- Port home/search page.
- Port search suggestions.
- Port category grid, shortcuts, category products, subcategory navigation, section nav badges, result counts, and URL state.
- Preserve `Alle resultaten voor "<term>"` header behavior and grey result count text.
- Preserve cart controls on product cards.
- Preserve current visual layout, spacing, sticky/nav behavior, and product card presentation.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Manual smoke test for global search, category search, URL state, suggestions, and PLP cart buttons.

### Chunk 12: Port Product Detail UI

Goal:

Port product detail pages with no parser or UI regressions.

Scope:

- Port product detail route.
- Port gallery, labels, highlights, nutrition, allergens, accordion sections, similar products, and bundle UI.
- Preserve add/remove cart controls and unavailable states.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Manual smoke test on normal, discounted, bundle, unavailable, and allergen-heavy products.

### Chunk 13: Port Cart UI

Goal:

Port the full cart experience.

Scope:

- Port cart page.
- Port delivery slot banner/picker.
- Port order summary, fees, credit, deposit breakdown, unavailable replacements, checkout CTA, and cart item controls.
- Preserve remove-all product control and improved icons.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Manual add/remove/remove-all smoke tests.
- Manual delivery slot and checkout readiness smoke tests.

### Chunk 14: Port Cookbook And Recipe UI

Goal:

Port cookbook browsing, scoped search, saved recipes, recipe detail, and recipe cart flow.

Scope:

- Port cookbook page.
- Port category/scope selector and saved recipes control.
- Port global and scoped recipe search.
- Port recipe detail page, hero save button, ingredients, portions, steps, nutrition, allergens, and add-to-cart.
- Preserve category view caching expectations from the current app.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Manual cookbook category/search/saved smoke tests.
- Manual recipe save and add-to-cart smoke tests.

### Chunk 15: Port Payment UI And Return Flow

Goal:

Port the direct payment user flow to Vite.

Scope:

- Port payment settings page.
- Port payment method selector and preferred option management.
- Port checkout/payment return page.
- Preserve iDEAL/WERO naming and all direct order payment behavior.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Manual payment profile smoke test.
- Manual checkout status/return smoke test where safe.

### Chunk 16: Query Caching And Invalidation

Goal:

Use TanStack Query to reduce repeated Picnic API calls while avoiding stale private data.

Scope:

- Add route/query hooks with deliberate query keys.
- Apply stale times:
  - Categories: 15-30 minutes.
  - Product detail: 10-30 minutes.
  - Search: 1-5 minutes.
  - Cart: 15-60 seconds.
  - Cookbook categories: 15-30 minutes.
  - Cookbook category views: around 15 minutes.
  - Saved recipes: 1-5 minutes.
  - Payment profile: 1-5 minutes.
- Invalidate cart after cart mutations and recipe add-to-cart.
- Invalidate saved recipes/counts after save/unsave.
- Avoid Worker-side shared caching for private data.

Validation:

- Typecheck, lint, `build:web`, Worker dry-run build.
- Confirm repeated navigation does not re-query unnecessarily.
- Confirm mutations refresh affected views.

### Chunk 17: Feature Parity And Spec Review

Goal:

Confirm the Vite/Hono app preserves current intended behavior and only diverges from specs where the current fork intentionally improved behavior.

Scope:

- Review specs in `specs/` against migrated behavior.
- Check product search, URL state, nav badges, auth gate, product detail, cart, PLP actions, cart actions, category search, subcategories, shortcuts, bundle UI, cookbook, recipe, login, and payment.
- Compare migrated screens visually against the current Next app and treat unintended visual drift as a regression.
- Do not edit spec files unless explicitly requested.
- Document intentional divergences in this file or a review note.

Validation:

- Typecheck, lint, web/API builds.
- Manual smoke test matrix across all core flows.

### Chunk 18: Cloudflare Deployment Configuration

Goal:

Make the migration deployable as one Worker serving static assets and API routes.

Scope:

- Finalize `wrangler.jsonc`.
- Confirm static asset caching.
- Confirm SPA fallback for direct web routes.
- Configure production cookie security.
- Confirm environment variable strategy, if any.
- Add deployment notes to `platform_migration.md` or this file.

Validation:

- `npm run build:web`
- `npm run build:api`
- Local `wrangler dev` smoke test.
- Cloudflare preview or dry-run deploy check.

### Chunk 19: Stability And Performance Testing

Goal:

Prove the Worker app is fast, reliable, and suitable for the free tier.

Scope:

- Exercise login, search, categories, product, cart, cookbook, recipe, payment profile, and checkout status flows.
- Watch Worker logs for CPU-heavy requests and unexpected upstream fan-out.
- Check bundle size and route-level splitting.
- Check API response sizes for large pages.
- Check auth expiration handling.
- Check no private responses are cached publicly.

Validation:

- Manual smoke test matrix completed.
- Worker dry-run build passes.
- No obvious CPU or request explosion issues.

### Chunk 20: Retire The Next App

Goal:

Remove or archive the old Next app only after feature parity and deployability are proven.

Scope:

- Remove Next-specific source and dependencies.
- Remove old scripts.
- Keep shared parser/service code in its final home.
- Update docs to make Vite/Hono the default development flow.
- Confirm no imports from `next/*` remain.

Validation:

- Clean install.
- Typecheck, lint, web build, Worker dry-run build.
- Final full manual smoke test.

## Always-Run Validation Baseline

Use the smallest relevant set while developing, then run the full baseline before committing a chunk:

```powershell
npm run lint
npx tsc --noEmit --pretty false
npm run build:web
npm run build:api
npm run build
```

After the Next app is retired, replace `npm run build` with the final Worker/web build commands only.
