[![GitHub license](https://img.shields.io/badge/license-AGPL3.0-blue.svg?style=flat-square)](https://github.com/MRVDH/picnic-web/blob/master/LICENSE) [![Buy me an Affligem blond](https://img.shields.io/badge/buy%20me%20an-affligem%20blond-orange?style=flat-square)](https://www.buymeacoffee.com/MRVDH) [![MAAR3267](https://img.shields.io/badge/picnic%20discount-MAAR3267-E1171E?style=flat-square)](https://picnic.app/nl/vriendenkorting/MAAR3267)

# Picnic Web

Unofficial web interface for the online supermarket Picnic. It uses the npm library [picnic-api](https://github.com/MRVDH/picnic-api) and runs as a Vite/React app served by a Hono API on Cloudflare Workers.

This project is independent and is not affiliated with Picnic.

<img alt="image" src="https://github.com/user-attachments/assets/774c2fd5-4c0e-4bcf-b789-a51c5b93a996" />

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

Deploy the Worker and static web assets:

```powershell
pnpm deploy:worker
```

## Local Auth Testing

Authenticated smoke tests use `PICNIC_TOKEN` from `.env`. Generate one with:

```powershell
node .\src\scripts\picnic-auth-probe.mjs login
```

Then run:

```powershell
pnpm smoke:api:auth
```

Do not commit `.env`; it is intentionally ignored.

## FAQ

#### Why this when there is an app?

For when you do not have your phone with you but still want to browse, manage your cart, view recipes, manage payment methods, or check deliveries.

#### Something broke, what now?

Please report issues in GitHub issues.
