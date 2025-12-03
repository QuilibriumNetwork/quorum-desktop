# Quick Reference for Agents

Fast lookup guide for file paths and essential patterns. **For detailed workflows, see [agents-workflow.md](agents-workflow.md)**.

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
