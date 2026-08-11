# Picnic registration and onboarding flow

Reverse-engineering notes for adding a "Don't have an account? Register here" flow.

This document only records validation-only probes and read-only observations. Do not run a fully valid registration probe casually: the registration endpoints can create accounts and may send email/SMS.

## Endpoint family

Use the public onboarding API, not the older route-table entry:

```text
POST /public-api/{api_version}/user-onboarding/check-address
POST /public-api/{api_version}/user-onboarding/register
POST /public-api/{api_version}/user-onboarding/register-leadlist
POST /public-api/{api_version}/user-onboarding/activate
```

Confirmed live for API `17` on:

```text
https://storefront-prod.nl.picnicinternational.com
https://storefront-prod.de.picnicinternational.com
https://storefront-prod.fr.picnicinternational.com
```

Also confirmed through the public website proxy:

```text
https://picnic.app/nl/rest/public-api/17/user-onboarding/...
https://picnic.app/de/rest/public-api/17/user-onboarding/...
https://picnic.app/fr/rest/public-api/17/user-onboarding/...
```

The historical route below is present in `picnic-api`'s reverse-engineered route table but returned `404` for API versions 1 through 25:

```text
POST /api/{api_version}/user/register/direct
```

## Headers

The public onboarding endpoints accept app-like headers. Once an address is included, `register` requires at least:

```text
Content-Type: application/json
Accept: application/json
User-Agent: okhttp/4.9.0
picnic-country: NL | DE | FR
x-picnic-did: <stable device id>
x-picnic-agent: 10100;1.0.0;
```

Observed validation:

```text
Could not find value of header 'x-picnic-did'
web is not recognized as a three-part Picnic version number
```

So `x-picnic-agent` must contain a numeric client id and a three-part version string.

## Address check

Call `check-address` before registration. It validates serviceability and normalizes the address.

NL payload:

```json
{
  "country_code": "NL",
  "postcode": "1012AB",
  "house_number": 1,
  "house_number_ext": "A"
}
```

`house_number_ext` is optional. `house_number` may be sent as a string or number, but responses normalize it to a number.

DE/FR payloads require `street` and `city`:

```json
{
  "country_code": "DE",
  "postcode": "10115",
  "house_number": "1",
  "street": "Example Street",
  "city": "Berlin"
}
```

Without `street`/`city`, DE/FR returned:

```text
Field(s) city, street have invalid data
```

Successful NL response shape:

```json
{
  "address": {
    "postcode": "1012AB",
    "house_number": 1,
    "house_number_ext": null,
    "street": "Stationsplein",
    "city": "Amsterdam",
    "geolocation": {
      "latitude": 52.37847539,
      "longitude": 4.90315253,
      "source": "POSTCODE_NL",
      "lm": [2026, 5, 20]
    }
  },
  "b2b_enabled": true,
  "waitlist_area": false
}
```

Use `waitlist_area` to decide whether to offer direct registration or lead-list registration.

## Direct registration

Endpoint:

```text
POST /public-api/17/user-onboarding/register
```

Base required fields are snake_case:

```json
{
  "client_id": 10100,
  "device_id": "web_reg",
  "device_name": "Web",
  "email": "user@example.com",
  "address": {
    "country_code": "NL",
    "postcode": "1012AB",
    "house_number": 1,
    "house_number_ext": ""
  },
  "password": "plain text candidate"
}
```

Confirmed field behavior:

- Empty body reports missing `[clientId, deviceId, deviceName, email]`, but the actual accepted JSON field names are snake_case.
- `address` is the accepted key. `new_address` and `old_address` did not satisfy validation.
- `address.house_number` must be snake_case. `houseNumber` was rejected.
- Non-leadlist direct registration requires either `secret` or `password`.
- `password` was accepted past schema validation.
- `secret` was also accepted past schema validation when sent as the MD5 hash of the password, matching the login convention.
- `phone`, `firstname`/`lastname`, and `first_name`/`last_name` were not required by the validation probes.
- `phone` is optional for direct registration at schema-validation time. Omitting it, or sending `phone: null`, got past phone validation; sending `phone: ""` or another invalid string produced a phone validation error.

Observed validation when password/secret is missing:

```text
Non leadlist user registration expects secret or password.
```

Do not set `leadlist_user: true` on the direct `register` endpoint. It returned:

```text
Cannot register leadlist users through the present method
```

Likely direct registration response is expected to either create a user immediately or trigger an activation email/token flow. This has not been tested with valid user data.

## Lead-list registration

Endpoint:

```text
POST /public-api/17/user-onboarding/register-leadlist
```

The public Picnic website uses this for addresses outside the direct service area.

Website bundle payload shape:

```json
{
  "email": "user@example.com",
  "phone": "+31612345678",
  "device_id": "web_reg",
  "device_name": "Web",
  "client_id": 10100,
  "address": {
    "country_code": "NL",
    "postcode": "1012AB",
    "house_number": "1",
    "house_number_ext": ""
  }
}
```

The public site uses:

```text
client_id = 10100
device_id = web_reg
device_name = Web
```

Observed validation:

- Missing base fields reports `[clientId, deviceId, deviceName, email]`.
- Missing address reports `Either old or new address must be present`.
- Invalid phone is rejected if present.
- Missing phone was not rejected before email validation, but the public site requires it in the form.
- Server-side validation does not appear to require phone for lead-list either. Omitting it, or sending `phone: null`, got past phone validation; sending `phone: ""` or another invalid string produced a phone validation error. The public website still requires phone in the form, so treating phone as optional in our UI would differ from Picnic's public website UX.

## Activation

Endpoint:

```text
POST /public-api/17/user-onboarding/activate
```

Required fields are snake_case:

```json
{
  "token": "activation-token-from-email-or-link",
  "password": "new password",
  "client_id": 10100,
  "device_id": "web_reg",
  "device_name": "Web",
  "client_version": "1.0.0"
}
```

Empty body reports missing:

```text
[token, password, clientId, deviceId, deviceName, clientVersion]
```

But camelCase JSON keys did not satisfy validation; snake_case did. With all snake_case fields and an invalid token, the endpoint reached token validation and returned:

```text
INVALID_TOKEN
Token is invalid or expired
```

The website deeplink helper maps activation links to:

```text
nl.picnic-supermarkt://activate-account/token/{token}?country={country}
```

This implies activation links are expected to carry a token usable by the app; for the web app, parse the token from Picnic's activation URL/deeplink if the user lands on our activation screen.

## Post-login onboarding

After registration/activation, log in using the existing credentials flow:

```text
POST /api/17/user/login
POST /api/17/user/2fa/generate
POST /api/17/user/2fa/verify
```

2FA is conditional. The login response includes:

```json
{
  "second_factor_authentication_required": true,
  "show_second_factor_authentication_intro": true
}
```

When `second_factor_authentication_required` is false, the app should accept the returned `x-picnic-auth` token and finish login without any second-factor step.

The API helper exposes `generate2FACode(channel)` and passes the channel through unchanged:

```json
{
  "channel": "SMS"
}
```

Known/likely channels:

- `SMS`: used by the current app and MCP implementation.
- `EMAIL`: strongly implied by current feature toggles observed on an authenticated account:
  - `TWO_FACTOR_AUTHENTICATION`
  - `TWO_FACTOR_AUTHENTICATION_VIA_EMAIL`
  - `BRAZE_ENABLED_TWO_FACTOR_AUTHENTICATION_EMAIL`

Validation-only probes with no/fake auth could not confirm channel enum support because `/user/2fa/generate` authenticates the token before validating `channel`.

Implementation recommendation:

- Do not always auto-send SMS.
- After a login response with `second_factor_authentication_required: true`, show a second-factor screen that can request either SMS or email.
- Default to email if the account has no phone number or the user explicitly chooses email.
- Keep verification shared: `/user/2fa/verify` accepts `{ "otp": "<code>" }` regardless of channel.

Current code gap:

- `src/app/api/auth/login-credentials/route.ts` always calls `generate2FACode("SMS")`.
- A future implementation should return the partial token first, or accept a requested channel, so the UI can choose `SMS` or `EMAIL`.

Open 2FA preference question:

