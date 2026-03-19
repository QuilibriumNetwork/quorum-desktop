---
type: task
title: "Mobile Primitives Audit: Correctness, Parity & Migration Readiness"
status: open
complexity: medium
created: 2026-03-15
depends_on:
  - "tasks/2026-03-15-stacked-prs-workflow.md"
---

# Mobile Primitives Audit

Comprehensive audit of all native primitive implementations covering:
1. **Correctness** — bugs, hardcoded values, unused props, broken features
2. **Web-Native Parity** — props/features on web but missing on native (intentional vs oversight)
3. **Migration Readiness** — issues to fix before moving primitives to `quorum-shared`

---

## Summary

| Primitive | Status | Critical | Significant | Minor |
|-----------|--------|----------|-------------|-------|
| Button | DONE | 0 | 0 | 0 |
| Input | DONE | 0 | 0 | 0 |
| TextArea | DONE | 0 | 0 | 0 |
| Select | DONE | 0 | 0 | 0 |
| Switch | DONE | 0 | 0 | 0 |
| RadioGroup | Deferred | 0 | 0 | 1 |
| FileUpload | OK | 0 | 0 | 0 |
| Flex | OK | 0 | 0 | 0 |
| Container | OK | 0 | 0 | 0 |
| Spacer | DONE | 0 | 0 | 0 |
| ScrollContainer | OK | 0 | 0 | 0 |
| Modal | DONE | 0 | 0 | 0 |
| Tooltip | DONE | 0 | 0 | 0 |
| Icon | OK | 0 | 0 | 0 |
| ColorSwatch | OK | 0 | 0 | 0 |
| Callout | DONE | 0 | 0 | 0 |
| Text | OK | 0 | 0 | 0 |
| ThemeProvider | OK | 0 | 0 | 0 |

**All issues resolved except RadioGroup `variant` (deferred — needs design review)**

### General Notes on Colors

The theme `colors.ts` file was set up to mirror all web CSS variables, but may be out of date. The color system will likely need a rework when primitives migrate to `quorum-shared`. The key principle for now: **use `useTheme()` and reference theme colors** instead of hardcoding hex values, so components at least respond to light/dark mode correctly.

### Dead Onboarding Code

The `disabled-onboarding` and `-white` button variants, plus the `onboarding` Input/TextArea variants, are only used in legacy onboarding/login/maintenance screens that **won't exist in the mobile app**. These should be removed from native implementations to reduce dead code and hardcoded colors.

---

## Playground Issues (Already Fixed)

These were found and fixed during the initial playground review:

- [x] `'callout'` missing from `PrimitiveScreen` type union in `AppTest.tsx`
- [x] `ThemeTestScreen` not wired up (barrel export, import, menu entry, route)
- [x] Redundant button section in Layout test screen (removed — Button has standalone screen)
- [x] Unused `useState` import in `PrimitivesTestScreen.tsx`
- [x] `'at'` icon missing from icon mapping — added `IconAt` for MentionPills menu card
- [x] MentionPills test screen buttons used `onPress` instead of `onClick` — pills wouldn't insert

---

## Button

**File**: `src/components/primitives/Button/Button.native.tsx`

### Significant — DECIDED

- [ ] **Remove dead onboarding/white variants** — Remove `disabled-onboarding`, `primary-white`, `secondary-white`, `light-white`, `light-outline-white` from native implementation. Only used in legacy screens that won't exist in the mobile app. Contains hardcoded colors (e.g. `'#0287f2'` at line 196).

### Parity Notes (Intentional Differences)

- Native has `hapticFeedback`, `fullWidthWithMargin`, `accessibilityLabel` — native-only, correct
- Web uses CSS classes for styling — expected platform difference
- `compact` size is correctly supported in both types and implementation
- `tooltip` prop: not applicable on mobile — tooltips don't work the same way. Leave as-is (prop is in base types).

---

## Input

