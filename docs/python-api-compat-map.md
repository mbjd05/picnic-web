# Picnic API Reference Compatibility Map

References reviewed:

- <https://github.com/codesalatdev/python-picnic-api> at commit `883899d` on 2026-07-31.
- <https://github.com/ivo-toby/mcp-picnic> at commit `6714555` on 2026-07-31.

This is a three-way comparison between this migrated Cloudflare Worker app, the Python Picnic API fork, and the MCP Picnic server. It tracks only direct Picnic API/page functionality or compatibility hardening. MCP-only AI workflows, prompt helpers, and lossy LLM response shaping are excluded from the implementation roadmap.

This document does not replace profile/settings CRUD research in `docs/registration-onboarding-flow.md`.

## Ranked Implementation Queue

Wallet transaction reads have an unfinished branch, `feature/wallet-transactions`, but remain parked until a test account has transaction data. Profile/settings CRUD research and the first editable account settings have been merged into `main`; the active queue now starts with onboarding support.

### 1. Profile Settings CRUD Research And Profile Menu

Reference: `docs/registration-onboarding-flow.md`, Python fork, MCP Picnic.

Status: merged into `main` through PR #8. The initial profile menu/account settings scope is complete; remaining unknown profile mutations stay documented as intentionally unsupported until their Picnic routes are safely confirmed.

Direct Picnic surfaces currently confirmed or strongly indicated:

```text
GET /user
GET /profile-menu?fetch_mgm=true
GET /consents/settings-page
PUT /consents
GET /consents/general/settings-page
PUT /consents/general
POST /user-onboarding/household-details
POST /user-onboarding/business-details
```

Why it made the cut:

- It is core account functionality rather than a convenience feature.
- Read-only profile display can be useful before every write route is proven.
- Consent settings have clearer confirmed read/update routes than delivery address edits.

Implemented approach:

- Start with a profile menu/page that reads safe account/profile data and links to focused settings areas.
- Keep delivery address read-only until an authenticated address-change route is discovered and tested.
- Add consent updates only with reversible, explicit user actions.
- Treat household and business details as separately guarded settings after payload validation.

Current implementation:

- `/account` reads `GET /user`, `GET /user-info`, `GET /profile-menu?fetch_mgm=true`, and consent settings through an authenticated Worker route.
- The page shows account, contact, delivery address, household, delivery count, subscription, and consent summaries.
- Household composition is editable through `POST /user-onboarding/household-details`.
- Privacy/marketing consent switches merge normal and general settings-page items and are editable through `PUT /consents`.
- The general consent request itself remains hidden/read-only because `PUT /consents/general` still lacks a confirmed safe payload.
- Address, contact details, business details, and push subscription device registrations remain read-only or hidden until their mutation semantics are safer.
- Focused address rediscovery on 2026-08-10 did not find a current package, public-web, deeplink, Fusion page, or Page Task route for authenticated delivery-address edits. Keep address editing out of the UI until the official app flow can be observed.

### 2. Onboarding Support

Reference: `docs/registration-onboarding-flow.md`.

Direct Picnic surfaces:

```text
POST /public-api/17/user-onboarding/check-address
POST /public-api/17/user-onboarding/register
POST /public-api/17/user-onboarding/register-leadlist
POST /public-api/17/user-onboarding/activate
```

Why it makes the cut:

- It is the largest missing first-run flow.
- It should build on the profile/settings route research so region, address, household, consent, and activation behavior are not duplicated or guessed.

Recommended implementation:

- Implement only after profile/settings research clarifies the post-login account model.
- Keep public onboarding routes isolated from authenticated settings routes.
- Prefer a guided flow with explicit region and address validation before registration/activation.

### 3. Product Detail Category Name Resolution

Reference: Python fork.

Direct Picnic surface:

```text
GET /pages/L2-category-page-root?category_id={l2}&l3_category_id={l3}
```

The Python fork uses category IDs from the product page category button, then reads the selected L3 category label from the category page.

Why it makes the cut:

- Direct Picnic category metadata.
- Improves product detail navigation without guessing labels.

Recommended implementation:

- Resolve category labels from Picnic category pages when product detail exposes category IDs.
- Keep the UI small, likely as a navigable breadcrumb/tag rather than another prominent control.

### 4. User-Created Recipe Scope

Reference: MCP Picnic.

Direct Picnic surface:

```text
GET /pages/cookbook-page-content
```

Relevant data:

```text
segment_type = USER_DEFINED_RECIPES
segment_type = SAVED_RECIPES
```

Why it makes the cut:

- Real Picnic cookbook functionality.
- Read-only.
- Our app already supports featured, category, search, and saved recipe scopes, so an "Eigen recepten" scope is a natural extension if the API exposes it.