- No standalone settings route was found for paths such as `/user/2fa/settings`, `/user/2fa/channels`, `/user/security`, or `/account/2fa`; they returned `404` in existence probes.
- Direct registration ignored or did not validate obvious preference fields such as `second_factor_authentication_channel`, `two_factor_authentication_method`, `mfa_channel`, `preferred_2fa_channel`, and `phone_verification_required`.
- Therefore there is no confirmed way yet to set a new account's 2FA preference to `none`, `phone`, or `email` during public registration.
- Based on validation probes, `phone` can be omitted from initial registration. A new account without a phone number may naturally avoid SMS 2FA, but whether that means no 2FA or email 2FA depends on the successful registration/login response and has not been proven.

The installed `picnic-api` helper exposes authenticated onboarding helpers:

```ts
client.userOnboarding.setHouseholdDetails(details);
client.userOnboarding.setBusinessDetails(details);
client.userOnboarding.subscribePush(topics);
```

Those map to:

```text
POST /api/17/user-onboarding/household-details
POST /api/17/user-onboarding/business-details
POST /api/17/user-onboarding/subscribe-push
```

These endpoints exist for NL/DE/FR and return `401` without authentication.

Known household details shape from `GET /user` and `picnic-api` types:

```json
{
  "adults": 1,
  "children": 0,
  "cats": 0,
  "dogs": 0
}
```

Read responses include server-managed fields:

```json
{
  "adults": 1,
  "children": 0,
  "cats": 0,
  "dogs": 0,
  "author": "USER",
  "last_edit_ts": 1779217463882
}
```

For writes, send only the user-editable counts unless validation proves the server requires more.

Known business details shape:

```json
{
  "business_name": "Example BV",
  "business_registration_number": "12345678",
  "sector": "OTHER",
  "employee_count": 10
}
```

`b2b_enabled` from `check-address` can drive whether to show a business-account option.

## Authenticated user settings surface

Date verified read-only: 2026-07-31, using `picnic-api` `4.6.0` against API `17`.

The currently confirmed user-settings surface is split across multiple API families. Address and profile data are readable as normal user/profile data, but household and business composition writes are exposed through the authenticated `user-onboarding` family.

Reusable probe:

```powershell
node .\scripts\settings-api-probe.mjs
```

The default mode redacts personal values, summarizes response shapes, and only uses read-only or validation-style route checks. It skips meaningful account-setting mutations unless explicitly run with:

```powershell
node .\scripts\settings-api-probe.mjs --confirm-idempotent-writes
```

Do not use the idempotent-write mode casually: even sending the current values back may update server timestamps or consent audit records.

The default mode also skips the old broad address-candidate matrix. Use the following only for an explicitly approved, focused rediscovery pass:

```powershell
node .\scripts\settings-api-probe.mjs --include-address-candidate-matrix
```

Read-only recheck on 2026-08-10 confirmed the same stable profile surfaces and current response shape:

- `GET /user` includes profile, address, household, subscription, push subscription, consent decision, and delivery-count data.
- `GET /user-info` includes redacted phone and feature toggles.
- `GET /profile-menu?fetch_mgm=true` includes profile-menu user data plus at least one highlight for the current NL test account.
- `GET /consents/settings-page` returned 7 normal settings for the current account.
- `GET /consents/general/settings-page` returned 5 general settings.
- `PUT /consents` with an empty declaration list still returns `200`.
- `POST /user-onboarding/household-details` and `POST /user-onboarding/business-details` still exist and reject empty input with validation errors.

Focused same-value mutation research on 2026-08-10 confirmed:

- `POST /user-onboarding/household-details` accepts the current `adults`, `children`, `cats`, and `dogs` values and the same values are reflected by the next `GET /user`.
- `PUT /consents` accepts a current normal-consent declaration and the same value is reflected by the next `GET /consents/settings-page`.
- `PUT /consents/general` still returned `422` for a same-value payload built from current general settings plus `check_general_consent`; keep general consents read-only until its exact semantics are understood.

### Profile and address reads

`picnic-api` exposes:

```ts
client.user.getUserDetails();
client.user.getUserInfo();
client.user.getProfileMenu();
```

Those map to:

```text
GET /api/17/user
GET /api/17/user-info
GET /api/17/profile-menu?fetch_mgm=true
```

