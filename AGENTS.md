# AGENTS.md

This is the **Quorum Desktop** repository - the web and Electron desktop app for Quorum messenger.

---

## 🌐 Multi-Repository Ecosystem

Quorum is built as a **multi-repo ecosystem**. This repo is one of three:

| Repository | Purpose |
|------------|---------|
| **[quorum-desktop](https://github.com/QuilibriumNetwork/quorum-desktop)** | Web + Electron desktop app (this repo) |
| **[quorum-mobile](https://github.com/QuilibriumNetwork/quorum-mobile)** | React Native + Expo mobile app |
| **[quorum-shared](https://github.com/QuilibriumNetwork/quorum-shared)** | Shared types, UI primitives, hooks, sync protocol |

All clients sync data via `@quilibrium/quorum-shared`. When implementing features, check if mobile has it and use shared types for sync compatibility.

**Full Guide**: [Quorum Ecosystem Architecture](.agents/docs/quorum-shared-architecture.md)

---

## 🚀 Quick Start for AI Development

**IMPORTANT**: Before starting ANY task, read these files:

1. **[AGENTS.md](.agents/AGENTS.md)** - Fast lookup for file paths, patterns, and common tasks
2. **[agents-workflow.md](.agents/agents-workflow.md)** - How to effectively use documentation
3. **[INDEX.md](.agents/INDEX.md)** - Find specific documentation for your task

---

## Repository Structure

```
quorum-desktop/
├── src/                          # Application source code
│   ├── components/              # React components
│   │   ├── primitives/         # SCSS styles + barrel re-exports from @quilibrium/quorum-shared
│   │   └── Router/             # Routing components
│   ├── hooks/                  # Custom React hooks
│   ├── api/                    # API layer
│   ├── services/               # Business logic services
│   ├── types/                  # TypeScript types (local, extends quorum-shared)
│   ├── utils/                  # Utility functions
│   └── adapters/               # Storage adapters (IndexedDBAdapter)
│
├── web/                        # Web/Electron entry points
│   ├── index.html             # Web HTML entry
│   ├── main.tsx               # React entry point
│   ├── vite.config.ts         # Vite bundler config
│   └── electron/              # Electron desktop wrapper
│
└── .agents/                    # Development documentation
    ├── docs/                   # Architecture & feature guides
    ├── issues/           # Bugs AND tasks being worked on right now
    └── reports/                # Analysis & audits
```

---

## CRITICAL: Package Management

- **NEVER use npm commands** - this project uses Yarn exclusively
- **Always use `yarn` commands** - npm creates package-lock.json which conflicts with yarn.lock
- **If package-lock.json appears, DELETE it immediately**

---

## @quilibrium/quorum-shared

Import shared types, hooks, and utilities from the shared package:

```typescript
// Types
import type { Space, Message, Channel, UserConfig } from '@quilibrium/quorum-shared';

// Utilities (most common - used in 45+ files)
import { logger } from '@quilibrium/quorum-shared';

// Sync utilities
import { SyncService, createMemberDigest } from '@quilibrium/quorum-shared';

// Hooks
import { useSpaces, useMessages } from '@quilibrium/quorum-shared';
```

**Full Reference**: [Quorum Ecosystem Architecture](.agents/docs/quorum-shared-architecture.md)

---

## React Hooks Rules - IMPORTANT

**NEVER violate React's Rules of Hooks:**

```tsx
// ❌ BAD - Conditional return before hooks
if (someCondition) return <SomeComponent />;
useEffect(() => {...}, []);  // This hook is called conditionally!

// ✅ GOOD - All hooks before conditionals
useEffect(() => {...}, []);
if (someCondition) return <SomeComponent />;
```

**Rules:**
- Call all hooks at the top level (not inside functions, conditionals, or loops)
- Call hooks in the same order on every render
- NEVER put conditional returns before hooks

**Reference**: [React Hooks Violation Bug](.agents/issues/.done/2025-01-20-react-hooks-violation-conditional-return.md)

---

## UI Primitives

Use primitives for interactive elements:

```tsx
import { Button, Input, Modal } from 'src/components/primitives';

<Button onClick={save}>Save</Button>
<Input value={name} onChange={setName} />
<Modal isOpen={open} onClose={close}>...</Modal>
```

**When to use primitives**: Always for interactive elements (Button, Input, Modal, Select, Switch). For layout, use Flex (not Container — removed). For text on web, use plain HTML (`<span>`, `<p>`) with CSS typography classes (`.text-label`, `.text-strong`, `.text-subtle`). The Text primitive is **native-only** — not used in web production code.

**Source**: All primitives live in `@quilibrium/quorum-shared` and are re-exported from `src/components/primitives/` (SCSS-only shim). Do not add primitive source files to quorum-desktop.

**Reference**: [Primitives Guide](.agents/docs/features/primitives/INDEX.md)

---

## Documentation Structure

The `.agents/` folder contains all development context:

- **[AGENTS.md](.agents/AGENTS.md)** - ⭐ START HERE - Fast lookup for everything
- **[agents-workflow.md](.agents/agents-workflow.md)** - ⭐ READ THIS - How to work effectively
- **[INDEX.md](.agents/INDEX.md)** - Complete documentation index

**Topics covered**:
- Architecture & Components
- Features (Modals, Search, Theming, etc.)
- Active Bugs & Tasks
- Reports & Audits

**🔒 `.agents/issues/.secret/` — gitignored, never committed.** This repository is
public, so issue write-ups that describe an attack working against code users are
running today (mechanism, `file:line` pointers, vulnerable code, repro steps) are
created in `.secret/` from the start and kept out of `INDEX.md`. Ordinary
reliability, data-loss and correctness bugs are filed normally, however serious.
Full rule and the release procedure: [.agents/AGENTS.md](.agents/AGENTS.md) →
"Security-sensitive issues".

---

## quorum-shared Migration — Active & Ongoing

**Status (as of 2026-04-09):** Types ✅ | Primitives ✅ | Utils ✅ | Hooks ⏳ (blocked)

quorum-shared is not just a dependency — it's the migration destination for this repo's code. PRs 1–3 are complete. PR 4 (hooks) is next but requires access to the latest quorum-mobile codebase first.

**Rules to follow while this migration is ongoing:**

- **New utility functions**: If a new util is platform-agnostic (no DOM APIs, no desktop-specific imports), it should either go directly into quorum-shared or be flagged as a migration candidate. Ask: "Would mobile need this?"
- **New hooks**: Classify immediately (Pure / Context-dependent / Platform-specific — see `quorum-shared-migration/2026-03-19-hooks-migration-design.md`). Pure business hooks belong in shared eventually.
- **New types**: Add to quorum-shared directly (`src/types/`), not just locally.
- **Import pattern**: Always import migrated utils and primitives from `@quilibrium/quorum-shared`, not from local paths.

**Key reference docs:**
- [Migration status overview](.agents/issues/quorum-shared-migration/reference/stacked-prs-workflow.md)
- [Hooks migration design + hook classification](.agents/tasks/quorum-shared-migration/2026-03-19-hooks-migration-design.md)
- [quorum-shared architecture](.agents/docs/quorum-shared-architecture.md)

---

## Verifying a change

Before reporting any code change complete, run `yarn verify` and paste the
verdict block **verbatim**.

**Full guide: [The verify gate](.agents/docs/verify-gate.md)** — what each
verdict means, what it costs, what it does not cover, and where the pieces live.

- Do not summarise it, and do not report a subset of the rows.
- Do not report `PASS` when the block says `PASS (PARTIAL)` or `FLAKY`. Those
  are distinct verdicts: `PASS (PARTIAL)` means **this run proved less than a
  full run would** — read the `⚠` lines and say whether the gap matters for
  this change. `FLAKY` means a step went green only on a retry.
- A `KNOWN-RED` row does **not** make a run partial. It is a step that ran and
  failed exactly as already recorded on main, so it proved nothing less; the
  verdict line names those steps separately. If one gets WORSE than its
  recorded baseline the run FAILs — the baseline is a ceiling, never a budget.
- A `ℹ` line is advisory and costs the verdict nothing (a stale exemption, a
  debt count that improved). Only `⚠` lines are the ones that made a run
  PARTIAL. Do not report an `ℹ` line as a problem.
- `yarn verify --show-receipt` prints the last run's record, including the
  commit it ran against.

### The live tier will not run on a machine with no bot identities

The live arms drive real bots against the **production relay**, and accounts and
Spaces there are **permanent — there is no delete endpoint**. On a machine whose
`src/dev/tests/harness/.state/` is empty (a fresh clone, or CI), running them
would register 6 accounts and a Space that can never be removed.

So the gate checks first (`scripts/verify/mintGuard.mjs`) and skips any arm that
would mint, printing a `MINT-GUARD` line and reporting `PASS (PARTIAL)`. **That
is correct behaviour, not a failure — do not work around it, and do not pass
`--live-allow-minting` to make it go away.** The fast tier still ran in full
(typecheck, lint, 1808 + 766 + 1222 tests, build), which is what a PASS on that
run means.

If you add a new live arm, add its identities to `STATE_BY_ARM` in that file. An
unlisted arm is assumed to mint and will not run; the fast tier fails if you
forget, so this cannot rot silently.

### What it costs, so you can predict before you run it

The gate routes itself from the diff (`scripts/verify/routing.mjs`), so the
cost depends on what changed. "What changed" means **this branch's own commits
plus any uncommitted work** — so committing before you verify is fine, and
running it on a clean branch still checks that branch. (Until 2026-08-23 it read
only the working tree, so a clean tree reported "no changes detected" and ran
nothing, however much the branch had changed.) **`yarn verify --explain` prints the plan and
the arms it would run, in milliseconds, without running any of them** — ask it
rather than guessing from the list below:

```
  ROUTED     mobile
  TIER       fast + live
  LIVE ARMS  config-cross
  HELD BACK  cross-dm  (run `yarn verify --all`)
             (only quorum-mobile changed — running the cross-client arms; the
              four same-client arms load no mobile code and cannot observe it)
```

- **Docs, styles, images, translation catalogues, or a components-only
  change**: the fast tier only, about **3 minutes** (desktop's fast tier:
  typecheck, lint, unit tests, build; measured 2026-08-23). The live tier does
  not run. Changing the colour of a button falls here, as does editing
  `src/i18n/<locale>/messages.po` — but not `src/i18n/i18n.ts`, which is code.
- **A quorum-mobile-only change**: the fast tier plus **only the cross-client
  arms**, which today means `config-cross` alone (`cross-dm` is held back, see
  below). The four same-client arms are desktop vitest scenarios that never
  load mobile code, so they cannot observe the change; running them would be
  six minutes of real-relay traffic that could not have gone red.
- **Services, sync, storage, crypto, or any path nobody has classified**: the
  fast tier plus the live tier, about **6.5 minutes measured**. Real bots send
  real messages over a real relay.
- **A change under `src/dev/tests/harness/`**: the fast tier plus the full live
  tier, deliberately. The harness IS the live tier's measuring equipment, so a
  change to it is exactly the change a live run has to check. Every other
  directory under `src/dev/tests/` stays on the fast tier, which already runs
  those tests.
- **Two arms are HELD BACK from every per-change run**, for unrelated reasons.
  `yarn verify --all` runs both, and every run that leaves one out says so on
  its own `HELD BACK` line, quoting why — so this can never quietly become
  "nobody ran it".
  - **`space-basic`** creates a permanent, undeletable Space each time it runs,
    and unlike `space-delivery` it cannot reuse one, because creating a space
    is its subject.
  - **`cross-dm`** reports a reproducible cross-client message loss (5 of 6
    runs, always the first echo desktop sends) whose cause is not yet known,
    tracked in
    `.agents/issues/.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md`.
    It is held back rather than removed because an arm that is red in most runs
    for a reason unrelated to the change under test would block every piece of
    work. Release it — two lines in `scripts/verify/steps.mjs` — once that issue
    is resolved either way.
- `yarn verify --fast` skips the live tier on request, for a quick check
  mid-work; it is not a substitute for the full run before reporting done.
- `space-delivery` is retried once if it fails, because it is load-sensitive
  under the live tier's back-to-back real-relay traffic. A retry-pass reports
  `FLAKY`, never `PASS`: that distinction is the point, not a bug.

An unclassified path defaults to the live tier on purpose: the routing is an
allowlist of provably safe paths, not a denylist of risky ones, so it rots
loudly (an occasional unnecessary few minutes) rather than silently (a real
risk shipping with no coverage). That is the trade this rule makes on your
behalf.

---

## Development Checklist

- ✅ Read AGENTS.md for relevant patterns
- ✅ Check if feature exists in quorum-mobile (use shared types for sync)
- ✅ Use primitives for interactive elements
- ✅ Follow React Hooks rules
- ✅ Use Yarn (never npm)
- ✅ New utils/hooks: consider if they belong in quorum-shared

---

_Last updated: 2026-08-23_
