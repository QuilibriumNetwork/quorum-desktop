---
type: task
title: "Auto-save settings modals — eliminate save buttons"
status: open
complexity: high
ai_generated: true
reviewed_by: null
created: 2026-02-16
updated: 2026-02-16
related_tasks: []
related_docs: []
---

# Auto-save settings modals — eliminate save buttons

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/components/modals/UserSettingsModal/UserSettingsModal.tsx`
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`
- `src/hooks/business/useModalSaveState.ts`
- `src/hooks/business/useUserSettings.ts`
- `src/hooks/business/useSpaceManagement.ts`
- `src/hooks/business/useSpaceProfile.ts`
- Backend API layer (`updateSpace`, `saveUserChanges`)

## What & Why

Both `UserSettingsModal` and `SpaceSettingsModal` use a "stage locally, flush on save" pattern: all changes accumulate in React `useState` and are persisted only when the user clicks "Save Changes". This is a friction point — users expect settings to apply as they change them, similar to OS-level and modern SaaS settings UIs.

The goal is to eliminate the Save button entirely by implementing continuous/auto-save: each setting persists as the user modifies it (immediately for toggles, debounced for text fields).

## Blocker — Monolithic API Layer

**This task cannot proceed until granular API endpoints exist.**

Currently:
- `updateSpace()` sends the **entire space object** in one call (name, description, icon, banner, roles, emojis, stickers, flags — all at once)
- `saveUserChanges()` persists display name + bio + profile image together

For auto-save, individual field changes would fire in rapid succession. With monolithic endpoints this causes:
- **Race conditions**: change A is in-flight when change B fires, B overwrites A's payload with stale data
- **Unnecessary payload**: changing a single toggle re-sends every emoji, sticker, and role
- **No partial failure**: if the banner upload fails, the name change is also lost

**Required**: Backend must expose per-field or per-section endpoints (e.g., `updateSpaceName()`, `updateSpaceIcon()`, `updateSpaceRoles()`, `updateUserDisplayName()`, `updateUserBio()`, `updateUserProfileImage()`).

## Current Architecture

### UserSettingsModal
- Save button triggers `saveChanges` → `saveUserChanges()` → updates parent via `setUser()` → dismisses modal via `onSaveComplete`
- Categories needing save: `general` (display name, bio, profile image) and `privacy` (sync, non-repudiable, device management)
- Uses `useModalSaveState` hook for save-then-dismiss pattern
- Uses `markedForDeletion` pattern for staged image deletion

### SpaceSettingsModal
- Save triggers either `handleAccountSave` or `saveChanges` depending on active tab
- **Account tab**: saves space profile + mention notification settings via `spaceProfile.onSave()` and `mentionSettings.saveSettings()`
- **General/Roles/Emojis/Stickers tabs**: all go through monolithic `updateSpace()` which sends the entire space object
- Uses `useSpaceManagement`, `useRoleManagement`, `useSpaceFileUploads`, `useCustomAssets`, `useInviteManagement`, `useModalSaveState`, `useSpaceProfile` hooks

## Implementation

### Phase 1: Granular API Endpoints (BLOCKER — backend work)
- [ ] **Create per-field update endpoints** (backend)
  - `updateSpaceName(spaceId, name)`
  - `updateSpaceDescription(spaceId, description)`
  - `updateSpaceIcon(spaceId, iconData)`
  - `updateSpaceBanner(spaceId, bannerData)`
  - `updateSpaceRoles(spaceId, roles)`
  - `updateSpaceEmojis(spaceId, emojis)`
  - `updateSpaceStickers(spaceId, stickers)`
  - `updateSpaceFlags(spaceId, { isRepudiable, saveEditHistory, defaultChannelId })`
  - `updateUserDisplayName(displayName)`
  - `updateUserBio(bio)`
  - `updateUserProfileImage(imageData)`
  - `updateUserPrivacyFlags({ allowSync, nonRepudiable })`
  - Done when: each endpoint can be called independently without affecting other fields

### Phase 2: Debounced Auto-Save Hooks (requires Phase 1)
- [ ] **Create `useAutoSave` hook** for text fields
  - Debounce 500-1000ms after last keystroke
  - Show inline saving indicator (spinner → checkmark)
  - Rollback to previous value on error
  - Done when: display name, bio, space name, description auto-save independently
- [ ] **Create immediate-save wrappers** for toggles
  - Sync, non-repudiable, repudiable, save edit history toggles save on click
  - Done when: each toggle persists immediately
- [ ] **Create upload-and-save wrappers** for file uploads
  - Profile image, space icon, space banner persist on upload/deletion
  - Remove `markedForDeletion` staging pattern
  - Done when: file changes persist immediately without save button

### Phase 3: Remove Staged State Pattern (requires Phase 2)
- [ ] **Refactor `useUserSettings`** to persist on change instead of accumulating
  - Remove `saveChanges` method
  - Each setter calls its granular endpoint
- [ ] **Refactor `useSpaceManagement`** similarly
- [ ] **Refactor `useSpaceFileUploads`** — upload immediately, no staging
- [ ] **Refactor `useCustomAssets`** — each add/remove/update persists
- [ ] **Refactor `useRoleManagement`** — each role change persists
- [ ] **Remove `useModalSaveState` hook** from both modals
  - Done when: no local state accumulation, no save button needed

### Phase 4: UX Changes (requires Phase 3)
- [ ] **Replace footer save button** with per-field saving indicators
  - Subtle spinner/checkmark next to each field while saving
  - Inline error messages on failure with retry
- [ ] **Remove `ModalSaveOverlay`** from both modals
- [ ] **Simplify modal dismissal** — remove `isSaving` guards, modal can close anytime
  - Add brief "unsaved changes" check only for in-flight debounced saves
- [ ] **Refactor parent state sync** in `UserSettingsModal`
  - Replace imperative `setUser()` callback with reactive store (React Query cache)
  - Parent reads from shared state rather than receiving updates on save
  - Done when: modal close doesn't need to push state to parent

## Verification
✅ **Settings persist without save button**
   - Test: change display name → wait 1s → close modal → reopen → name persists

✅ **Race conditions handled**
   - Test: rapidly change name, then toggle → both persist correctly

✅ **Error rollback works**
   - Test: simulate API failure → field reverts to last-known-good value

✅ **Modal dismissal is instant**
   - Test: close modal at any time → no blocking overlay

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Definition of Done
- [ ] Granular API endpoints exist for all settings fields
- [ ] All settings auto-save (debounced text, immediate toggles, immediate uploads)
- [ ] No save button in either modal
- [ ] Per-field saving indicators and error states
- [ ] Modal can close at any time without blocking
- [ ] Parent state reads from reactive store
- [ ] TypeScript passes
- [ ] Manual testing across all settings tabs

---

_Created: 2026-02-16_
