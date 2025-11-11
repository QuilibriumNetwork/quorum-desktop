# Quick Reference for Agents

Fast lookup guide for common tasks, file locations, and architectural patterns in the Quorum Desktop codebase.

---

## 📁 Key File Locations

### Primitives & UI Components
- **All primitives**: `src/components/primitives/`
- **Business components**: `src/components/`
- **Router**: `src/components/Router/` (includes `ModalRouter.tsx`)

### Hooks & Logic
- **All hooks**: `src/hooks/`
- **API layer**: `src/api/`
- **Services**: `src/services/`
- **Utilities**: `src/utils/`

### Styling
- **Styling Guidelines**: `docs/styling-guidelines.md` ⭐ **READ THIS FIRST**
- **Theme config**: `src/styles/_colors.scss` (CSS variables)
- **Tailwind config**: `tailwind.config.js`
- **Color system**: RGB-based utilities (`--danger`, `--success`, `--warning`, `--info`)

#### Quick Styling Reference

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

**Semantic Classes:**
- `bg-app`: Main background
- `bg-sidebar`: Sidebar background
- `bg-card`: Card background
- Form fields: Use `--color-field-*` variables (see styling guide)

**Detailed Guides:**
- [**Styling Guidelines**](docs/styling-guidelines.md) ⭐ Complete Tailwind vs CSS guide
- [Primitive Styling Guide](docs/features/primitives/05-primitive-styling-guide.md)
- [Cross-Platform Theming](docs/features/cross-platform-theming.md)

### State Management
- **MessageDB**: `src/components/MessageDB.tsx` (IndexedDB on web)
- **Context providers**: `src/components/`

### Type Definitions
- **All types**: `src/types/`

### Playgrounds (Testing)
- **Web primitives**: `src/dev/primitives-playground`
- **Mobile primitives**: `mobile/test/primitives/`
- **Mobile business components**: `mobile/test/business/`

### Platform-Specific
- **Web entry**: `web/main.tsx`
- **Electron**: `web/electron/`
- **Mobile entry**: `mobile/App.tsx` (placeholder)

---

## 🎨 Core Architectural Patterns

### Cross-Platform Component Pattern

**Use primitives strategically** - not everything needs to be a primitive:

```tsx
// ✅ ALWAYS use primitives for:
// - Interactive elements (Button, Input, Select, Modal, Switch)
// - Layout containers when they simplify code (FlexRow, FlexColumn)
<FlexRow gap="md">
  <Input value={name} onChange={setName} />
  <Button onClick={handleSave}>Save</Button>
</FlexRow>

// ✅ EVALUATE case-by-case:
// - Container vs div (complex layouts can use div + Tailwind)
// - Text vs raw text (use Text for semantic colors)
<div className="complex-table-layout">
  <Text variant="strong">Table Header</Text>
  {/* Complex table structure with divs is fine */}
</div>

// ❌ DON'T over-engineer with primitives:
// - Highly specialized components (charts, editors)
// - Complex SCSS animations
// - Third-party library wrappers
```

**Decision Framework**: [When to Use Primitives](docs/features/primitives/03-when-to-use-primitives.md)

### Container + Layout Pattern

```tsx
// ✅ Separate styling (Container) from layout (Flex)
<Container backgroundColor={theme.colors.bg.card} padding="md">
  <FlexColumn gap="md">
    <Text>Content</Text>
  </FlexColumn>
</Container>
```

### Modal System

All modals route through **`Router/ModalRouter.tsx`**:

```tsx
// Modal implementation location
src/components/Router/ModalRouter.tsx

// Documentation
docs/features/modals.md
```

### Theme Integration

```tsx
import { useTheme } from '../components/primitives/theme';

const theme = useTheme();
theme.colors.bg.app;        // Main background
theme.colors.text.strong;   // Primary text
theme.colors.accent[500];   // Accent color
theme.colors.utilities.danger; // Error color
```

### Internationalization (i18n)

Always use Lingui for user-facing text:

```tsx
import { Trans } from '@lingui/react/macro';

// Simple text
<Trans>User-facing text</Trans>

// With variables
<Trans>Hello {userName}</Trans>
```

