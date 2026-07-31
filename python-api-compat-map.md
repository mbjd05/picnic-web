# Picnic API Reference Compatibility Map

References reviewed:

- <https://github.com/codesalatdev/python-picnic-api> at commit `883899d` on 2026-07-31.
- <https://github.com/ivo-toby/mcp-picnic> at commit `6714555` on 2026-07-31.

This is a three-way comparison between this migrated Cloudflare Worker app, the Python Picnic API fork, and the MCP Picnic server. It tracks only direct Picnic API/page functionality or compatibility hardening. MCP-only AI workflows, prompt helpers, and lossy LLM response shaping are excluded from the implementation roadmap.

This document does not replace profile/settings CRUD research in `src/scripts/registration-onboarding-flow.md`.

## Ranked Implementation Queue

The previous delivery-related entries are intentionally merged into one first chunk, because they touch the same delivery detail/service area.

### 1. Delivery Management Actions

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

### 2. Wallet Transaction Reads

Reference: MCP Picnic.

Direct Picnic surfaces through `picnic-api`:

```text
payment.getWalletTransactions(pageNumber)
payment.getWalletTransactionDetails(transactionId)
```

Why it makes the cut:

- Direct Picnic account/payment functionality.
- Read-only.
- Useful for grocery spending and Picnic credit visibility.

Why it ranks below delivery status/cancellation:

- Needs response-shape inspection across NL/DE/FR.
- Needs a considered UI location under account/payment without cluttering payment-method management.

Recommended implementation:

- First add normalized API routes and a minimal read-only account page/section.
- Only expand UI if response data is consistently useful.

### 3. Recipe URL And Share-Link Resolution

Reference: MCP Picnic.

Direct Picnic behavior:

- Bare recipe/selling-group IDs.
- Canonical Picnic recipe URLs.
- `selling_group_id` or legacy `recipe_id` query/deeplink parameters.
- Picnic short share links resolving through HTTPS `picnic.app`.

Why it makes the cut:

- Maps external Picnic URLs to actual `selling_group_id` values.
- Useful if we add a direct "open recipe URL" flow.
- MCP Picnic has good safety constraints: allow only HTTPS `picnic.app` hosts and re-check redirect targets.

Why it is deferred:

- We currently do not expose a recipe URL input.
- It should be implemented only when there is a UI flow that needs it.

### 4. Barcode / GTIN Product Lookup

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

### 5. User-Created Recipe Scope

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

MCP Picnic maps recipe IDs to cookbook segment membership from analytics contexts.

Why it makes the cut:

- Real Picnic cookbook functionality.
- Read-only.
- Our app already supports featured, category, search, and saved recipe scopes, so an "Eigen recepten" scope is a natural extension if the API exposes it.

Recommended implementation:

- Extend cookbook parsing to preserve segment types.
- Add an own-recipes scope only when `USER_DEFINED_RECIPES` is present.
- Prefer dynamic segment discovery over hardcoded assumptions.

### 6. Product Detail Category Name Resolution

Reference: Python fork.

Direct Picnic surface:

```text
GET /pages/L2-category-page-root?category_id={l2}&l3_category_id={l3}
```

The Python fork uses category IDs from the product page category button, then reads the selected L3 category label from the category page.

Why it makes the cut:

- Direct Picnic category metadata.

Why it is lowest priority:

- We already parse product page `categoryIds`.
- The current product detail UI has the product's category tag.
- Breadcrumb/category navigation needs a small UI decision to avoid clutter.

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

Decision: keep `src/scripts/registration-onboarding-flow.md` as the source of truth for profile/settings CRUD discovery.
