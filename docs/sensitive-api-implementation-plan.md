# Sensitive API Research Implementation Plan

Status: active research branch `research/sensitive-api-roadmap`

This document tracks sanitized implementation planning derived from local captures
under `docs/sensitive-api-research/`. That source folder is intentionally ignored
by git and must not be committed. Do not copy raw payloads, account identifiers,
tokens, addresses, screenshots, or unredacted response bodies into this file.

## Source Handling Rules

- Keep `docs/sensitive-api-research/` out of git.
- Commit only normalized route names, behavior notes, and implementation plans.
- Convert mitmproxy flows to an ignored HAR when structured inspection is
  needed:

  ```powershell
  mitmdump -nr .\docs\sensitive-api-research\flows --set hardump=.\docs\sensitive-api-research\picnic.har
  ```

- Keep both the source flow file and generated HAR local-only. Do not commit
  either file or any extracted raw payloads.
- Treat all write routes as unconfirmed until the exact request body and state
  impact are understood.
- Prefer reversible user actions and explicit UI confirmation for account writes.
- Re-run `pnpm validate` before merging any implementation branch.

## Initial Capture Inventory

The local capture contains 521 HTTP requests. Ignoring static images and
analytics, the notable Picnic API families are:

- Account/profile: `GET /user`, profile-menu page routes, profile avatar routes,
  account/user-info page content, and `POST /user`.
- Address/profile settings: `GET/POST /address-specifications`,
  `GET /address-specifications/enabled-fields`, and public onboarding address
  helper routes.
- Consents: `PUT /consents` and `GET /consents/settings-page`.
- Payments: `GET /payment-profile`, `POST /payment-profile/payment-options`,
  `PUT /payment-profile/preferred-payment-option/{id}`, and payment-option
  delete.
- Wallet: `GET /wallet/debts`, `POST /wallet/transactions`, and wallet/saldo
  page routes including balance and wallet overview pages.
- Cart: `GET /cart`, `POST /cart/add_product`, `POST /cart/remove_product`,
  `POST /cart/clear`, and basket footer page content.
- Deliveries/planner: `POST /deliveries/summary`, planner cloud/page routes.
- Search: `GET /pages/search-page-root` and
  `GET /pages/search-page-root-content` with focus/recommendation parameters.
- Recipes/meals: cookbook/meal page routes, meal section content, meal planner,
  meal preferences, recipe saving, assign selling group to basket, and assign
  basket day tasks.
- Promotions/favorites/gifts: promo box task, promobox grid, sellable favorite
  task, purchase/favorites page, user gift campaigns.
- Parcels/returns: parcel overview, vendor selection, label selection, and QR
  code page routes.
- Notifications: `GET /messages`, `GET /reminders`, and push subscription.

## Priority Focus

The first implementation work from this research branch should focus on the
Page Platform and account-settings surfaces that can materially improve the app:

1. Official in-app search handling
   - Captured route family: `GET /pages/search-page-root` and repeated
     `GET /pages/search-page-root-content`.
   - Captured query shape includes focus/session flags such as
     `search_term`, `search_session_id`, `pending_search_session_id`,
     `is_text_input_focused`, `is_search_recommendations_active`,
     `force_focus_from_tab`, `from`, and initial-search skipping flags.
   - Current app: combines `catalog.search()` with older
     `GET /pages/search-page-results?search_term=...`.
   - Goal: compare official root/root-content output with our current merged
     catalog/Fusion approach, then adopt it where it improves suggestions,
     history/recommendations, section construction, or result metadata without
     regressing uncategorized product coverage.

2. Better product favorites handling
   - Captured route family: `POST /pages/task/toggle-sellable-favorite`, plus
     purchase/favorites page surfaces.
   - Current app: recipe saving exists through a page task, but product
     favorites are not exposed as a first-class product/card/detail action.
   - Goal: implement product favorite state and toggling through Picnic's Page
     Platform task if the parsed action/payload can be derived safely from page
     responses. Prefer official task metadata over hardcoded request bodies.

3. Delivery address details and editing
   - Captured route family:
     `POST /public-api/{version}/user-onboarding/suggest-address`,
     `POST /public-api/{version}/user-onboarding/retrieve-address`,
     `GET /address-specifications/enabled-fields`,
     `GET /address-specifications/{id}`, `POST /address-specifications`, and
     `POST /user`.
   - Current app: account page displays delivery address but keeps address,
     contact details, and business details read-only.
   - Goal: first implement richer read/validation details, then only expose
     editing after confirming whether the final mutation is a narrow address
     update, an onboarding continuation, or a broader profile write. Address
     mutation work must remain guarded until the exact semantics are known.

