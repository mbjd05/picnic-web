# Upstream Alignment

This fork tracks `MRVDH/picnic-web` as upstream, but the codebase is no longer a line-by-line Next.js fork. Upstream changes are reviewed for behavior, Picnic API compatibility, parser robustness, dependency/security fixes, and project hygiene before being ported into the Vite/Hono implementation.

## Current Upstream Delta

Reviewed upstream commits through `MRVDH/picnic-web@5caff70` / `v2.8.1`.

Already covered or intentionally superseded here:

- France region and display-language support.
- Localized delivery date formatting and Picnic image-region behavior.
- Narrow search fallback when Picnic returns products without filter sections.
- Subcategory title fallback from malformed `layout.header` to top-level `header`.
- API-driven promotion, badge, label, taste-descriptor, and discounted-price color extraction.
- Auth key generation and `.env.example` local testing guidance.
- Runtime/security dependency direction, with this fork targeting Node 26 instead of upstream's Node 24.
- Feature-oriented folder structure, adapted to the migrated Vite/Hono layout.
- Spec-kit scaffolding removal from the active project shape.

Not directly ported:

- Next.js route/component refactors, because the legacy Next app has been retired in this fork.
- `package-lock.json` changes, because this fork uses pnpm and `pnpm-lock.yaml`.

## Review Rule

Future upstream commits should be evaluated by behavior and API compatibility rather than by raw diff size. Large file deletions or moves in upstream often reflect the old Next.js tree and should not be applied mechanically.
