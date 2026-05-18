---
type: task
title: Primitives Migration to quorum-shared
status: planned
priority: high
created: 2026-01-14T00:00:00.000Z
updated: 2026-01-14T00:00:00.000Z
---

# Primitives Migration to quorum-shared

> **Purpose:** Step-by-step plan to migrate UI primitives from both quorum-desktop and quorum-mobile into the shared `@quilibrium/quorum-shared` package.

---

## Quick Links

- **Architecture Reference:** [quorum-shared-architecture.md](../docs/quorum-shared-architecture.md)
- **Gap Analysis:** [primitives-gap-analysis-quorum-shared_2026-01-14.md](../reports/primitives-gap-analysis-quorum-shared_2026-01-14.md)
- **Existing Masterplan:** [components-shared-arch-masterplan.md](./mobile-dev/components-shared-arch-masterplan.md)

---

## Decisions to Make

Before starting migration, these decisions need to be finalized:

### Decision 1: Primitives Export Path

**Question:** How should primitives be imported from quorum-shared?

| Option | Import Syntax | Pros | Cons |
|--------|---------------|------|------|
| **A** | `@quilibrium/quorum-shared/primitives` | Clear separation, tree-shakeable | Longer import path |
| **B** | `@quilibrium/quorum-shared` (same as types) | Single import source | Larger bundle if not tree-shaken |
| **C** | `@quilibrium/quorum-primitives` (separate package) | Clean separation | Another package to maintain |

**Recommendation:** Option A - clear separation while keeping one package.

---

### Decision 2: Theme System Strategy

**Question:** How should theming work across platforms?

| Option | Description | Effort | Risk |
|--------|-------------|--------|------|
| **A** | Keep separate (CSS vars + JS context) | Low | Manual sync of colors |
| **B** | JS source → generate CSS | Medium | Build complexity |
| **C** | Design tokens (Style Dictionary) | High | New tooling |

**Recommendation:** Start with Option A, plan for Option C later.

---

### Decision 3: Playground Location

**Question:** Where should primitive playgrounds/demos live?

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A** | In quorum-shared | Single source of truth | Complex RN setup |
| **B** | In each app repo | Natural platform fit | Duplication |
| **C** | Separate docs repo | Clean separation | Another repo |

**Recommendation:** Option B - keep web playground in quorum-desktop, create native playground in quorum-mobile. Both import from quorum-shared.

---

### Decision 4: API Unification Strategy

**Question:** How to handle platform-specific props?