## Comparison Against Current App

### Already Implemented Or Mostly Covered

- `GET /user`, `GET /user-info`, `GET /profile-menu`, consent settings reads,
  and `PUT /consents` are covered by `/account`.
- Household composition is already editable through the confirmed onboarding
  household route.
- Payment profile read, iDEAL/Wero option creation, option removal, and checkout
  start/status/cancel are implemented.
- Cart add/remove and delivery-slot selection are implemented through current
  package/API helpers.
- Cookbook browsing, recipe detail, recipe saving, and recipe add-to-cart are
  implemented, although some app-captured page tasks may offer cleaner behavior.
- Delivery summary/detail/tracking/cancel/rating/invoice routes are implemented
  from previous compatibility work.

### Meaningful Gaps Or Improvement Candidates

1. Official Page Platform search handling
   - Candidate routes: `pages/search-page-root` and
     `pages/search-page-root-content`.
   - Current app: uses catalog search plus older `search-page-results`.
   - Need: compare official search suggestions/recommendations, session/focus
     behavior, and result sections against our current robust uncategorized-item
     merge before switching any production behavior.

2. Product favorites
   - Candidate routes: `pages/task/toggle-sellable-favorite` and
     purchase/favorites page surfaces.
   - Current app: no product favorite UI or mutation support.
   - Need: discover whether product detail/card page responses include the
     complete task metadata, then build favorite toggling from parsed actions
     instead of hardcoded task payloads.

3. Address/profile editing research
   - Candidate routes: `address-specifications`, `enabled-fields`, public
     onboarding address helpers, and `POST /user`.
   - Current app: delivery address, contact details, and business details remain
     read-only/hidden.
   - Need: identify exact safe update payloads and whether `POST /user` is a
     partial profile update or a broader dangerous account write.

4. Avatar management
   - Candidate routes: `profile-menu/avatars`, `images/CUSTOMER_AVATAR`,
     `PUT /profile-menu/avatar`.
   - Current app: shows avatar only.
   - Opportunity: avatar picker/upload if payloads are safe and reversible.

5. Payment preference handling
   - Candidate route: `PUT /payment-profile/preferred-payment-option/{id}`.
   - Current app: replaces/removes options around iDEAL/Wero setup.
   - Opportunity: safer preferred-option switching when multiple stored options
     exist, reducing destructive payment-option churn.

6. Wallet and debts
   - Candidate routes: `wallet/debts`, `wallet/transactions`, saldo/portemonnee
     page routes.
   - Current app: wallet branch is parked due empty transaction data.
   - Opportunity: implement debt/balance summary first, then transaction list
     once populated data exists.

7. Cart clear and basket footer behavior
   - Candidate routes: `cart/clear`, `pages/basket-footer-section-root`.
   - Current app: removes line items through product mutations and parses cart
     totals from `/cart`.
   - Opportunity: clear-cart action and/or more API-compatible footer/minimum
     checkout messaging if the page route exposes richer data.

8. Meal planning and preferences
   - Candidate routes: meal planner pages, meal preferences page, preference save
     task, assign basket day task.
   - Current app: cookbook and recipe-to-cart only.
   - Opportunity: add meal-planning features after preserving current cookbook
     simplicity.

9. Promotions and gifts
   - Candidate routes: promo box task, promobox grid, user gift campaign routes.
   - Current app: promotion/product labels are parsed where they appear; no
     gift campaign UI.
   - Opportunity: richer promotions/gift entry points.

10. Messages and reminders
    - Candidate routes: `messages`, `reminders`.
    - Current app: no inbox/reminders surface.
    - Opportunity: low-risk read-only notification/reminder center if payload
      shape is clean.

11. Push subscriptions
    - Candidate route: `user-onboarding/subscribe-push`.
    - Current app: push subscription device registrations are hidden.
    - Opportunity: likely low priority; browser push semantics differ from the
      Android app and should not be copied blindly.

12. Parcels/returns
    - Candidate routes: parcel overview, vendor selection, label selection, and
      QR-code page routes.
    - Current app: no parcel or return flow.
    - Opportunity: start with read-only discovery and only add mutation support
      after exact app behavior is understood.

