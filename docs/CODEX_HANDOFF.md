# Codex handoff

## Current objective

Expand the existing read-mostly `/account` page into profile management using newly researched Picnic routes. The current working tree adds name and avatar editing, address lookup/change and delivery specifications, household and consent refresh behavior, push-preference controls, and a browser-local saved-address workflow.

This objective is inferred from branch `feature/account-profile-management`, the modified files, the profile/address/avatar priorities in `docs/sensitive-api-implementation-plan.md`, and sanitized method/path/body-key/response-shape summaries from the ignored local capture. Raw capture payloads were not copied or exposed.

## Relevant architecture

- `apps/web` owns the React/TanStack account UI and calls same-origin `/api/account/*` routes with `fetchJson`.
- `apps/api` registers Hono routes, reads the HTTP-only Picnic session, and delegates to shared services.
- `src/lib/api-services/account.ts` validates inputs, calls either the installed Picnic client or direct Picnic HTTP endpoints, then normalizes results for the web app.
- `src/lib/api/validation.ts` contains Valibot request schemas; `src/types/account.ts` contains the shared response/domain shapes.
- Account data is held in the user-scoped TanStack Query cache. The new saved-address feature additionally writes sanitized address records to a country-and-user-scoped `localStorage` key; access codes and delivery instructions are deliberately removed before persistence.

## Files involved

- `apps/web/src/features/account/account-pages.tsx`: all new account forms, mutations, address autocomplete, delivery-details editor, avatar picker, push/consent toggles, and saved-address persistence.
- `apps/api/src/routes/account-routes.ts`: Hono endpoints for the new account operations and multipart avatar upload.
- `src/lib/api-services/account.ts`: Picnic route adapters for name, avatars, push topics, public address helpers, selected-address updates, and address specifications; also extends the profile read.
- `src/lib/api/validation.ts`: validates all new JSON mutation payloads.
- `src/types/account.ts`: shared avatar, address, specification, and mutation response types.
- `apps/web/src/lib/api-client.ts`: preserves browser-generated multipart boundaries for `FormData` requests.
- `src/lib/i18n/translations.ts`: new account labels in NL, DE, FR, and EN.
- `apps/web/src/styles.css`: attention animation for the delivery-details panel.
- `docs/sensitive-api-implementation-plan.md` and `docs/registration-onboarding-flow.md`: authoritative checked-in research context, but not updated by this working tree.

## Completed work

- Added authenticated Worker routes and shared services for the new profile operations.
- Added name editing and avatar selection/upload to the account UI.
- Added public address autocomplete/retrieval, selected-address mutation, delivery-specification read/write, and a three-entry saved-address UI.
- Split normal consent toggles from push-subscription toggles and refreshes profile data after writes.
- Added translations and multipart request support.
- Scoped saved addresses by Picnic user ID, capped avatar uploads at 5 MB and JPEG/PNG, and removed raw upstream response bodies from logged errors.
- Configured `picnic-api` from the authenticated token's device claim and routed
  push preference writes through its API-v15 generic request method, fixing the
  device-ID mismatch that previously produced a local `502`.
- Added account validation and Picnic token-claim tests; the unit suite now has
  54 tests.
- `pnpm validate` passes: lint, typecheck, 14 test files/54 tests, coverage, Vite
  build, and Wrangler dry-run build.
- There were no untracked task files before this handoff. `docs/CODEX_HANDOFF.md` and the account validation test are intentional continuation files.

## Inferred decisions and constraints

- Picnic region remains separate from display language; all queries and upstream URLs use `CountryCode`.
- Sensitive mutations are mediated by the Worker; auth remains in HTTP-only cookies.
- Mutations re-read authoritative Picnic state where practical, with a short retry/optimistic fallback for eventually consistent address reads.
- The saved-address feature is intentionally described as browser-local and capped at three entries rather than claimed as an official Picnic address book.
- General-consent requests remain distinct from normal setting declarations.
- Existing work must not be discarded merely because its private route research is absent from Git.

Sanitized capture inspection confirms the implemented API v15 route families and top-level body keys, including separate `POST /user` writes for `selected_address` and name, `push_subscriptions` for the captured push route, address specifications, and avatar reads/writes. It does not establish behavior for other regions/accounts, so the implementation remains deliberately data-driven and contact/business edits remain hidden.

## Remaining work

- Confirm region behavior of push changes during approved authenticated smoke
  testing; the captured v15 shape and device binding are confirmed, but they
  should not be generalized beyond subscription IDs returned by `GET /user`.
- Review fixed API versions/app/device headers and prefer the shared Picnic client/header helpers where possible.
- Add focused service and saved-address helper tests; validation coverage exists, but the direct upstream adapters and React flows are not unit-tested.
- `pnpm format:check` still reports already-unmodified `docs/registration-onboarding-flow.md` and `pnpm-lock.yaml`; active task files have been formatted without rewriting unrelated files.
- Perform authenticated smoke testing only with an approved test account and restorable values. Do not infer route success from the passing dry-run build.

## Verification commands

```powershell
pnpm format:check
pnpm validate
pnpm smoke:api:auth
```

For focused development, use `pnpm typecheck`, `pnpm test:unit`, `pnpm build:web`, and `pnpm build:api`. The authenticated smoke command requires local credentials and should not be run unless the configured account and mutation scope are known to be safe.