```typescript
// Proposed approach: unified types with platform markers
interface ButtonProps {
  // Shared (work on both)
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

**Recommendation:** Accept this pattern. Document clearly which props are platform-specific.

---

## Migration Phases

### Phase 0: Setup quorum-shared for Primitives

**Goal:** Prepare the package structure and build configuration.

- [ ] Create `src/primitives/` folder structure in quorum-shared
- [ ] Configure package.json exports for platform resolution:
  ```json
  {
    "exports": {
      "./primitives": {
        "react-native": "./dist/primitives/index.native.js",
        "default": "./dist/primitives/index.js"
      }
    }
  }
  ```
- [ ] Add React Native peer dependency
- [ ] Set up TypeScript paths for primitives
- [ ] Create barrel export (`primitives/index.ts`)
- [ ] Test import from both quorum-desktop and quorum-mobile

**Deliverable:** Empty primitives module that can be imported on both platforms.

---

### Phase 1: Core Primitives (Foundation)

**Goal:** Migrate the most critical primitives that establish patterns.

#### 1.1 Button (First - establishes pattern)

| Task | Status |
|------|--------|
| Create unified `Button.types.ts` | ⬜ |
| Copy desktop `Button.web.tsx` | ⬜ |
| Copy/adapt mobile `Button.native.tsx` | ⬜ |
| Add `loading` prop to web version | ⬜ |
| Add `ghost` variant to web version | ⬜ |
| Unify `onClick`/`onPress` handling | ⬜ |
| Write tests | ⬜ |
| Update quorum-desktop imports | ⬜ |
| Update quorum-mobile imports | ⬜ |

#### 1.2 Text

| Task | Status |
|------|--------|
| Create unified `Text.types.ts` | ⬜ |
| Copy desktop `Text.web.tsx` | ⬜ |
| Create mobile `Text.native.tsx` | ⬜ |
| Write tests | ⬜ |

#### 1.3 Input

| Task | Status |
|------|--------|
| Create unified `Input.types.ts` | ⬜ |
| Copy desktop `Input.web.tsx` | ⬜ |
| Create mobile `Input.native.tsx` (NEW) | ⬜ |
| Write tests | ⬜ |

#### 1.4 TextArea

| Task | Status |
|------|--------|
| Create unified `TextArea.types.ts` | ⬜ |
| Copy desktop `TextArea.web.tsx` | ⬜ |
| Create mobile `TextArea.native.tsx` (NEW) | ⬜ |
| Write tests | ⬜ |

#### 1.5 Modal

| Task | Status |
|------|--------|
| Create unified `Modal.types.ts` | ⬜ |
| Copy desktop `Modal.web.tsx` | ⬜ |
| Copy mobile `BaseModal` → `Modal.native.tsx` | ⬜ |
| Unify `isOpen`/`visible` prop naming | ⬜ |
| Write tests | ⬜ |

**Phase 1 Deliverable:** 5 core primitives working on both platforms.

---

### Phase 2: Layout Primitives

**Goal:** Migrate layout utilities (mostly need native implementations).

| Primitive | Web | Native | Notes |
|-----------|-----|--------|-------|
| FlexRow | Copy | Create | Mobile lacks this |
| FlexColumn | Copy | Create | Mobile lacks this |
| FlexCenter | Copy | Create | Mobile lacks this |
| FlexBetween | Copy | Create | Mobile lacks this |
| Container | Copy | Copy | Both exist |
| Spacer | Copy | Copy | Both exist |
| ScrollContainer | Copy | Copy | Both exist |

**Phase 2 Deliverable:** 7 layout primitives working on both platforms.

---

### Phase 3: Form Primitives

**Goal:** Migrate form controls.

| Primitive | Web | Native | Notes |
|-----------|-----|--------|-------|
| Select | Copy | Create/Adapt | Mobile uses picker |
| Switch | Copy | Copy | Both exist |
| RadioGroup | Copy | Create | Mobile lacks this |
| ColorSwatch | Copy | Copy | Both exist |
| FileUpload | Copy | Copy | Both exist |

**Phase 3 Deliverable:** 5 form primitives working on both platforms.

---

### Phase 4: UI Components

**Goal:** Migrate higher-level UI components.

| Component | Web | Native | Notes |
|-----------|-----|--------|-------|
| Card | Create | Copy | Desktop lacks this |
| Avatar | Create | Copy | Desktop lacks this |
| Tooltip | Copy | Copy | Complex on mobile |
| Callout | Copy | Create | Mobile lacks this |
| ModalContainer | Copy | Copy | Both exist |
| OverlayBackdrop | Copy | Copy | Both exist |

**Phase 4 Deliverable:** 6 UI components working on both platforms.

---

### Phase 5: State Components

**Goal:** Migrate feedback/state components.

| Component | Web | Native | Notes |
|-----------|-----|--------|-------|
| EmptyState | Create | Copy | Desktop lacks this |
| ErrorState | Create | Copy | Desktop lacks this |
| LoadingState | Create | Copy | Desktop lacks this |
| OfflineBanner | Copy | Copy | Both exist |

**Phase 5 Deliverable:** 4 state components working on both platforms.

---

### Phase 6: Cleanup & Documentation

**Goal:** Remove duplicated code, update docs.

- [ ] Remove `src/components/primitives/` from quorum-desktop
- [ ] Remove `components/ui/` primitives from quorum-mobile
- [ ] Update all imports in quorum-desktop
- [ ] Update all imports in quorum-mobile
- [ ] Update quorum-shared README with primitives docs
- [ ] Update architecture doc with primitives section
- [ ] Create migration guide for contributors

---

## File Structure in quorum-shared

```
quorum-shared/src/
├── primitives/
│   ├── Button/
│   │   ├── Button.web.tsx
│   │   ├── Button.native.tsx
│   │   ├── Button.types.ts
│   │   ├── Button.scss          # Web styles
│   │   └── index.ts
│   ├── Input/
│   ├── TextArea/
│   ├── Modal/
│   ├── Text/
│   ├── FlexRow/
│   ├── FlexColumn/
│   ├── FlexCenter/
│   ├── FlexBetween/
│   ├── Container/
│   ├── Spacer/
│   ├── ScrollContainer/
│   ├── Select/
│   ├── Switch/
│   ├── RadioGroup/
│   ├── Card/
│   ├── Avatar/
│   ├── Tooltip/
│   ├── Callout/
│   ├── EmptyState/
│   ├── ErrorState/
│   ├── LoadingState/
│   ├── OfflineBanner/
│   ├── theme/
│   │   ├── colors.ts            # Shared color definitions
│   │   ├── ThemeProvider.tsx    # Cross-platform provider
│   │   └── useTheme.ts          # Theme hook
│   └── index.ts                 # Barrel export
├── types/
├── hooks/
├── ... (existing modules)
└── index.ts
```

---

## Checklist for Each Primitive

When migrating a primitive, follow this checklist:

```markdown
### [PrimitiveName]

