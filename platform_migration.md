# Platform Migration Plan

## Goal

Move Picnic Web away from Next.js SSR/App Router runtime assumptions and toward a Cloudflare Workers free-tier friendly architecture:

```text
/apps/web
  Vite + React + Tailwind
  TanStack Router
  TanStack Query
  static assets

/apps/api
  Hono
  Picnic API proxy routes
  auth cookie handling
  payment return/status routes
```

The target should keep the current product behavior, but make the runtime smaller, more predictable, and cheaper to execute on Cloudflare Workers.

## Recommendation

Use a React SPA for the UI and a small Hono Worker for authenticated API proxying.

Do not use SSR for authenticated grocery browsing. Most useful screens depend on live Picnic API data, so SSR adds Worker CPU cost and deployment complexity without meaningful SEO or first-paint benefit.

Keep the backend as a thin proxy. Do not move Picnic API calls fully into the browser unless CORS, Picnic auth headers, and credential safety are proven acceptable. The safer default is still:

- Browser talks to `/api/*`.
- Hono reads the `HttpOnly` auth cookie.
- Hono calls Picnic API with `x-picnic-auth`.
- Hono returns parsed, UI-oriented JSON.

## Core Principles

- Preserve behavior before optimizing structure.
- Preserve the current UI visually as much as practical. This migration is a platform/runtime change, not a redesign.
- Extract reusable logic before moving frameworks.
- Keep Cloudflare Worker CPU work small: route, validate, call Picnic, parse, return.
- Use client caching for interactive browsing state.
- Avoid global caching of private user data.
- Keep payment and auth flows explicit and easy to audit.
- Prefer one deployment unit if possible: Worker serving static assets and API routes.

## Target Package Layout

```text
apps/
  web/
    index.html
    src/
      routes/
      components/
      hooks/
      query/
      lib/
    vite.config.ts
    tailwind config/postcss setup

  api/
    src/
      index.ts
      routes/
        auth.ts
        cart.ts
        categories.ts
        checkout.ts
        cookbook.ts
        images.ts
        products.ts
        recipes.ts
        search.ts
      lib/
        auth.ts
        picnic-client.ts
        response.ts
        security.ts
    wrangler.jsonc

packages/
  shared/
    src/
      parsers/
      types/
      formatting/
      picnic/
```

`packages/shared` is optional at first. If the migration branch needs speed, begin by placing shared code under `apps/api/src/lib` and `apps/web/src/lib`, then extract once duplication becomes real.

## What Moves Where

### Web App

Move these concerns to `/apps/web`:

- Page components currently under `src/app/**/page.tsx`.
- Reusable components under `src/components`.
- Client contexts such as country and cart UI state.
- UI-only helpers such as formatting and image URL building.
- TanStack Router route definitions.
- TanStack Query hooks.

The web app should call API endpoints through a small typed fetch wrapper.

Example query keys:

```ts
["categories"][("category", categoryId)][("subcategory", categoryId, subcategoryId)][
  ("search", query)
][("product", productId)]["cart"]["delivery-slots"]["cookbook"][("cookbook-category", categoryId)][
  ("recipe", recipeId)
]["saved-recipes"]["payment-profile"][("checkout-status", transactionId)];
```

### API Worker

Move these concerns to `/apps/api`:

- Auth login/token/2FA routes.
- Auth cookie read/write/clear.
- Picnic API client construction.
- Picnic proxy routes for cart, search, product, categories, cookbook, recipes, payment.
- Request security checks.
- Payment return/status endpoints.
- Response normalization and auth-error classification.

The Hono API should remain stateless. Per-user caching belongs primarily in the browser via TanStack Query unless there is a very clear Worker-side reason.

### Shared Parsing

These modules should be framework-neutral before migration:

- `parse-cart`
- `parse-categories`
- `parse-category-products`
- `parse-content-page`
- `parse-cookbook`
- `parse-delivery-slots`
- `parse-fusion-product`
- `parse-fusion-search`
- `parse-recipe-detail`
- `parse-shortcuts`
- `recipe-categories`
- `recipe-quantity`
- `format-price`
- `format-delivery-window`
- `types`

They should not import Next.js, React, DOM-only APIs, or Worker-only APIs.

## Migration Sequence

### Phase 1: Stabilize Boundaries In Current App

Do this before creating the new platform branch if possible.

- Ensure route handlers delegate to framework-neutral service functions.
- Move Picnic request path construction into small API service helpers.
- Keep parser modules pure.
- Remove or isolate any Next-specific imports from reusable libraries.
- Confirm auth, checkout, cart mutations, cookbook, and search behavior with the existing app.

Exit criteria:

- Most route handlers are thin wrappers.
- Parser/service logic can be copied into Hono without dragging in Next types.

### Phase 2: Scaffold Target Apps

Create:

- `/apps/web` with Vite, React, Tailwind, TanStack Router, TanStack Query.
- `/apps/api` with Hono and Wrangler.
- Optional root workspace config if moving to a monorepo package setup.

Keep the existing Next app intact during this phase.

Exit criteria:

- Worker serves a health endpoint.
- Web app builds and renders a minimal shell.
- Local dev can run web and API together.

### Phase 3: Port API Routes To Hono

Port routes in this order:

1. Auth login/token/logout/2FA.
2. Categories and search.
3. Product details and image proxy.
4. Cart read/mutations and delivery slots.
5. Cookbook and recipe details.
6. Saved recipes and recipe add-to-cart.
7. Payment profile and checkout status/start/cancel.

For every route:

- Preserve request/response shape where practical.
- Preserve auth error semantics.
- Add `Cache-Control: no-store` for private responses.
- Avoid eager upstream calls.
- Return narrow JSON payloads consumed by the UI.