Recommended implementation:

- Extend cookbook parsing to preserve segment types.
- Add an own-recipes scope only when `USER_DEFINED_RECIPES` is present.
- Prefer dynamic segment discovery over hardcoded assumptions.

### 5. Barcode / GTIN Product Lookup

Reference: Python fork.

Direct Picnic behavior:

```text
https://picnic.app/{country}/qr/gtin/{ean}
```

The Python fork follows Picnic redirects to discover a product ID, then fetches the product detail.

Why it makes the cut:

- Direct Picnic product lookup behavior.

Why it is lower priority:

- No current scanner/manual barcode UI.
- Adds little to the current web shopping workflow unless we build barcode entry/scanning.

## Parked Until Test Data Exists

### Wallet Transaction Reads

Reference: MCP Picnic.

Status: active on branch `feature/wallet-transactions` as a read-only Picnic wallet page. The page now follows the app-observed `Portemonnee` / `Saldo` model first, with balance and delivery-debt summary before transaction history.

Direct Picnic surfaces through `picnic-api`:

```text
payment.getWalletTransactions(pageNumber)
payment.getWalletTransactionDetails(transactionId)
```

Research status:

- `picnic-api@4.6.0` exposes both methods.
- The JS package maps them to:
  - `POST /wallet/transactions` with `{ page_number }`
  - `GET /wallet/transactions/{walletTransactionId}`
- `scripts/picnic-checkout-probe.mjs wallet-shape 1` confirmed the list endpoint is accepted for the current test account.
- Sensitive app traffic confirmed the official wallet entrypoints:
  - `GET /pages/portemonnee-page`
  - `GET /pages/saldo-overview-page`
  - `GET /pages/saldo-balance-page`
  - `GET /wallet/debts`
  - `POST /wallet/transactions`
- The current test account returned an empty first page, so live item/detail shape remains unconfirmed in populated data.
- Package types indicate list fields including `id`, `timestamp`, `amount_in_cents`, `display_name`, `brand`, `status`, `transaction_method`, and `transaction_type`; details include delivery/order item, deposit, fee, refund, and payment-option fields.
- Picnic's own payments engineering blog describes the wallet as a customer-facing abstraction for reducing and combining many delivery-related payment movements into understandable transactions.
- Treat wallet as Picnic balance first: refunds, deposit/statiegeld returns, and other settlements can produce saldo that is automatically settled against a later order. It is not the direct iDEAL/Wero checkout initiation flow. Direct checkout remains based on `payment-profile` plus `/cart/checkout/initiate_payment`.

Recommended implementation:

- Keep the current branch separate and current with `main` until the empty-account UI is validated.
- Validate list/detail rendering once a wallet with transactions is available.
- Keep populated arrays in a generic debug-friendly presentation until real wallet data proves the stable detail shape.
- Only then decide whether the page belongs under account/payment or a broader account menu.

## Already Implemented From This Queue

### Delivery Management Actions

Reference: MCP Picnic.

Status: implemented in `0f5ac88` on the Cloudflare Worker migration branch. The UI exposes order status on demand, guarded cancellation, invoice email resend, and completed-delivery rating from the delivery detail page.

Direct Picnic surfaces through `picnic-api`:

```text
cart.getOrderStatus(orderId)
delivery.cancelDelivery(deliveryId)
delivery.setDeliveryRating(deliveryId, rating)
delivery.sendDeliveryInvoiceEmail(deliveryId)
```

Why it makes the cut:

- Complements the already-adopted `/deliveries` page.
- `getOrderStatus` is read-only.
- Cancellation is high-impact but core order-management functionality.
- Rating and invoice email belong naturally on completed delivery details.

Recommended implementation:

- Show order status on delivery detail when an order ID is available.
- Expose cancellation only when Picnic marks the order/delivery cancellable.
- Require explicit user confirmation for cancellation.
- Add invoice resend where it naturally fits completed delivery details.
- Do not expose rating unless the API clearly indicates the delivery is rateable.

### Recipe URL And Share-Link Resolution

Reference: MCP Picnic.

Status: implemented on `feature/recipe-url-resolution`. Cookbook search accepts Picnic recipe IDs or supported Picnic recipe links on Enter and opens the resolved recipe detail page. The Worker exposes an authenticated resolver route for HTTPS `picnic.app` share links, with redirect host revalidation before accepting a resolved recipe ID.

Direct Picnic behavior:

- Bare recipe/selling-group IDs.
- Canonical Picnic recipe URLs.
- `selling_group_id` or legacy `recipe_id` query/deeplink parameters.
- Picnic short share links resolving through HTTPS `picnic.app`.

Why it makes the cut:

- Maps external Picnic URLs to actual `selling_group_id` values.
- Useful if we add a direct "open recipe URL" flow.
- MCP Picnic has good safety constraints: allow only HTTPS `picnic.app` hosts and re-check redirect targets.

Current UI:

- Cookbook search accepts direct Picnic recipe links and IDs.
- Global search accepts supported Picnic links and routes to the resolved recipe or product.

## Already Adopted

### Promotions / Acties

Reference: MCP Picnic.

MCP Picnic uses:

```text
GET /pages/promo-page-all-promos-redirect
```

Live comparison on 2026-07-31 showed:

- `home_page_root` has an `Acties van de week` shortcut to `promo-page-all-promos-redirect`.
- `home_page_root` has an `Alle acties` shortcut to `promo-page-root`.
- `promo-page-root` and `promo-page-all-promos-redirect` returned the same 161 product IDs, the same 78 promotion IDs, and the same campaign sections for NL.

Status: already covered by the existing shortcut/content-page flow. Do not add a separate promotions implementation unless the current parser drops promotion labels, sections, or product data.

### Product Detail Text Parsing

Reference: Python fork.

Adopted in `src/lib/parse-fusion-product.ts`: product name, brand/producer, unit quantity, and price-per-unit are parsed by PML role rather than fixed markdown position.

### Product Page Category IDs

Reference: Python fork.

Adopted as `ProductDetail.categoryIds`, parsed from the product page `category-button` deep-link:

```text
app.picnic://categories/{l1}/l2/{l2}/l3/{l3}
```

### Explicit 2FA Channel Support

References: Python fork and MCP Picnic.

Adopted at the API service boundary. Login routes accept optional:

```ts
twoFactorChannel: "SMS" | "EMAIL";
```

The visible login UI still defaults to SMS.

### Delivery History And Live Delivery Data

References: Python fork and MCP Picnic.

Adopted in Worker routes and `/deliveries` UI:

```text
POST /deliveries/summary
GET /deliveries/{delivery_id}
GET /deliveries/{delivery_id}/scenario
GET /deliveries/{delivery_id}/position
```

### Recipe Save And Add-To-Cart Tasks

Reference: MCP Picnic.

Mostly adopted:

```text
POST /pages/task/recipe-saving
POST /pages/task/assign-selling-group-to-basket
POST /pages/task/remove-selling-group-from-basket
```

This app supports saving/unsaving and adding recipe ingredients to cart. Removing an assigned recipe group is not currently exposed in the UI.

### Dynamic Cookbook Categories

Reference: MCP Picnic.

Mostly adopted: this app dynamically discovers cookbook categories and validates category IDs before fetching category pages. MCP Picnic's underscore/dash fallback remains a useful compatibility reference.

## Current Better Implementations In This App

### API Package Baseline

- Python fork: API version 15, older agent.
- MCP Picnic: `picnic-api@^4.5.0`, default API version 15.
- This app: `picnic-api@4.6.0`, aligned with the migrated Worker branch.

Decision: keep this app's newer JS package baseline.

### Search

- Python fork: Fusion search page endpoint.
- MCP Picnic: `client.catalog.search()` with pagination and result filtering for LLM context.
- This app: combines Picnic search surfaces so uncategorized direct products still appear under the main result section.

Decision: keep this app's search behavior.

### Cookbook And Checkout

The Python fork does not implement this app's current cookbook UI, saved recipe flow, recipe cart integration, or direct payment support.

Decision: keep this app's implementations and use MCP Picnic only for direct endpoint/segment discoveries.

## Excluded From Implementation Roadmap

These MCP Picnic features are useful for AI/MCP interaction but are not direct Picnic app functionality:

- Meal-planning prompts.
- Budget-shopping prompts.
- Dietary-substitution prompts.
- Special-occasion/pantry/order-management prompt templates.
- Consolidated shopping-list generation across multiple recipes.
- Meal-combination ranking by shared ingredients.
- LLM-sized response filtering and pagination where it only exists to reduce model context usage.
- MCP transports, resources, prompt registry, Smithery packaging, Docker packaging.

Also excluded for production web:

- File-based credential/session storage from `PICNIC_USERNAME` and `PICNIC_PASSWORD`.
- File-based device ID persistence for the Worker app.

Reason: this web app should remain a user-facing Picnic client with HTTP-only cookie session handling, not an automation server configured with a user's Picnic password.

## Profile/Settings CRUD

Python fork models user, address, household, and subscription reads through `GET /user`. MCP Picnic exposes user details and user info/feature toggles through the JS package. Neither reference implements authenticated delivery address or household write routes.

Decision: keep `docs/registration-onboarding-flow.md` as the source of truth for profile/settings CRUD discovery.
