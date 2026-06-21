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
- [x] Chunk 7: Port payment profile and checkout API routes to Hono.
- [x] Chunk 8: Add Worker API security, headers, and response helpers.
- [x] Chunk 9: Establish the Vite web app shell, styling baseline, and API client.
- [x] Chunk 10: Port login UI and session handling.
- [x] Chunk 11: Port home, search, categories, and product listing UI.
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
- Authenticated recipe save/restore and selected-ingredient cart mutation checks now run in `npm run smoke:api:auth`; full recipe add-to-cart UI testing remains scheduled for Chunk 14/19.

### Chunk 7: Payment And Checkout API Routes

Commit: `5c11346 Port payment routes to Hono`

Implemented:

- Removed the Next dependency from shared Picnic payment helpers and made payment error mapping framework-neutral.
- Extracted shared services for payment profile reads, preferred payment option creation/removal, checkout start, checkout cancellation, and checkout status.
- Added Hono routes for `GET/POST /api/account/payment-profile`, `POST /api/account/payment-profile/payment-options`, `DELETE /api/account/payment-profile/payment-options/:paymentOptionId`, `POST /api/checkout/start-payment`, `POST /api/checkout/cancel`, and `GET /api/checkout/status/:transactionId`.
- Kept the existing Next payment routes as thin adapters over the shared services.
- Preserved iDEAL | Wero restrictions and naming, bank validation, preferred option verification, payment return URL handling, checkout error codes, and inactive transaction handling.
- Preserved same-origin checks on every payment and checkout mutation.

