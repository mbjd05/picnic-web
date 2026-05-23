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
client.userOnboarding.setHouseholdDetails(details)
client.userOnboarding.setBusinessDetails(details)
client.userOnboarding.subscribePush(topics)
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
