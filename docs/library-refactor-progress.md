# Library Refactor Progress

## Phase Checklist

- [x] Phase 1: Valibot request/input validation
- [x] Phase 2: Zustand client-only cart/UI state
- [x] Phase 3: TanStack Form login/payment/rating forms
- [x] Phase 4: Ky-backed API client wrapper
- [x] Phase 5: TanStack Virtual performance spike
- [x] Phase 6: Persistent cache decision: idb for reload-persistent product browsing

## Current Status

Completed body/input validation for cart mutations, delivery slots, payment option creation, checkout cancel, auth login, 2FA verification, country switching, delivery rating, and recipe add-to-cart.

Moved visible cart UI state to a small Zustand store while keeping server state in TanStack Query and the existing per-product mutation coordination in the cart provider.

Moved login, payment-bank selection, and delivery-rating submit controls to TanStack Form without changing visible UI or request payloads.

Moved the existing browser `fetchJson` implementation onto Ky while preserving its public API, same-origin credentials, JSON parsing, expired-session redirect behavior, and non-`ApiClientError` network failures.

Rejected TanStack Virtual for the current product grids. The app's main product views use responsive CSS grids plus section headers that drive the sticky section navigation. Virtualizing those rows now would make section DOM positions synthetic and would risk regressions in active-section highlighting, scroll restoration, and browser back behavior. Revisit only if profiling shows rendering, not API/image loading, is the bottleneck and after replacing section tracking with virtualization-aware measurements.

Added a small `idb` persistence layer for reload-persistent product browsing only. It hydrates before React renders and persists only categories, subcategories, product search results, category product pages, and shortcut product pages. It explicitly excludes cart, payment profile, deliveries, saved recipes, recipe detail, and other private or fast-changing account data. Cache entries are discarded after 30 minutes.

Measured in the local Worker build on `/?q=banaan`:

- Without persisted cache: one `/api/search` request after reload; results ready after about `2876 ms`.
- With warmed `idb` cache: zero `/api/search` requests after reload; results ready after about `1102 ms`.

The added implementation is one isolated module plus startup installation and tests. Bundle impact was `+6.77 kB` minified and `+2.26 kB` gzip versus the pre-`idb` build. Dexie remains unnecessary because this is a simple key-value persisted query snapshot, not a relational/indexed local database.

## SOLID Pass

- Single responsibility improved: API body validation now lives in `src/lib/api-validation.ts`; visible cart UI state now lives in `apps/web/src/cart-ui-store.ts`; browser HTTP behavior remains centralized in `fetchJson`.
- Open/closed improved: new request body shapes can be added as Valibot schemas without editing each service's manual parsing logic.
- Liskov substitution is not a major pressure point in this codebase because there are few inheritance-style abstractions.
- Interface segregation is already mostly followed through small service functions and UI components; the cart context remains intentionally broader because product cards need a single ergonomic cart API.
- Dependency inversion improved at the browser API boundary: route/page code depends on the app-level `fetchJson` contract, not directly on `fetch` or Ky.

## Validation Log

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`
- Phase 2 repeated `pnpm format:check`, `pnpm typecheck`, and `pnpm test:unit`.
- Phase 3 repeated `pnpm format:check`, `pnpm typecheck`, and `pnpm lint`.
- Phase 4 repeated `pnpm typecheck`, `pnpm lint`, and `pnpm test:unit`.
- Phase 5 decision: no code adoption for TanStack Virtual yet; avoid until profiling shows render work is the bottleneck.
- Phase 6 decision: keep `idb` because the measured reload benefit is clear and the implementation remains narrowly scoped.
