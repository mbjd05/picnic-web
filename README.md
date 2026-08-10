[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg?style=flat-square)](./LICENSE)

# Picnic Web

Unofficial web interface for the online supermarket Picnic. It uses the npm library [picnic-api](https://github.com/MRVDH/picnic-api) and runs as a Vite/React app served by a Hono API on Cloudflare Workers.

Picnic Web is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Picnic.

## Project Direction

This fork started from [MRVDH/picnic-web](https://github.com/MRVDH/picnic-web) and keeps that project's goal of making Picnic usable from a browser. It now deliberately targets a different runtime shape: no Next.js SSR, a static Vite/React client, and a small Hono Worker that proxies authenticated Picnic API calls with HTTP-only cookie sessions.

The migration is meant to keep Picnic API interaction fast and reliable on inexpensive hosting targets, especially the Cloudflare Workers free tier. The same separation should also make later Docker or desktop-shell targets easier because the UI and API boundary is explicit.

## Features

- Product browsing, search suggestions, category pages, product detail pages, and cart controls.
- Recipe browsing, recipe detail pages, saved recipes, and recipe-to-cart support.
- Delivery-slot selection, delivery/order status views, invoice/rating actions where Picnic exposes them, and direct payment/profile flows.
- Region and display-language selection for supported Picnic regions.
- Dark mode, mobile shell improvements, persisted client-side browsing caches, and PWA install metadata.

## Upstream Credits

This project depends heavily on the original work in [MRVDH/picnic-web](https://github.com/MRVDH/picnic-web) and [MRVDH/picnic-api](https://github.com/MRVDH/picnic-api). Several later improvements were also informed by current upstream changes, including France support, Picnic API-driven labels and colors, narrow search fallback behavior, subcategory title fallbacks, and repository cleanup direction. Where this fork differs, it is mostly because the runtime target moved from Next.js to Vite/Hono/Cloudflare Workers.

## Development

Requirements:

- Node.js `26.5.1` or compatible `26.x`
- pnpm `11.19.0`

Install dependencies:

```powershell
pnpm install
```

Run the Vite web app during local development:

```powershell
pnpm dev:web
```

Run the Cloudflare Worker API locally:

```powershell
pnpm dev:api
```

Validate the project:

```powershell
pnpm validate
```

Format the project:

```powershell
pnpm format
```

Deploy the Worker and static web assets:

```powershell
pnpm deploy:worker
```

## Contributing Regional API Behavior

Picnic API behavior can differ per country and account. Payment setup is
currently confirmed only for NL iDEAL | Wero; DE/FR payment methods need
region-local account reports or implementation pull requests before this project
can support them. See
[CONTRIBUTING.md](./CONTRIBUTING.md#regional-picnic-api-contributions) for safe
testing steps and guidance on redacting private account data.

## PWA Behavior

The Vite build emits a web app manifest and service worker. Only static app assets are precached; authenticated `/api/*` responses and Picnic account data are not stored in a shared service-worker cache.

## Local Auth Testing

Authenticated smoke tests use `PICNIC_TOKEN` from `.env`. Generate one with:

```powershell
node .\scripts\picnic-auth-probe.mjs login
```

Then run:

```powershell
pnpm smoke:api:auth
```

Do not commit `.env`; it is intentionally ignored.

## Security And Privacy

- Picnic credentials are used only to obtain a Picnic auth token.
- Auth tokens are stored in HTTP-only cookies by the Worker API.
- Do not commit `.env`, `.dev.vars`, local logs, build output, screenshots, or Playwright artifacts.
- Report sensitive issues privately according to [SECURITY.md](./SECURITY.md).

## FAQ

#### Why this when there is an app?

For when you do not have your phone with you but still want to browse, manage your cart, view recipes, manage payment methods, or check deliveries.

#### Something broke, what now?

Please report issues in GitHub issues.
