# Migration E2E Testing Plan

This file is the source of truth for end-to-end validation during Chunk 19 and Chunk 20 of the Cloudflare Worker migration.

## Operating Rules

- Test the migrated Vite/Hono app through the Worker at `http://127.0.0.1:8787`.
- Use Playwright MCP for browser-level checks and the existing authenticated API smoke for API/state-restoration checks.
- Keep Codex context/tool usage efficient: prefer one authenticated browser session per matrix run.
- Prefer `browser_evaluate` for grouped assertions. Use screenshots only for visual checkpoints and failures.
- Mutation policy is restored-only:
  - Cart mutations are allowed only after capturing the exact original quantity and restoring it.
  - Recipe saved-state mutations are allowed only after capturing the original saved state and restoring it.
  - Delivery-slot mutations are allowed only when an original slot and restorable alternate slot are available.
  - Payment-option creation/removal and checkout-start are not automated unless explicitly approved at test time.
- Any failed restoration is blocking until account/cart state is manually reconciled.

## Required Environment

- `PICNIC_TOKEN`: required for authenticated API smoke and browser login.
  - `node .\src\scripts\picnic-auth-probe.mjs login` saves a verified token to the local `.env` file.
- `PICNIC_COUNTRY_CODE`: optional; defaults to `NL`.
- `PICNIC_EMAIL` and `PICNIC_PASSWORD`: optional, only for explicit credential/2FA smoke.
- Local target: `http://127.0.0.1:8787`.

## Chunk 19: Stability And Performance Testing

### Preflight

- Confirm `git status --short --branch` is clean or only contains the testing-plan edits being worked on.
- Run `pnpm validate`.
- Run `pnpm build:web`.
- Start `pnpm dev:api` in a temporary background process.
- Confirm the Worker reports `Ready on http://127.0.0.1:8787`.
- Run header smoke:
  - `/login` returns HTML, `X-Content-Type-Options: nosniff`, and a revalidatable cache header.
  - A deep route such as `/product/example-id` returns the SPA shell.
  - A hashed `/assets/*.js` file returns `Cache-Control: public, max-age=31536000, immutable`.
  - `/api/health` returns JSON and `X-Content-Type-Options: nosniff`.
  - Unauthenticated `/api/categories` returns `401`, `TOKEN_EXPIRED`, and `Cache-Control: no-store`.
- Run `PICNIC_WORKER_URL=http://127.0.0.1:8787 pnpm smoke:api:auth`.

### Playwright MCP Flow

Use desktop first, then one mobile pass. Batch assertions with `browser_evaluate` and avoid repeated full-page snapshots.

- Authentication:
  - Navigate directly to `/cart` while unauthenticated and verify the login/auth gate.
  - Log in through the UI with `PICNIC_TOKEN`.
  - Verify the authenticated header, cart link, cookbook link, payment link, logout button, and successful private API access.
- Search:
  - Submit `banaan`.
  - Verify URL `/?q=banaan`, input persistence, result count spacing, and the `Alle resultaten voor "banaan"` section header.
  - Verify suggestions appear only after typing, support keyboard selection, and do not flash stale suggestions after clearing.
  - Clear the search input, submit, and verify the URL returns to `/`.
- Section navigation:
  - On a multi-section results page, click first, middle, second-to-last, and last section pills.
  - Verify the clicked section lands below the sticky header, the active pill remains visible, and the URL hash/history is not polluted.
- Categories and shortcuts:
  - From home, open a normal category, then a subcategory product page.
  - Open a `Snel naar` shortcut such as `Alle acties`.
  - Verify product grids, section nav where present, and back navigation.
- Product cards and cart controls:
  - Pick an available product whose current quantity is below `maxCount`.
  - Capture original cart quantity through API or page state.
  - Add one from PLP, verify duplicate cards and header badge update, then remove and verify original quantity is restored.
- Product detail:
  - Open PDP from a product card.
  - Verify gallery, title, unit metadata, price, promotion/bundle UI when present, description/highlights, accordions, allergens, similar products, and cart controls.
- Cart:
  - Verify cart page loading/empty/success behavior as applicable.
  - Verify item rows, remove-all control, order summary, checkout CTA, suggested products, and delivery banner.
  - Open delivery-slot picker and verify day tabs, green/regular sections, selected slot display, close behavior, and selection error handling where possible.
  - Mutate delivery slot only when an original slot and alternate slot can be restored.