Read-only verification showed `GET /user` includes:

```json
{
  "user_id": "...",
  "firstname": "...",
  "lastname": "...",
  "address": {
    "id": "...",
    "house_number": 1,
    "house_number_ext": null,
    "postcode": "...",
    "street": "...",
    "city": "..."
  },
  "phone": "...",
  "contact_email": "...",
  "feature_toggles": [],
  "subscriptions": [],
  "push_subscriptions": [],
  "customer_type": "CONSUMER",
  "household_details": {
    "adults": 1,
    "children": 0,
    "cats": 0,
    "dogs": 0,
    "author": "USER",
    "last_edit_ts": 1779217463882
  },
  "check_general_consent": false,
  "placed_order": true,
  "received_delivery": true,
  "consent_decisions": {},
  "total_deliveries": 0,
  "completed_deliveries": 0
}
```

`GET /user-info` is narrower and currently useful for feature flags and redacted phone display:

```json
{
  "user_id": "...",
  "feature_toggles": [],
  "redacted_phone_number": "..."
}
```

`GET /profile-menu?fetch_mgm=true` returns a profile-menu shaped response:

```json
{
  "user": {
    "name": "...",
    "address": {},
    "avatar": {}
  },
  "highlights": []
}
```

The `picnic-api` types also describe optional MGM referral details on this response, but the verified account did not return `user.mgm`.

### Address changes

No confirmed authenticated address-change endpoint exists yet.

What is confirmed:

- Current delivery address is readable from `GET /user` and `GET /profile-menu?fetch_mgm=true`.
- Public onboarding address validation/normalization uses `POST /public-api/17/user-onboarding/check-address`.
- Public registration carries the initial address through `register` or `register-leadlist`.

What remains unverified:

- Whether Picnic exposes an authenticated "move house" or address-change flow through another route family.
- Whether address changes are intentionally app/support-only after registration.
- Whether the mobile app first creates an address-change request, checks delivery-area availability, or requires customer-service confirmation.

Do not implement address editing until the authenticated route family is discovered and tested. Showing the address as read-only is currently the safe settings behavior.

Validation probes rejected these authenticated address-route candidates with `404 Not Found` for `GET`, `POST`, and `PUT`:

```text
/address
/addresses
/user/address
/user/addresses
/user/address-change
/user/address_change
/user/move
/user/relocation
/user/delivery-address
/user/delivery_address
/user-onboarding/address
/user-onboarding/check-address
/user-onboarding/register-address
/user-onboarding/update-address
/address/check
/address/autocomplete
```

`PUT /user`, `PATCH /user`, and `PUT /user-info` are also not viable profile/address update routes. They return `BAD_REQUEST` with messages like:

```text
Request method 'PUT' is not supported
Request method 'PATCH' is not supported
```

`GET /bootstrap` did not expose obvious address/profile/settings navigation targets in the verified response. This makes an undiscovered address-change route less likely to be a simple first-level REST path.

Additional static discovery:

- Picnic's public website bundle exposes public onboarding address checks and lead-list registration, but no authenticated address-change route.
- The public deeplink script maps broad paths such as `profile`, `settings`, and `activate`, but does not reveal an address-edit API route.
- Authenticated `POST /deeplink/resolve` echoes unknown profile/settings/address-style deeplinks rather than resolving them to hidden page IDs.
- `GET /bootstrap` only exposed the normal store tab configuration for the verified account, not a profile/settings page tree.
- `codesalatdev/python-picnic-api` was inspected on 2026-07-31. It does not expose address/profile/settings write methods beyond typed reads such as `get_user()`. Its implemented account-relevant routes are still conventional reads and cart/delivery/product/search methods:

```text
GET  /user
GET  /cart
POST /cart/add_product
POST /cart/remove_product
POST /cart/clear
GET  /cart/delivery_slots
POST /deliveries/summary
GET  /deliveries/{delivery_id}
GET  /deliveries/{delivery_id}/scenario
GET  /deliveries/{delivery_id}/position
GET  /pages/search-page-results?search_term=...
GET  /pages/product-details-page-root?id=...&show_category_action=true
GET  /pages/L2-category-page-root?category_id=...&l3_category_id=...
POST /user/2fa/generate with channel "SMS" or "EMAIL"
POST /user/2fa/verify
```