## Proposed Implementation Sequence

### Phase 0: Hygiene And Research Tooling

- [x] Add `docs/sensitive-api-research/` to `.gitignore`.
- [x] Create this sanitized working plan.
- [x] Confirm local flow-to-HAR conversion with `mitmdump -nr ... --set
  hardump=...`; generated HAR remains ignored.
- [ ] Add a local-only extraction helper under `scripts/` that reads ignored
      captures and prints normalized route summaries without bodies or IDs.
- [ ] Extend the helper with route-family filters for profile, payment, wallet,
      cart, recipes, and search.

### Phase 1: Page Platform Search

- [ ] Build a sanitized comparer for current `/pages/search-page-results` output
      versus captured-style `/pages/search-page-root-content` output.
- [ ] Confirm whether root-content can replace or supplement current
      suggestions without flashing, slower rendering, or duplicate sections.
- [ ] Preserve current uncategorized product coverage from `catalog.search()`
      unless official root-content proves it returns the same products.
- [ ] Implement only the proven better path behind the existing app search API
      route, keeping the UI stable.

### Phase 2: Product Favorites

- [ ] Identify product detail/card response action metadata for favorites.
- [ ] Confirm `POST /pages/task/toggle-sellable-favorite` can be executed from
      parsed task metadata without hardcoding account-specific payload fields.
- [ ] Add product favorite state to product cards and product detail pages if the
      official API path is stable.
- [ ] Add cache updates for category/search/product detail views so favorites do
      not flicker or require reloads.

### Phase 3: Delivery Address Details And Editing

- [ ] Analyze sanitized request/response shapes for `address-specifications` and
      `POST /user`.
- [ ] Compare public address suggestion/retrieval helpers against onboarding
      research notes and confirm whether they can safely power address lookup in
      account settings.
- [ ] Confirm whether delivery address editing is a safe partial update, a
      validation-only flow, or a high-risk broader profile mutation.
- [ ] Investigate avatar picker/upload routes and decide whether avatar editing
      belongs in the profile menu.
- [ ] Keep contact/address/business edits hidden until exact CRUD semantics are
      proven.

### Phase 4: Small Robustness Wins

- [ ] Replace destructive payment setup assumptions with preferred-option
      switching where `PUT /payment-profile/preferred-payment-option/{id}` is
      safe and confirmed.
- [ ] Investigate `POST /cart/clear` and add a guarded clear-cart implementation
      if it restores cleanly and avoids per-item mutation loops.
- [ ] Add read-only wallet debt/balance summary if `wallet/debts` has a stable
      non-sensitive shape.

### Phase 5: Browsing And Cookbook Improvements

- [ ] Compare `basket-footer-section-root` against current cart/order summary
      parsing.
- [ ] Investigate meal planner and meal preference routes as a distinct cookbook
      enhancement branch.
- [ ] Investigate promo/gift routes as separate features.

### Phase 6: Lower Priority Read-Only Surfaces

- [ ] Add messages/reminders read-only UI if payloads are useful and not noisy.
- [ ] Revisit wallet transactions when test data exists.
- [ ] Revisit push subscriptions only if a browser-native equivalent can be
      implemented without pretending to be the Android app.

## Branch Plan

- `research/sensitive-api-roadmap`: ignored source protection, sanitized route
  map, and implementation planning.
- `research/payment-preferred-option`: focused probe and implementation plan for
  preferred payment option switching.
- `feature/cart-clear`: only after `cart/clear` is confirmed safe.
- `research/profile-address-crud`: exact profile/address mutation semantics.
- `feature/avatar-management`: only if avatar routes are reversible and useful.
- `feature/wallet-summary`: wallet debts/balance before transaction details.
- `research/search-page-content`: compare official search-page suggestions.
- `feature/meal-planner`: meal planner/preferences after route semantics are
  understood.

## Open Questions

- Does `POST /user` update only address/profile fields, or can it mutate broader
  account state?
- Is `address-specifications` sufficient to build a safe address-edit form, or
  does it only describe validation fields?
- Does preferred payment switching work independently of option creation, and
  does it avoid deleting existing payment options?
- Does `cart/clear` require cart MTS/version data, and does it return a fresh
  cart or an empty response?
- Are official search recommendations meaningfully better than our current
  suggestions/history blend?
- Are meal planner tasks useful without implementing a full weekly planning UI?
