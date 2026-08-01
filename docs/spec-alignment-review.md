# Spec Alignment Review

Reviewed against `.specify/memory/constitution.md`, `.specify/templates/*`, and
`specs/001` through `specs/018`.

## Intentional Divergence

- **Next.js file paths in specs and contracts**: The inherited specs reference `src/app`,
  Next route handlers, middleware, `next/image`, and `localhost:3000`. The migrated project
  intentionally implements the same user-facing routes and internal API contracts through
  `apps/web` (Vite/TanStack Router) and `apps/api` (Hono Worker). Treat the HTTP behavior as
  authoritative, not the old Next-specific file paths.
- **Product cards are clickable**: `001-product-search` says product cards are display-only,
  but `005-product-detail-page` supersedes that by requiring product cards and sliders to link
  to product detail pages.
- **Cart is no longer read-only**: `006-cart-page` originally requires a read-only cart, but
  `007-plp-cart-actions` and `008-cart-page-actions` intentionally add cart mutation controls,
  optimistic updates, and rollback handling.
- **Auth is broader than token-only**: `004-auth-token-gate` specifies token login. The current
  app intentionally keeps token login while adding credential login, 2FA, per-region session
  handling, and local-only `/api/dev/login-from-env`.
- **Search/category behavior is richer than the original specs**: Current search merges broader
  API result sources, localizes API section labels, supports cached browsing data, and renames
  the anti-category search section to "Alle resultaten voor ..." in the visible header. These
  are intentional UX/API improvements beyond the inherited specs.
- **Recipe, payment, delivery, language, region, and theme features are not fully represented
  by specs 001-018**: They are current project scope even though the inherited specs do not
  define them.

## Current Adherence

- **Architecture direction**: Feature/shared code no longer imports from `apps/web/src/app`.
  Providers live in `apps/web/src/providers`, and `app` is primarily router/shell composition.
- **No blind barrels**: Shared imports remain direct, matching the constitution and Bulletproof
  guidance.
- **Naming and folder conventions**: ESLint enforces kebab-case files/folders for source and
  scripts.
- **Formatting and linting**: `pnpm validate` includes lint, typecheck, unit tests, coverage,
  Vite build, and Worker dry-run build.
- **Auth token storage**: Full Picnic tokens are kept in HTTP-only cookies. Browser-visible
  state is used for non-secret UI preferences and local convenience caches.
- **Debug routes/logging**: The temporary debug routes called out in category/search specs are
  absent from production code.

## Tightened In This Review

- Login page titles now use the shared `TITLE_SEPARATOR`/`APP_NAME` constants, matching
  `011-dynamic-page-title`.
- Loading surface title formatting now uses the same constants.
- A stale `src/scripts` path in `scripts/settings-api-probe.mjs` was updated to `scripts`.

## Remaining Tightening Candidates

- **Large files**: File length is now treated as a review signal, not a hard
  rule. Current large responsibility-boundary review candidates include
  `apps/web/src/features/browsing/browsing-components.tsx`,
  `apps/web/src/app/app-shell.tsx`, `apps/web/src/features/auth/login-page.tsx`,
  `apps/web/src/features/recipes/recipe-pages.tsx`, `apps/web/src/features/deliveries/delivery-pages.tsx`,
  `apps/web/src/features/products/product-detail-page.tsx`, `apps/web/src/features/cart/cart-page.tsx`,
  `apps/web/src/features/payment/payment-pages.tsx`, `src/lib/i18n/translations.ts`,
  `src/lib/parse/recipe-detail.ts`, `src/lib/parse/cart.ts`, `src/lib/parse/fusion-product.ts`,
  and `src/lib/extract/card-data.ts`. Splitting these is desirable but should be done as
  feature-by-feature refactors with tests, not mechanically.
- **Spec task checkboxes are stale**: Several `tasks.md` files still show unchecked manual
  validation or old Next-file tasks even when the migrated implementation exists. Do not treat
  task checkbox state as authoritative without re-validating against current routes.
- **Docs still contain old Next examples**: The inherited specs intentionally remain historical.
  If the project starts writing new specs, generated plans should use the current `apps/web`
  and `apps/api` structure instead of the old template defaults.
- **Constitution automation can improve gradually**: responsibility-boundary heuristics,
  deeper complexity rules, and stricter no-magic-string enforcement would currently create
  broad churn. Add them as warnings first, then tighten after large modules are split.