This fork reinforces that `GET /user` is currently the stable address/settings read surface, but it does not reveal a delivery-address update target. Its README links Picnic's "Adding Write Functionality to Pages with Self-Service APIs" blog post, which explains that new mutations are increasingly implemented as Page Platform Tasks rather than feature-specific Java endpoints.

Focused rediscovery on 2026-08-10:

- `picnic-api` npm was still at `4.6.0`, with no newer user/address domain.
- `simonmartyr/picnic-api` was inspected as a third-party Go reference. It models address data as a read-only field on `GET /user` and does not expose profile/settings/address writes.
- Current public `picnic.app` scripts still expose only public onboarding address validation and lead-list registration:

```text
POST /rest/public-api/15/user-onboarding/check-address
POST /rest/public-api/15/user-onboarding/register-leadlist
```

- Focused authenticated reads of `GET /profile-menu?fetch_mgm=true`, `GET /user-info`, and `GET /bootstrap` still did not reveal a profile/settings/address page reference.
- Focused candidate Fusion pages such as `profile-page-root`, `settings-page-root`, `address-change-page-root`, `delivery-address-page-root`, `moving-page-root`, and `customer-details-page-root` were not available for the verified account.
- Focused candidate task names were rejected as unknown task IDs with empty bodies:

```text
/pages/task/address-change
/pages/task/change-address
/pages/task/update-address
/pages/task/save-address
/pages/task/edit-address
/pages/task/delivery-address-change
/pages/task/change-delivery-address
/pages/task/update-delivery-address
/pages/task/moving-address
/pages/task/relocation-address
/pages/task/user-address-change
/pages/task/user-onboarding-address
```

This keeps the current conclusion unchanged: address editing should remain hidden/read-only until a real authenticated address-change flow is observed. The strongest remaining discovery path is capturing the official app's own requests while opening or using its address-change flow.

Picnic's blog post describes Tasks as a Page Platform response type that can return arbitrary JSON and execute backend operations through a generic command binding. It explicitly uses adding a recipe to favorites as the kind of operation moved from a conventional backend API call to a Page Platform Task. That matches routes we already use, such as:

```text
POST /api/17/pages/task/recipe-saving
POST /api/17/pages/task/assign-selling-group-to-basket
POST /api/17/pages/task/update-selling-group-number-of-portions-task
POST /api/17/pages/task/remove-selling-group-from-basket
```

Implication for address/settings discovery: the missing write route may not look like `/user/address` at all. It may be a task endpoint whose ID appears only inside a real server-driven settings or onboarding page response. Without that page response, broad route guessing is a weak strategy.

Discovery caution:

Broad live guessing with many address-like paths produced noisy HTML `403` responses that are not reliable route-existence signals and may temporarily affect subsequent requests from the same client context. Do not use large live sweeps as the normal research method. For the missing delivery-address update route, prefer one of:

- capture the official mobile app's own request while changing address;
- inspect a newer `picnic-api` release if it adds a user/address domain;
- find a Fusion page/task reference in a real app response;
- ask for explicit approval before any focused account-changing test.

### Household composition

Household composition is read from `GET /user.household_details`.

The write candidate exposed by `picnic-api` is:

```ts
client.userOnboarding.setHouseholdDetails(details);
```

Route:

```text
POST /api/17/user-onboarding/household-details
```

Likely write payload, based on the readable user shape:

```json
{
  "adults": 1,
  "children": 0,
  "cats": 0,
  "dogs": 0
}
```

For writes, send only user-editable counts. Do not send server-managed `author` or `last_edit_ts` unless validation proves they are required.

This route has been same-value mutation-tested in this repo. Treat ordinary changes as supported, but still avoid sending server-managed fields.

- `GET /user.household_details` reflects the submitted values immediately.
- Sending the current values is accepted and returns analytics metadata.
- Country parity for DE/FR remains unverified.

Validation-only probes confirmed:

- `POST /user-onboarding/household-details` exists.
- `GET` and `PUT` on the same route are rejected with `405 Method Not Allowed`.
- The payload must be top-level, not nested under `household_details`.
- Empty body returns:

```text
At least one field of the household details should be present.
```

- Sending string values to numeric fields reaches DTO validation on `tech.picnic.userregistration.api.dtos.HouseholdDetails.Json`, confirming the backend expects integer values such as `adults`, `children`, `cats`, and `dogs`.

Practical CRUD interpretation:

```text
Read current household details:  GET  /api/17/user
Create/update household details: POST /api/17/user-onboarding/household-details
Delete household details:        no confirmed endpoint
```

### Business account details

Business details are optional on `GET /user.business_details`; the verified consumer account did not include them.

The write candidate exposed by `picnic-api` is:

```ts
client.userOnboarding.setBusinessDetails(details);
```

Route:

```text
POST /api/17/user-onboarding/business-details
```

Likely payload:

```json
{
  "business_name": "Example BV",
  "business_registration_number": "12345678",
  "sector": "OTHER",
  "employee_count": 10
}
```

Use `b2b_enabled` from public `check-address` and `customer_type` / `business_details` from `GET /user` to decide whether to show this UI. Do not call this endpoint casually because it may alter account type or tax/business metadata.

Validation-only probes confirmed:

- `POST /user-onboarding/business-details` exists.
- `PUT` on the same route is rejected with `405 Method Not Allowed`.
- The payload must be top-level, not nested under `business_details`.
- Empty body returns:

```text
At least one field of the business details should be present.
```

- Sending invalid numeric values reaches DTO validation on `tech.picnic.userregistration.api.dtos.BusinessDetails.Json`, confirming at least `employee_count` is expected as an integer when present.

Practical CRUD interpretation:

```text
Read current business details:  GET  /api/17/user
Create/update business details: POST /api/17/user-onboarding/business-details
Delete business details:        no confirmed endpoint
```

### Consents, privacy, and subscriptions

`picnic-api` exposes:

```ts
client.consent.getConsentSettings();
client.consent.getConsentSettings(true);
client.consent.setConsentSettings(input);
client.consent.getConsents(topics, strategy);
client.consent.getGeneralConsents();
client.consent.setGeneralConsents(input);
```

Routes:

```text
GET /api/17/consents/settings-page
GET /api/17/consents/general/settings-page
PUT /api/17/consents
GET /api/17/consents?consent_topics=...&strategy=WIDE|NARROW
GET /api/17/consents/general
PUT /api/17/consents/general
```

Read-only verification showed:

- `GET /consents/settings-page` returned an array of 8 settings.
- `GET /consents/general/settings-page` returned an array of 5 settings.
- Each setting included `type`, `id`, `text_id`, `text_locale`, `text`, `established_decision`, and `initial_state`.

The update payload is:

```json
{
  "consent_declarations": [
    {
      "consent_request_text_id": "text-id-from-setting",
      "consent_request_locale": "nl_NL",
      "agreement": true
    }
  ]
}
```

General-consent updates additionally include `general_consent`:

```json
{
  "general_consent": true,
  "consent_declarations": []
}
```

`GET /user` also exposes `subscriptions`, `push_subscriptions`, and `consent_decisions`. The older upstream Vue settings page displayed `subscriptions` read-only and mutated privacy settings via consent declarations.

No direct subscription toggle endpoint has been confirmed yet. Push onboarding is exposed separately as:

```text
POST /api/17/user-onboarding/subscribe-push
```

with payload:

```json
{
  "topics": ["..."]
}
```

Do not treat email/list subscriptions and push subscriptions as the same feature until their route semantics are verified.

Validation-only probes confirmed:

- `PUT /consents` is the target for normal privacy/marketing consent settings.
- `PUT /consents` with an empty declaration list returns `200` and an empty `consent_request_text_ids` list, so the route is live and can accept no-op input.
- `PUT /consents` with a current-value declaration returns `200` and the same value is reflected by the next settings-page read.
- `PUT /consents` with incomplete declaration objects returns missing-field validation for `consentRequestTextId`, `consentRequestLocale`, and `agreement`.
- `PUT /consents/general` is live, but `general_consent: true` requires a matching general consent declaration. A false/no-declaration payload returned:

```text
General consent declaration must be provided with generalConsent=true
```

