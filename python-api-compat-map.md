# Picnic API Reference Compatibility Map

References reviewed:

- <https://github.com/codesalatdev/python-picnic-api> at commit `883899d` on 2026-07-31.
- <https://github.com/ivo-toby/mcp-picnic> at commit `6714555` on 2026-07-31.

This is now a three-way comparison between the migrated Cloudflare Worker app, the Python Picnic API fork, and the MCP Picnic server. It is limited to stable client behavior and known Picnic page/API surfaces. It does not replace the separate profile/settings CRUD research in `src/scripts/registration-onboarding-flow.md`.

## Best Current Baseline

### API package/version

- Python fork: direct Python client, Picnic API version 15, older agent.
- MCP Picnic: `picnic-api@^4.5.0`, configurable API version/device/agent, default API version 15.
- This app: `picnic-api@4.6.0`, currently targeting newer Picnic API behavior through the JS package.

Decision: keep this app on the newer JS package baseline, while borrowing endpoint knowledge and parser hardening from both reference projects.

### Search

- Python fork: Fusion search page endpoint.
- MCP Picnic: `client.catalog.search()` with pagination and LLM-sized result filtering.
- This app: combines Picnic search surfaces so uncategorized direct product results still appear under the main product result section.

Decision: keep this app's search implementation. The MCP pagination idea is useful for API/automation surfaces, but not needed for the visual PLP.

## Adopted

### Product detail text parsing

Reference: Python fork.

The Python fork parses product detail name, producer, unit quantity, and price-per-unit by PML role instead of by markdown position. That is more robust for brandless produce and products where colored category/badge lines shift the text order.

Status: adopted in `src/lib/parse-fusion-product.ts`.

### Product page category IDs

Reference: Python fork.

The Python fork no longer trusts the removed `GET /articles/{article_id}/category` route. It extracts category IDs from the `category-button` deep-link on `product-details-page-root`.

Status: adopted as `ProductDetail.categoryIds`, parsed from `app.picnic://categories/{l1}/l2/{l2}/l3/{l3}`.

### Explicit 2FA channel support

References: Python fork and MCP Picnic.

Both references expose `generate_2fa_code(channel)`. The Python fork documents `SMS` and `EMAIL`; MCP accepts a channel string and defaults to SMS.

Status: adopted at the API service boundary. `/api/auth/login` and `/api/auth/login-credentials` accept optional `twoFactorChannel: "SMS" | "EMAIL"` and default to SMS. The visible login UI is unchanged until we decide whether to expose channel selection.

### Delivery history and live delivery data

References: Python fork and MCP Picnic.

Both references expose:

- `POST /deliveries/summary`
- `GET /deliveries/{delivery_id}`
- `GET /deliveries/{delivery_id}/scenario`
- `GET /deliveries/{delivery_id}/position`

Status: adopted. The Worker exposes normalized delivery summaries/details plus live tracking payloads, and the web app has a `/deliveries` page for current/all deliveries.

### Recipe save/add-to-cart task endpoints

Reference: MCP Picnic.

MCP Picnic documents the modern task endpoints:

- `POST /pages/task/recipe-saving`
- `POST /pages/task/assign-selling-group-to-basket`
- `POST /pages/task/remove-selling-group-from-basket`

Status: mostly adopted. This app supports saving/unsaving and adding recipe ingredients to cart. It uses `picnic-api` helpers where available and direct cart additions when the user selects ingredient quantities. Removing an assigned recipe group is not currently exposed in the UI.

### Dynamic cookbook categories

Reference: MCP Picnic.

MCP Picnic scans the cookbook page for `recipe_cattree_*` and `recipe-cattree-*` page IDs and supports both underscore and dash page forms.

Status: mostly adopted. This app dynamically discovers cookbook categories and validates category IDs before fetching category pages.

## Strong Upgrade Candidates

### Promotions page

Reference: MCP Picnic.

MCP Picnic fetches `GET /pages/promo-page-all-promos-redirect` and extracts promoted products from selling-unit tiles with analytics `promotion_id`, current price, promotion label, original price, image, and max count.

Why it matters: this is a real product-facing Picnic surface and fits our existing category/product card UI. It could power an "Alle acties" page that is more explicit and robust than treating promotions as just another shortcut page.

Suggested adoption: add a promotions service/parser that returns normal `Product[]` plus promotion metadata, then route the existing "Alle acties" shortcut through it if the page ID matches.

### Wallet transaction reads

Reference: MCP Picnic.

MCP Picnic exposes:

- `payment.getWalletTransactions(pageNumber)`
- `payment.getWalletTransactionDetails(transactionId)`

Why it matters: useful for account/payment visibility and grocery spending review. This is read-only and lower risk than settings writes.