**File**: `src/components/primitives/Input/Input.native.tsx`

### Significant — DECIDED

- [ ] **Remove dead onboarding variant** — The `onboarding` variant has hardcoded colors (`'#3aa9f8'`, `'#ffffff'`, `'#034081'`, `'#6fc3ff'` at lines 70, 79, 119, 190) and is only used in legacy onboarding screens that won't exist in the mobile app. Remove the variant from native.

### Parity Notes (Intentional Differences)

- Native has `keyboardType`, `returnKeyType`, `autoComplete`, `secureTextEntry`, `onSubmitEditing` — native-only, correct
- Web has `onKeyDown` — web-only keyboard event, correct
- Web has `clearable` — not needed on mobile (OS handles this natively)
- Floating label animation is simpler on native — acceptable

---

## TextArea

**File**: `src/components/primitives/TextArea/TextArea.native.tsx`

### Significant — DECIDED

- [ ] **Remove dead onboarding variant** — Same as Input: `onboarding` variant has hardcoded colors (`'#3aa9f8'`, `'#ffffff'`, `'#034081'`, `'#6fc3ff'` at lines 54, 62, 100, 135) only used in legacy screens. Remove from native.

### Parity Notes (Intentional Differences)

- Web has `onKeyDown`, `onSelect`, `onMouseUp`, `resize` — web-only, correct
- Native has `onKeyPress`, `returnKeyType` — native-only, correct
- Auto-resize uses different mechanisms (scrollHeight vs onContentSizeChange) — expected

---

## Select

**File**: `src/components/primitives/Select/Select.native.tsx`

### Significant — DECIDED

- [ ] **Remove `dropdownPlacement` from native types** — Native always uses a centered Modal for options, which is correct for mobile UX. The `dropdownPlacement` prop is web-only. Remove from native types to avoid confusion.

### Parity Notes (Intentional Differences)

- Native uses Modal overlay instead of positioned dropdown — correct for mobile UX
- Both support single/multi-select, grouped options, compact mode — good parity
- Multiselect display is simpler on native (text vs chips) — acceptable

---

## Switch

**File**: `src/components/primitives/Switch/Switch.native.tsx`

### Significant — DECIDED

- [ ] **Implement haptic feedback** — `hapticFeedback` prop is accepted but the implementation is commented out (lines 32-35). Implement with `expo-haptics` (light impact on toggle). **Default to on** — consumers can opt out by passing `hapticFeedback={false}`.

### Parity Notes (Intentional Differences)

- **Single fixed size on native** — Mobile switches are conventionally one size (iOS and Android both use fixed-size switches). No need to add `size` prop. Keep as-is.
- Native has animated thumb transition — enhancement over web, fine
- Different color sources (CSS vs theme object) — expected

---

## RadioGroup

**File**: `src/components/primitives/RadioGroup/RadioGroup.native.tsx`

### Significant — DECIDED

- [ ] **Remove `tooltip` from native types** — Tooltips on individual radio options don't make sense on mobile. Remove from native types.

### Minor — NEEDS DESIGN REVIEW

- [ ] **`variant` prop ('default' | 'bordered')** — Declared in native types but not implemented. Needs design review: check the web bordered variant and decide if it's useful on mobile. For now, leave in types but don't implement.

### Parity Notes (Intentional Differences)

- Native uses custom View-based radio circles vs web HTML radio inputs — expected
- Icon-only mode works on both — good parity
- Horizontal layout centering (line 132: `justifyContent: 'center'`) — leave as-is for now

---

## FileUpload

**File**: `src/components/primitives/FileUpload/FileUpload.native.tsx`

### Status: OK

No action needed now. Image compression can be added later when handling avatar uploads on mobile.

### Parity Notes (Intentional Differences)

- Web has drag-and-drop (react-dropzone), native has camera/gallery picker — correct
- Web has `onDragActiveChange`, `validator`; native has `showCameraOption`, `imageQuality`, `allowsEditing` — correct platform splits
- Permission handling on native — correct