A same-value payload containing all current general settings plus the current `check_general_consent` value still returned `422`. This makes normal consents editable now, but general consents should remain read-only until a real mobile-app payload or clearer package behavior is captured.

Focused recheck on 2026-08-10 clarified the distinction:

- `GET /consents/general` returns the general consent request/intro text. Its `PUT /consents/general` update contract still returned `422` for same-value false payload variants and should not be used in this app yet.
- `GET /consents/general/settings-page` returns individual consent settings. These overlap with `/consents/settings-page`, except some accounts may expose a general-only Push notification consent there.
- A same-value declaration for that general-only Push consent was accepted by `PUT /consents` and reflected unchanged by the next general settings-page read.

Implementation implication: merge `/consents/settings-page` and `/consents/general/settings-page` for display, dedupe by `text_id`, and update individual switches through `PUT /consents`. Do not expose the general consent request itself as editable until `PUT /consents/general` is understood.

The Push notifications settings-page entry is an exception: live comparison
showed that changing it through `PUT /consents` does not change the
corresponding switch for another registered device. Hide it in the web account
preferences alongside `user.push_subscriptions`; a future browser-push feature
must register its own device and describe the preference as browser-specific.

Practical CRUD interpretation:

```text
Read consent settings:          GET /api/17/consents/settings-page
Update consent settings:        PUT /api/17/consents
Read general consent request:   GET /api/17/consents/general
Read general settings page:     GET /api/17/consents/general/settings-page
Update general consent:         PUT /api/17/consents/general
Delete consent settings:        no delete; update by declaring agreement true/false
Read email/list subscriptions:  GET /api/17/user
Update email/list subscriptions: no confirmed endpoint
Read push subscriptions:        GET /api/17/user
Subscribe push topics:          POST /api/17/user-onboarding/subscribe-push
Unsubscribe push topics:        no confirmed endpoint
```

`POST /user-onboarding/subscribe-push` is device-sensitive. Validation with the generic script device ID returned a bad-request error saying the current user has no device with that ID. That confirms the route exists, but not that it should be used for ordinary settings toggles in this web app.

### Phone and email settings

Current phone and contact email are readable from `GET /user`. Redacted phone is readable from `GET /user-info`.

`picnic-api` exposes phone verification helpers:

```ts
client.auth.generatePhoneVerificationCode(phoneNumber);
client.auth.verifyPhoneNumber(phoneNumber, code);
```

Routes:

```text
POST /api/17/user/phone_verification/generate
POST /api/17/user/phone_verification/verify
```

Validation probes confirmed both routes exist and require `phone_number`; verify additionally requires `otp`.

These are phone verification routes, not confirmed phone-number update routes. No email update route has been found yet.

### Settings CRUD target matrix

Current implementation target table:

| Settings area                      | Read                                                                 | Create/update                                                                    | Delete/clear                     | Confidence                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Profile name/email/phone           | `GET /user`, `GET /user-info`, `GET /profile-menu?fetch_mgm=true`    | no confirmed route                                                               | no confirmed route               | Read confirmed only                                                                                            |
| Delivery address                   | `GET /user`, `GET /profile-menu?fetch_mgm=true`                      | no confirmed authenticated route                                                 | no confirmed route               | Read confirmed only; public website/bootstrap/deeplink/static package evidence did not reveal an update target |
| Household composition              | `GET /user.household_details`                                        | `POST /user-onboarding/household-details`                                        | no confirmed route               | Same-value mutation confirmed; ordinary edits are now reasonable                                               |
| Business details                   | `GET /user.business_details`                                         | `POST /user-onboarding/business-details`                                         | no confirmed route               | Route and payload validation confirmed; live mutation not run                                                  |
| Privacy/marketing consent settings | `GET /consents/settings-page`, `GET /consents/general/settings-page` | `PUT /consents`                                                                  | no delete; set `agreement` false | Same-value mutation confirmed; settings-page items are editable after merging and deduping by `text_id`        |
| General consent request            | `GET /consents/general`                                              | `PUT /consents/general`                                                          | no delete; update declarations   | Route exists, but same-value payload still returns `422`; do not expose this request as an editable setting    |
| Email/list subscriptions           | `GET /user.subscriptions`                                            | no confirmed route                                                               | no confirmed route               | Read confirmed only                                                                                            |
| Push subscriptions                 | `GET /user.push_subscriptions`                                       | `POST /user-onboarding/subscribe-push`                                           | no confirmed route               | Route exists, but device-bound and not ordinary web settings-ready                                             |
| Phone verification                 | none needed beyond `GET /user`/`GET /user-info`                      | `POST /user/phone_verification/generate`, `POST /user/phone_verification/verify` | n/a                              | Verification route confirmed, profile update not confirmed                                                     |

