# Agents Workflow Guide

Best practices for AI-assisted development on the Quorum Desktop project.

---

## Table of Contents

1. [Before Starting Any Task](#before-starting-any-task)
2. [Common Workflows](#common-workflows)
3. [Key Resources by Task Type](#key-resources-by-task-type)
4. [Documentation Guidelines](#documentation-guidelines)
5. [Tips for Effective AI Development](#tips-for-effective-ai-development)
6. [Common Pitfalls](#common-pitfalls)

---

## Before Starting Any Task

### Step 1: Check Quick Reference

**Always start here**: [QUICK-REFERENCE.md](QUICK-REFERENCE.md)

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

**Steps**:
1. ✅ Use semantic CSS variables from `src/index.css`
2. ✅ Apply via Tailwind utilities or component props
3. ✅ Use theme colors via `useTheme()` hook
4. ✅ Test on both light and dark themes
5. ✅ Verify mobile compatibility

**Key Resources**:
- [Primitive Styling Guide](docs/features/primitives/05-primitive-styling-guide.md)
- [Theming System](docs/features/cross-platform-theming.md)
- [Quick Reference - Styling](../QUICK-REFERENCE.md#styling)

---

### Adding Primitives

**Steps**:
1. ✅ Create folder in `src/components/primitives/ComponentName/`
2. ✅ Add `.web.tsx` and `.native.tsx` versions
3. ✅ Create shared `types.ts` interface
4. ✅ Export from `src/components/primitives/index.ts`
5. ✅ Update [API Reference](docs/features/primitives/API-REFERENCE.md)
6. ✅ Add examples to [Quick Reference](docs/features/primitives/02-primitives-quick-reference.md)

**Key Resources**:
- [Primitives Introduction](docs/features/primitives/01-introduction-and-concepts.md)
- [When to Use Primitives](docs/features/primitives/03-when-to-use-primitives.md)
- [API Reference Template](docs/features/primitives/API-REFERENCE.md)

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
| Platform detection | [Quick Reference - Platform Detection](../QUICK-REFERENCE.md#mobile-first-development) |

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

### Naming Conventions

**Files**:
- Use kebab-case: `feature-name.md`
- Be descriptive: ❌ `fix.md` ✅ `modal-zindex-stacking-fix.md`

**Folders**:
- Active work: Root folder (`bugs/`, `tasks/`)
- Completed work: `.done/` or `.solved/` subfolders
- Archived/deprecated: `.archived/` subfolder

---

## Tips for Effective AI Development

### 1. Read Before Writing

**Why**: Understanding existing patterns saves time and prevents conflicts

**How**:
- Use QUICK-REFERENCE.md for fast pattern lookup
- Read related docs before implementing
- Check `.done/` and `.solved/` for completed examples

### 2. Use Primitives Everywhere

**Why**: Ensures cross-platform compatibility

**How**:
- Always check [API Reference](docs/features/primitives/API-REFERENCE.md) first
- Never use raw HTML (`<div>`, `<button>`, `<input>`)
- Use `FlexRow`/`FlexColumn` instead of manual flexbox

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

#### 1. Using Raw HTML Instead of Primitives

**Bad**:
```tsx
<div className="flex">
  <p>Text</p>
  <button onClick={handleClick}>Action</button>
</div>
```

**Good**:
```tsx
<FlexRow gap="md">
  <Text>Text</Text>
  <Button onClick={handleClick}>Action</Button>
</FlexRow>
```

**Why**: Raw HTML breaks on React Native

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
- Read QUICK-REFERENCE.md first
- Search INDEX.md for related docs
- Follow existing patterns

**Why**: Consistency reduces bugs and maintenance burden

---

#### 6. Forgetting WSL/Windows Commands

**Bad** (in WSL with Windows Node.js):
```bash
npx tsc --noEmit
yarn lint
```

**Good**:
```bash
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit"
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && yarn lint"
```

**Why**: Node.js is installed on Windows, not WSL

**Reference**: [QUICK-REFERENCE.md - Development Commands](../QUICK-REFERENCE.md#development-commands-wslwindows)

---

## Workflow Checklist

### Before Starting Task

- [ ] Read QUICK-REFERENCE.md for relevant patterns
- [ ] Search INDEX.md for related documentation
- [ ] Review active bugs in `bugs/` folder
- [ ] Check primitives documentation if UI work involved

### During Development

- [ ] Use primitives instead of raw HTML/RN elements
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
1. [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - Start here for every task
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

- [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - Fast lookup for common tasks
- [INDEX.md](INDEX.md) - Complete documentation index
- [CLAUDE.md](../../CLAUDE.md) - Project setup and guidelines
- [Cross-Platform Components Guide](docs/cross-platform-components-guide.md) - Architecture patterns
- [Primitives INDEX](docs/features/primitives/INDEX.md) - Primitives documentation hub

---

_Created: 2025-10-08_