**Commands:**
- Extract messages: `yarn lingui:extract`
- Compile translations: `yarn lingui:compile`

---

## 🔧 Common Tasks

### Adding a New Modal
→ **See**: `docs/features/modals.md`
1. Create modal component in appropriate folder
2. Add route to `Router/ModalRouter.tsx`
3. Use `<ModalContainer>` primitive

### Adding a New Primitive Component
→ **See**: `docs/features/primitives/INDEX.md`
1. Create in `src/components/primitives/ComponentName/`
2. Add `.web.tsx` and `.native.tsx` versions
3. Export from `src/components/primitives/index.ts`
4. Update API reference documentation

### Fixing Styling Issues
→ **See**: `docs/features/primitives/05-primitive-styling-guide.md`
1. Use semantic CSS variables from `src/index.css`
2. Apply via Tailwind utilities or component props
3. Test on both light and dark themes
4. Verify mobile compatibility

### Working with Messages
→ **See**: `docs/features/messages/` folder
- **Compression**: `client-side-image-compression.md`
- **Markdown**: `markdown-renderer.md`
- **Signing**: `message-signing-system.md`
- **Mobile actions**: `message-actions-mobile.md`
- **Pinned messages**: `pinned-messages.md`

### Search Implementation
→ **See**: `docs/features/search-feature.md`

### Permissions & Roles
→ **See**: `docs/space-permissions/space-permissions-architecture.md`

---

## 📱 Mobile-First Development

**CRITICAL**: Every UI change must work on both desktop and mobile.

### Platform Detection

```tsx
import { isWeb, isMobile, isElectron } from 'src/utils/platform';

if (isWeb()) {
  // Web-specific code
}

if (isMobile()) {
  // React Native specific code
}
```

### Key Resources
- **Architecture guide**: `docs/cross-platform-components-guide.md`
- **Repository structure**: `docs/cross-platform-repository-implementation.md`
- **Migration guide**: `docs/features/primitives/04-web-to-native-migration.md`
- **Component workflow**: `tasks/mobile-dev/docs/component-architecture-workflow-explained.md`

---

## 🐛 Debugging & Known Issues

### Check Active Bugs
→ **Location**: `.agents/bugs/`
- Review active issues before starting work
- Check `.solved/` for similar past problems

### Common Pitfalls

1. **React Hooks violations** - Never put conditional returns before hooks:
   ```tsx
   // ❌ BAD - Conditional return before hooks
   if (someCondition) return <SomeComponent />;
   useEffect(() => {...}, []);  // This hook is called conditionally!

   // ✅ GOOD - All hooks before conditionals
   useEffect(() => {...}, []);
   if (someCondition) return <SomeComponent />;
   ```
   **Rule**: Call all hooks at the top level, in the same order every render.

2. **npm vs yarn**: Always use `yarn`, never `npm` (creates package-lock.json conflicts)

3. **File paths in WSL**: Use `cmd.exe /c` wrapper for Node.js commands

4. **Primitives vs raw HTML**: Always prefer primitives for cross-platform compatibility

5. **Portal usage**: Use `<Portal>` for overlays that need to escape parent containers (toasts, right-aligned dropdowns). DON'T use for modals - they use rendering location, not portals.

6. **Internationalization**: Always wrap user-facing text in `<Trans>` from `@lingui/macro`

---

## 📦 Package Management

**CRITICAL**: This project uses **Yarn exclusively**

```bash
# ✅ DO
yarn install
yarn add package-name
yarn dev

# ❌ DON'T (creates package-lock.json conflicts)
npm install
npm i package-name
npm run dev
```

---

## 🔨 Development Commands

### Standard Commands (Quick Reference)

```bash
yarn dev              # Start Vite dev server (ask user to run)
yarn build            # Build project (you can run to check)
yarn lint             # Lint code (run on modified files only)
yarn format           # Format code (run on modified files only)
yarn electron:dev     # Run Electron app
yarn lingui:extract   # Extract i18n messages
yarn lingui:compile   # Compile i18n translations
```

### WSL/Windows Environment

When working in WSL with Windows Node.js installation:

```bash
# Type checking
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"

# Linting
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && yarn lint"

# Formatting
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && yarn format"

# Building
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && yarn build"
```