## Implementation outline

1. Add a register link on the login page.
2. Step 1: country selector and address form.
3. Call `check-address`.
4. If `waitlist_area: true`, show lead-list form and call `register-leadlist`.
5. If served, show account form and call `register`.
6. If `register` returns a token or immediate auth header, continue directly; otherwise show "check your email" and route the activation link/token to an activation page.
7. Activation page calls `activate`.
8. Log in with the selected credentials using the existing login flow.
9. Show optional household composition and business details.
10. Use `client.userOnboarding.setHouseholdDetails` and `setBusinessDetails` after authentication.

## Open questions for implementation

- The exact successful `register` response is unknown because no valid account-creating request was sent.
- It is unknown whether successful direct registration sends an email, returns an activation token, returns `x-picnic-auth`, or all of these depending on country/service area.
- It is unknown whether `password` or MD5 `secret` is preferred. Both passed schema validation. Prefer `secret` only if we want parity with `login`; prefer `password` if activation/direct registration expects plaintext.
- No authenticated address-change endpoint was found. The delivery address appears to be carried by public registration itself, then exposed by `GET /user`.
- Phone verification endpoints exist in authenticated auth service, but public direct registration did not require phone in validation-only probes.
- Settings implementation needs a focused authenticated mutation probe for household details, business details, consent updates, and any undiscovered address-change route. Start with read-only profile/settings UI and add mutations only after each route is proven restorable or low-risk.

## Test-account cleanup route

Before doing a valid registration probe with a real address, confirm account cleanup.

Unauthenticated route-existence probes found one strong cleanup candidate:

```text
DELETE /api/17/user
```

Observed unauthenticated behavior for NL/DE/FR:

```text
DELETE /api/17/user -> 401
```

The empty 401 response differs from adjacent non-existent paths, which returned `404`. Broad probes for likely alternatives such as `/user/delete`, `/user/deactivate`, `/account/delete`, `/privacy/delete`, and `/gdpr/erase` returned `404`.

Do not call `DELETE /api/17/user` with a real auth token unless the user explicitly approves a destructive account-deletion test.

## Valid no-phone registration probe

Date: 2026-05-20.

Tested with a non-residential served NL address:

```json
{
  "country_code": "NL",
  "postcode": "1012AB",
  "house_number": 1
}
```

`check-address` returned the canonical public address:

```json
{
  "address": {
    "postcode": "1012AB",
    "house_number": 1,
    "house_number_ext": null,
    "street": "Stationsplein",
    "city": "Amsterdam"
  },
  "b2b_enabled": true,
  "waitlist_area": false
}
```

Direct `register` was called with email, password, address, and no `phone`.

Result:

```json
{
  "user_id": "808-316-0725",
  "postcode_served": false,
  "contact_email": "warofan827@gzeos.com",
  "opt_in_token": "<returned-token>"
}
```

No `x-picnic-auth` header was returned, so no authenticated profile deletion could be attempted.

Attempting to use the returned `opt_in_token` as `/public-api/17/user-onboarding/activate` token returned:

```text
INVALID_TOKEN
Token is invalid or expired
```

Attempting login with the registration credentials returned:

```text
AUTH_ERROR
Could not authenticate user
```

Interpretation:

- No-phone direct registration can create an opt-in/lead-style record without immediate auth.
- The returned `opt_in_token` is not the activation token expected by `/user-onboarding/activate`.
- The result is not a complete usable account yet.
- Cleanup via `DELETE /api/17/user` is impossible at this stage because no auth token is available.
- Public probes for likely lead cleanup routes under `/public-api/17/user-onboarding/*` did not find a delete/unsubscribe endpoint.
