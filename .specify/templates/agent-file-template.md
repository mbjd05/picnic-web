# [PROJECT NAME] Development Guidelines

Auto-generated from all feature plans. Last updated: [DATE]

## Active Technologies

[EXTRACTED FROM ALL PLAN.MD FILES]

## Project Structure

```text
apps/
├── api/                 # Hono Cloudflare Worker routes and Worker config
└── web/                 # Vite React app, TanStack Router routes, Tailwind UI

src/
├── components/          # Shared framework-neutral React presentation components
├── lib/                 # Shared Picnic services, parsers, formatting, utilities
└── types/               # Shared domain and API types

scripts/                 # Local probe, maintenance, and smoke-test scripts
docs/                    # Project research, migration, and review notes
tests/                   # Unit and smoke-test support
```

## Commands

[ONLY COMMANDS FOR ACTIVE TECHNOLOGIES]

## Code Style

[LANGUAGE-SPECIFIC, ONLY FOR LANGUAGES IN USE]

- New frontend code belongs in `apps/web/src`.
- New Worker/API routes belong in `apps/api/src/routes`.
- Shared Picnic API logic belongs in `src/lib`.
- Shared domain types belong in `src/types`.
- Do not add `next/*` imports, Next middleware, or Next route handlers.
- Treat older specs that mention `src/app` or `src/app/api` as historical
  implementation notes; preserve their behavioral contracts through the current
  Vite/Hono architecture.
- Split files by responsibility boundary. Raw line count is a review signal,
  not an automatic rule.

## Recent Changes

[LAST 3 FEATURES AND WHAT THEY ADDED]

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