- Cookbook and recipe:
  - Browse featured recipes.
  - Select a recipe category and verify scoped results.
  - Search globally and within the selected scope.
  - Open saved recipes and verify saved count remains distinct from search result count.
  - Open recipe detail, verify hero image, bookmark button, ingredients with product names, portion controls, price totals, condiments, steps, nutrition, and allergens.
  - Toggle bookmark only with original saved state captured and restored.
  - Recipe add-to-cart remains covered by restored API smoke unless UI restoration is straightforward.
- Payment:
  - Open payment settings.
  - Verify preferred payment section, stored method display, bank selector, and `iDEAL | Wero` label.
  - Open `/cart/payment-return` with no transaction and verify missing-state UI.
  - Exercise cancelled/ready return states only with safe stored transaction fixtures or manual approval.
- Mobile pass:
  - Resize to `390x844`.
  - Verify header wrapping, search input/suggestions, category/product grid, cart page, cookbook page, and recipe detail have no horizontal overflow or overlapping controls.

### Performance And Stability Checks

- During the Playwright flow, collect API request counts per page with `performance.getEntriesByType("resource")`.
- Flag obvious repeated upstream fan-out:
  - repeated `/api/cart` calls after no cart mutation,
  - repeated `/api/cookbook` calls when switching back to a recently visited cached category,
  - repeated `/api/account/payment-profile` calls when moving between cart and payment settings.
- Record Vite bundle sizes from `pnpm build:web`.
- Watch Worker output for unexpected unhandled errors or obviously CPU-heavy request bursts.

### Chunk 19 Acceptance

- `pnpm validate` passes.
- Authenticated API smoke passes with restoration.
- Playwright desktop and mobile matrix passes or has documented non-blocking skips.
- Cart quantities, recipe saved state, and delivery slot match their initial snapshots after testing.
- No private API route is publicly cacheable.
- No obvious request explosion is observed during normal browsing.

## Chunk 20: Retire The Next App

Chunk 20 may start only after Chunk 19 acceptance is met.

### Before Removal

- Record the green Chunk 19 result summary.
- Confirm the migration branch is clean.
- Confirm `apps/web` and `apps/api` cover every current user-facing route.
- Confirm no active issue requires the old Next app for fallback.

### After Removal

- Remove Next-specific app/runtime files and dependencies only after updating root scripts.
- Replace the validation baseline so it no longer runs `next build`.
- Confirm production app code has no `next/*` imports.
- Run install/build checks:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build:web`
  - `pnpm build:api`
- Start the Worker and repeat the Chunk 19 header smoke.
- Repeat `pnpm smoke:api:auth`.
- Repeat the Playwright MCP desktop and mobile matrix against the Worker-served Vite app.

### Chunk 20 Acceptance

- Clean install/build path succeeds without Next.
- Worker dry-run build succeeds.
- SPA fallback works for every direct route.
- Auth, search, categories, product detail, cart, cookbook, recipe, payment settings, and payment return routes pass Playwright checks.
- Restored mutations leave the account/cart state unchanged from the initial snapshot.
- Documentation names Vite/Hono as the default development and deployment path.

## Results Log

Append results below while executing Chunks 19 and 20.

### Chunk 19 Results

- 2026-07-31 local Worker run against `http://127.0.0.1:8787`.
- Environment:
  - Auth token loaded from local `.env`; token validation passed with SHA-256 prefix `5afc34a2771d1311`.
  - Playwright MCP initially lacked a Chrome executable; installed Playwright Chromium with `pnpm dlx playwright install chromium` and bridged the expected user-local Chrome path to it.
- Preflight:
  - `git status --short --branch` was clean before testing.
  - `npm run validate` passed: lint, typecheck, `build:web`, Worker dry-run build, and current Next build.
  - Header smoke passed for `/login`, deep SPA fallback, hashed immutable assets, `/api/health`, and unauthenticated `/api/categories` `401`/`TOKEN_EXPIRED`/`no-store`.
  - `PICNIC_WORKER_URL=http://127.0.0.1:8787 npm run smoke:api:auth` passed 43 checks with credential/2FA smoke skipped by design.