---

## 🎯 Quick Component Lookup

### Most-Used Primitives

| Component | Use For | Location |
|-----------|---------|----------|
| `FlexRow` | Horizontal layouts | `src/components/primitives/FlexRow/` |
| `FlexColumn` | Vertical layouts | `src/components/primitives/FlexColumn/` |
| `Text` | All text content | `src/components/primitives/Text/` |
| `Button` | Interactive buttons | `src/components/primitives/Button/` |
| `Input` | Text inputs | `src/components/primitives/Input/` |
| `Modal` / `ModalContainer` | Modal dialogs | `src/components/primitives/Modal/` |
| `Portal` | Escape stacking context (toasts, right-aligned dropdowns) | `src/components/primitives/Portal/` |
| `Callout` | Status messages | `src/components/primitives/Callout/` |
| `Icon` | Icons | `src/components/primitives/Icon/` |
| `Container` | Styled wrappers | `src/components/primitives/Container/` |
| `Spacer` | Fixed spacing | `src/components/primitives/Spacer/` |

→ **Full API Reference**: `docs/features/primitives/API-REFERENCE.md`

---

## 📚 Documentation Index

**Main documentation hub**: `.agents/INDEX.md`

### Quick Links by Category

**Architecture & Setup:**
- Cross-platform architecture: `docs/cross-platform-components-guide.md`
- Repository structure: `docs/cross-platform-repository-implementation.md`
- Data management: `docs/data-management-architecture-guide.md`

**Primitives (UI Components):**
- Primitives overview: `docs/features/primitives/INDEX.md`
- API reference: `docs/features/primitives/API-REFERENCE.md`
- Quick reference: `docs/features/primitives/02-primitives-AGENTS.md`
- When to use: `docs/features/primitives/03-when-to-use-primitives.md`
- Migration guide: `docs/features/primitives/04-web-to-native-migration.md`
- Styling guide: `docs/features/primitives/05-primitive-styling-guide.md`

**Features:**
- Modals: `docs/features/modals.md`
- Search: `docs/features/search-feature.md`
- Theming: `docs/features/cross-platform-theming.md`
- Notifications: `docs/features/desktop-notifications.md`
- Responsive layout: `docs/features/responsive-layout.md`

**Mobile Development:**
- Component architecture: `tasks/mobile-dev/docs/component-architecture-workflow-explained.md`
- Testing guide: `tasks/mobile-dev/docs/primitives-testing.md`
- Repo structure: `tasks/mobile-dev/docs/web-and-native-repo-structure.md`

---

## 🚦 Workflow Guidelines

### Before Starting Any Task
1. ✅ Check `AGENTS.md` (this file) for patterns
2. ✅ Search `.agents/INDEX.md` for relevant docs
3. ✅ Review active bugs in `bugs/` folder
4. ✅ Check primitives documentation if UI work involved

### During Development
1. ✅ Use primitives instead of raw HTML/RN elements
2. ✅ Think mobile-first (test on mobile)
3. ✅ Follow React Hooks rules (no conditional returns before hooks)
4. ✅ Use semantic CSS variables and theme colors
5. ✅ Run linter and formatter on changed files

### Before Committing
1. ✅ Test on both web and mobile (if applicable)
2. ✅ Run type checking, linting, formatting
3. ✅ Verify no package-lock.json created
4. ✅ Write descriptive commit message (never mention "Claude" or "Anthropic")

### After Completing Task
1. ✅ Update documentation if pattern is reusable
2. ✅ Move task to `.done/` folder if documented
3. ✅ Document bugs/edge cases in `bugs/` if non-trivial

---

## 💡 Tips for Effective Development

1. **Read before writing**: Check existing patterns to save time
2. **Use primitives everywhere**: Ensures cross-platform compatibility
3. **Mobile-first thinking**: Every UI change must work on mobile
4. **Document edge cases**: If solution is non-obvious, document it
5. **Cross-reference docs**: Link related documentation for context

---

## 🔗 Related Documentation

- **Full documentation index**: `.agents/INDEX.md`
- **AI workflow guide**: `docs/agents-workflow.md`
- **Project setup**: `CLAUDE.md` (root of project)

---

_Last updated: 2025-10-08_
