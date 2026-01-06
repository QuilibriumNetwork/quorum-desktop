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

### WSL/Windows
```bash
# Get current Windows path and run commands
WINDOWS_PATH=$(pwd | sed 's|^/mnt/\([a-z]\)/|\U\1:/|' | sed 's|/|\\|g')
cmd.exe /c "cd /d $WINDOWS_PATH && yarn validate"
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

| Component | Use For |
|-----------|---------|
| `Button` | Interactive buttons |
| `Input` | Text inputs |
| `Modal` | Modal dialogs |
| `Text` / `Title` / `Paragraph` | Text content |
| `FlexRow` / `FlexColumn` | Simple layouts |
| `Container` | Styled wrappers |

→ **Full API**: `docs/features/primitives/API-REFERENCE.md`

## 📚 Key Documentation

- **Workflow Guide**: [agents-workflow.md](agents-workflow.md)
- **Full Index**: [INDEX.md](INDEX.md)
- **Primitives**: `docs/features/primitives/INDEX.md`
- **Styling**: `docs/styling-guidelines.md`

---

_Quick reference only - see [agents-workflow.md](agents-workflow.md) for detailed processes_
