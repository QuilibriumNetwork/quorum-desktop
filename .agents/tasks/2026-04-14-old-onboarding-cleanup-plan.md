# Old Onboarding Cleanup & Maintenance Restyling - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead old onboarding code, restyle the Maintenance page to use themed components, and clean up white button variants across quorum-desktop and quorum-shared.

**Architecture:** Delete orphaned `.native.tsx` and old web onboarding files, restyle `Maintenance.tsx` with theme-aware background and standard button variants, remove white button CSS/types/tests/playground entries from both repos.

**Tech Stack:** React, SCSS, TypeScript (quorum-desktop + quorum-shared)

---

### Task 1: Delete dead native components

**Files:**
- Delete: `src/components/onboarding/Onboarding.native.tsx`
- Delete: `src/components/onboarding/OnboardingStyles.native.tsx`
- Delete: `src/components/onboarding/Login.native.tsx`
- Delete: `src/components/Maintenance.native.tsx`

These four files are orphaned -- no imports reference them from anywhere in the codebase.

- [ ] **Step 1: Delete the four native files**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
rm src/components/onboarding/Onboarding.native.tsx
rm src/components/onboarding/OnboardingStyles.native.tsx
rm src/components/onboarding/Login.native.tsx
rm src/components/Maintenance.native.tsx
```

- [ ] **Step 2: Verify no broken imports**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -30
```

Expected: No new errors related to these files.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/Onboarding.native.tsx src/components/onboarding/OnboardingStyles.native.tsx src/components/onboarding/Login.native.tsx src/components/Maintenance.native.tsx
git commit -m "chore: delete dead native onboarding and maintenance components"
```

---

### Task 2: Delete old web onboarding code

**Files:**
- Delete: `src/components/onboarding/Onboarding.tsx`
- Delete: `src/components/onboarding/Login.tsx` (also dead -- no imports)
- Delete: `src/hooks/business/user/useOnboardingFlow.ts`
- Delete: `src/styles/_passkey-modal.scss` (only imported by old `Onboarding.tsx` and `Login.tsx`; the new flow uses `usePasskeyFlow` hook directly, not the `PasskeyModal` UI component)
- Modify: `src/hooks/business/user/index.ts:10`

- [ ] **Step 1: Delete old files**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
rm src/components/onboarding/Onboarding.tsx
rm src/components/onboarding/Login.tsx
rm src/hooks/business/user/useOnboardingFlow.ts
rm src/styles/_passkey-modal.scss
```

- [ ] **Step 2: Remove re-export from barrel file**

In `src/hooks/business/user/index.ts`, remove line 10:

```typescript
// DELETE this line:
export * from './useOnboardingFlow';
```

The file should go from:

```typescript
export * from './useUserSettings';
export * from './useProfileImage';
export * from './useLocaleSettings';
export * from './useNotificationSettings';
export * from './useUserKicking';
export * from './useUserMuting';
export * from './useUserRoleManagement';
export * from './useUserProfileActions';
export * from './useUserRoleDisplay';
export * from './useOnboardingFlow';
export * from './useKeyBackup';
```

to:

```typescript
export * from './useUserSettings';
export * from './useProfileImage';
export * from './useLocaleSettings';
export * from './useNotificationSettings';
export * from './useUserKicking';
export * from './useUserMuting';
export * from './useUserRoleManagement';
export * from './useUserProfileActions';
export * from './useUserRoleDisplay';
export * from './useKeyBackup';
```

- [ ] **Step 3: Verify no broken imports**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -30
```

Expected: No new errors. `useOnboardingFlowLogic.ts` stays because `usePasskeyAdapter.web.ts` and `usePasskeyAdapter.native.ts` import types from it.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/Onboarding.tsx src/components/onboarding/Login.tsx src/hooks/business/user/useOnboardingFlow.ts src/styles/_passkey-modal.scss src/hooks/business/user/index.ts
git commit -m "chore: delete old web onboarding components, hook, and passkey modal styles"
```

---

### Task 3: Restyle Maintenance.tsx and update App.tsx

**Files:**
- Modify: `src/components/Maintenance.tsx`
- Modify: `src/App.tsx:106`

- [ ] **Step 1: Restyle Maintenance.tsx**

Replace the entire content of `src/components/Maintenance.tsx` with themed styling. The current version uses white text, `text-white` classes, and `type="secondary-white"` button. Replace with standard themed components that work in both light and dark mode.

New content for `src/components/Maintenance.tsx`:

```tsx
import React from 'react';
import { Button, Icon } from './primitives';
import { Trans } from '@lingui/react/macro';

export const Maintenance = () => {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[460px] text-center">
        <div className="flex justify-center mb-6">
          <div className="onboarding-step-icon onboarding-step-icon--large">
            <Icon name="tools" size="2xl" />
          </div>
        </div>
        <h1 className="onboarding-title">
          <Trans>Maintenance in Progress</Trans>
        </h1>
        <p className="onboarding-description">
          <Trans>
            Quorum infrastructure is being deployed at this time. Please try
            refreshing, and check{' '}
            <a
              href="https://status.quilibrium.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="onboarding-link"
            >
              status.quilibrium.com
            </a>{' '}
            for updates.
          </Trans>
        </p>
        <div className="flex justify-center">
          <Button
            type="primary"
            className="onboarding-action"
            onClick={() => window.location.reload()}
          >
            <Trans>Refresh</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
};
```

This reuses existing onboarding utility classes (`onboarding-step-icon`, `onboarding-title`, `onboarding-description`, `onboarding-link`, `onboarding-action`) which are already theme-aware and provide consistent styling. No white-specific variants needed.

- [ ] **Step 2: Update ErrorBoundary fallback in App.tsx**

In `src/App.tsx`, change the ErrorBoundary fallback wrapper from `bg-radial--accent-noise` to a simple `--surface-1` background. Change line 106:

From:
```tsx
<div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
```

To:
```tsx
<div className="flex flex-col min-h-screen text-main" style={{ backgroundColor: 'var(--surface-1)' }}>
```

- [ ] **Step 3: Verify the app builds**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -30
```

- [ ] **Step 4: Visual verification**

Start the dev server and trigger the maintenance page (or the ErrorBoundary fallback) to confirm:
- Background uses the themed surface color (not the old gradient)
- Text is readable in both light and dark themes
- Button uses standard accent color styling

- [ ] **Step 5: Commit**

```bash
git add src/components/Maintenance.tsx src/App.tsx
git commit -m "style: restyle Maintenance page with themed components, remove gradient background"
```

---

### Task 4: Remove white button CSS variants from Button.scss

**Files:**
- Modify: `src/components/primitives/Button/Button.scss:132-212`

- [ ] **Step 1: Remove btn-disabled-onboarding and all white button variant classes**

In `src/components/primitives/Button/Button.scss`, delete lines 132-212 (from `.btn-disabled-onboarding` through the end of `.btn-light-outline-white`):

Remove:
```scss
.btn-disabled-onboarding {
  @extend %btn-base;
  border: $border-2 solid transparent;
  color: white;
  cursor: default;
  pointer-events: none;
  background-color: rgba(255, 255, 255, 0.3);
}

/* ... everything through .btn-light-outline-white ... */
```

Keep everything after (icon button styles, sizes, etc. starting at line 214).

- [ ] **Step 2: Verify build**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/primitives/Button/Button.scss
git commit -m "style: remove white button variant CSS classes (no longer used)"
```

---

### Task 5: Clean up playground and tests

**Files:**
- Modify: `src/dev/primitives-playground/examples/Button.tsx:27-30,53`
- Modify: `src/dev/tests/components/Button.test.tsx:38-41,154-163,205-215`

- [ ] **Step 1: Remove white variants from playground**

In `src/dev/primitives-playground/examples/Button.tsx`, remove these four entries from the `staticExamples` array (lines 27-30):

```typescript
// DELETE these four lines:
    { name: 'Primary White', props: { type: 'primary-white' }, children: 'Primary White' },
    { name: 'Secondary White', props: { type: 'secondary-white' }, children: 'Secondary White' },
    { name: 'Light White', props: { type: 'light-white' }, children: 'Light White' },
    { name: 'Light Outline White', props: { type: 'light-outline-white' }, children: 'Light Outline White' },
```

Also update the type comment on line 53. Change:

```typescript
  type="primary" // 'primary' | 'secondary' | 'light' | 'light-outline' | 'subtle' | 'subtle-outline' | 'danger' | 'primary-white' | 'secondary-white' | 'light-white' | 'light-outline-white' | 'disabled-onboarding' | 'unstyled'
```

To:

```typescript
  type="primary" // 'primary' | 'secondary' | 'subtle' | 'subtle-outline' | 'danger' | 'danger-outline' | 'unstyled'
```

- [ ] **Step 2: Remove white variant test cases**

In `src/dev/tests/components/Button.test.tsx`, remove the four white variant entries from the `.each` table (lines 38-41):

```typescript
// DELETE these four lines:
    ['light-white', 'btn-light-white'],
    ['primary-white', 'btn-primary-white'],
    ['secondary-white', 'btn-secondary-white'],
    ['light-outline-white', 'btn-light-outline-white'],
```

Remove the `btn-disabled-onboarding` test (lines 154-163):