Validated:

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build:web`
- `npm run build:api`
- `npm run build`
- Authenticated payment-profile reads now run in `npm run smoke:api:auth`; payment-option mutations and checkout remain scheduled for Chunk 19.

### Chunk 8: Worker Security And Response Helpers

Commit: `feaa020 Harden Worker API responses`

Implemented:

- Added shared Hono helpers for status handling, auth-required responses, private-response cache prevention, and unhandled upstream failures.
- Centralized security middleware for all `/api/*` routes, including same-origin enforcement for every unsafe method.
- Applied `Cache-Control: no-store`, `Pragma: no-cache`, and `Expires: 0` to private API responses while preserving health and image caching behavior.
- Added response hardening headers to Worker API responses and Cloudflare-served Vite assets.
- Preserved the distinct auth endpoint error shape for rejected cross-origin requests.
- Narrowed established-session expiry detection so generic upstream 403 failures no longer force a login redirect.
- Kept Worker error logs useful without including tokens, credentials, request bodies, or user input.
- Added an authenticated Worker smoke harness with dynamic fixture discovery, guarded cart/recipe/delivery-slot mutations, and exact state restoration.

Validated:

- `npm run validate`
- Local Worker response checks for public health headers, private no-store headers, and auth/non-auth cross-origin rejection bodies.
- Confirmed the Worker dry-run includes the static `_headers` file.
- Confirmed no Worker/service log statement emits tokens, passwords, email addresses, credentials, or request bodies.
- `npm run smoke:api:auth`: 43 checks passed against the local Worker, including cart, saved recipe, recipe ingredient, and delivery-slot restoration; interactive credential/2FA login remains an explicit optional check via `--credentials`.

### Chunk 9: Vite Web App Shell And API Client

Commit: `52d3077 Establish Vite application shell`

Implemented:

- Added the Tailwind Vite integration and ported the current Picnic design tokens and global styling baseline.
- Added responsive authenticated and standalone shells with the existing header navigation, search, country switcher, cart summary, logout, loading, error, and not-found surfaces.
- Added a typed JSON client with structured errors, same-origin credentials, and centralized expired-session redirects that preserve the requested return URL.
- Added pathless TanStack Router layouts and route definitions for every current user-facing URL.
- Added Vite API proxying for local development and limited Worker-first routing to `/api/*`, allowing Cloudflare assets to provide SPA fallback without unnecessary Worker execution.

Validated:

- `npm run validate`
- Direct Worker requests to `/login`, `/cart`, and a nested category URL all returned the SPA shell with static security headers.
- Authenticated headless Chromium checks confirmed client-side navigation, all expected header links, no desktop/mobile page overflow, and a usable 390px header layout.
- Desktop, mobile, and standalone-login screenshots were inspected for blank output, overlap, and framing.

### Chunk 10: Port Login UI

Completed in `089a371` (`Port login UI to Vite`).

Implemented:

- Ported the existing localized login experience to Vite and TanStack Router without redesigning it.
- Preserved credential and auth-token modes, country selection, password/token visibility controls, expired-session messaging, safe return redirects, and the in-memory 2FA verification step.
- Routed all authentication calls through the Hono Worker and retained full-page navigation after success so the authenticated shell starts after cookies are accepted.
- Kept full and partial tokens out of browser-visible storage; the partial 2FA token exists only in component state and the full token is stored by Hono in an HTTP-only cookie.
- Corrected the Vite development proxy origin so unsafe same-origin API mutations pass the Worker's strict origin validation during local development.
- Preserved specific localized errors for invalid tokens, credentials, and 2FA codes on non-success HTTP responses.

Validated:

- `npm run validate`
- Headless Chromium verified expired-session messaging, NL/DE localization, password and token visibility toggles, and successful auth-token login through the Vite UI.
- Successful login followed the requested `/cookbook` redirect, mounted the authenticated header, and issued `picnic_auth_token` with `HttpOnly` and `SameSite=Strict`.
- A direct Hono login request independently confirmed the environment token was valid while diagnosing the development-proxy origin mismatch.
- Credential validation and the 2FA UI/endpoint contract are implemented; a live credential/2FA completion was not repeated because test credentials and a newly delivered verification code were not available for this chunk.

### Chunk 11: Port Home, Search, Categories, And Product Listing UI

Completed in `7da8686` (`Port product browsing UI to Vite`).

Implemented:

- Ported home category/shortcut browsing, arbitrary shortcut pages, category navigation, subcategory product listings, global search, and search suggestions to Vite and TanStack Router.
- Preserved search query URL state, the grey result count, and the `Alle resultaten voor "<term>"` section heading.
- Added a Vite-shell header extension so section navigation remains part of the sticky header on search, shortcut, and category-product pages.
- Ported section scroll-spy behavior and automatic horizontal pill scrolling so the active section remains visible.
- Follow-up `ed51ad8` replaced hash-based section links with history-neutral buttons, fixed final-section alignment, and added faster non-flashing suggestions with full arrow-key and Enter selection.
- Ported the existing product-card presentation, bio prefixes, highlights, flags, badges, unavailable state, bundle progress, and pricing.
- Added shell-level optimistic cart state so product-card controls and the header cart badge share one initial cart request and one mutation queue.
- Kept global search and suggestions available from every authenticated route and synchronized the field with TanStack Router URL state.

Validated:

- `npm run validate`
- Authenticated Chromium loaded 33 home rows across `Snel naar` and `Alle categorieën`, and followed `Alle acties` to `/pages?pageId=promo-page-root` with 160 rendered product cards.
- Searching for `banaan` returned seven suggestions, preserved `/?q=banaan` and the visible input value, showed `86 resultaten voor “banaan”`, and rendered `Alle resultaten voor "banaan"` plus `Bekijk ook` in both content and section navigation.
- Category navigation reached `/categories/21724/CustomCatNLFruitLvl2Pos1` with 23 products and a sticky section bar.
- A real product add/remove cycle completed through Hono and restored the original cart state.
- On the 23-section `Alle acties` page, scroll-spy automatically kept the active pill fully visible in the horizontal strip.
- Follow-up browser validation confirmed the last pill lands at the sticky offset and becomes active, section clicks do not alter the hash or history length, Back returns to `/`, suggestions remain visible during refresh, and Arrow Down/Up/Enter select and submit the expected result.
- Desktop search and 390x844 category-product screenshots were inspected; the mobile page had no horizontal overflow.

## Remaining Chunks

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
npm run validate
```

`validate` runs these steps sequentially:

```powershell
npm run lint
npm run typecheck
npm run build:web
npm run build:api
npm run build
```

After the Next app is retired, replace `npm run build` with the final Worker/web build commands only.
