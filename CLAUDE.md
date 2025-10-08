# CLAUDE.md

This is a React project using Vite and Electron with a **cross-platform web + mobile architecture**.

---

## 🚀 Quick Start for AI Development

**IMPORTANT**: Before starting ANY task, read these three files in order:

1. **[AGENTS.md](.agents/AGENTS.md)** - Fast lookup for file paths, patterns, and common tasks
2. **[agents-workflow.md](.agents/agents-workflow.md)** - How to effectively use documentation
3. **[INDEX.md](.agents/INDEX.md)** - Find specific documentation for your task

---

## Cross-Platform Architecture - CRITICAL

**IMPORTANT**: This project uses a shared codebase with primitive components designed for both web and mobile platforms. All development must consider mobile compatibility from the start.

### Key Principles

- **Shared Code Architecture**: Components are built using custom primitives that abstract platform differences
- **Mobile-First Approach**: Every UI change must work on both desktop and mobile
- **Pragmatic Primitive Usage**: Use primitives for interactive elements and layouts, but don't over-engineer (see [When to Use Primitives](.agents/docs/features/primitives/03-when-to-use-primitives.md))
- **Platform Detection**: Use `src/utils/platform.ts` utilities (`isWeb()`, `isMobile()`, `isElectron()`)

**When making any changes, always ask**: "Will this work on mobile?" If uncertain, use primitives and follow mobile-first design principles.

**Reference**: [AGENTS.md - Core Architectural Patterns](.agents/AGENTS.md#-core-architectural-patterns)

---

## Repository Structure

```
quorum/
├── src/                          # SHARED CODE (90% of app)
│   ├── components/              # Business logic components
│   │   ├── primitives/         # Cross-platform UI components
│   │   └── Router/             # Platform-aware routing
│   ├── hooks/                  # 100% shared business logic
│   ├── api/                    # 100% shared API layer
│   ├── services/               # 100% shared services
│   ├── types/                  # 100% shared TypeScript types
│   └── utils/                  # 100% shared utilities (including platform detection)
│
├── web/                        # WEB-SPECIFIC FILES
│   ├── index.html             # Web HTML entry
│   ├── main.tsx               # Web React entry point
│   ├── vite.config.ts         # Vite bundler config
│   └── electron/              # Electron desktop wrapper
│
├── mobile/                     # MOBILE-SPECIFIC FILES
│   ├── App.tsx                # React Native entry point
│   └── app.json               # Expo configuration
```

**Detailed Guide**: [Cross-Platform Repository Implementation](.agents/docs/cross-platform-repository-implementation.md)

---

## CRITICAL: Package Management

- **NEVER use npm commands** - this project uses Yarn exclusively
- **Always use `yarn` commands** - npm creates package-lock.json which conflicts with yarn.lock
- **If package-lock.json appears, DELETE it immediately**

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

## Documentation Structure

The `.agents/` folder contains all development context, tasks, and documentation:

- **[AGENTS.md](.agents/AGENTS.md)** - ⭐ START HERE - Fast lookup for everything
- **[agents-workflow.md](.agents/agents-workflow.md)** - ⭐ READ THIS - How to work effectively
- **[INDEX.md](.agents/INDEX.md)** - Complete documentation index

**For specific topics**, see [INDEX.md](.agents/INDEX.md) which organizes all documentation by:
- Architecture & Components
- Features (Modals, Search, Theming, etc.)
- Mobile Development
- Active Bugs & Tasks

---

## Development Workflow

**See**: [AGENTS.md - Workflow Guidelines](.agents/AGENTS.md#-workflow-guidelines)

Quick checklist:
- ✅ Read AGENTS.md for relevant patterns
- ✅ Use primitives for interactive elements
- ✅ Think mobile-first
- ✅ Follow React Hooks rules
- ✅ Use Yarn (never npm)

---

_Last updated: 2025-10-08_
