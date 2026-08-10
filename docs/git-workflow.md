# Git Workflow

This repository uses a lightweight GitHub Flow-style branch model.

Reference: GitHub documents GitHub Flow as creating a branch, making changes, opening a pull request, addressing review, merging, then deleting the branch. See <https://docs.github.com/en/get-started/using-github/github-flow>.

Why this model fits this project:

- `main` is the stable baseline and should remain deployable.
- Work is easier to review when features, bug fixes, and research spikes are isolated.
- The project does not need long-lived `develop` or release branches right now.

## Branch Names

Use one focused branch per task:

- `feature/<short-name>` for user-facing functionality.
- `bugfix/<short-name>` for defects and regressions.
- `chore/<short-name>` for maintenance, tooling, docs, and cleanup.
- `research/<short-name>` for probes, API discovery, and notes that may not become product code.

Examples:

- `feature/wallet-transactions`
- `bugfix/cart-total-flicker`
- `chore/pwa-icons`
- `research/profile-settings-crud`

## Rules

- Branch from the current `main`.
- Keep branches short-lived and scoped to one compat-map/spec item where practical.
- Run the relevant local checks before opening or merging a pull request.
- Prefer pull requests for review and CI, even for solo work.
- Delete branches after merge or when superseded.
- Do not keep old PR branches around as documentation; document decisions in `docs/` instead.

## Current Backlog

The active unfinished feature branch is:

- `feature/wallet-transactions`

This branch is intentionally parked until wallet transaction data exists for validation.

The next branches should be created from fresh `main` in this order:

- `research/profile-settings-crud`
- `feature/profile-menu`
- `feature/onboarding-flow`
- `feature/product-category-name-resolution`
- `feature/cookbook-user-recipes`
- `feature/barcode-gtin-lookup`
