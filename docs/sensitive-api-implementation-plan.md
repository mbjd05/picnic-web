# Sensitive API Research Implementation Plan

Status: active research branch `research/sensitive-api-roadmap`

This document tracks sanitized implementation planning derived from local captures
under `docs/sensitive-api-research/`. That source folder is intentionally ignored
by git and must not be committed. Do not copy raw payloads, account identifiers,
tokens, addresses, screenshots, or unredacted response bodies into this file.

## Source Handling Rules

- Keep `docs/sensitive-api-research/` out of git.
- Commit only normalized route names, behavior notes, and implementation plans.
- When official app behavior is unclear, future sessions may ask the maintainer
  to capture fresh Picnic app API traffic for the specific flow being
  investigated. Add the capture under the ignored sensitive research folder and
  summarize only redacted route/shape findings here.
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
  task, purchase/favorites page, user gift campaigns, and gift campaign
  selection.
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
   - Current app: payment profile improvements now use this route to switch
     stored options instead of deleting all existing options before setup.
   - Captured shape: Picnic's app created the Dutch Rabobank card-flow option
     as `payment_method: "MAESTRO"` with `selected_bank_id: "RABONL2U"`.
     Treat this as MAESTRO in API code even if the consumer-facing app copy is
     ambiguous.
   - Opportunity: keep the UI fully data-driven from `available_payment_methods`
     and continue verifying non-NL region payment methods through fresh app
     captures.

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
   - Candidate routes: promo box task, promobox grid, user gift campaign
     read/selection routes.
   - Current app: promotion/product labels are parsed where they appear; no
     gift campaign UI or gift collection flow.
   - Opportunity: richer promotions/gift entry points and a guarded gift
     selector when Picnic exposes an active campaign.
   - Captured gift shape: a user gift campaign read returns a selectable article
     list and campaign display text; selection is a dedicated write route with
     campaign, article, and status fields. Do not hardcode campaign identifiers;
     derive them from the read response or Page Platform actions.

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
- [x] Confirm local flow-to-HAR conversion with the documented `mitmdump`
      command; generated HAR remains ignored.
- [x] Add local-only extraction/probe helpers under `scripts/` that print
      normalized route summaries and API comparison metrics without bodies or
      IDs.
- [ ] Extend the helper with route-family filters for profile, payment, wallet,
      cart, recipes, and search.

### Phase 1: Page Platform Search

- [x] Build a sanitized comparer for current `/pages/search-page-results` output
      versus captured-style `/pages/search-page-root-content` output.
- [x] Confirm whether root-content can replace or supplement current
      suggestions without flashing, slower rendering, or duplicate sections.
- [x] Preserve current uncategorized product coverage from `catalog.search()`
      unless official root-content proves it returns the same products.
- [x] Implement only the proven better path behind the existing app search API
      route, keeping the UI stable.

Findings:

- For tested submitted searches, official `search-page-root-content` returned
  the same product counts and section structure as the existing
  `search-page-results` path, with full overlap against `catalog.search()`.
  Repeated timing probes showed the single official page path is usually
  slightly faster than the current catalog-plus-metadata critical path,
  especially for larger result sets, and it avoids one Picnic API request.
  Product result loading now tries official submitted `search-page-root-content`
  first and falls back to the older catalog/Fusion merge if the official page
  shape cannot be parsed.
- Focused `search-page-root-content` is a distinct suggestions/history surface,
  not a product-results surface. It is now used as the preferred source for
  typed search suggestions, with `catalog.getSuggestions()` retained as fallback
  if the official Page Platform shape changes or returns no usable suggestions.

### Phase 2: Product Favorites

- [ ] Identify product detail/card response action metadata for favorites.
- [ ] Confirm `POST /pages/task/toggle-sellable-favorite` can be executed from
      parsed task metadata without hardcoding account-specific payload fields.
- [ ] Add product favorite state to product cards and product detail pages if the
      official API path is stable.
- [ ] Add cache updates for category/search/product detail views so favorites do
      not flicker or require reloads.

### Phase 3: Delivery Address Details And Editing

- [x] Analyze sanitized request/response shapes for `address-specifications` and
      `POST /user`.
- [x] Compare public address suggestion/retrieval helpers against onboarding
      research notes and confirm whether they can safely power address lookup in
      account settings.
- [x] Confirm whether delivery address editing is a safe partial update, a
      validation-only flow, or a high-risk broader profile mutation.
- [x] Investigate avatar picker/upload routes and decide whether avatar editing
      belongs in the profile menu.
- [x] Keep contact and business edits hidden until exact CRUD semantics are
      proven; expose only the captured narrow name and selected-address writes.

Sanitized capture findings:

- The official app updates the selected delivery address with `POST /user` and a
  top-level `selected_address` object. It updates first/last name through a
  separate `POST /user` request. Both captured writes returned `204`, followed
  by successful `GET /user` reads, which supports narrow forms rather than a
  general-purpose user editor.
- Address lookup uses the public API v15 `suggest-address`, `retrieve-address`,
  and `registration-properties` routes. Suggestion results are under `results`;
  retrieval returns an `address`; registration properties expose only the
  service-area/business flags needed by the UI.
- Delivery details use API v15 `GET /address-specifications/{addressId}`,
  `GET /address-specifications/enabled-fields`, and
  `POST /address-specifications`. The write has only `address_id`,
  `address_specification`, and `delivery_instruction` at the top level and
  returned `201` in the capture.
- Avatar management uses API v15 `GET /profile-menu/avatar`,
  `GET /profile-menu/avatars`, `POST /images/CUSTOMER_AVATAR`, and
  `PUT /profile-menu/avatar`. The avatar update contains only `image_id` and
  `type`; captured updates returned `200`.
- The same capture shows successful `POST /user-onboarding/subscribe-push`
  requests with top-level `push_subscriptions`, followed by `GET /user`
  readback. This supersedes the older `topics` assumption for the captured app
  version, but the write remains device-specific rather than an account-wide
  preference. The web app therefore does not expose this mutation. Its
  Push notifications entry returned by the consent settings payload also does
  not mirror the official app's device switch in live comparison. The web app
  therefore hides both push controls until the browser registers its own push
  token and can describe the setting as browser-specific.

### Phase 4: Small Robustness Wins

- [x] Replace destructive payment setup assumptions with preferred-option
      switching where `PUT /payment-profile/preferred-payment-option/{id}` is
      safe and confirmed.
- [x] Use Picnic's app-observed payment option creation payload:
      `payment_method` plus `selected_bank_id` when the selected method exposes
      banks.
- [ ] Investigate `POST /cart/clear` and add a guarded clear-cart implementation
      if it restores cleanly and avoids per-item mutation loops.
- [ ] Add read-only wallet debt/balance summary if `wallet/debts` has a stable
      non-sensitive shape.

### Phase 5: Browsing And Cookbook Improvements

- [ ] Compare `basket-footer-section-root` against current cart/order summary
      parsing.
- [ ] Investigate meal planner and meal preference routes as a distinct cookbook
      enhancement branch.
- [ ] Investigate promo routes as a separate feature.
- [ ] Investigate gift campaign collection as a separate guarded feature:
      discover active campaigns, show available gift articles, submit selection
      only from official campaign response metadata, and refresh cart/campaign
      state afterward.

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
