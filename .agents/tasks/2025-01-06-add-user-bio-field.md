---
type: task
title: Add User Bio Field to UserSettingsModal General Tab
status: in-progress
complexity: low
ai_generated: true
created: 2025-01-06T00:00:00.000Z
updated: '2026-01-09'
---

# Add User Bio Field to UserSettingsModal General Tab

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/db/messages.ts:47-87`
- `src/hooks/business/user/useUserSettings.ts:10-217`
- `src/hooks/business/validation/useSpaceNameValidation.ts:53-68` (add bio validation)
- `src/components/modals/UserSettingsModal/General.tsx:1-144`
- `src/components/modals/UserSettingsModal/UserSettingsModal.tsx`

## What & Why
Users cannot add a bio/description to their profile on the desktop app, while mobile already supports this feature. Adding a bio textarea to the General tab enables users to share information about themselves, improving profile completeness and parity with the mobile app.

## Context
- **Existing pattern**: `SpaceSettingsModal/General.tsx:171-195` implements space description with TextArea, XSS validation, and character limit - follow this pattern exactly
- **Validation**: Use `validateNameForXSS` from `src/utils/validation.ts` for XSS protection
- **Constraints**: Keep local-only for now (no server sync) - see "Future Work" section below

## Sync System Background

Desktop and mobile use the **same sync infrastructure**:
- Same API endpoint: `/users/${address}/config`
- Same encryption: AES-GCM with SHA-512(private_key)[0:32]
- Same signing: Ed448
- Same conflict resolution: Last-write-wins (higher timestamp)

**Current bio status across platforms:**
| Platform | Bio Storage | Synced to Server |
|----------|-------------|------------------|
| Mobile | `UserInfo` (MMKV local) | ❌ No |
| Desktop | Not implemented | ❌ No |
| Shared `UserConfig` type | Not included | N/A |

**This task implements local-only bio** to match mobile's current behavior. Cross-platform sync requires coordinated changes (see Future Work).

---

## Implementation

### Phase 1: Data Layer

- [ ] **Add bio field to UserConfig type** (`src/db/messages.ts:55`)
    - Done when: TypeScript recognizes `bio` field on `UserConfig`
    ```typescript
    // Current:
    name?: string;
    profile_image?: string;
    spaceKeys?: {

    // Change to:
    name?: string;
    profile_image?: string;
    bio?: string;                     // User's bio/description (local-only for now)
    spaceKeys?: {
    ```

- [ ] **Add bio validation function** (`src/hooks/business/validation/useSpaceNameValidation.ts`)
    - Done when: `validateUserBio` exported and importable
    - Reference: Follow `validateSpaceDescription` pattern at line 53-68
    ```typescript
    export const MAX_BIO_LENGTH = 160;

    export const validateUserBio = (bio: string): string[] => {
      const errors: string[] = [];
      if (!validateNameForXSS(bio)) {
        errors.push(t`Bio cannot contain special characters`);
      }
      if (bio.length > MAX_BIO_LENGTH) {
        errors.push(t`Bio must be ${MAX_BIO_LENGTH} characters or less`);
      }
      return errors;
    };
    ```
    - Also export from `src/hooks/business/validation/index.ts`

### Phase 2: Hook Layer (requires Phase 1)

- [ ] **Add bio state to useUserSettings hook** (`src/hooks/business/user/useUserSettings.ts`)
    - Done when: `bio`, `setBio`, `bioErrors` available in hook return
    - Add to interface `UseUserSettingsReturn` (~line 15):
      - `bio: string`
      - `setBio: (bio: string) => void`
      - `bioErrors: string[]`
    - Add state after `displayName` state (~line 40):
      ```typescript
      const [bio, setBio] = useState(currentPasskeyInfo?.bio || '');
      ```
    - Add validation (follow descriptionErrors pattern from SpaceSettingsModal):
      ```typescript
      const bioErrors = validateUserBio(bio);
      ```
    - Include bio in `saveChanges` config (~line 158-164):
      ```typescript
      const newConfig = {
        ...existingConfig.current!,
        allowSync,
        nonRepudiable: nonRepudiable,
        name: displayName,
        profile_image: profileImageUrl,
        bio: bio.trim() || undefined,  // ADD THIS
      };
      ```
    - Return bio, setBio, bioErrors in return object (~line 197)

### Phase 3: UI Layer (requires Phase 2)

- [ ] **Update GeneralProps interface** (`src/components/modals/UserSettingsModal/General.tsx:8`)
    - Done when: Props accept bio-related fields
    - Add to interface:
      ```typescript
      bio: string;
      setBio: (value: string) => void;
      bioErrors: string[];
      maxBioLength: number;
      ```

- [ ] **Add Bio TextArea to General component** (`src/components/modals/UserSettingsModal/General.tsx`)
    - Done when: TextArea visible below display name input
    - Reference: Follow exact pattern from `SpaceSettingsModal/General.tsx:171-195`
    - Add after display name Input (after line 103), before Account Address section:
      ```tsx
      <Spacer size="md" direction="vertical" borderTop={true} />
      <div className="text-subtitle-2 mb-2">
        <Trans>Bio</Trans>
      </div>
      <div className="w-full mb-2">
        <TextArea
          value={bio}
          onChange={setBio}
          placeholder={t`Tell us about yourself...`}
          rows={3}
          variant="filled"
          className="w-full"
          error={bioErrors.length > 0}
          errorMessage={
            bioErrors.length > 0
              ? bioErrors.join('. ')
              : undefined
          }
        />
      </div>
      <div className="text-label mb-4">
        <Trans>
          This bio will be visible to others when they view your profile.
        </Trans>
      </div>
      ```
    - Add imports: `TextArea`, `Spacer` from primitives, `Trans` from `@lingui/react/macro`

- [ ] **Pass bio props from UserSettingsModal** (`src/components/modals/UserSettingsModal/UserSettingsModal.tsx`)
    - Done when: General component receives all bio props
    - Pass to General component:
      ```typescript
      bio={bio}
      setBio={setBio}
      bioErrors={bioErrors}
      maxBioLength={MAX_BIO_LENGTH}
      ```
    - Add `bioErrors.length > 0` to save button disabled condition (follow descriptionErrors pattern from SpaceSettingsModal:614)

---

## Verification

✓ **Bio field saves and persists**
    - Test: Enter bio → close modal → reopen → bio is still there
    - Verify: Check IndexedDB `user_config` table shows bio value

✓ **XSS validation works**
    - Test: Enter `<script>alert('xss')</script>` → error message appears
    - Test: Enter `<3 emoticon` → no error (safe pattern allowed)

✓ **Character limit enforced**
    - Test: Type >160 characters → error message appears
    - Verify: Error shows "Bio must be 160 characters or less"

✓ **Save button disabled on validation error**
    - Test: Enter invalid bio → Save button becomes disabled

✓ **TypeScript compiles**
    - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| HTML-like input `<script>` | XSS validation error | ⚒️ Needs handling | P0 | High |
| Safe patterns `<3`, `>_<` | Allowed (no error) | ✓ Already works via validateNameForXSS | P0 | Low |
| Bio with newlines | Preserve newlines in TextArea | ⚒️ Verify works | P1 | Low |
| Future sync conflict | Last-write-wins | ⚠️ Acceptable | P2 | Medium |
| Empty bio | Saved as undefined, shows placeholder | ⚒️ Needs handling | P1 | Low |

---

## Definition of Done

- [ ] TypeScript compiles without errors
- [ ] Bio TextArea appears in General tab with proper styling
- [ ] XSS validation prevents HTML injection attempts
- [ ] Character limit (160) shows error when exceeded
- [ ] Save button disabled when bio has validation errors
- [ ] Bio persists after modal close/reopen
- [ ] Safe patterns like `<3` emoticons are allowed
- [ ] No console errors or warnings

---

## Implementation Notes

_Updated during implementation_

---

## Future Work: Enable Cross-Platform Bio Sync

Once this task is complete, the following steps are needed to enable bio sync between desktop and mobile:

### Step 1: Update Shared Package (`@quilibrium/quorum-shared`)
- **File**: `src/types/user.ts`
- **Change**: Add `bio?: string` to `UserConfig` type (line ~37, after `profile_image`)
- **Publish**: New version of `@quilibrium/quorum-shared`

### Step 2: Update Mobile App (`quorum-mobile`)
- **File**: `context/AuthContext.tsx:246-252`
- **Change**: Add bio to `configUpdates` in `updateProfile()`:
  ```typescript
  const configUpdates: { name?: string; profile_image?: string; bio?: string } = {};
  if (updates.displayName !== undefined) {
    configUpdates.name = updates.displayName;
  }
  if (updates.profileImage !== undefined) {
    configUpdates.profile_image = updates.profileImage;
  }
  if (updates.bio !== undefined) {
    configUpdates.bio = updates.bio;  // ADD THIS
  }
  ```
- **File**: `context/AuthContext.tsx:152-157`
- **Change**: Read bio from synced config:
  ```typescript
  const updatedUser = {
    ...parsedUser,
    displayName: config.name || parsedUser.displayName,
    profileImage: config.profile_image || parsedUser.profileImage,
    bio: config.bio || parsedUser.bio,  // ADD THIS
  };
  ```

### Step 3: Update Desktop App (`quorum-desktop`)
- **File**: `src/services/ConfigService.ts`
- **Change**: Bio is already included in config object (from this task), just ensure it's not filtered out during sync
- **Verify**: Bio persists after enabling `allowSync` and syncing to another device

### Conflict Resolution
When sync is enabled, bio will use **last-write-wins** (same as `name` and `profile_image`):
- If user has different bios on mobile and desktop
- Whichever device saves config last will overwrite the other
- No merge strategy for string fields - simple replacement

### Coordinated Release
All three changes should be released together to ensure compatibility:
1. Publish new `@quilibrium/quorum-shared` version
2. Update mobile app dependency and deploy
3. Update desktop app dependency and deploy

---

## Updates

**2025-01-06 - Claude**: Initial task creation based on mobile app analysis
**2025-01-06 - Claude**: Updated to follow SpaceSettingsModal pattern with TextArea, XSS validation, and proper error handling
**2025-01-06 - Claude**: Added sync system background and future work section for cross-platform bio sync
