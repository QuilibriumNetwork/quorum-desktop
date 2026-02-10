# AGENTS.md

This is the **Quorum Desktop** repository - the web and Electron desktop app for Quorum messenger.

---

## 🌐 Multi-Repository Ecosystem

Quorum is built as a **multi-repo ecosystem**. This repo is one of three:

| Repository | Purpose |
|------------|---------|
| **[quorum-desktop](https://github.com/QuilibriumNetwork/quorum-desktop)** | Web + Electron desktop app (this repo) |
| **[quorum-mobile](https://github.com/QuilibriumNetwork/quorum-mobile)** | React Native + Expo mobile app |
| **[quorum-shared](https://github.com/QuilibriumNetwork/quorum-shared)** | Shared types, hooks, sync protocol |

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
│   │   ├── primitives/         # UI primitives (Button, Input, Modal, etc.)
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
    ├── tasks/                  # Task tracking
    ├── bugs/                   # Bug reports
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

**Reference**: [React Hooks Violation Bug](.agents/bugs/.solved/SOLVED_react-hooks-violation-conditional-return.md)

---

## UI Primitives

Use primitives for interactive elements:

```tsx
import { Button, Input, Modal } from 'src/components/primitives';

<Button onClick={save}>Save</Button>
<Input value={name} onChange={setName} />
<Modal isOpen={open} onClose={close}>...</Modal>
```

**When to use primitives**: Always for interactive elements (Button, Input, Modal, Select, Switch). For layout, use Flex/Container. For text on web, use plain HTML (`<span>`, `<p>`) with CSS typography classes (`.text-label`, `.text-strong`, `.text-subtle`). The Text primitive is **native-only** — not used in web production code.

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

---

## Development Checklist

- ✅ Read AGENTS.md for relevant patterns
- ✅ Check if feature exists in quorum-mobile (use shared types for sync)
- ✅ Use primitives for interactive elements
- ✅ Follow React Hooks rules
- ✅ Use Yarn (never npm)

---

_Last updated: 2026-01-06_
