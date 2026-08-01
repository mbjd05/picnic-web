# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]
**Primary Dependencies**: [For this project prefer: Vite, React, Tailwind CSS, TanStack Router, TanStack Query, Hono, Cloudflare Workers, picnic-api, Valibot, Ky]
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]
**Target Platform**: [For this project prefer: Cloudflare Workers free tier + modern browsers]
**Project Type**: [For this project prefer: Vite React SPA plus Hono Worker API]
**Performance Goals**: [Prioritize fast and reliable Picnic API interaction, responsive UI, small Worker CPU cost]
**Constraints**: [Cloudflare Worker compatibility, no SSR dependency, no browser-visible auth tokens, private data no-store]
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
apps/
├── api/
│   └── src/
│       ├── lib/
│       └── routes/
└── web/
    └── src/
        ├── app/
        ├── components/
        ├── features/
        ├── hooks/
        ├── lib/
        ├── providers/
        └── stores/

src/
├── components/
├── lib/
└── types/

scripts/
docs/
tests/
└── unit/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

**Legacy Spec Translation**: [If the source spec mentions Next.js paths such as
`src/app` or `src/app/api`, document the equivalent current paths in `apps/web`,
`apps/api`, `src/lib`, and `src/types`. Do not implement new Next.js files.]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
