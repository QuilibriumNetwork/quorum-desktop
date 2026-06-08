# Agents Workflow Guide

Best practices for AI-assisted development on the Quorum Desktop project.

---

## Table of Contents

1. [Before Starting Any Task](#before-starting-any-task)
2. [Common Workflows](#common-workflows)
3. [Key Resources by Task Type](#key-resources-by-task-type)
4. [PR & Commit Workflow](#pr--commit-workflow)
5. [Documentation Guidelines](#documentation-guidelines)
6. [Tips for Effective AI Development](#tips-for-effective-ai-development)
7. [Common Pitfalls](#common-pitfalls)

---

## Before Starting Any Task

### Step 1: Check Quick Reference

**Always start here**: [AGENTS.md](AGENTS.md)

This file contains:
- File paths for all major components
- Common architectural patterns
- Quick component lookup table
- Development command reference

### Step 2: Search Documentation Index

**Navigate to**: [INDEX.md](INDEX.md)

Use browser search (Ctrl+F) to find relevant documentation:
- Search for feature names (e.g., "modal", "search", "theming")
- Search for component names (e.g., "Button", "Input")
- Search for file paths (e.g., "MessageDB", "primitives")

### Step 3: Review Related Documentation

Before implementing, read relevant docs:
- **For UI work**: Check `docs/features/primitives/` folder
- **For features**: Check `docs/features/` folder
- **For bugs**: Check `bugs/` folder for similar issues
- **For architecture**: Check `docs/` root-level guides

---

## Common Workflows

### Adding a New Feature

**Steps**:
1. ✅ Check if similar feature exists in `docs/features/` or `tasks/.done/`
2. ✅ Review primitives documentation if UI involved
3. ✅ Read cross-platform architecture guide
4. ✅ Implement following mobile-first patterns
5. ✅ Test on both web and mobile (if applicable)
6. ✅ Document if pattern is reusable

**Key Resources**:
- [Cross-Platform Components Guide](docs/cross-platform-components-guide.md)
- [Primitives INDEX](docs/features/primitives/INDEX.md)
- [API Reference](docs/features/primitives/API-REFERENCE.md)

---

### Fixing a Bug

**Steps**:
1. ✅ Search `bugs/` for existing reports
2. ✅ Check `bugs/.solved/` for similar past issues
3. ✅ Document solution approach if non-trivial
4. ✅ Move bug report to `.solved/` if documented

**Key Resources**:
- [Bug Reports](bugs/) - Active issues
- [Solved Issues](bugs/.solved/) - Historical solutions

---

### Refactoring Components

**Steps**:
1. ✅ Read primitives guides thoroughly
2. ✅ Check migration patterns in `tasks/mobile-dev/`
3. ✅ Test on both platforms after changes
4. ✅ Update related documentation

**Key Resources**:
- [Primitives Migration Guide](docs/features/primitives/04-web-to-native-migration.md)
- [Component Architecture](docs/cross-platform-components-guide.md)
- [Styling Guide](docs/features/primitives/05-primitive-styling-guide.md)

---

### Working with Modals

**Steps**:
1. ✅ Read [Modal System Documentation](docs/features/modals.md)
2. ✅ Determine which modal system to use (ModalProvider vs Layout-Level)
3. ✅ Use `ModalContainer` or `Modal` primitives
4. ✅ Follow routing patterns in `Router/ModalRouter.tsx`

**Key Resources**:
- [Modal System Documentation](docs/features/modals.md)
- [API Reference - Modal](docs/features/primitives/API-REFERENCE.md#modal)
- [API Reference - ModalContainer](docs/features/primitives/API-REFERENCE.md#modalcontainer)

---

### Styling Components

**Core Rules:**
- **Use Tailwind in JSX** for simple styles (< 7 classes)
- **Use raw CSS in .scss** for complex/shared styles
- **NEVER use `@apply`** (anti-pattern - loses benefits of both)
- **Always use `rem`** instead of `px` (follow Tailwind spacing scale)
- **Always use CSS variables** for colors (never hardcode hex values)

**Theme System:**
- Light/dark themes controlled via `dark` class on `<html>`
- Accent colors: `accent-50` → `accent-900` (dynamic theming support)
- Surface colors: `surface-00` → `surface-10`
- Text colors: `text-strong`, `text-main`, `text-subtle`, `text-muted`

**Utility Colors (RGB-based):**
- `danger`, `warning`, `success`, `info`
- Usage: `rgb(var(--danger))` or `rgb(var(--danger) / 0.5)` for opacity
- Tailwind classes: `text-danger`, `bg-danger`, `border-danger`

**Steps**:
1. ✅ Use semantic CSS variables from `src/index.css`
2. ✅ Apply via Tailwind utilities or component props
3. ✅ Use theme colors via `useTheme()` hook
4. ✅ Test on both light and dark themes
5. ✅ Verify mobile compatibility

**Key Resources**:
- [Primitive Styling Guide](docs/features/primitives/05-primitive-styling-guide.md)
- [Theming System](docs/features/cross-platform-theming.md)
- [Styling Guidelines](docs/styling-guidelines.md) ⭐ **Complete guide**

---

### Adding Primitives

> **Primitives now live in quorum-shared**, not in this repo. `src/components/primitives/` is a SCSS-only shim that re-exports from `@quilibrium/quorum-shared`.

**Steps** (for new primitives):
1. ✅ Add the primitive to `quorum-shared/src/primitives/` (`.web.tsx` + `.native.tsx` + `types.ts`)
2. ✅ Export from `quorum-shared/src/index.ts`
3. ✅ Add SCSS file to `src/components/primitives/ComponentName/` in this repo (web styles only)
4. ✅ Re-export from `src/components/primitives/index.ts`
5. ✅ Update [API Reference](docs/features/primitives/API-REFERENCE.md)

**Key Resources**:
- [Primitives Introduction](docs/features/primitives/01-introduction-and-concepts.md)
- [When to Use Primitives](docs/features/primitives/03-when-to-use-primitives.md)
- [API Reference Template](docs/features/primitives/API-REFERENCE.md)
- [quorum-shared migration overview](tasks/quorum-shared-migration/README.md)

---

## Key Resources by Task Type

### UI Components

| Task | Primary Documentation |
|------|----------------------|
| Build new component | [Cross-Platform Components Guide](docs/cross-platform-components-guide.md) |
| Use existing primitive | [API Reference](docs/features/primitives/API-REFERENCE.md) |
| Choose primitive vs HTML | [When to Use Primitives](docs/features/primitives/03-when-to-use-primitives.md) |
| Migrate web component | [Migration Guide](docs/features/primitives/04-web-to-native-migration.md) |
| Style component | [Styling Guide](docs/features/primitives/05-primitive-styling-guide.md) |

### Primitives Reference

**Quick lookup** - for complete details see [API Reference](docs/features/primitives/API-REFERENCE.md):

| Component | Use For |
|-----------|---------|
| `Button`, `Input`, `Select`, `Switch` | **Always use** - Interactive elements |
| `Modal`, `ModalContainer` | **Always use** - Modal boundaries |
| `Text`, `Title`, `Paragraph`, `Label` | **Platform-specific** - See [text guidance](docs/features/primitives/03-when-to-use-primitives.md#text-component-decision-framework) |
| `FlexRow`, `FlexColumn`, `Container` | **Case-by-case** - Simple layouts |

### Modal Systems

| Task | Primary Documentation |
|------|----------------------|
| Implement modal | [Modal System Documentation](docs/features/modals.md) |
| Choose modal system | [Modal System - Architecture](docs/features/modals.md#modal-system-architecture) |
| Modal props lookup | [API Reference - Modal](docs/features/primitives/API-REFERENCE.md#modal) |

### Theming & Colors

| Task | Primary Documentation |
|------|----------------------|
| Theme integration | [Cross-Platform Theming](docs/features/cross-platform-theming.md) |
| Color system usage | [Styling Guide](docs/features/primitives/05-primitive-styling-guide.md) |
| Accent colors | [Theming System](docs/features/cross-platform-theming.md) |

### Search & Performance

| Task | Primary Documentation |
|------|----------------------|
| Search implementation | [Search Feature Guide](docs/features/search-feature.md) |
| Performance optimization | [Search Performance Task](tasks/search-performance-optimization.md) |
| MessageDB queries | [Data Management Architecture](docs/data-management-architecture-guide.md) |

### Mobile Development

| Task | Primary Documentation |
|------|----------------------|
| Component architecture | [Component Architecture Workflow](tasks/mobile-dev/docs/component-architecture-workflow-explained.md) |
| Testing primitives | [Primitives Testing Guide](tasks/mobile-dev/docs/primitives-testing.md) |
| Repository structure | [Web/Native Repo Structure](tasks/mobile-dev/docs/web-and-native-repo-structure.md) |
| Platform detection | [Quick Reference - Platform Detection](../AGENTS.md#mobile-first-development) |

---

## PR & Commit Workflow

### Bundle doc commits into the next feature/fix PR

**Don't open a doc-only PR for every small doc update.** Squash-merging is expensive (push → `gh pr create` → squash → pull → `git checkout main`) and most doc edits are small enough that a separate PR is overkill. Instead, commit doc changes locally on the current working branch and let the **next feature/fix PR from this workspace** carry them as part of its diff.

Why this matters:

- **Doc commits get free PR-number context.** Shipped-log / history entries written during a session can reference a just-merged PR number directly, no follow-up patch needed. (Example: when port-from-mobile's #6 Public Profile shipped as PR #181, the shipped-log line referencing "PR #181" was easy to get right because the doc edit happened *after* the merge but *before* the next session's commits closed.)
- **Cheaper.** No push/create/merge cycle per typo, naming convention tweak, or workflow clarification.
- **Self-consistent across worktrees.** Each worktree accumulates its own doc edits on its own branch. Both eventually reach main via their own next-feature PRs. Conflicts only arise if both edit the same doc — handled the normal git-conflict way at rebase.

**Procedure during a session:**

1. Make the doc edit. Commit it on the current branch (session branch, `feat/...`, `fix/...`, whatever). No push, no PR.
2. Continue with the actual code work in the same session — the doc commit will ship alongside the code commits in one squashed PR.
3. If the session ends without any code PR (pure doc / inventory / scoping session), squash-merge the branch into main as a doc-only PR. Standard ship.

**When to break the rule** (rare):

- The doc IS the work this session (capability investigation, scope reframing, retiring a candidate, architecture decision write-up, etc.) → ship as a doc-only PR.
- Something in the docs would urgently mislead the *next* session if left until then → patch direct to main.
- Pure typo / link rot with zero informational bundling value → patch direct to main.

For everything else (the common case): commit locally, let the next code PR sweep it up.

### Where this rule lives in the per-effort workflows

The `.agents/tasks/<effort>/` folders may have their own workflow docs that elaborate on this for their specific context (e.g. [`tasks/port-from-mobile/workflow.md`](tasks/port-from-mobile/workflow.md) describes how the rule interacts with session-branch naming across multiple worktrees). The general principle above always applies; effort-specific workflows only extend it.

---

## Documentation Guidelines

### When to Create New Documentation

Create documentation when:
- ✅ Feature has >3 components or >100 lines of logic
- ✅ Pattern will be reused across multiple features
- ✅ Bug required >2 hours to solve and solution is non-obvious
- ✅ Architecture decision affects multiple areas of codebase

### Documentation Structure

**For Features** (`docs/features/`):
```markdown
# Feature Name

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview
Brief description of the feature

## Architecture
Technical implementation details

## Usage Examples
Code examples showing how to use

## Related Documentation
Links to related docs

---

_Created: YYYY-MM-DD_
```

**For Bugs** (`bugs/`):
```markdown
# Bug Description

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms
What goes wrong

## Root Cause
Why it happens

## Solution
How it was fixed

## Prevention
How to avoid in future

---

_Created: YYYY-MM-DD_
```

**For Reports** (`reports/`):
```markdown
# Report Title

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary
Brief overview of key findings and recommendations

## Scope & Methodology
- **Scope**: What was analyzed/investigated
- **Methodology**: How the analysis was conducted
- **Tools/Approaches**: Specific methods or tools used

## Findings
### [Finding Category 1]
- **Issue**: Description of what was found
- **Impact**: Severity/importance level
- **Evidence**: Supporting details, file locations

## Recommendations
### High Priority
1. **[Action Item 1]**
   - **Why**: Justification
   - **How**: Implementation approach
   - **Files**: `src/path/to/file.ts:123`

## Action Items
- [ ] **[Specific task]** - Priority: [level]

## Related Documentation
Links to related tasks, bugs, documentation

---

_Created: YYYY-MM-DD_
_Report Type: [Audit/Research/Analysis/Assessment]_
```

### AI-Generated Documentation

**IMPORTANT**: All documentation created by AI agents MUST include a warning disclaimer immediately below the title:

```markdown
# Document Title

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview
...
```

**Why**: AI-generated documentation may contain inaccuracies or outdated information. The warning helps developers know to verify critical details before relying on the documentation.

**Applies to**:
- ✅ All docs in `.agents/` created by AI
- ✅ Feature documentation in `docs/features/` created by AI
- ✅ Bug reports in `bugs/` created by AI
- ✅ Reports in `reports/` created by AI
- ✅ Architecture guides created by AI
- ❌ Human-written or human-verified documentation (remove the warning after verification)

### Naming Conventions

**Files**:
- Use kebab-case: `feature-name.md`
- **Reports**: Use date format: `report-name_YYYY-MM-DD.md` (e.g., `security-audit_2025-11-19.md`)
- Be descriptive: ❌ `fix.md` ✅ `modal-zindex-stacking-fix.md`

**Folders**:
- Active work: Root folder (`bugs/`, `tasks/`, `reports/`)
- Completed work: `.done/` or `.solved/` subfolders
- Archived/deprecated: `.archived/` subfolder

---

## Tips for Effective AI Development

### 1. Read Before Writing

**Why**: Understanding existing patterns saves time and prevents conflicts

**How**:
- Use AGENTS.md for fast pattern lookup
- Read related docs before implementing
- Check `.done/` and `.solved/` for completed examples

### 2. Use Primitives Strategically

**Why**: Ensures consistency where it matters, flexibility where it helps

**⚡ Quick Rules:**
- **Interactive elements**: Always use primitives (Button, Input, Select, Modal, Switch)
- **Text elements**: Platform-specific approach (helpers for shared, Text+as for web-only)
- **Layout containers**: Case-by-case evaluation

**📖 Complete Guidance**: See [When to Use Primitives](docs/features/primitives/03-when-to-use-primitives.md)
- Decision framework (5 questions)
- Platform-specific text guidance (helpers vs Text+as)
- Typography vs legacy props coexistence
- Detailed examples and anti-patterns

**How**:
- Always check [API Reference](docs/features/primitives/API-REFERENCE.md) first for interactive elements
- Apply the [decision framework](docs/features/primitives/03-when-to-use-primitives.md#decision-framework) when unsure

### 3. Think Mobile-First

**Why**: Mobile constraints ensure robust design

**How**:
- Ask: "Will this work on mobile?" before every change
- Test touch interactions, not just mouse/hover
- Use responsive primitives (`ResponsiveContainer`, `isMobile()`)

### 4. Document Edge Cases

**Why**: Non-obvious solutions get lost without documentation

**How**:
- Add to `bugs/` if solution took >2 hours
- Add to `docs/features/` if pattern is reusable
- Link related docs at bottom of files

### 5. Cross-Reference Documentation

**Why**: Reduces cognitive load, improves discoverability

**How**:
- Add "Related Documentation" section to all docs
- Link to API Reference when mentioning components
- Link to architecture guides when explaining patterns

---

## Common Pitfalls

### ❌ Avoid These Mistakes

#### 1. Wrong Primitive Usage Decisions

**Problem**: Inconsistent primitive usage leads to maintenance issues and platform incompatibility.

**Solution**: Follow the systematic approach in [When to Use Primitives](docs/features/primitives/03-when-to-use-primitives.md):
- Always use primitives for interactive elements (Button, Input, etc.)
- Apply the 5-question decision framework for other components
- Use platform-specific text approach (helpers vs Text+as)

**Examples**: See [practical examples](docs/features/primitives/03-when-to-use-primitives.md#practical-examples) for good vs over-engineered approaches.

---

#### 2. Breaking React Hooks Rules

**Bad**:
```tsx
if (someCondition) return <Loading />;
useEffect(() => { ... }, []); // Hook called conditionally!
```

**Good**:
```tsx
useEffect(() => { ... }, []);
if (someCondition) return <Loading />;
```

**Why**: Violates React's Rules of Hooks

**Reference**: [React Hooks Violation Bug](bugs/.solved/SOLVED_react-hooks-violation-conditional-return.md)

---

#### 3. Using npm Instead of yarn

**Bad**:
```bash
npm install package-name
```

**Good**:
```bash
yarn add package-name
```

**Why**: Creates package-lock.json conflicts with yarn.lock

**Reference**: [CLAUDE.md - Package Management](../../CLAUDE.md#package-management)

---

#### 4. Not Testing on Mobile

**Bad**:
- Implement feature
- Test on desktop only
- Commit

**Good**:
- Implement feature
- Test on desktop
- Test on mobile (or verify mobile compatibility)
- Commit

**Why**: Mobile-first ensures cross-platform compatibility

---

#### 5. Ignoring Documentation

**Bad**:
- Implement without reading docs
- Reinvent existing patterns
- Create incompatible solutions

**Good**:
- Read AGENTS.md first
- Search INDEX.md for related docs
- Follow existing patterns

**Why**: Consistency reduces bugs and maintenance burden

---


## Workflow Checklist

### Before Starting Task

- [ ] Read AGENTS.md for relevant patterns
- [ ] Search INDEX.md for related documentation
- [ ] Review active bugs in `bugs/` folder
- [ ] Check primitives documentation if UI work involved

### During Development

- [ ] Use primitives strategically (always for interactions, case-by-case for layout)
- [ ] Reference [primitives decision framework](docs/features/primitives/03-when-to-use-primitives.md#decision-framework) when unsure
- [ ] Think mobile-first (test on mobile)
- [ ] Follow React Hooks rules (no conditional returns before hooks)
- [ ] Use semantic CSS variables and theme colors
- [ ] Run linter and formatter on changed files

### Before Committing

- [ ] Test on both web and mobile (if applicable)
- [ ] Run type checking, linting, formatting
- [ ] Verify no package-lock.json created
- [ ] Write descriptive commit message (never mention "Claude" or "Anthropic")

### After Completing Task

- [ ] Update documentation if pattern is reusable
- [ ] Move task to `.done/` folder if documented
- [ ] Document bugs/edge cases in `bugs/` if non-trivial
- [ ] Add cross-reference links to related docs

---

## Quick Reference Summary

**Most Important Files**:
1. [AGENTS.md](AGENTS.md) - Start here for every task
2. [INDEX.md](INDEX.md) - Find documentation
3. [API Reference](docs/features/primitives/API-REFERENCE.md) - Component props lookup
4. [Cross-Platform Guide](docs/cross-platform-components-guide.md) - Architecture patterns

**Most Common Workflows**:
1. Adding UI Component → [Primitives INDEX](docs/features/primitives/INDEX.md)
2. Implementing Modal → [Modal System](docs/features/modals.md)
3. Fixing Styling → [Styling Guide](docs/features/primitives/05-primitive-styling-guide.md)
4. Working with Theme → [Theming System](docs/features/cross-platform-theming.md)

**Most Common Pitfalls**:
1. ❌ Raw HTML instead of primitives
2. ❌ Breaking React Hooks rules
3. ❌ Using npm instead of yarn
4. ❌ Not testing on mobile

---

## Related Documentation

- [AGENTS.md](AGENTS.md) - Fast lookup for common tasks
- [INDEX.md](INDEX.md) - Complete documentation index
- [CLAUDE.md](../../CLAUDE.md) - Project setup and guidelines
- [Cross-Platform Components Guide](docs/cross-platform-components-guide.md) - Architecture patterns
- [Primitives INDEX](docs/features/primitives/INDEX.md) - Primitives documentation hub

---

_Created: 2025-10-08 | Last updated: 2026-04-09_