Suggested adoption: add an account spending page only after checking the raw response shape and whether it is relevant for NL/DE/FR.

### Delivery post-order actions

Reference: MCP Picnic.

MCP Picnic exposes:

- `delivery.cancelDelivery(deliveryId)`
- `delivery.setDeliveryRating(deliveryId, rating)`
- `delivery.sendDeliveryInvoiceEmail(deliveryId)`
- `cart.getOrderStatus(orderId)`

Why it matters: these complete the delivery-management surface around the `/deliveries` page.

Suggested adoption: add read/status first (`getOrderStatus`), then invoice resend. Treat cancellation and rating as explicit user-confirmed actions because they mutate account/order state.

### User-created recipes

Reference: MCP Picnic.

MCP Picnic identifies cookbook segment membership from analytics, including `USER_DEFINED_RECIPES` and `SAVED_RECIPES`.

Why it matters: our cookbook currently has featured/categories/saved recipes, but not a distinct "own recipes" view.

Suggested adoption: extend cookbook parsing to preserve segment types, then add an "Eigen recepten" scope only when the API returns that segment.

### Recipe URL/share-link resolution

Reference: MCP Picnic.

MCP Picnic resolves bare recipe IDs, canonical recipe URLs, `selling_group_id` query/deeplink references, and Picnic short share links. It constrains resolution to HTTPS `picnic.app` hosts and re-checks redirect targets.

Why it matters: useful for direct recipe import/open flows, and its URL safety checks are better than accepting arbitrary URL input.

Suggested adoption: add a small `resolveRecipeId` utility if we introduce recipe URL input anywhere. Do not add a UI just to expose it.

### Recipe meal-planning helpers

Reference: MCP Picnic.

MCP Picnic extracts structured recipe ingredients from `recipe_id`, `recipe_name`, `portions`, and `selling_units` analytics context, then supports:

- multiple recipe ingredient extraction with per-recipe errors;
- consolidated shopping-list generation;
- meal-combination ranking by shared non-pantry ingredients and conservative cost.

Why it matters: this is more of an automation/planning feature than a core storefront feature, but it fits future "plan meals then add to cart" workflows.

Suggested adoption: defer until after the UI migration replacement is complete. When adopted, keep it client-visible as a planning workflow rather than a hidden parser-only feature.

### Session/device identity persistence

Reference: MCP Picnic.

MCP Picnic persists auth session and device ID files for MCP/container use, and lets users override `PICNIC_DEVICE_ID` and `PICNIC_AGENT`.

Why it matters: stable device identity can reduce repeated 2FA challenges in long-running automation.

Decision for this app: do not copy file-based persistence. Our browser app stores auth in HTTP-only cookies and should not persist credentials/device files on the Worker. The configurable agent/device idea may be useful for local scripts only.

## Lower-Priority Or Context-Specific Candidates

### Barcode / GTIN lookup

Reference: Python fork.

The Python fork can resolve `https://picnic.app/{country}/qr/gtin/{ean}` redirects to a product ID.

Potential value: scanner/manual barcode lookup.

Reason deferred: no current UI entry point, and adding an unused Worker route would expand surface area without product value.

### Category name resolution from product detail

Reference: Python fork.

The Python fork can load `L2-category-page-root?category_id={l2}&l3_category_id={l3}` after extracting product category IDs, then read the selected L3 header label.

Potential value: richer product detail breadcrumbs.

Reason deferred: the current product detail UI already has the product page's category tag. Adding category navigation needs a small UI decision so it remains consistent with existing category browsing.

### LLM-specific response filtering

Reference: MCP Picnic.

MCP Picnic aggressively filters cart/search/product responses for prompt context size and paginates broad tools.

Potential value: useful if this app later exposes a machine-oriented API.

Reason deferred: our current API serves UI screens, where normalized display models are better than lossy LLM summaries.

## Not Useful For This App

### MCP transports/prompts

Reference: MCP Picnic.

MCP Picnic includes stdio and streamable HTTP transports, prompt templates, Smithery/Docker packaging, and MCP tool schemas.

Decision: do not adopt. This app is a user-facing web client, not an MCP server.

### File-based credential/session model

Reference: MCP Picnic.

MCP Picnic is configured with `PICNIC_USERNAME` and `PICNIC_PASSWORD`, then stores a session token locally.

Decision: do not adopt for production web. This app should continue to avoid storing Picnic passwords and should keep the server-side session surface cookie-based.

## Profile/Settings CRUD

Python fork models user, address, household, and subscription reads through `GET /user`; MCP Picnic exposes user details and user info/feature toggles through the JS package. Neither reference implements authenticated delivery address or household write routes.

Decision: keep `src/scripts/registration-onboarding-flow.md` as the source of truth for profile/settings CRUD discovery.
