# Quick Reference for Agents

Fast lookup guide for file paths and essential patterns. **For detailed workflows, see [agents-workflow.md](agents-workflow.md)**.

---

## 🌐 Quorum Ecosystem

This repo is part of a **multi-repo ecosystem**. Data syncs across all clients.

| Repository | Purpose | URL |
|------------|---------|-----|
| **quorum-desktop** | Web + Electron (this repo) | `github.com/QuilibriumNetwork/quorum-desktop` |
| **quorum-mobile** | React Native + Expo | `github.com/QuilibriumNetwork/quorum-mobile` |
| **quorum-shared** | Shared types, hooks, sync | `github.com/QuilibriumNetwork/quorum-shared` |

**Before implementing features**: Check if mobile has it → use same shared types for sync compatibility.

→ **Full Guide**: [Quorum Ecosystem Architecture](docs/quorum-shared-architecture.md)

---

## 📁 Key File Locations

| Category | Location | Key Files |
|----------|----------|-----------|
| **Primitives** | `src/components/primitives/` | Button, Input, Modal, Text, etc. |
| **Components** | `src/components/` | Business logic components |
| **Hooks** | `src/hooks/` | Custom React hooks |
| **Types** | `src/types/` | TypeScript definitions |
| **Services** | `src/services/` | API calls, utilities |
| **Styling** | `src/styles/` | SCSS variables, themes |
| **Router** | `src/components/Router/` | ModalRouter.tsx |

## 📱 Platform Detection
```tsx
import { isWeb, isMobile, isElectron } from 'src/utils/platform';
```

## 🎨 Essential Styling
- **Guidelines**: `docs/styling-guidelines.md` ⭐ **READ FIRST**
- **Tailwind**: Simple styles (< 7 classes)
- **SCSS**: Complex/shared styles
- **Variables**: Always use CSS variables, never hex
- **Theme**: `dark` class on `<html>` switches themes

## ⚡ Essential Patterns

### Primitive Usage (Platform-Aware)
```tsx
// ALWAYS use primitives for interactions
<Button onClick={save}>Save</Button>
<Input value={name} onChange={setName} />

// TEXT: Platform-specific choice
// Shared (.tsx): Use helpers - <Title>, <Paragraph>
// Web-only (.web.tsx): Use Text + as - <Text as="h1">
// Both typography & legacy props valid long-term
```

### Theme Integration
```tsx
import { useTheme } from '../components/primitives/theme';
const theme = useTheme();
```

### i18n
```tsx
import { Trans } from '@lingui/react/macro';
<Trans>User text</Trans>
```

## 🔧 Development Commands

```bash
yarn dev              # Start dev server (ask user)
yarn build            # Build project (you can run)
yarn validate         # Type check + lint (run after changes)
yarn lint             # Lint only
yarn format           # Format (run on modified files)
```


## 📦 Package Management
**Use `yarn` only** - never `npm` (creates conflicts)

## 📦 @quilibrium/quorum-shared

Shared package providing types, hooks, and utilities for Quorum apps (web + mobile).

| Module | Purpose | Common Import |
|--------|---------|---------------|
| **Types** | Space, Message, Channel, User, etc. | `import type { Space, Message } from '@quilibrium/quorum-shared'` |
| **Storage** | StorageAdapter interface | `import type { StorageAdapter } from '@quilibrium/quorum-shared'` |
| **Sync** | Hash-based delta sync protocol | `import { SyncService, createMemberDigest } from '@quilibrium/quorum-shared'` |
| **Hooks** | React Query hooks | `import { useSpaces, useMessages } from '@quilibrium/quorum-shared'` |
| **Utils** | Logger, encoding, formatting | `import { logger } from '@quilibrium/quorum-shared'` |
| **Crypto** | E2E encryption, Ed448 signing | `import { WasmCryptoProvider } from '@quilibrium/quorum-shared'` |

→ **Full Guide**: [quorum-shared-architecture.md](docs/quorum-shared-architecture.md)

## 🎯 Quick Component Lookup

All primitives live in `@quilibrium/quorum-shared`, re-exported from `src/components/primitives/`.

| Component | Use For |
|-----------|---------|
| `Button` | Interactive buttons |
| `Input` | Text inputs |
| `Modal` | Modal dialogs |
| `Text` / `Title` / `Paragraph` | Text content (native-first) |
| `FlexRow` / `FlexColumn` / `Flex` | Simple layouts |

→ **Full API**: `docs/features/primitives/API-REFERENCE.md`

## 🔒 Security-sensitive issues: `issues/.secret/`

**This repository is PUBLIC.** `issues/.secret/` is gitignored and must stay that
way. It holds issue files whose contents would help someone attack users of the
shipped app.

**The test, applied when you create the file, not later:**

> Does this document describe an attack that works against code users are running
> today, or materially help someone build one?

If yes, create it in `.secret/` from the start - mechanism, `file:line` pointers,
vulnerable code excerpt, reproduction steps. Severity is not the test and neither
is `status:`; a `done` write-up still belongs in `.secret/` if the fix has not
actually reached users, because release lag is exactly the window an attacker wants.

If no, file it normally. Reliability bugs, data-loss bugs, crashes and correctness
defects are ordinary engineering work even when serious. A bug is not
security-sensitive just because it sounds alarming.

**Why a folder rather than a judgement call each time.** Anything committed here is
permanent: deleting a file later does not remove it from git history, and by then
it has been cloned and indexed. When unsure, put it in `.secret/` - a file held
back costs nothing and can be released in one move, a file published cannot be
recalled.

**Rules:**

- Never add a `.secret/` file to `INDEX.md` - the index is tracked, so a row there
  republishes the title and the path.
- Never paste `.secret/` detail into a tracked file, a commit message, a PR
  description or a public GitHub issue.
- A tracked file may reference the work in neutral language ("space-auth hardening,
  detail held privately") but must not restate the mechanism.
  [`2026-06-25-MASTER-RECAP-control-message-auth.md`](issues/.open/2026-06-25-MASTER-RECAP-control-message-auth.md)
  is the worked example of that neutral public hub.
- The authoritative cross-repo tracker is the private repo
  `QuilibriumNetwork/quorum-app-prod` (issue #1 for the control-message-auth
  cluster). Link there, not to `.secret/` paths.
- **Releasing a file** once its fix has shipped to users: move it out of
  `.secret/` into `.done/`, add its `INDEX.md` row, and say in the commit that the
  fix is live. A deliberate act, never a side effect of tidying.

## 📚 Key Documentation

- **Workflow Guide**: [agents-workflow.md](agents-workflow.md)
- **Full Index**: [INDEX.md](INDEX.md)
- **Primitives**: `docs/features/primitives/INDEX.md`
- **Styling**: `docs/styling-guidelines.md`

---

_Quick reference only - see [agents-workflow.md](agents-workflow.md) for detailed processes_
