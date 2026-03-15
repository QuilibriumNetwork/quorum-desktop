# Mobile Primitives Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues identified in the mobile primitives audit (`.agents/tasks/2026-03-15-mobile-primitives-audit.md`)

**Architecture:** Each task is a self-contained fix to one primitive. No cross-dependencies between tasks — they can be executed in any order. After each fix, verify visually in the mobile playground.

**Tech Stack:** React Native, TypeScript, expo-haptics

---

## Task 1: Callout — Switch to Theme Colors (Critical)

**Files:**
- Modify: `src/components/primitives/Callout/Callout.native.tsx`

**Reference:** Follow the web pattern in `Callout.web.tsx` which uses semantic color names (`info`, `success`, `warning`, `error`/`danger`). The native version should use `useTheme()` and derive colors from `theme.colors.utilities.*`.

- [ ] **Step 1: Replace hardcoded colors with theme-derived colors**

Replace the hardcoded `variantColors` object (lines 20-42) with a function that uses `useTheme()`. The text color comes from `theme.colors.utilities.*`, and background/border are derived with opacity.

In `Callout.native.tsx`, add `useTheme` import and replace the color logic:

```tsx
// Add to imports:
import { useTheme } from '../theme';

// Remove the hardcoded variantColors object (lines 20-42)

// Replace getVariantStyles with this:
const getVariantStyles = (
  variant: string,
  layout: string,
  colors: ReturnType<typeof import('../theme/colors').getColors>
) => {
  // Map variant names to theme utility colors
  const variantColorMap: Record<string, string> = {
    info: colors.utilities.info,
    success: colors.utilities.success,
    warning: colors.utilities.warning,
    error: colors.utilities.danger,
  };

  const textColor = variantColorMap[variant] || colors.utilities.info;

  if (layout === 'base') {
    return {
      container: {
        borderColor: textColor + '4D', // 30% opacity
        backgroundColor: textColor + '1A', // 10% opacity
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
      },
      text: { color: textColor },
      icon: { color: textColor },
    };
  }

  return {
    container: {},
    text: { color: textColor },
    icon: { color: textColor },
  };
};
```

- [ ] **Step 2: Update the component to use useTheme**

In the `Callout` component function, add theme access and pass colors to `getVariantStyles`:

```tsx
const Callout: React.FC<CalloutNativeProps> = ({
  variant,
  children,
  size = 'sm',
  layout = 'base',
  dismissible = false,
  autoClose,
  onClose,
  testID,
}) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ... (useEffect and handleClose unchanged)

  const variantStyle = getVariantStyles(variant, layout, theme.colors);
  // ... rest unchanged
```

- [ ] **Step 3: Also fix the icon name for 'info' variant**

