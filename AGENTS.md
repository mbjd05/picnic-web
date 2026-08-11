# picnic-web Development Guidelines

## Current Architecture

- TypeScript 5.9
- Node.js `>=26.5.1 <27`
- pnpm 11
- `apps/web`: Vite, React 19, Tailwind CSS 4, TanStack Router, TanStack Query
- `apps/api`: Hono on Cloudflare Workers, serving API routes and static Vite assets
- `src/lib`: shared Picnic API services, parsers, domain types, formatting helpers, and pure utilities
- `src/components`: shared React presentation components

The legacy Next.js app has been retired. Do not add new `next/*` imports or Next route handlers.

## Commands

```powershell
pnpm install
pnpm dev:web
pnpm dev:api
pnpm validate
pnpm format:check
pnpm smoke:api:auth
```

`pnpm validate` runs lint, typecheck, Vite build, and Worker dry-run build.

## Code Style

- Prefer shared parser/service functions in `src/lib` over route-specific logic.
- Keep Picnic API region (`CountryCode`) separate from display language (`LanguageCode`).
- Use `useCountryCode()` for API query keys, image URLs, region-specific date formatting, and Picnic endpoint behavior.
- Use `useTranslations()` for authenticated UI labels.
- Keep private Picnic data out of caches that could be shared between users.
- Keep auth tokens in HTTP-only cookies; do not store tokens in browser-visible storage.
- Avoid logging tokens, passwords, email addresses, request bodies, or raw Picnic payloads in production code.

## Public-Repo Hygiene

- Never commit `.env`, tokens, credentials, local logs, generated repo dumps, build output, or Playwright artifacts.
- Keep `.env.example` placeholder-only.
- Run `pnpm format` before large cleanup commits and `pnpm validate` before pushing.

## Repository Collaboration

- This fork is no longer expected to remain compatible with the upstream source project.
- Merge completed feature branches directly into this fork's `main` when requested.
- Never open pull requests against the upstream repository.