---

## Flex

**File**: `src/components/primitives/Flex/Flex.native.tsx`

### Status: OK

No issues found. Web and native implementations are consistent in behavior.

### Parity Notes

- Gap values map correctly (semantic names to pixels)
- Default alignment behavior matches (row→center, column→stretch)
- Wrap support works on both

---

## Container

**File**: `src/components/primitives/Container/Container.native.tsx`

### Status: OK

`'auto'` and `'fit'` width both map to `undefined`, which is correct — React Native views naturally size to content, so there's no meaningful difference. Leave as-is.

### Parity Notes (Intentional Differences)

- Web has mouse events (`onMouseEnter`, `onMouseLeave`), native has `onPress` — correct
- Web has ARIA attributes, native has RN accessibility props — correct
- Native uses TouchableOpacity when `onPress` is provided — correct

---

## Spacer

**File**: `src/components/primitives/Spacer/Spacer.native.tsx`

### Significant — DECIDED

- [ ] **Use theme border color** — Line 19: `borderColor = '#e5e7eb'` is hardcoded. Spacer doesn't use `useTheme()`. Fix: add `useTheme()` and use `theme.colors.border.default` so borders adapt to dark mode.

### Parity Notes

- Web uses CSS variable `'var(--color-border-default)'` — adapts to theme
- Size values and compound spacer logic are consistent

---

## ScrollContainer

**File**: `src/components/primitives/ScrollContainer/ScrollContainer.native.tsx`

### Status: OK

No issues found. Platform-specific props are appropriate.

### Parity Notes (Intentional Differences)

- Web has ARIA attributes, native has scroll-specific props (`bounces`, `scrollEnabled`, etc.) — correct
- Height mapping values are identical
- Border radius mapping is consistent

---

## Modal

**File**: `src/components/primitives/Modal/Modal.native.tsx`

### Minor — DECIDED

- [ ] **Remove `keyboardAvoidingView` from types** — Declared but not implemented. Keyboard avoidance should be handled when we encounter the actual problem during real mobile development, not prematurely. Remove from types for now.

### Parity Notes (Intentional Differences)

- Native has swipe gestures (`swipeToClose`, `swipeUpToOpen`) — native-only, correct
- Handle indicator correctly only shows when swipe is enabled — correct
- Native uses PanResponder for gesture handling — correct
- Native has ScrollView for content, web doesn't — correct for mobile
- Size percentages (40%/70%/90%) vs CSS classes — expected

---

## Tooltip

**File**: `src/components/primitives/Tooltip/Tooltip.native.tsx`

### Significant — DECIDED

- [ ] **Clean up native types** — Remove unused props from native types: `id`, `noArrow`, `noBorder`, `touchTrigger`, `longPressDuration`, `showOnTouch`, `autoHideAfter`, `clickable`, `variant`. Keep only what's implemented: `content`, `children`, `place`, `showCloseButton`, `maxWidth`, `disabled`. Mobile tooltips are simpler by nature (tap to open, tap to close). Popover/positioning behavior may be revisited later.

### Parity Notes (Intentional Differences)

- Native uses centered Modal approach vs web ReactTooltip — acceptable for mobile
- Limited placement support vs web's 12 placements — acceptable, can revisit later

---

## Icon

**File**: `src/components/primitives/Icon/Icon.native.tsx`

### Status: OK

No issues found. Implementations are well-aligned.

### Parity Notes

- Both use dynamic imports from `@tabler/icons-react[-native]` — consistent
- Size values identical
- Variant support (outline/filled with fallback) identical
- Web uses `'currentColor'` default, native uses `colors.text.main` — correct for each platform

---

## ColorSwatch

**File**: `src/components/primitives/ColorSwatch/ColorSwatch.native.tsx`

### Status: OK

Active state indicator differs (web: check icon, native: border effect) but functionally fine. Leave as-is — both communicate the active state clearly.

