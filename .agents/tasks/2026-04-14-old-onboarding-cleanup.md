---
title: Old Onboarding Cleanup & Maintenance Restyling
description: Remove dead code from the old onboarding flow, restyle Maintenance.tsx to use themed components, and clean up white button variants from both quorum-desktop and quorum-shared.
created: 2026-04-14
---

# Old Onboarding Cleanup & Maintenance Restyling

## Context

The onboarding flow was completely reworked over the last two days. The new flow (`OnboardingFlow.tsx` + `useUnifiedOnboardingFlow`) uses a clean, minimal, theme-aware design with `bg-onboarding` (resolves to `var(--surface-1)`). The old flow (`Onboarding.tsx` + `useOnboardingFlow`) is now dead code with no imports.

The old design used a branded gradient background (`bg-radial--accent-noise`: blue/green radial gradient with noise texture) and white button variants (`btn-primary-white`, etc.) designed to sit on top of that gradient. The `Maintenance.tsx` component still uses this old style since it shared the same wrapper.

Now that onboarding has moved on, the maintenance page needs its own restyling, and the old code and button variants can be cleaned up.

## Decisions Made

- **Maintenance background**: Use `var(--surface-1)` directly (same value as `--color-bg-chat`), NOT `bg-onboarding` (which carries scoped style overrides for `.btn-secondary` and `.quorum-input` that are onboarding-specific). A simple class or inline background.
- **Maintenance layout**: Centered content, standard themed text and buttons, works in both light and dark themes.
- **`bg-radial--accent-noise` class**: Keep the CSS definition in `_base.scss` (may be useful later for landing page or brand contexts), but remove it from App.tsx so it's not applied anywhere.
- **Old `Onboarding.tsx`**: Delete (dead code, no imports).
- **Old `useOnboardingFlow` hook**: Delete if also orphaned.
- **White button variants**: Remove from both quorum-desktop (SCSS, tests, playground) and quorum-shared (types, component logic). The quorum-shared work goes on the existing `fix/input-error-message-layout-shift` branch.

## Scope

### quorum-desktop

#### 1. Restyle Maintenance.tsx
- Replace white text styling with standard themed text colors (`color-text-main`, `color-text-subtle`)
- Replace `type="secondary-white"` button with `type="secondary"` or `type="primary"`
- Use centered layout consistent with the app's content area
- Keep the warning icon

#### 2. Update App.tsx
- ErrorBoundary fallback: replace `bg-radial--accent-noise` wrapper with a simple `var(--surface-1)` background
- Remove the `bg-radial--accent-noise` class usage (keep the CSS definition in `_base.scss`)

#### 3. Delete dead code
- `src/components/onboarding/Onboarding.tsx` (old web onboarding component, no imports)
- `src/components/onboarding/Login.tsx` (old web login component, no imports)
- `src/styles/_passkey-modal.scss` (only imported by old Onboarding.tsx and Login.tsx; the new flow uses `usePasskeyFlow` hook, not the `PasskeyModal` UI component)
- `src/components/onboarding/Onboarding.native.tsx` (old native onboarding component, no imports)
- `src/components/onboarding/OnboardingStyles.native.tsx` (styling helpers only used by native onboarding/maintenance)
- `src/components/onboarding/Login.native.tsx` (native login component, no imports)
- `src/components/Maintenance.native.tsx` (native maintenance component, no imports -- uses `AuthScreenWrapper` from deleted `OnboardingStyles.native.tsx` and white button variants)
- `src/hooks/business/user/useOnboardingFlow.ts` (thin wrapper, only imported by old `Onboarding.tsx` and `Onboarding.native.tsx`)
- Remove the `useOnboardingFlow` re-export from `src/hooks/business/user/index.ts`
- **Keep** `useOnboardingFlowLogic.ts` -- it exports types (`OnboardingAdapter`, `PasskeyInfo`) that `usePasskeyAdapter.web.ts` and `usePasskeyAdapter.native.ts` depend on. These adapters are shared with the new unified hook.

#### 4. Clean up Button.scss
- Remove `btn-disabled-onboarding` class
- Remove white button variant classes: `btn-light-white`, `btn-primary-white`, `btn-secondary-white`, `btn-light-outline-white`
- Keep the comment block header if desired for git history context, or remove entirely

#### 5. Clean up playground and tests
- `src/dev/primitives-playground/examples/Button.tsx`: remove white variant entries, update type comment
- `src/dev/tests/components/Button.test.tsx`: remove test cases for white variants and `disabled-onboarding`

### quorum-shared (branch: `fix/input-error-message-layout-shift`)

#### 6. Update Button types
- `src/primitives/Button/types.ts`: remove `primary-white`, `secondary-white`, `light-white`, `light-outline-white`, `disabled-onboarding` from the `type` union in `BaseButtonProps`

#### 7. Update Button.web.tsx
- Remove `isDisabledOnboarding` logic (the special `disabled-onboarding` handling)
- Simplify `baseClass` calculation

## Out of Scope

- Redesigning the onboarding flow itself (already done)
- Creating new button variants
- Touching the `bg-radial--accent-noise` CSS definition (kept for potential future use)
- Changes to the quorum-mobile repo (confirmed no white variant usage there)

---

*Created: 2026-04-14*
