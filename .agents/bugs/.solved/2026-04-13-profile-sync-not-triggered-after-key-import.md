---
type: bug
title: "Profile sync not triggered after key import in new onboarding flow"
status: solved
priority: high
ai_generated: false
created: 2026-04-13
updated: 2026-04-13
related_docs:
  - ".agents/docs/features/profile-sync-returning-user-login.md"
related_tasks:
  - ".agents/tasks/2026-04-13-new-onboarding-ui-ux-plan.md"
---

# Profile sync not triggered after key import in new onboarding flow

## Symptoms

When a user imports an existing `.key` file for an account that has sync enabled (name + avatar saved remotely), the onboarding flow does **not** detect the existing profile and skips directly to the display-name step. The user is forced to re-enter their name and profile photo as if it were a new account.

## Root cause

`checkReturningUser()` in `useUnifiedOnboardingFlow.ts` runs once, guarded by `step === 'loading'`, on component mount. At that point, `adapter.currentPasskeyInfo` is always `null` for a fresh import because the SDK has not yet persisted credentials to IndexedDB. The check immediately falls through to `setStep('welcome')`.

After the user completes passkey setup (or skips it), the SDK fires `onStepChange('success')` and stores credentials — but `checkReturningUser` is never called again. The flow moves to `'backup-key'` unconditionally.

## Old flow (main branch)

`Onboarding.tsx` had a separate `useEffect` watching `currentPasskeyInfo?.address`:

```ts
useEffect(() => {
  if (onboardingFlow.currentPasskeyInfo?.address) {
    onboardingFlow.fetchUser(address, setUser);
  }
}, [onboardingFlow.currentPasskeyInfo?.address]);
```

This fired **after** the SDK stored credentials post-registration, catching the import case. The new unified flow has no equivalent trigger.

## Related fixes already applied

`PasskeysProvider` was being double-nested (`web/main.tsx` wraps the whole app; `App.tsx` was incorrectly adding a second one around `OnboardingFlow`). This caused `currentPasskeyInfo` to always be `null` inside the onboarding hook even on refresh. That fix is in place — refreshing now correctly re-logs the user. The remaining bug is the fresh-import path.

## Reproduction

1. Clear all localStorage + IndexedDB
2. Go through onboarding, import an existing `.key` file (account that has sync enabled with a saved name + avatar)
3. Complete or skip passkey creation
4. Observe: user sees the display-name input step instead of being logged in automatically

## Expected behaviour

After completing passkey setup with an imported key, the flow checks for a remote profile. If a valid name is found, `setUser()` is called and the user enters the app directly, skipping the display-name and profile-photo steps.

## Fix direction

In `useUnifiedOnboardingFlow.ts`, in the `onStepChange` callback for `'success'`:
- Only when `importMode === true`, attempt the remote profile fetch (same logic as `checkReturningUser` but after the SDK has stored credentials)
- If fetch succeeds and a valid name is found, call `setUser()` and return early
- If fetch fails or no profile found, proceed normally to `'backup-key'`

Because `onStepChange` is a callback (not an effect), `adapter.currentPasskeyInfo` may still not be updated synchronously. A short `useEffect` watching `[passkeyFlow.step, isImportMode]` that fires when `passkeyFlow.step === 'success'` would be the correct approach — mirroring the old `currentPasskeyInfo?.address` watcher.

## Fix applied

Two changes in `src/hooks/business/user/useUnifiedOnboardingFlow.ts`:

1. **Removed duplicate `PasskeysProvider`** from `src/App.tsx` — it was double-nested with the root provider in `web/main.tsx`, causing `currentPasskeyInfo` to always be `null` inside the onboarding hook.

2. **Added `syncImportedProfile` effect** — when `onStepChange('success')` fires in import mode, the flow holds at `'loading'` (spinner) instead of advancing to `'backup-key'`. A new effect guarded by `step === 'loading' && importMode && passkeyFlow.step === 'success'` runs the remote profile fetch. If a valid name is found, `setUser()` is called directly. If not, the flow advances to `'backup-key'` normally.

---

_Created: 2026-04-13_
