---
type: bug
title: "Profile Sync Not Working on Returning User Key Import"
status: closed
resolution: user-data-issue
priority: low
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_docs:
  - ".agents/docs/features/2026-03-14-profile-sync-returning-user-login.md"
  - ".agents/docs/config-sync-system.md"
related_tasks:
  - ".agents/tasks/.done/user-config-sync-on-existing-accounts.md"
---

# Profile Sync Not Working on Returning User Key Import

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When a specific existing user imported their private key on a fresh browser, the app did not sync their profile — it presented the full onboarding flow as if they were a new user.

## Investigation & Resolution

### What We Found

Diagnostic logging was added to the full `fetchUser` pipeline (`App.tsx` routing, `Onboarding.tsx` useEffect, `useOnboardingFlowLogic.ts` fetchUser). The logs revealed:

- The entire fetch/decrypt pipeline executed **successfully**
- The remote config was fetched and decrypted without errors
- The decrypted config contained: `['address', 'allowSync', 'nonRepudiable', 'spaceKeys', 'spaceIds', 'timestamp', 'bookmarks', 'deletedBookmarkIds']`
- **`name` and `profile_image` were `undefined`** in the remote config

### Why This Is Not a Code Bug

The `name` and `profile_image` fields are written to the remote config via `useUserSettings.saveChanges()` — the Settings page save button. This is the same action required to enable sync (`allowSync`), so under normal operation, saving settings always includes both the sync toggle AND the profile data.

Testing with other user accounts confirmed profile sync works correctly — their remote configs contain `name` and `profile_image`.

### Conclusion

The affected user's remote config has `allowSync: true` but no profile data. This is inconsistent with the current code paths (enabling sync requires saving settings, which includes profile data). The most likely explanation is **legacy/corrupted data** — the user may have enabled sync before `name`/`profile_image` were added to the save payload, or their config was overwritten by an older code path.

**Fix for the affected user**: Go to Settings and click Save. This will populate `name` and `profile_image` in the remote config.

**No code changes required** — the sync infrastructure works correctly for all users with properly populated configs.

---

_Created: 2026-03-14_
_Updated: 2026-03-14_
