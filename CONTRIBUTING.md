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
