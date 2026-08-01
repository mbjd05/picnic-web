# Specs Alignment Notes

These specs were inherited across the original Next.js implementation and the
later Cloudflare Worker migration. They remain useful as behavioral records, but
their implementation paths are not always current.

## Current Stack Is Authoritative

New implementation work targets:

- `apps/web`: Vite, React, Tailwind CSS, TanStack Router, TanStack Query.
- `apps/api`: Hono on Cloudflare Workers.
- `src/lib`: shared Picnic API services, parsers, formatting, and pure utilities.
- `src/types`: shared domain/API types.
- `src/components`: shared presentation components.
- `scripts`: local probes and maintenance scripts.
- `docs`: project notes and research.

Do not create new Next.js App Router files, Next middleware, `next/*` imports, or
Next route handlers. Translate old references like `src/app/page.tsx`,
`src/app/api/*/route.ts`, `NextRequest`, and `NextResponse` to the current
Vite/Hono structure before implementation.

## Supersession Rules

Later specs and accepted project decisions supersede earlier specs when they
conflict:

- `005-product-detail-page` supersedes the `001-product-search` display-only
  product-card requirement. Product cards may link to detail pages.
- `007-plp-cart-actions` and `008-cart-page-actions` supersede the original
  read-only cart requirement in `006-cart-page`.
- The migrated auth flow keeps token login but intentionally adds
  email/password login, 2FA, per-region session handling, and local-only
  development login from env.
- Direct payment, delivery management, recipes, language/region preferences,
  dark mode, product browsing cache, and cookbook behavior are current project
  scope even where specs 001-018 do not fully describe them.

## Constitution Interpretation

The constitution now treats raw file length as a review signal, not a hard
limit. The enforced rule is responsibility cohesion: split files when they mix
independent reasons to change, hide reusable logic inside route components, or
become difficult to test safely. Large cohesive maps, defensive parsers, and
single-owner UI surfaces may remain together when that is clearer.

## Task Checkbox Status

Historical `tasks.md` files include manual validation items and old file paths.
Do not treat unchecked boxes as automatically incomplete without checking the
current implementation and current route/API behavior.