The web version uses `'info-circle'` but native uses `'info'` (which doesn't exist in our icon mapping). Fix `variantIcons`:

```tsx
const variantIcons: Record<string, IconName> = {
  info: 'info-circle',  // was 'info' — matches web
  success: 'check',
  warning: 'warning',
  error: 'warning',
};
```

- [ ] **Step 4: Verify in playground**

Open the mobile playground, navigate to Callout test screen. Verify:
- All 4 variants (info, success, warning, error) render with correct colors
- Both light and dark themes look correct
- Both `base` and `minimal` layouts work
- Dismissible callouts still animate out

- [ ] **Step 5: Update audit**

Mark the Callout critical issue as done in `2026-03-15-mobile-primitives-audit.md`.

- [ ] **Step 6: Commit**

```bash
git add src/components/primitives/Callout/Callout.native.tsx
git commit -m "fix(callout): use theme colors instead of hardcoded Tailwind palette on native"
```

---

## Task 2: Button — Remove Dead Onboarding/White Variants

**Files:**
- Modify: `src/components/primitives/Button/Button.native.tsx`

**Context:** The `disabled-onboarding`, `primary-white`, `secondary-white`, `light-white`, `light-outline-white` types are only used in legacy onboarding/login/maintenance screens that won't exist in the mobile app. Remove their handling from native implementation. Keep them in the shared `types.ts` since web still uses them.

- [ ] **Step 1: Remove onboarding/white variant handling from Button.native.tsx**

In the `getBackgroundColor`, `getTextColor`, and any other style functions, remove the cases for:
- `'disabled-onboarding'`
- `'primary-white'`
- `'secondary-white'`
- `'light-white'`
- `'light-outline-white'`

These will fall through to the default case. The types.ts stays unchanged (web still uses them).

- [ ] **Step 2: Verify in playground**

Open Button test screen. All existing variants (primary, secondary, light, light-outline, subtle, subtle-outline, danger, unstyled) should render correctly. The removed variants were never shown in the playground.

- [ ] **Step 3: Update audit**

Mark the Button significant issue as done in `2026-03-15-mobile-primitives-audit.md`.

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/Button/Button.native.tsx
git commit -m "cleanup(button): remove dead onboarding/white variants from native implementation"
```

---

## Task 3: Input — Remove Dead Onboarding Variant

**Files:**
- Modify: `src/components/primitives/Input/Input.native.tsx`

**Context:** The `onboarding` variant and its hardcoded colors (`#3aa9f8`, `#ffffff`, `#034081`, `#6fc3ff`) are dead code — only used in legacy screens.

- [ ] **Step 1: Remove onboarding-specific code from Input.native.tsx**

Remove the `variant === 'onboarding'` conditionals and their hardcoded colors at lines 70, 79, 119, 190. The remaining variants (`filled`, `bordered`, `minimal`) should continue to work as before.

- [ ] **Step 2: Verify in playground**

Open Input test screen. Test filled, bordered, and minimal variants with text, email, password, search types. Verify focus states, error states, disabled state.

- [ ] **Step 3: Update audit**

Mark the Input significant issue as done in `2026-03-15-mobile-primitives-audit.md`.

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/Input/Input.native.tsx
git commit -m "cleanup(input): remove dead onboarding variant from native implementation"
```

---

## Task 4: TextArea — Remove Dead Onboarding Variant

**Files:**
- Modify: `src/components/primitives/TextArea/TextArea.native.tsx`

**Context:** Same as Input — the `onboarding` variant has hardcoded colors at lines 54, 62, 100, 135.

- [ ] **Step 1: Remove onboarding-specific code from TextArea.native.tsx**

Remove the `variant === 'onboarding'` conditionals and their hardcoded colors. The remaining variants should work unchanged.

- [ ] **Step 2: Verify in playground**

Open TextArea test screen. Test auto-resize, error states, different row counts.

- [ ] **Step 3: Update audit**

Mark the TextArea significant issue as done in `2026-03-15-mobile-primitives-audit.md`.

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/TextArea/TextArea.native.tsx
git commit -m "cleanup(textarea): remove dead onboarding variant from native implementation"
```

---

## Task 5: Spacer — Use Theme Border Color

**Files:**
- Modify: `src/components/primitives/Spacer/Spacer.native.tsx`

**Context:** The Spacer uses a hardcoded border color `'#e5e7eb'` that won't adapt to dark mode. Need to add `useTheme()` and use `theme.colors.border.default`.

- [ ] **Step 1: Add useTheme and replace hardcoded color**

The challenge: `Spacer` currently takes `borderColor` as a prop with a default value. We need to make the default come from the theme. Since `useTheme` is a hook, it must be called inside the component body, not as a default parameter.

```tsx
import { useTheme } from '../theme';

export const Spacer: React.FC<NativeSpacerProps> = ({
  size,
  direction = 'vertical',
  borderTop,
  borderBottom,
  borderColor,  // Remove the default value here
  spaceBefore,
  spaceAfter,
  border,
  testId,
}) => {
  const theme = useTheme();
  const resolvedBorderColor = borderColor || theme.colors.border.default;

  // Then use resolvedBorderColor everywhere borderColor was used
  // (lines 59, 65, 91, 95)
```

- [ ] **Step 2: Verify in playground**

Open Layout test screen (which has Spacer demos). Check borders are visible in both light and dark themes.

- [ ] **Step 3: Update audit**

Mark the Spacer significant issue as done in `2026-03-15-mobile-primitives-audit.md`.

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/Spacer/Spacer.native.tsx
git commit -m "fix(spacer): use theme border color instead of hardcoded value on native"
```

---

## Task 6: Type Cleanup — Select, Tooltip, RadioGroup, Modal

**Files:**
- Modify: `src/components/primitives/Select/types.ts`
- Modify: `src/components/primitives/Tooltip/types.ts`
- Modify: `src/components/primitives/RadioGroup/types.ts`
- Modify: `src/components/primitives/Modal/types.ts`

**Context:** Several native types declare props that are never implemented. Clean up by moving web-only props out of shared interfaces or documenting them clearly.

- [ ] **Step 1: Select — Move `dropdownPlacement` to web-only**

In `Select/types.ts`, move `dropdownPlacement` from `BaseSelectProps` to `WebSelectProps`:

```tsx
// Remove from BaseSelectProps (line 32):
//   dropdownPlacement?: 'top' | 'bottom' | 'auto';

// Add to WebSelectProps:
export interface WebSelectProps extends BaseSelectProps {
  name?: string;
  id?: string;
  autoFocus?: boolean;
  dropdownPlacement?: 'top' | 'bottom' | 'auto';
}
```

- [ ] **Step 2: Tooltip — Split into base and platform types**

In `Tooltip/types.ts`, create a `BaseTooltipProps` with only the shared props, and move web-only props to `TooltipWebProps`:

```tsx
// Base props (implemented on both platforms)
export interface BaseTooltipProps {
  content: ReactNode;
  children: ReactNode;
  place?: TooltipPlacement;
  showCloseButton?: boolean;
  maxWidth?: number;
  disabled?: boolean;
}

// Web gets all the extras
export interface TooltipWebProps extends BaseTooltipProps {
  id: string;
  noArrow?: boolean;
  className?: string;
  noBorder?: boolean;
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  showOnTouch?: boolean;
  autoHideAfter?: number;
  clickable?: boolean;
  variant?: 'simple' | 'rich';
}

// Native keeps it simple
export interface TooltipNativeProps extends BaseTooltipProps {
  // Native-specific props can be added here
}
```

Then update `Tooltip.web.tsx` to import `TooltipWebProps` instead of `TooltipProps` (if it doesn't already).

- [ ] **Step 3: RadioGroup — Mark tooltip as web-only in comments**

In `RadioGroup/types.ts`, the `tooltip` and `tooltipPlace` on `RadioOption` are already commented as "web only" (lines 8-9). The `variant` prop stays — it's deferred for design review. No code change needed, just verify the comments are clear.

- [ ] **Step 4: Modal — Remove keyboardAvoidingView**

In `Modal/types.ts`, remove `keyboardAvoidingView` from `NativeModalProps`:

```tsx
export interface NativeModalProps extends BaseModalProps {
  swipeToClose?: boolean;
  swipeUpToOpen?: boolean;
  // keyboardAvoidingView removed — will implement when needed
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

No errors should appear related to the changed types. If any component was relying on a moved prop, it will surface here.

- [ ] **Step 6: Update audit**

Mark all type cleanup items as done in `2026-03-15-mobile-primitives-audit.md`.

- [ ] **Step 7: Commit**

```bash
git add src/components/primitives/Select/types.ts src/components/primitives/Tooltip/types.ts src/components/primitives/Modal/types.ts
git commit -m "cleanup(types): move web-only props out of shared interfaces for Select, Tooltip, Modal"
```

---

## Task 7: Switch — Implement Haptic Feedback

**Files:**
- Modify: `src/components/primitives/Switch/Switch.native.tsx`

**Context:** `expo-haptics` is already in mobile dependencies. The haptic stub is at lines 32-35. Default should be **on** (`hapticFeedback = true`).

- [ ] **Step 1: Add expo-haptics import and implement**

```tsx
import * as Haptics from 'expo-haptics';

// Change default from false to true:
hapticFeedback = true,

// Replace lines 31-35 with:
const handlePress = () => {
  if (!disabled) {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onChange(!value);
  }
};
```

Note: Remove the `Platform.OS === 'ios'` check — `expo-haptics` handles cross-platform support internally (vibration on Android, haptic on iOS).

- [ ] **Step 2: Verify in playground**

Open Switch test screen. Toggle switches — should feel a light tap feedback on each toggle. Test with `hapticFeedback={false}` to verify opt-out works.

- [ ] **Step 3: Update audit**

Mark the Switch haptic feedback item as done in `2026-03-15-mobile-primitives-audit.md`.

- [ ] **Step 4: Commit**

```bash
git add src/components/primitives/Switch/Switch.native.tsx
git commit -m "feat(switch): implement haptic feedback on toggle (on by default)"
```

---

## Task 8: Update Audit File

**Files:**
- Modify: `.agents/tasks/2026-03-15-mobile-primitives-audit.md`

- [ ] **Step 1: Mark all completed items**

Go through the audit action items at the bottom and check off all completed items. Update the summary table statuses.

- [ ] **Step 2: Update the updated date**

Change the footer date to reflect completion.

---

_Created: 2026-03-15_
