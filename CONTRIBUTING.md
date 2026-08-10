# Contributing

This project is a TypeScript monorepo with a Vite/React frontend and a Hono
Cloudflare Worker API.

## Setup

```powershell
pnpm install
```

Use Node.js `26.5.1` or another compatible `26.x` release, and pnpm `11.19.0`.

## Development

```powershell
pnpm dev:web
pnpm dev:api
```

`pnpm dev:api` serves the Worker and Vite-built assets through Wrangler.

## Quality Gate

Before opening a pull request, run:

```powershell
pnpm format:check
pnpm validate
```

`pnpm validate` runs linting, type checking, unit tests, coverage, the Vite
production build, and a Worker dry-run build.

## Project Conventions

- Keep Picnic API access in shared services under `src/lib/api-services`.
- Keep defensive parsing in `src/lib/parse`.
- Keep shared domain types in `src/types`.
- Keep app composition in `apps/web/src/app`.
- Do not import `apps/web/src/app` from features or shared modules.
- Do not add `next/*` imports or Next.js route handlers.
- Do not store Picnic tokens in browser-visible storage.
- Do not log credentials, tokens, cookies, request bodies, or raw Picnic
  account payloads.

## Regional Picnic API Contributions

Picnic API behavior can differ per country and account. The maintainers can only
fully verify regions where they have a local Picnic account, so region-specific
contributions are welcome.

Good regional contributions are either:

- an implementation pull request with tests and documentation, or
- a behavior report that documents the observed API shape clearly enough for a
  maintainer to implement later.

### Payment Method Testing

Payment setup is currently confirmed only for NL iDEAL | Wero. For DE, FR, or
other future Picnic regions, please help by checking your own account's payment
profile.

1. Generate a local auth token for your own Picnic account:

   ```powershell
   node .\scripts\picnic-auth-probe.mjs login
   ```

2. Put the token in `.env` as `PICNIC_TOKEN`, and set the matching region if
   needed:

   ```text
   PICNIC_TOKEN=your-token-here
   PICNIC_COUNTRY_CODE=DE
   ```

3. Start the local Worker:

   ```powershell
   pnpm dev:api
   ```

4. Open the local app, log in for the same region, and visit:

   ```text
   http://127.0.0.1:8787/account/payment
   ```

5. Report which methods Picnic returns as available, which method is preferred
   if any, and whether the page shows stored options correctly.

Useful behavior to document:

- `available_payment_methods[].payment_method`
- whether the method has `available_banks`
- whether it has brands or other selector data
- `payment_methods[].display_name`
- whether `preferred_payment_option_id` points to a stored option
- whether checkout can start when the account already has a preferred method

Do not include auth tokens, cookies, email addresses, phone numbers, full names,
delivery addresses, payment option IDs, bank account fragments, raw response
dumps, or screenshots containing personal data. Redact or summarize private
fields before opening an issue or pull request.

For implementation PRs:

- keep payment reads dynamic from `GET /payment-profile`;
- do not add fallback availability that Picnic did not return;
- keep unsupported mutations hidden until they are confirmed with a real account;
- document the region and exact behavior in `docs/payment-flow.md`;
- add focused tests for parser/helper behavior where practical;
- run `pnpm validate` before opening the pull request.