```typescript
// DELETE this entire test:
  // 11. Uses btn-disabled-onboarding class for that variant
  it('applies btn-disabled-onboarding class for disabled-onboarding type', () => {
    render(
      <Button onClick={() => {}} disabled type="disabled-onboarding">
        Onboarding
      </Button>
    );
    const btn = screen.getByText('Onboarding');
    expect(btn.className).toContain('btn-disabled-onboarding');
  });
```

Remove the `disabled-onboarding` accessibility test (lines 205-215):

```typescript
// DELETE this entire test:
  // A5. disabled-onboarding button IS focusable (uses aria-disabled)
  it('disabled-onboarding button is still focusable', async () => {
    const user = userEvent.setup();
    render(
      <Button onClick={() => {}} disabled type="disabled-onboarding">
        Onboarding
      </Button>
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Onboarding' })).toHaveFocus();
  });
```

- [ ] **Step 3: Run tests to verify**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx vitest run src/dev/tests/components/Button.test.tsx 2>&1
```

Expected: All remaining tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/dev/primitives-playground/examples/Button.tsx src/dev/tests/components/Button.test.tsx
git commit -m "chore: remove white button variants from playground and tests"
```

---

### Task 6: Remove white button types and logic from quorum-shared

**Repo:** `d:/GitHub/Quilibrium/quorum-shared`

**Branch setup:** The previous branch (`fix/input-error-message-layout-shift`) may have been deleted. Create a fresh branch from `master`:

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git checkout master
git pull
git checkout -b chore/remove-white-button-variants
```

**Files:**
- Modify: `src/primitives/Button/types.ts`
- Modify: `src/primitives/Button/Button.web.tsx`

- [ ] **Step 0: Create branch from master (see above)**

- [ ] **Step 1: Remove white variant types from BaseButtonProps**

In `d:/GitHub/Quilibrium/quorum-shared/src/primitives/Button/types.ts`, update the `type` union. Change:

```typescript
  type?:
    | 'primary'
    | 'secondary'
    | 'light'
    | 'light-outline'
    | 'subtle'
    | 'subtle-outline'
    | 'danger'
    | 'primary-white'
    | 'secondary-white'
    | 'light-white'
    | 'light-outline-white'
    | 'disabled-onboarding'
    | 'unstyled';
```

To:

```typescript
  type?:
    | 'primary'
    | 'secondary'
    | 'light'
    | 'light-outline'
    | 'subtle'
    | 'subtle-outline'
    | 'danger'
    | 'danger-outline'
    | 'unstyled';
```

Note: `danger-outline` was missing from the type union but exists in the SCSS -- add it while we're here.

- [ ] **Step 2: Remove disabled-onboarding logic from Button.web.tsx**

In `d:/GitHub/Quilibrium/quorum-shared/src/primitives/Button/Button.web.tsx`, simplify the component. Change lines 7-14:

From:
```typescript
  const isDisabledOnboarding =
    props.disabled && props.type === 'disabled-onboarding';

  const baseClass = props.disabled
    ? isDisabledOnboarding
      ? 'btn-disabled-onboarding'
      : 'btn-disabled'
    : `btn-${props.type || 'primary'}`;
```

To:
```typescript
  const baseClass = props.disabled
    ? 'btn-disabled'
    : `btn-${props.type || 'primary'}`;
```

Also update line 37 (the `disabled` attribute):

From:
```typescript
        disabled={props.disabled && !isDisabledOnboarding}
```

To:
```typescript
        disabled={props.disabled}
```

Remove line 38 (aria-disabled):
```typescript
// DELETE this line:
        aria-disabled={isDisabledOnboarding ? 'true' : undefined}
```

Update the onClick handler (lines 40-43):

From:
```typescript
        onClick={(e) => {
          if (isDisabledOnboarding) return;
          props.onClick(e);
        }}
```

To:
```typescript
        onClick={props.onClick}
```

- [ ] **Step 3: Build quorum-shared to verify**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git add src/primitives/Button/types.ts src/primitives/Button/Button.web.tsx
git commit -m "chore: remove white button variants and disabled-onboarding logic"
```

---

### Task 7: Update quorum-shared dependency in quorum-desktop

After quorum-shared changes are committed, quorum-desktop needs to pick them up.

- [ ] **Step 1: Link or update quorum-shared**

If using a local link (yarn link or workspace protocol), no action needed -- the changes are already visible.

If using a published version, the user will handle the version bump and PR merge separately.

- [ ] **Step 2: Final type check across quorum-desktop**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -30
```

Expected: No type errors. All references to white button variants have been removed.

- [ ] **Step 3: Run full test suite**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx vitest run 2>&1 | tail -20
```

Expected: All tests pass.

---

*Created: 2026-04-14*