- [ ] Create `types.ts` with unified interface
- [ ] Copy/create `.web.tsx` implementation
- [ ] Copy/create `.native.tsx` implementation
- [ ] Copy `.scss` file (web only)
- [ ] Create `index.ts` barrel export
- [ ] Add to `primitives/index.ts`
- [ ] Write unit tests
- [ ] Test in quorum-desktop
- [ ] Test in quorum-mobile
- [ ] Update imports in consuming components
```

---

## Testing Strategy

### Per-Primitive Tests

```typescript
// Button.test.tsx
describe('Button', () => {
  it('renders children', () => {});
  it('applies variant styles', () => {});
  it('handles disabled state', () => {});
  it('shows loading spinner', () => {});
  it('calls onClick/onPress', () => {});
});
```

### Integration Tests

- [ ] Import works in quorum-desktop
- [ ] Import works in quorum-mobile
- [ ] Tree-shaking works (unused primitives not bundled)
- [ ] TypeScript types resolve correctly
- [ ] Styles apply correctly on each platform

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing code | Migrate one primitive at a time, test thoroughly |
| Build issues | Set up CI to build both apps after each merge |
| Style differences | Visual regression tests with screenshots |
| API incompatibilities | Define unified types FIRST, then implement |
| Performance regression | Benchmark before/after |

---

## Success Criteria

- [ ] All 23+ primitives migrated to quorum-shared
- [ ] Both apps import from `@quilibrium/quorum-shared/primitives`
- [ ] No duplicate primitive code in app repos
- [ ] All existing features continue working
- [ ] Bundle size doesn't increase significantly
- [ ] Documentation complete

---

## Progress Tracking

| Phase | Status | Primitives | Completion |
|-------|--------|------------|------------|
| Phase 0 | ⬜ Not started | Setup | 0% |
| Phase 1 | ⬜ Not started | Button, Text, Input, TextArea, Modal | 0% |
| Phase 2 | ⬜ Not started | Flex*, Container, Spacer, Scroll | 0% |
| Phase 3 | ⬜ Not started | Select, Switch, Radio, ColorSwatch, FileUpload | 0% |
| Phase 4 | ⬜ Not started | Card, Avatar, Tooltip, Callout, Modal*, Overlay* | 0% |
| Phase 5 | ⬜ Not started | Empty, Error, Loading, Offline | 0% |
| Phase 6 | ⬜ Not started | Cleanup & docs | 0% |

---

*Last updated: 2026-01-14*