Exit criteria:

- Hono routes can replace the current `/api/*` routes for migrated screens.
- No route depends on Next request/response objects.

### Phase 4: Port UI Routes

Port UI routes in this order:

1. Login.
2. Home/search/categories.
3. Product detail.
4. Cart.
5. Cookbook.
6. Recipe detail.
7. Payment page and payment return.

Use TanStack Query for all server data. Avoid hand-written `loading/error/success` state except for local UI flows.

Use route-level code splitting. Keep expensive screens such as cookbook/recipe/payment out of the initial bundle if practical.

During UI porting, treat the current app as the visual source of truth. Preserve layout, spacing, typography scale, colors, component states, labels, and interaction affordances unless a small adjustment is required by the new platform or to fix an existing bug. Do not introduce a new visual language as part of the migration.

Exit criteria:

- Feature parity with the existing Next app.
- Browser navigation works for direct URLs.
- Auth expiration redirects correctly.

### Phase 5: Cloudflare Worker Deployment

Configure Worker assets so:

- Static web assets are served directly by Cloudflare.
- `/api/*` goes to Hono.
- SPA fallback serves `index.html` for web routes.
- Security headers are set at Worker level.

Cloudflare Workers free-tier constraints to design for:

- Keep CPU per request low.
- Avoid SSR/rendering in Worker.
- Avoid large synchronous JSON transformations when not needed.
- Avoid unnecessary upstream fan-out.
- Prefer browser session cache for private data.

Exit criteria:

- Production build deploys to Cloudflare Workers.
- Login/cart/search/product/cookbook/payment smoke tests pass.
- Worker logs do not show CPU pressure during normal browsing.

## Caching Strategy

### Browser/TanStack Query

Use browser memory cache for private user data:

- Cart: short stale time, invalidate after mutations.
- Product details: moderate stale time.
- Categories: longer stale time.
- Cookbook categories: longer stale time.
- Cookbook category views: moderate stale time.
- Saved recipes: short-to-moderate stale time, invalidate after save/unsave.
- Payment profile: short stale time, invalidate after payment changes.

Suggested defaults:

```ts
categories: staleTime 15-30 min
product: staleTime 10-30 min
search: staleTime 1-5 min
cart: staleTime 15-60 sec
cookbook categories: staleTime 15-30 min
cookbook category view: staleTime 15 min
saved recipes: staleTime 1-5 min
payment profile: staleTime 1-5 min
```

### Worker/HTTP Cache

Use conservative headers:

- Private authenticated API responses: `Cache-Control: no-store`.
- Static assets: long immutable caching via build hashes.
- Image proxy: consider `private, max-age=...` only if behavior is verified.

Do not store auth-token keyed data in Cloudflare shared cache.

## Auth And Security

Keep:

- `HttpOnly` auth cookie.
- `SameSite=Strict` for auth where compatible.
- Secure cookies in production.
- Explicit country cookie.
- Same-origin checks for unsafe API methods.
- No-store headers on auth and private API responses.

Improve:

- Distinguish true token expiration from generic upstream 403/rate-limit/anti-abuse responses.
- Keep 2FA states explicit.
- Make credential login and token login share a clear auth-state model.

## Payment Flow Requirements

Payment endpoints must stay server-side in Hono:

- Payment profile.
- Payment option management.
- Checkout start.
- Checkout cancel.
- Checkout status polling.
- Payment return route handling.

Do not expose Picnic payment auth details to browser code beyond narrow app-specific responses.

## Risks

- Rewriting routing and data fetching can regress small interaction details.
- Picnic API response shapes are unstable; parser tests or probes are valuable.
- Cloudflare Worker runtime differs from Node; dependencies must be Worker-compatible.
- `picnic-api` may rely on Node assumptions in future versions; verify during migration.
- Payment and auth flows need careful manual testing.

## Non-Goals

- No redesign.
- No visual reinterpretation of existing screens during the migration.
- No new product features during migration.
- No SSR reimplementation.
- No database unless a later feature explicitly requires one.
- No global caching of private Picnic data.

## Success Criteria

- Fast and reliable Picnic API interaction.
- Runs on Cloudflare Workers free tier without SSR.
- Fast static asset delivery.
- Low Worker CPU per request.
- Same feature coverage as the current fork.
- Stable auth/session behavior.
- Cart and payment flows remain reliable.
- Fewer repeated Picnic upstream calls during normal browsing.

## Current Worker Deployment Notes

The migration branch currently deploys as one Cloudflare Worker from `apps/api/wrangler.jsonc`.

- `apps/web` builds static assets into `apps/web/dist`.
- The Worker assets binding serves `apps/web/dist`.
- `run_worker_first` is limited to `/api/*`, so normal web routes are served as static assets without invoking Hono.
- `not_found_handling = "single-page-application"` serves the SPA shell for direct client routes such as `/cart`, `/product/:id`, and `/recipe/:id`.
- `apps/web/public/_headers` keeps `index.html` revalidatable and serves hashed Vite chunks under `/assets/*` with long immutable caching.
- Private authenticated API responses are marked `Cache-Control: no-store` by Hono middleware.
- Auth cookies are `HttpOnly`, `SameSite=Strict`, path-scoped to `/`, and marked `Secure` whenever the incoming request is HTTPS, which is the production Cloudflare path.

Deployment command:

```powershell
npm run deploy:worker
```

Validation before deployment:

```powershell
npm run validate
npm run build:web
npm run build:api
```

Authenticated production smoke testing remains part of the later stability/performance chunk because it requires a live token, live Picnic state, and careful payment/cart mutation boundaries.
