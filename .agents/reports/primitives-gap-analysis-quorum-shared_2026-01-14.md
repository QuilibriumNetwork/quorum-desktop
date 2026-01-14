---
type: report
title: Primitives Gap Analysis - quorum-shared Migration
status: complete
created: 2026-01-14T00:00:00.000Z
updated: 2026-01-14T00:00:00.000Z
---

# Primitives Gap Analysis: quorum-shared Migration

> **AI-Generated**: May contain errors. Verify before use.

This report analyzes the UI primitive components in both `quorum-desktop` and `quorum-mobile` repositories to identify gaps, overlaps, and requirements for unifying them in `@quilibrium/quorum-shared`.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [How quorum-shared Works](#how-quorum-shared-works)
3. [Current Primitive Coverage](#current-primitive-coverage)
4. [Detailed Component Comparison](#detailed-component-comparison)
5. [Theme System Comparison](#theme-system-comparison)
6. [Gap Analysis](#gap-analysis)
7. [Migration Strategy](#migration-strategy)
8. [Technical Considerations](#technical-considerations)
9. [Recommendations](#recommendations)

---

## Executive Summary

### Current State

| Aspect | quorum-desktop | quorum-mobile |
|--------|----------------|---------------|
| **Primitives Location** | `src/components/primitives/` | `components/ui/` |
| **Total Primitives** | 23 components | 10 components |
| **Third-party UI lib** | None (custom) | None (custom) |
| **Styling** | SCSS + Tailwind + CSS Variables | React Native StyleSheet |
| **Theme System** | CSS Variables on DOM | Context API + JS objects |

### Key Findings

1. **Both repos use custom-built primitives** - no third-party UI libraries
2. **Desktop has more primitives** - mobile lacks layout primitives (Flex*, Container, etc.)
3. **APIs are similar but not identical** - need unification
4. **Theme colors are synchronized** - same palette, different consumption patterns
5. **Mobile has features desktop lacks** - gesture handling, gradient cards

---

## How quorum-shared Works

### Current Package Contents

```
@quilibrium/quorum-shared
├── types/        ← TypeScript interfaces (Space, Message, User, etc.)
├── hooks/        ← React Query hooks (useSpaces, useMessages, etc.)
├── sync/         ← Hash-based delta sync protocol
├── storage/      ← StorageAdapter interface
├── utils/        ← Logger, formatting, validation
├── crypto/       ← E2E encryption (WASM)
├── signing/      ← Ed448 signatures (WASM)
└── transport/    ← HTTP/WebSocket clients
```

### How Apps Consume It

```bash
# Install the package
yarn add @quilibrium/quorum-shared

# Import what you need
import { useSpaces, logger, type Message } from '@quilibrium/quorum-shared';
```

### What's NOT in quorum-shared Yet

**UI Primitives are NOT shared** - they exist separately in each repo:
- Desktop: `quorum-desktop/src/components/primitives/`
- Mobile: `quorum-mobile/components/ui/`

### Proposed Addition: Primitives Package

```
@quilibrium/quorum-shared
├── ... (existing modules)
└── primitives/               ← NEW
    ├── Button/
    │   ├── Button.web.tsx    ← Web/Electron implementation
    │   ├── Button.native.tsx ← React Native implementation
    │   ├── Button.types.ts   ← Shared interface
    │   └── index.ts          ← Platform resolution
    ├── Input/
    ├── Modal/
    └── ... (all primitives)
```

### Platform Resolution

React Native's Metro bundler and web bundlers (Vite/Webpack) automatically pick the correct file:

```typescript
// This import works on BOTH platforms
import { Button } from '@quilibrium/quorum-shared/primitives';

// Web bundler resolves to: Button.web.tsx
// Metro bundler resolves to: Button.native.tsx
```

---

## Current Primitive Coverage

### Desktop Primitives (`src/components/primitives/`)

| Primitive | Web | Native | Description |
|-----------|-----|--------|-------------|
| **Button** | ✅ | ✅ | Variants: primary, secondary, subtle, danger, unstyled |
| **Input** | ✅ | ✅ | Floating labels, error states, variants |
| **TextArea** | ✅ | ✅ | Multi-line input with auto-resize |
| **Select** | ✅ | ✅ | Dropdown selection |
| **Switch** | ✅ | ✅ | Toggle switch |
| **RadioGroup** | ✅ | ✅ | Radio button group |
| **Modal** | ✅ | ✅ | Overlay modal (drawer on mobile) |
| **ModalContainer** | ✅ | ✅ | Modal content wrapper |
| **OverlayBackdrop** | ✅ | ✅ | Modal/drawer backdrop |
| **Portal** | ✅ | - | React portal for overlays |
| **Text** | ✅ | ✅ | Typography with variants |
| **Container** | ✅ | ✅ | Generic container |
| **FlexRow** | ✅ | ✅ | Horizontal flex layout |
| **FlexColumn** | ✅ | ✅ | Vertical flex layout |
| **FlexCenter** | ✅ | ✅ | Centered flex layout |
| **FlexBetween** | ✅ | ✅ | Space-between flex layout |
| **Spacer** | ✅ | ✅ | Spacing utility |
| **ScrollContainer** | ✅ | ✅ | Scrollable container |
| **ResponsiveContainer** | ✅ | ✅ | Responsive width container |
| **Tooltip** | ✅ | ✅ | Hover/tap tooltips |
| **Callout** | ✅ | ✅ | Alert/info callout box |
| **ColorSwatch** | ✅ | ✅ | Color picker swatch |
| **FileUpload** | ✅ | ✅ | File upload trigger |
| **Icon** | ✅ | - | SVG icon system |

### Mobile Primitives (`components/ui/`)

| Component | Description | Desktop Equivalent |
|-----------|-------------|-------------------|
| **Button** | Variants: primary, secondary, danger, ghost | Button ✅ |
| **Card** | With gradient variant | ❌ Missing |
| **Avatar** | With fallback and badge | ❌ Missing |
| **DefaultAvatar** | Deterministic color from address | ❌ Missing |
| **TabBar** | Underline, pill, segmented variants | ❌ Missing |
| **EmptyState** | Empty data placeholder | ❌ Missing |
| **ErrorState** | Error with retry | ❌ Missing |
| **LoadingState** | Loading spinner | ❌ Missing |
| **OfflineBanner** | Network status | ✅ (in ui/) |
| **IconSymbol** | SF Symbols + Material Icons | Icon (different) |
| **BaseModal** | Bottom sheet with gestures | Modal ✅ |

---

## Detailed Component Comparison

### Button

| Feature | Desktop | Mobile | Action |
|---------|---------|--------|--------|
| **Variants** | primary, secondary, subtle, danger, unstyled | primary, secondary, danger, ghost | Unify: add `ghost`, keep `subtle` |
| **Sizes** | sm, md, lg | sm, md, lg | ✅ Same |
| **Loading state** | ❌ | ✅ | Add to desktop |
| **Icon support** | Via children | `icon` prop + position | Unify: adopt mobile's approach |
| **Full width** | Via className | `fullWidth` prop | Unify: add prop |
| **Disabled** | ✅ | ✅ | ✅ Same |

**Desktop Button API:**
```typescript
interface ButtonProps {
  children: React.ReactNode;
  type?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'unstyled';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}
```

**Mobile Button API:**
```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconSymbolName;
  iconPosition?: 'left' | 'right';
  onPress: () => void;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
```

**Unified API Proposal:**
```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost' | 'unstyled';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onPress?: () => void;      // Mobile
  onClick?: () => void;      // Web (aliased internally)
  className?: string;        // Web only
  style?: StyleProp<ViewStyle>; // Native only
  testID?: string;
}
```

### Modal

| Feature | Desktop | Mobile | Action |
|---------|---------|--------|--------|
| **Presentation** | Centered overlay | Bottom sheet | ✅ By design |
| **Close on backdrop** | ✅ | ✅ | ✅ Same |
| **Swipe to dismiss** | ❌ | ✅ | Native-only feature |
| **Keyboard avoiding** | N/A | ✅ | Native-only feature |
| **Height control** | Auto | `height` prop (0-1) | Add to unified API |
| **Animation** | CSS transitions | Spring animation | Platform-specific |

**Desktop Modal API:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}
```

**Mobile BaseModal API:**
```typescript
interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;              // Screen ratio 0-1
  backdropDarkness?: number;    // 0-1
  showHandle?: boolean;
  avoidKeyboard?: boolean;
  fillHeight?: boolean;
  testID?: string;
}
```

### Input / TextInput

| Feature | Desktop | Mobile | Action |
|---------|---------|--------|--------|
| **Floating label** | ✅ | ❌ | Keep as web feature |
| **Error state** | ✅ | ❌ | Add to mobile |
| **Helper text** | ✅ | ❌ | Add to mobile |
| **Variants** | filled, bordered, minimal | N/A (inline styling) | Standardize |
| **Auto-resize** | ✅ (TextArea) | ✅ (maxHeight) | ✅ Same concept |

**Note:** Mobile doesn't have an Input primitive - uses raw `TextInput` with inline styling.

---

## Theme System Comparison

### Color Palette (Synchronized)

Both repos use the **same color values** but different access patterns:

| Token | Desktop (CSS Var) | Mobile (JS Object) |
|-------|-------------------|-------------------|
| Accent | `var(--accent)` | `theme.colors.accent` |
| Surface 0 | `var(--color-surface-0)` | `theme.colors.surface0` |
| Text Strong | `var(--color-text-strong)` | `theme.colors.textStrong` |
| Danger | `var(--color-danger)` | `theme.colors.danger` |

### Accent Colors (Both Support)

- blue (default)
- purple
- fuchsia
- orange
- green
- yellow

### Theme Switching

| Feature | Desktop | Mobile |
|---------|---------|--------|
| **Light/Dark** | HTML class toggle | Context state |
| **Accent color** | CSS class toggle | Context state |
| **Persistence** | localStorage | AsyncStorage |
| **System preference** | CSS media query | Appearance API |

### Theme Consumption

**Desktop (CSS Variables):**
```tsx
// Tailwind classes reference CSS variables
<button className="bg-accent text-white hover:bg-accent-400">
  Click me
</button>
```

**Mobile (Context + StyleSheet):**
```tsx
const { theme } = useTheme();

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.accent,
    color: theme.colors.white,
  },
});
```

---

## Gap Analysis

### Missing in Desktop (from Mobile)

| Component | Priority | Complexity | Notes |
|-----------|----------|------------|-------|
| **Card** | High | Low | Container with gradient variant |
| **Avatar** | High | Medium | With fallback text, badge |
| **DefaultAvatar** | Medium | Low | Deterministic color from address |
| **TabBar** | Medium | Medium | Multiple variants |
| **EmptyState** | Low | Low | Placeholder component |
| **ErrorState** | Low | Low | Error with retry button |
| **LoadingState** | Low | Low | Spinner component |
| **Button loading** | High | Low | Add loading prop to Button |

### Missing in Mobile (from Desktop)

| Primitive | Priority | Complexity | Notes |
|-----------|----------|------------|-------|
| **Input** | High | Medium | Wrapper with error states |
| **TextArea** | High | Medium | Multi-line with features |
| **Select** | High | High | Dropdown/picker |
| **FlexRow** | Medium | Low | Layout primitive |
| **FlexColumn** | Medium | Low | Layout primitive |
| **FlexCenter** | Medium | Low | Layout primitive |
| **FlexBetween** | Medium | Low | Layout primitive |
| **Container** | Low | Low | Generic wrapper |
| **Spacer** | Low | Low | Spacing utility |
| **Text** | Medium | Low | Typography primitive |
| **RadioGroup** | Medium | Medium | Radio options |
| **Callout** | Low | Low | Alert box |
| **Tooltip** | Low | High | Complex on mobile |

### API Differences to Resolve

| Component | Difference | Resolution |
|-----------|------------|------------|
| Button | `onClick` vs `onPress` | Support both, alias internally |
| Button | `type` vs `variant` | Use `variant` |
| Modal | `isOpen` vs `visible` | Use `visible` |
| All | `className` (web only) | Keep as web-only prop |
| All | `style` (native only) | Keep as native-only prop |
| All | `testID` | Add to all components |

---

## Migration Strategy

### Phase 1: Prepare quorum-shared (Week 1)

1. **Create primitives folder structure:**
   ```
   quorum-shared/src/primitives/
   ├── Button/
   ├── Input/
   ├── TextArea/
   ├── Modal/
   └── index.ts
   ```

2. **Set up build configuration:**
   - Configure Metro resolution for `.native.tsx`
   - Configure Vite/Webpack for `.web.tsx`
   - Add TypeScript paths

3. **Export primitives from package:**
   ```typescript
   // quorum-shared/src/index.ts
   export * from './primitives';
   ```

### Phase 2: Migrate Core Primitives (Week 2-3)

**Priority order:**
1. **Button** - Most used, establishes pattern
2. **Input** - Critical for forms
3. **TextArea** - Message composition
4. **Modal** - Used everywhere
5. **Text** - Typography foundation

**For each primitive:**
1. Define unified `types.ts`
2. Copy desktop `.web.tsx` implementation
3. Copy/create mobile `.native.tsx` implementation
4. Ensure API compatibility
5. Add tests

### Phase 3: Migrate Layout Primitives (Week 3-4)

- FlexRow, FlexColumn, FlexCenter, FlexBetween
- Container, Spacer, ScrollContainer
- ResponsiveContainer

### Phase 4: Migrate UI Components (Week 4-5)

- Card (create for desktop)
- Avatar (create for desktop)
- Select
- Switch
- RadioGroup
- Tooltip, Callout

### Phase 5: Migrate State Components (Week 5-6)

- EmptyState
- ErrorState
- LoadingState
- OfflineBanner

### Phase 6: Update Consuming Repos (Week 6-7)

1. **Update quorum-desktop:**
   ```typescript
   // Before
   import { Button } from '../primitives/Button';

   // After
   import { Button } from '@quilibrium/quorum-shared/primitives';
   ```

2. **Update quorum-mobile:**
   ```typescript
   // Before
   import { Button } from '../components/ui/Button';

   // After
   import { Button } from '@quilibrium/quorum-shared/primitives';
   ```

3. **Remove duplicated code** from both repos

---

## Technical Considerations

### Build System Requirements

**quorum-shared package.json:**
```json
{
  "name": "@quilibrium/quorum-shared",
  "exports": {
    ".": "./dist/index.js",
    "./primitives": {
      "react-native": "./dist/primitives/index.native.js",
      "default": "./dist/primitives/index.js"
    }
  }
}
```

### Platform-Specific Props

Some props only make sense on one platform:

```typescript
interface ButtonProps {
  // Shared props
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;

  // Web-only (ignored on native)
  className?: string;
  onClick?: () => void;

  // Native-only (ignored on web)
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}
```

### Theme Unification Options

**Option A: Keep separate systems**
- Web: CSS variables (current)
- Native: JS context (current)
- Pros: No changes to existing code
- Cons: Manual synchronization of color values

**Option B: Single JS source of truth**
- Generate CSS variables from JS at build time
- Pros: Single source, no sync issues
- Cons: Requires build pipeline changes

**Option C: Design tokens pipeline**
- Use Style Dictionary or similar
- Define tokens in JSON/YAML
- Generate both CSS and JS outputs
- Pros: Industry standard, extensible
- Cons: Additional tooling

**Recommendation:** Start with **Option A**, evolve to **Option C** later.

### Testing Strategy

1. **Unit tests** for each primitive
2. **Visual regression tests** (Storybook + Chromatic)
3. **Cross-platform tests** (Detox for native, Playwright for web)
4. **API compatibility tests** (ensure same props work on both)

---

## Recommendations

### Immediate Actions

1. **Unify Button first** - establishes the pattern for all other primitives
2. **Create Card primitive for desktop** - mobile already has it, desktop needs it
3. **Create Avatar primitive for desktop** - frequently needed component
4. **Add loading state to desktop Button** - mobile has it, desktop should too

### Short-term (1-2 months)

1. Complete core primitive migration (Button, Input, TextArea, Modal, Text)
2. Document the unified API in quorum-shared README
3. Set up Storybook for primitives in quorum-shared

### Medium-term (2-4 months)

1. Migrate all remaining primitives
2. Implement design tokens pipeline (Option C)
3. Add comprehensive test coverage
4. Remove duplicated code from consuming repos

### Long-term (4-6 months)

1. Create CLI tool for generating new primitives
2. Implement theme customization system
3. Add accessibility audit tooling
4. Consider extracting as standalone open-source package

---

## Related Documentation

- [Component Architecture Masterplan](./../tasks/mobile-dev/components-shared-arch-masterplan.md)
- [Primitive Migration Audit](./../tasks/mobile-dev/primitive-migration-audit.md)
- [quorum-shared Architecture](./../docs/quorum-shared-architecture.md)
- [Cross-Platform Theming](../docs/features/cross-platform-theming.md)

---

*Report generated: 2026-01-14*
