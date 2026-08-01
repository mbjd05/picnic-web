[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg?style=flat-square)](./LICENSE)

# Picnic Web

Unofficial web interface for the online supermarket Picnic. It uses the npm library [picnic-api](https://github.com/MRVDH/picnic-api) and runs as a Vite/React app served by a Hono API on Cloudflare Workers.

This project is independent and is not affiliated with Picnic.

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
