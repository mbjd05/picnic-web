# Library Refactor Progress

## Phase Checklist

- [x] Phase 1: Valibot request/input validation
- [x] Phase 2: Zustand client-only cart/UI state
- [x] Phase 3: TanStack Form login/payment/rating forms
- [ ] Phase 4: Ky-backed API client wrapper
- [ ] Phase 5: TanStack Virtual performance spike
- [ ] Phase 6: Persistent cache decision: no persistent cache vs no library vs in-memory query only vs Dexie vs idb

## Current Status

Completed body/input validation for cart mutations, delivery slots, payment option creation, checkout cancel, auth login, 2FA verification, country switching, delivery rating, and recipe add-to-cart.

Moved visible cart UI state to a small Zustand store while keeping server state in TanStack Query and the existing per-product mutation coordination in the cart provider.

Moved login, payment-bank selection, and delivery-rating submit controls to TanStack Form without changing visible UI or request payloads.

## Validation Log

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`
- Phase 2 repeated `pnpm format:check`, `pnpm typecheck`, and `pnpm test:unit`.
- Phase 3 repeated `pnpm format:check`, `pnpm typecheck`, and `pnpm lint`.
