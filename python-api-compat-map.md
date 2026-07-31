# Python Picnic API Compatibility Map

Source reviewed: <https://github.com/codesalatdev/python-picnic-api> at commit `883899d` on 2026-07-31.

This map compares the Python fork with the migrated Cloudflare Worker implementation. It is intentionally limited to stable client behavior and known page/API surfaces. It does not replace the separate profile/settings CRUD research.

## Adopted Now

### Product detail text parsing

The Python fork parses product detail name, producer, unit quantity, and price-per-unit by PML role instead of by markdown position. That is more robust for brandless produce and products where colored category/badge lines shift the text order.

Status: adopted in `src/lib/parse-fusion-product.ts`.

### Product page category IDs

The Python fork no longer trusts the removed `GET /articles/{article_id}/category` route. It extracts category IDs from the `category-button` deep-link on `product-details-page-root`.

Status: adopted as `ProductDetail.categoryIds`, parsed from `app.picnic://categories/{l1}/l2/{l2}/l3/{l3}`.

### Explicit 2FA channel support

The Python fork documents `generate_2fa_code(channel)` with `SMS` and `EMAIL`. Our app already used Picnic's channel argument internally but always sent SMS.

Status: adopted at the API service boundary. `/api/auth/login` and `/api/auth/login-credentials` now accept optional `twoFactorChannel: "SMS" | "EMAIL"` and default to SMS. The visible login UI is unchanged until we decide whether to expose channel selection.

## Already Covered Or Better Here

### API version and agent

The Python fork currently defaults to Picnic API version 15 and agent `30100;1.206.1-#15408`. This app uses `picnic-api@4.6.0`, which currently targets API version 17 and a newer Picnic agent.

Decision: keep our current JS package behavior.

### Search

The Python fork implements the Fusion search page endpoint. Our implementation combines Picnic search surfaces so uncategorized direct product results still appear under the product result section.

Decision: keep our implementation.

### Product detail request flags

The Python fork uses `show_category_action=true`. Our product detail service already requests both `show_category_action=true` and `show_remove_from_purchases_page_action=true`.

Decision: keep our broader request flags.

### Cart and delivery slots

Both implementations cover cart reads, add/remove/clear operations, and delivery slot reads. Our app also includes slot selection UI and payment/checkout support, which the Python fork does not.

Decision: no change.

### Cookbook and payments

The Python fork does not implement our migrated cookbook browsing/saved recipe/cart integration or direct payment support.

Decision: no change.

## Deferred Upgrade Candidates

### Barcode / GTIN lookup

The Python fork can resolve `https://picnic.app/{country}/qr/gtin/{ean}` redirects to a product ID.

Potential value: useful for a future scanner/manual barcode lookup feature.

Reason deferred: no current UI entry point, and adding an unused Worker route would expand surface area without product value.

### Delivery history and live delivery data

The Python fork exposes:

- `POST /deliveries/summary`
- `GET /deliveries/{delivery_id}`
- `GET /deliveries/{delivery_id}/scenario`
- `GET /deliveries/{delivery_id}/position`

Potential value: future order history and active delivery tracking screens.

Status: adopted. The Worker exposes normalized delivery summaries/details plus live tracking payloads, and the web app has a `/deliveries` page for current/all deliveries.

### Category name resolution from product detail

The Python fork can load `L2-category-page-root?category_id={l2}&l3_category_id={l3}` after extracting product category IDs, then read the selected L3 header label.

Potential value: richer product detail breadcrumbs.

Reason deferred: the current product detail UI already has the product page's category tag. Adding category navigation needs a small UI decision so it remains consistent with existing category browsing.

### User/profile writes

The Python fork models user, address, household, and subscription reads through `GET /user`, but does not implement address or household write routes.

Decision: keep the separate `src/scripts/registration-onboarding-flow.md` research as the source of truth for profile/settings CRUD discovery.