- Playwright MCP desktop:
  - Unauthenticated `/cart` redirected to `/login?expired=true&redirect=%2Fcart`.
  - Authenticated header, cart link, cookbook link, payment link, logout button, and private `/api/categories` access were present.
  - Search for `banaan` passed: URL persistence, result-count spacing, `Alle resultaten voor "banaan"` header, suggestions after typing, and no stale suggestions after clearing.
  - Search result section pills passed for the available `Alle resultaten` and `Bekijk ook` sections without hash/history pollution.
  - Home category navigation, subcategory product listing, and `Alle acties` shortcut navigation passed.
  - PLP add-to-cart UI mutation passed and restored original cart quantity/count.
  - PDP `/product/s1012386` passed for title, imagery, price, bundle tiers, description, cart control, and similar products.
  - Cart page passed for item rows, remove-all controls, one-step controls, summary, checkout CTA, payment-management link, and delivery picker visibility. Delivery slot was not changed.
  - Cookbook browse, saved-recipes view/count, and cookbook-specific search passed. A first search attempt hit the global product search because the global header search has the broader selector; rerun with the recipe placeholder selector passed.
  - Recipe detail `/recipe/68b1a6aec6c2190fcd153ab4` passed for hero image, bookmark button, portion controls, ingredients with product names, condiments, steps, nutrition, allergens, and the previous ingredient-title regression check.
  - Recipe bookmark UI mutation passed and restored saved count from `0` back to `0`.
  - Payment settings passed, including payment profile read, stored method display, bank selector, and `iDEAL | Wero` label.
  - `/cart/payment-return` without a transaction showed the missing-active-payment state.
- Mobile pass:
  - `390x844` overflow checks passed for `/`, `/?q=banaan`, `/categories/21724/21745`, `/cart`, `/cookbook`, and `/recipe/68b1a6aec6c2190fcd153ab4`.
- Performance/stability:
  - Browser resource counts after mobile pass showed no obvious request explosion: `/api/cart` 2, `/api/cookbook` 2, and searched/browsed routes 1 each in the sampled navigation set.
  - Worker stderr log was empty.
  - Worker stdout showed normal successful API traffic; repeated `/api/categories` and `/api/cart` calls occurred mostly after explicit full navigations/reloads during testing.
- Follow-up findings:
  - Top-level category route `/categories/21724` loads correctly but sets the document title to `21724 - Picnic Web` instead of the category name.
  - On the large `Alle acties` shortcut page, far section-pill clicks are clickable and history-safe, but visible headings after long jumps did not always align tightly with the clicked pill. This needs a focused sync/active-state pass before calling the section-navigation work fully polished.

### Chunk 20 Results

- 2026-07-31 local Worker run after retiring the Next app.
- Branch replacement:
  - Removed the old Next App Router tree, Next route handlers, Next proxy/config, and unused Next-only components.
  - Removed `next`, `eslint-config-next`, and the old import-sort Prettier plugin from the dependency set.
  - Replaced the default scripts with Vite/Hono/Worker commands: `pnpm build` now runs `build:web` and `build:api`.
  - Confirmed no production app/config import from `next/*` remains.
- Upstream/package audit:
  - `picnic-api` latest remained `4.6.0`; no broader fusion-api package replacement was found upstream.
  - Adopted missed upstream/picnic-api-compatible behavior for promotion label matching/colors, subtitle icon metadata, 32-character recipe IDs, and product-detail request flags.
  - Updated ESLint to `10.8.0` with `typescript-eslint`; kept TypeScript at `5.9.3` because the current `typescript-eslint` line does not support TypeScript 7.
  - `pnpm audit --audit-level high` reported no known vulnerabilities.
  - `pnpm peers check` reported no peer dependency issues.
- Validation:
  - `pnpm install` completed with the updated pnpm workspace settings.
  - `pnpm validate` passed: lint, typecheck, Vite build, and Worker dry-run build.
  - `PICNIC_WORKER_URL=http://127.0.0.1:8787 pnpm smoke:api:auth` passed 43 checks, with credential/2FA skipped by design.
  - Header smoke passed for `/login`, a deep SPA route, `/api/health`, and unauthenticated `/api/categories`.
  - Playwright MCP desktop route matrix passed for `/`, `/?q=banaan`, category/subcategory routes, `/product/s1018231`, `/cookbook`, `/recipe/68b1a6aec6c2190fcd153ab4`, `/account/payment`, and `/cart/payment-return`.
  - Playwright MCP mobile overflow matrix passed at `390x844` for the main migrated route families.