### Parity Notes

- Both use same `getColorHex` function — consistent
- Hardcoded color values are intentional (accent color palette, not themed) — correct

---

## Callout

**File**: `src/components/primitives/Callout/Callout.native.tsx`

### Critical — DECIDED

- [ ] **Switch to theme colors** — Lines 21-42 define `variantColors` with hardcoded Tailwind-palette colors instead of using `theme.colors.utilities.*`:

  | Variant | Callout Hardcoded | Theme Light | Theme Dark |
  |---------|------------------|-------------|------------|
  | info | `#3B82F6` | `#3095bd` | `#267b9e` |
  | success | `#10B981` | `#46c236` | `#379e2b` |
  | warning | `#F59E0B` | `#e7b04a` | `#d09a3d` |
  | error | `#EF4444` | `#e74a4a` | `#c73737` |

  Background and border colors are also hardcoded for dark mode only — won't adapt to light mode.

  **Fix**: Follow the web Callout pattern. Use `useTheme()` and reference `theme.colors.utilities.*` for text colors, derive bg/border with opacity. The exact color values may need tuning later when the color system is reworked for `quorum-shared`, but at least they'll respond to light/dark mode.

### Parity Notes (Intentional Differences)

- Native has fade-out animation on dismiss, web is instant — enhancement, fine
- Both support base/minimal layouts, dismissible, autoClose

---

## Text

**File**: `src/components/primitives/Text/Text.native.tsx`

### Status: OK

Native Text is the primary usage — web has deprecated Text in favor of HTML + CSS classes. This is intentional and documented.

### Parity Notes

- Text is native-only in production — correct per architecture decision
- All semantic wrappers (Title, Paragraph, Label, Caption, InlineText) work correctly
- Link handling uses `Linking.openURL` — correct for native

---

## ThemeProvider

**File**: `src/components/primitives/theme/ThemeProvider.native.tsx`

### Status: OK

No issues found. Platform-specific storage and theme application are correct.

### Parity Notes

- Web uses localStorage, native uses AsyncStorage — correct
- Web modifies HTML classList, native returns colors via context — correct
- Both support system/light/dark themes and accent colors — good parity
- Native includes `getColor()` helper — native-only convenience, fine

---

## Action Items (Ordered by Priority)

### 1. Critical Fix
- [x] **Callout**: Switch hardcoded colors to `useTheme()` + `theme.colors.utilities.*`, following web Callout pattern

### 2. Dead Code Removal
- [x] **Button**: Remove `disabled-onboarding`, `primary-white`, `secondary-white`, `light-white`, `light-outline-white` variants from native
- [x] **Input**: Remove `onboarding` variant from native
- [x] **TextArea**: Remove `onboarding` variant from native
- [x] **Legacy test screens**: Remove `AuthenticationTestScreen`, `OnboardingTestScreen`, `LoginTestScreen`, `MaintenanceTestScreen` from mobile playground

### 3. Theme Compliance
- [x] **Spacer**: Add `useTheme()`, use `theme.colors.border.default` instead of hardcoded `'#e5e7eb'`

### 4. Type Cleanup
- [x] **Select**: Move `dropdownPlacement` to web-only types
- [x] **Tooltip**: Split into `BaseTooltipProps` (shared) and `TooltipWebProps` (web-only extras)
- [x] **Modal**: Remove `keyboardAvoidingView` from native types
- RadioGroup `tooltip`/`tooltipPlace` already marked as web-only in comments — no change needed

### 5. Feature Implementation
- [x] **Switch**: Implement haptic feedback with `expo-haptics` (on by default)

### 6. Deferred (Needs Design Review)
- [ ] **RadioGroup**: `variant` prop — check if bordered variant is useful on mobile

---

_Created: 2026-03-15_
_Updated: 2026-03-15 — All fixes implemented except deferred RadioGroup variant review_
