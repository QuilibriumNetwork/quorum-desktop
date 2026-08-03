---
type: task
title: Space Tags
status: done
complexity: high
created: 2025-12-30T00:00:00.000Z
updated: '2026-02-18'
related_issues:
  - '#14'
  - '#15'
---

# Space Tags

https://github.com/QuilibriumNetwork/quorum-desktop/issues/14

> **:warning: AI-Generated**: May contain errors. Verify before use.
> Reviewd by feature-analyzer agent, security-analyst agent, cryptographer agent, experts panel
> Soft-review by human


**Reference**: [GitHub Issue #14](https://github.com/QuilibriumNetwork/quorum-desktop/issues/14), [PR #15](https://github.com/QuilibriumNetwork/quorum-desktop/pull/15)
**Prior Art**: `origin/feat/space-tags` branch (incomplete implementation)

**Files** (implemented):
- `src/api/quorumApi.ts` — SpaceTag, BroadcastSpaceTag types; Space.spaceTag field; UpdateProfileMessage.spaceTag
- `src/db/messages.ts` — space_members schema + DB_VERSION 7→8
- `src/utils/validation.ts` — validateSpaceTagLetters
- `src/components/space/SpaceTag/SpaceTag.tsx` (new) — React.memo pill badge component
- `src/components/space/SpaceTag/SpaceTag.scss` (new) — sm/md/lg size variants
- `src/components/space/SpaceTag/index.ts` (new) — barrel export
- `src/hooks/business/spaces/useSpaceTag.ts` (new) — tag editor state hook
- `src/components/modals/SpaceSettingsModal/SpaceTagSettings.tsx` (new) — owner tag config UI
- `src/components/modals/SpaceSettingsModal/Navigation.tsx` — added space-tag tab
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` — integrated useSpaceTag + SpaceTagSettings
- `src/hooks/business/user/useUserSettings.ts` — spaceTagId state, resolves to BroadcastSpaceTag on save
- `src/components/modals/UserSettingsModal/General.tsx` — Space Tag selector dropdown + preview
- `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` — eligibleSpaceTags memo, passes to General
- `src/components/context/MessageDB.tsx` — updateUserProfile accepts optional spaceTag param
- `src/services/MessageService.ts` — update-profile handler reads spaceTag from incoming profiles (3 locations)
- `src/hooks/business/channels/useChannelData.ts` — passes spaceTag through members map
- `src/components/message/Message.tsx` — renders SpaceTag next to username (desktop + mobile)
- `src/hooks/business/spaces/useSpaceLeaving.ts` — auto-clears spaceTagId config on space leave + re-broadcasts update-profile with spaceTag: undefined
- `src/hooks/business/spaces/useSpaceTagStartupRefresh.ts` (new) — one-shot startup hook to detect stale tag data and re-broadcast

---

## What & Why

Users want to publicly display their Space membership alongside their username in messages - similar to Discord server tags. Currently there's no way for users to show community affiliation. This feature lets Space owners define a tag (icon + 4-letter code), and members can optionally display ONE Space tag next to their name.

## Context

- **Prior implementation**: `origin/feat/space-tags` branch has partial implementation (review commits `8903d6b4`, `e8480f7c`)
- **Design pattern**: Similar to Discord Server Tags - user picks ONE tag, shown everywhere
- **Scope**: Global tag selection (same tag across all Spaces, matching Discord behavior)
- **Constraint**: Only public spaces (`isPublic: true`) can have displayable tags
- **Constraint**: Space must define a tag before members can use it

---

## Data Model

### SpaceTag Type (add to `src/api/quorumApi.ts`)

```typescript
import { IconColor } from '../components/space/IconPicker/types';

export type SpaceTag = {
  letters: string;           // Exactly 4 uppercase letters/numbers (e.g., "GAME", "DEV1")
  url: string;               // Tag image URL (data: URI or hosted URL)
  backgroundColor: IconColor; // Color from IconPicker palette (e.g., "purple", "blue")
};
```

### Space Type Update

```typescript
export type Space = {
  // ... existing fields
  spaceTag?: SpaceTag;  // Optional - owner-defined tag
};
```

### User Config Update

User's selected tag stored in their config (synced across devices):

```typescript
// In config sync payload
{
  spaceTagId?: string;  // spaceId of the selected tag to display
}
```

### Database Schema Update (`src/db/messages.ts`)

Add `spaceTag` (full tag data) to `space_members` object store:

```typescript
// In space_members object store schema
{
  spaceId: string;
  user_address: string;
  inbox_address: string;
  isKicked?: boolean;
  spaceTag?: SpaceTag & { spaceId: string };  // NEW: Full tag data from user's selected space
  // ... UserProfile fields (displayName, bio, etc.)
}
```

**Why full tag data instead of just spaceId?** Recipients may not be members of the Space that owns the tag. By embedding the full tag (letters, url, backgroundColor), any user can render the tag without needing access to the source Space.

**Migration**: Increment `DB_VERSION` and add migration logic for existing data (no data transformation needed, field is optional).

### UpdateProfileMessage Payload (`src/api/quorumApi.ts`)

Broadcast the **full tag data** (not just spaceId) so recipients can render it:

```typescript
// Tag data sent in profile broadcasts
export type BroadcastSpaceTag = SpaceTag & {
  spaceId: string;  // Reference to source Space (for user's own validation)
};

export type UpdateProfileMessage = {
  // ... existing fields (displayName, bio, avatar, etc.)
  spaceTag?: BroadcastSpaceTag;  // NEW: Full tag data for rendering
};
```

**Trade-off**: If the Space owner changes the tag design, users with that tag selected must re-broadcast their profile for others to see the update. This is acceptable for v1 - the slight staleness is a minor UX issue.

---

## Design Specifications

### Visual Design

**Tag Shape**: Pill-shaped badge with circular image + text

```
┌─────────────────────────────────────┐
│  [○ Image] GAME                     │  ← Pill shape
│     ↑         ↑                     │
│  Circular   4-letter code           │
│  (cropped)  on colored background   │
└─────────────────────────────────────┘
```

**Sizes**:
| Size | Image | Font | Use Case |
|------|-------|------|----------|
| `sm` | 16px | 8px | Messages (next to username) |
| `md` | 24px | 10px | Settings preview, dropdowns |
| `lg` | 32px | 12px | Space Settings editor |

**Colors**:
- Background color uses the same `IconColor` palette from IconPicker
- Available colors: `default`, `blue`, `purple`, `fuchsia`, `green`, `orange`, `yellow`, `red`
- Text color: white
- Use `FOLDER_COLORS` hex values for dimmed background (consistent with folder icons)
- Default background: `default` color if not set

### Image Upload (Space Owner)

Follow existing emoji upload pattern from `src/components/modals/SpaceSettingsModal/Emojis.tsx`:
- **Formats**: PNG, JPG, GIF
- **Max size**: 5MB (automatically compressed/optimized)
- **Aspect ratio**: 1:1 recommended (will be cropped to circle)
- **Dropzone UI**: Similar to emoji upload button

### 4-Letter Code Validation

Add validation function to `src/utils/validation.ts`:

```typescript
/**
 * Validates Space Tag letters (4 uppercase alphanumeric characters)
 * @param letters - The letters to validate
 * @returns true if valid, false otherwise
 */
export const validateSpaceTagLetters = (letters: string): boolean => {
  // Must be exactly 4 characters
  if (letters.length !== 4) return false;
  // Only uppercase letters and numbers allowed
  return /^[A-Z0-9]{4}$/.test(letters);
};

export const SPACE_TAG_LETTERS_LENGTH = 4;
```

**Validation Rules**:
- Exactly 4 characters
- Uppercase letters (A-Z) and numbers (0-9) only
- No XSS risk (alphanumeric only, no HTML patterns)
- Auto-uppercase on input

### Color Selection (IconPicker Pattern)

Use the same color swatch system from `IconPicker` instead of a ColorPicker:
- Import `FOLDER_COLORS`, `getFolderColorHex`, `IconColor` from `IconPicker/types`
- Display color swatches using `ColorSwatch` primitive
- Show preview with selected color as background + white text
- No need for external color picker library

**Implementation Example:**

```tsx
import { FOLDER_COLORS, getFolderColorHex, IconColor } from '../space/IconPicker/types';
import { ColorSwatch, FlexRow } from '../primitives';

// In SpaceSettingsModal tag config section
const [selectedColor, setSelectedColor] = useState<IconColor>('default');

<FlexRow gap={3}>
  {FOLDER_COLORS.map((colorOption) => (
    <ColorSwatch
      key={colorOption.value}
      color={colorOption.value === 'default' ? 'gray' : colorOption.value}
      isActive={selectedColor === colorOption.value}
      onPress={() => setSelectedColor(colorOption.value)}
      size="small"
      showCheckmark={false}
      style={colorOption.value === 'default' ? { backgroundColor: colorOption.hex } : undefined}
    />
  ))}
</FlexRow>

// Preview with selected color
<div style={{ backgroundColor: getFolderColorHex(selectedColor, isDarkTheme) }}>
  <span style={{ color: '#ffffff' }}>{letters}</span>
</div>
```

### User Settings Selector

Use existing `Select` primitive (NOT custom SpaceTagSelector from old branch):
- Dropdown with Space name + tag preview
- "None" option to clear selection
- Filter to only show eligible Spaces

### Internationalization (i18n)

All user-facing strings must use `<Trans>` from `@lingui/react/macro`:

```tsx
import { Trans } from '@lingui/react/macro';

// Labels
<Trans>Space Tag</Trans>
<Trans>None</Trans>
<Trans>4-letter code</Trans>

// Validation errors
<Trans>Code must be exactly 4 characters</Trans>
<Trans>Only letters and numbers allowed</Trans>
```

---

## Data Flow

How spaceTag flows from user selection to message display:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. USER SAVES SELECTION                                                │
│     UserSettingsModal → useUserSettings.saveChanges()                   │
│     Stores spaceTagId in UserConfig (synced across devices)             │
│     Fetches full tag data from selected Space                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  2. PROFILE UPDATE BROADCAST                                            │
│     When config saved, send `update-profile` message to all Spaces      │
│     Include FULL spaceTag data: { spaceId, letters, url, bgColor }      │
│     File: src/services/MessageService.ts (update-profile handler)       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  3. OTHER USERS RECEIVE UPDATE                                          │
│     MessageService processes incoming update-profile                    │
│     Updates space_members table with sender's full spaceTag data        │
│     Recipients can render tag WITHOUT being members of source Space     │
│     File: src/db/messages.ts (space_members schema)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  4. MESSAGE RENDERING                                                   │
│     useChannelData.ts → members object includes full spaceTag           │
│     mapSenderToUser() returns { ...sender, spaceTag }                   │
│     Message.tsx receives sender.spaceTag via props                      │
│     Renders <SpaceTag tag={sender.spaceTag} /> using embedded data      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key insight**: We broadcast the full tag data (not just spaceId) because recipients may not have access to the source Space. This allows anyone to render another user's tag.

**Key files in the flow:**
- `src/hooks/business/user/useUserSettings.ts` - Save spaceTagId to config, fetch tag data
- `src/services/MessageService.ts` - Broadcast profile update with full tag, handle incoming updates
- `src/hooks/business/channels/useChannelData.ts` - Include spaceTag in members
- `src/hooks/business/channels/useChannelMessages.ts` - mapSenderToUser includes spaceTag
- `src/components/message/Message.tsx` - Render the tag

---

## Implementation

### Phase 1: Data Model & Types

- [x] **Add SpaceTag types** (`src/api/quorumApi.ts`)
    - `SpaceTag` and `BroadcastSpaceTag` types exported
    - `Space.spaceTag?: SpaceTag` field added
    - `UpdateProfileMessage.spaceTag?: BroadcastSpaceTag` added

- [x] **Update database schema** (`src/db/messages.ts`)
    - `spaceTag?: BroadcastSpaceTag` added to `space_members` store
    - `DB_VERSION` incremented 7 → 8, no-op migration (field is optional)

- [x] **Update useUserSettings hook** (`src/hooks/business/user/useUserSettings.ts`)
    - `spaceTagId` loaded from config and saved on `saveChanges()`
    - Resolves `spaceTagId` → full `BroadcastSpaceTag` at save time for broadcast

### Phase 2: Space Owner Configuration (requires Phase 1)

- [x] **Add SpaceTag validation** (`src/utils/validation.ts`)
    - `validateSpaceTagLetters()` and `SPACE_TAG_LETTERS_LENGTH = 4` exported

- [x] **Create SpaceTag component** (`src/components/space/SpaceTag/SpaceTag.tsx`)
    - Pill-shaped `React.memo` component, sizes sm/md/lg
    - `onError` fallback to letters-only when image fails to load

- [x] **Add SpaceTag styles** (`src/components/space/SpaceTag/SpaceTag.scss`)
    - Pill shape with all three size variants (sm: 20px, md: 24px, lg: 32px)

- [x] **Add SpaceTag color constants** (`src/components/space/IconPicker/types.ts`)
    - `SPACE_TAG_COLORS_LIGHT` and `SPACE_TAG_COLORS_DARK` palettes added
    - `getSpaceTagColorHex(color, isDarkTheme)` helper exported

- [x] **Add tag config to SpaceSettingsModal** (`src/components/modals/SpaceSettingsModal/`)
    - `SpaceTagSettings.tsx` created; `useSpaceTag` hook manages editor state
    - "Space Tag" tab added to `Navigation.tsx`; integrated into `SpaceSettingsModal.tsx`
    - Image upload via react-dropzone + `processEmojiImage()`, 5MB limit
    - Auto-uppercase letters input, `ColorSwatch` color picker, live preview (all 3 sizes)

### Phase 3: User Settings Integration (requires Phase 2)

- [x] **Add Space Tag selector to UserSettingsModal** (`src/components/modals/UserSettingsModal/General.tsx`)
    - Dropdown using `Select` primitive; filters to public spaces with tag + user is member
    - "None" option clears selection

- [x] **Persist spaceTagId in config** (`src/hooks/business/user/useUserSettings.ts`)
    - `spaceTagId` saved to `UserConfig` via `actionQueueService` (deduped, non-blocking)

### Phase 4: Message Display (requires Phase 3)

- [x] **Display tag in Message component** (`src/components/message/Message.tsx`)
    - Done when: Tag appears next to sender's display name
    - Location: After `displayName` in message header
    - Implemented at lines 735 and 814 (desktop + mobile):
      `{sender.spaceTag && <SpaceTag tag={sender.spaceTag} size="sm" className="ml-1.5" />}`

- [x] **Pass spaceTag through sender mapping**
    - Done: `useChannelData.ts` members map includes `spaceTag` from `space_members` DB record
    - `mapSenderToUser` in Channel/DirectMessage spreads the full member object including `spaceTag`

- [x] **Auto-clear tag when leaving space — re-broadcast**
    - ✅ `useSpaceLeaving.ts` clears `spaceTagId` from config on leave
    - ✅ `updateUserProfile` called with `spaceTag: undefined` after clearing — other users stop seeing the tag
    - Location: `src/hooks/business/spaces/useSpaceLeaving.ts` `leaveSpace()` callback

- [x] **Auto-refresh stale tag on app startup**
    - ✅ `useSpaceTagStartupRefresh` hook created at `src/hooks/business/spaces/useSpaceTagStartupRefresh.ts`
    - ✅ Integrated into `NavMenuContent` in `src/components/navbar/NavMenu.tsx`
    - ✅ `UserConfig.lastBroadcastSpaceTag` field added to `src/db/messages.ts` to track last broadcast snapshot
    - Runs once per session (guarded by `hasRun = useRef(false)`)
    - Only runs if user has `spaceTagId` set in config
    - Compares `lastBroadcastSpaceTag` (stored in config) against current space tag — pure in-memory, no network call
    - Handles: Space owner changed tag design → re-broadcasts with fresh data, saves new snapshot
    - Handles: Space owner deleted tag → clears `spaceTagId` and re-broadcasts with `spaceTag: undefined`
    - Error-resilient: failures are logged and retried on next startup without user impact

---

## Verification

:white_check_mark: **Space owner can configure tag**
    - Test: Go to Space Settings (public space) → See "Space Tag" section
    - Test: Upload image + enter 4-letter code → Save → Tag appears in settings

:white_check_mark: **User can select tag in settings**
    - Test: Go to User Settings → General → See "Space Tag" dropdown
    - Test: Select a space → Save → Selection persists after refresh

:white_check_mark: **Tag displays in messages**
    - Test: Send message in any channel → Tag appears next to your name
    - Test: Other users see your tag next to your messages

:white_check_mark: **Only public spaces with tags appear**
    - Test: Private space user is member of → NOT in dropdown
    - Test: Public space without tag defined → NOT in dropdown

:white_check_mark: **Tag auto-clears when leaving space**
    - Test: Select a tag from Space A → Leave Space A → Tag is cleared from your config ✅
    - Test: Other users no longer see your tag after you leave ✅ (re-broadcast implemented)

:white_check_mark: **Tag auto-refreshes on app startup**
    - Test: User A selects tag → Space owner changes tag design → User A restarts app → Tag updates automatically
    - Test: Space owner deletes tag → User restarts app → Tag is cleared
    - Test: If tag unchanged, no profile broadcast occurs (check network)

:white_check_mark: **TypeScript compiles**
    - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

---

## Edge Cases

Since we embed full tag data in the profile broadcast, most edge cases are handled at **selection time** (User Settings) rather than **render time** (Message display).

| Scenario | Expected Behavior | Handler Location | Implementation |
|----------|-------------------|------------------|----------------|
| Space tag deleted by owner | User's tag auto-cleared on next app startup | App startup hook | `checkAndRefreshSpaceTag()` detects missing tag, clears selection |
| User leaves space | Tag auto-cleared, profile re-broadcast | `leaveSpace` handler | If `spaceTagId === leavingSpaceId`, clear tag and broadcast |
| User selects tag from space they're not member of | Prevented at selection time | `UserSettingsModal` | Dropdown filters by membership |
| No tag data in sender profile | No tag shown | `Message.tsx` | `{sender.spaceTag && <SpaceTag ... />}` |
| Tag owner changes tag design | User's tag auto-updates on next app startup | App startup hook | `checkAndRefreshSpaceTag()` compares and re-broadcasts if different |
| Sender's inbox key rotated since receiver last saw them | Tag still delivered correctly | `MessageService.ts` saveMessage handler | Inbox mismatch guard removed for `update-profile` — key rotation is announced via this message type, signature already verified upstream |

**SpaceTag Component (simple - receives full data):**

```tsx
// In SpaceTag.tsx - receives embedded tag data, no fetching
// MUST be memoized - renders on every message in the list
type SpaceTagProps = {
  tag: BroadcastSpaceTag;
  size: 'sm' | 'md' | 'lg';
};

export const SpaceTag = React.memo<SpaceTagProps>(({ tag, size }) => {
  if (!tag?.letters) return null;
  const [imageError, setImageError] = useState(false);

  const bgColor = getFolderColorHex(tag.backgroundColor, isDarkTheme);

  return (
    <div className={`space-tag space-tag--${size}`} style={{ backgroundColor: bgColor }}>
      {tag.url && !imageError && (
        <img
          src={tag.url}
          className="space-tag__image"
          alt=""
          onError={() => setImageError(true)}
        />
      )}
      <span className="space-tag__letters">{tag.letters}</span>
    </div>
  );
});

SpaceTag.displayName = 'SpaceTag';
```

**Note**: Image URLs are always safe base64 data URIs produced by the upload pipeline (canvas re-encoding via compressorjs). When an image fails to load, the component gracefully falls back to showing only the letters on the colored background — no broken image icon.

**User Settings Validation (filters at selection time):**

```tsx
// In UserSettingsModal - filter eligible spaces
const eligibleSpaces = spaces.filter(space =>
  space.isPublic &&                    // Only public spaces
  space.spaceTag?.letters &&           // Has tag defined
  isMember(space, currentUser)         // User is a member
);
```

---

## Code to Port from `origin/feat/space-tags`

### 1. ~~ColorPicker.tsx~~ (NOT NEEDED)

~~Port from: `origin/feat/space-tags:src/components/ColorPicker.tsx`~~

**Instead**: Use the existing `ColorSwatch` primitive with `FOLDER_COLORS` from `IconPicker/types.ts`. This keeps the color palette consistent across the app (folders, channel icons, space tags).

### 2. SpaceTag.tsx (redesign)

The old branch has a basic circular badge. We need a **pill-shaped** design:
- **Don't port** the fetching logic - component now receives full tag data as props
- Port the size classes concept
- Redesign the visual to match Design Specifications
- Use `IconColor` type and `getFolderColorHex()` for background colors

### 3. SpaceEditor.tsx changes (adapt to SpaceSettingsModal)

The old branch modifies `SpaceEditor.tsx`. We should add to `SpaceSettingsModal/` instead:
- Port the dropzone pattern
- Port the 4-letter input
- Add color swatch row using `ColorSwatch` + `FOLDER_COLORS`
- Follow `Emojis.tsx` pattern for image upload/compression

### 4. SpaceTagSelector.tsx (DO NOT PORT)

The old branch has a custom dropdown. Instead:
- Use our existing `Select` primitive
- Simpler, consistent with rest of app

### 5. Message.tsx changes (minimal)

```bash
git diff origin/develop...origin/feat/space-tags -- src/components/message/Message.tsx
```

Just the tag display next to sender name.

---

## Future Enhancements

### Space Profile Modal on Tag Hover/Click (Requires Public Directory)


**Concept**: Allow users to hover or click on a space tag to view a modal with the full space profile (avatar, name, description, member count) and a "Join" button.

**Current Limitation**:
- Space tags only contain minimal data (`spaceId`, `letters`, `url`, `backgroundColor`)
- Full space metadata (name, description, icon) is NOT embedded in tags
- Recipients may not be members of the tagged space, so no local data available
- Quorum's decentralized architecture means there's no way to look up arbitrary space metadata without a coordination service

**Implementation Approach** (after directory is available):
1. User hovers/clicks on space tag → Extract `spaceId` from tag data
2. Query directory API: `GET /api/spaces/{spaceId}/info` (or similar endpoint)
3. Fetch space metadata: name, description, iconUrl, memberCount, ratings
4. Display modal with space profile information
5. Add "Join" button that uses directory invite flow (`GET /api/spaces/{spaceId}/directory-invite`)

**Dependencies**:
- [ ] Public Space Directory API must be implemented (see [public-space-directory.md](./public-space-directory.md))
- [ ] Directory must expose a "get space info by ID" endpoint
- [ ] Space must be publicly listed in directory (private spaces would show limited info or error)

**Alternative** (limited scope - could implement now):
- Only show modal for spaces the user is already a member of
- Check local space database by `spaceId`
- If user is member: Show modal with local space data
- If not member: Show tooltip with "Unknown Space" or just the tag letters
- **Downside**: Inconsistent UX, doesn't enable discovery of new spaces

**Recommendation**: Wait for Public Space Directory implementation for consistent, complete UX.

---

## quorum-shared Integration (Required for Mobile + Cross-Device Sync)

**Current approach: Option B — implement desktop first, update quorum-shared later.**

The desktop implementation is complete as a standalone feature. However, full cross-platform parity (mobile showing tags, cross-device config sync) requires a follow-up update to `quorum-shared` and `quorum-mobile`.

### Why quorum-shared needs updating

Three sync paths are affected:

| Sync path | Used for | Current gap |
|-----------|----------|-------------|
| `update-profile` E2E message | Sending your tag to other users in a space | `UpdateProfileMessage` in quorum-shared has no `spaceTag` field — mobile ignores it |
| Member sync (`MemberDelta`) | Syncing `space_members` records between your own devices | `SpaceMember` and `MemberDigest` don't know about `spaceTag` — sync won't detect tag changes |
| Config sync (`UserConfig`) | Syncing `spaceTagId` preference across your own devices | `UserConfig` in quorum-shared has no `spaceTagId` field — preference doesn't sync to phone |

### Changes needed in `quorum-shared`

**New types to add:**
```typescript
// In types/space.ts (or equivalent)
export type SpaceTag = {
  letters: string;            // Exactly 4 uppercase alphanumeric (e.g., "GAME", "DEV1")
  url: string;                // Tag image as data: URI
  backgroundColor: IconColor; // From the standard color palette
};

export type BroadcastSpaceTag = SpaceTag & {
  spaceId: string;            // Source space reference
};
```

**Types to update:**
```typescript
// Space — add spaceTag field
type Space = {
  // ...existing fields...
  spaceTag?: SpaceTag;
};

// UpdateProfileMessage — add spaceTag field
type UpdateProfileMessage = {
  // ...existing fields...
  spaceTag?: BroadcastSpaceTag;
};

// SpaceMember — add spaceTag field
type SpaceMember = UserProfile & {
  inbox_address: string;
  isKicked?: boolean;
  spaceTag?: BroadcastSpaceTag; // NEW
};

// UserConfig — add spaceTagId field
type UserConfig = {
  // ...existing fields...
  spaceTagId?: string; // spaceId of the Space whose tag to display
};
```

**`computeMemberHash` / `MemberDigest` — include spaceTag in change detection:**

The current `MemberDigest` only hashes `display_name` and `user_icon`. It needs to also hash `spaceTag` so the sync protocol detects when a user's tag changes and pushes the updated member to other devices.

```typescript
// Current MemberDigest
interface MemberDigest {
  address: string;
  inboxAddress: string;
  displayNameHash: string;
  iconHash: string;
  // NEW:
  spaceTagHash: string;  // SHA-256 hash of JSON.stringify(spaceTag) or '' if none
}

// computeMemberHash needs to compute spaceTagHash
function computeMemberHash(member: SpaceMember): { displayNameHash, iconHash, spaceTagHash }
```

### Changes needed back in this repo (after quorum-shared update)

Minimal — just type import swaps:

1. **`src/api/quorumApi.ts`** — Remove local `SpaceTag` and `BroadcastSpaceTag` definitions, import from `@quilibrium/quorum-shared`
2. **`src/db/messages.ts`** — Update `BroadcastSpaceTag` import source
3. **`src/adapters/indexedDbAdapter.ts`** — TypeScript cast for `SpaceMember` with `spaceTag` may need updating

All feature logic (components, hooks, MessageService, UI) is unchanged.

### Mobile implementation

Once quorum-shared is updated, `quorum-mobile` needs to implement the display side:
- Render `SpaceTag` component next to sender name in messages
- Show `SpaceTag` selector in user settings
- Space settings: allow owner to configure tag (if public space)
- Handle `spaceTag` in incoming `update-profile` messages

---

## Definition of Done

- [ ] All Phase 1-4 checkboxes complete
- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] All verification tests pass
- [ ] Edge cases P0-P1 handled
- [ ] No console errors or warnings
- [ ] All user-facing strings wrapped in `<Trans>` from `@lingui/react/macro`
- [ ] Performance verified: Message list scroll smooth with 100+ messages containing tags
- [x] SpaceTag component MUST be memoized with `React.memo` (tags render on every message)
- [x] SpaceTag `<img>` has `onError` handler with graceful fallback (letters-only display)
- [ ] All async operations in auto-refresh and auto-clear wrapped in try/catch with logger.error

---

## Implementation Notes

### Post-Implementation Bug Fix: Tags Not Visible to Recipients (2026-02-18)

After completing all phases, testing revealed that senders saw their own space tag but recipients did not. Debugging traced three bugs in `src/services/MessageService.ts`, all in the `update-profile` message receive path:

**Bug 1 — Wrong spaceId source in `saveMessage` handler (~line 634)**

Both `update-profile` handlers (the standalone `saveMessage` function and the class method handler) used `decryptedContent.spaceId` to look up and save the space member. But `decryptedContent.spaceId` is not reliably populated on the decrypted content object when arriving via the plaintext envelope path. The `spaceId` parameter passed into `saveMessage` is the authoritative value from `conversationId.split('/')[0]`.

Fix: Changed `messageDB.getSpaceMember(decryptedContent.spaceId, ...)` → `messageDB.getSpaceMember(spaceId, ...)` and same for `saveSpaceMember`. Applied to both handler instances.

**Bug 2 — Hardcoded `'post'` in non-repudiability message ID verification (~line 2416)**

The outer non-repudiability check computed the expected message ID using:
```
nonce + 'post' + senderId + canonicalize(content)
```
…for **all** message types. But `update-profile` messages are signed on the send side with:
```
nonce + 'update-profile' + senderId + canonicalize(content)
```
This caused a guaranteed `messageIdMismatch`, which cleared `publicKey` and `signature` from `decryptedContent`. The subsequent guard `!publicKey || !signature` then dropped the message silently.

Fix: Changed hardcoded `'post'` → `decryptedContent.content.type` so the hash uses the actual message type.

**Bug 3 — Inbox address mismatch guard blocking key-rotated senders (~line 667)**

After the sender's inbox key had rotated, the receiver had a stale inbox address stored for that user. The inbox mismatch guard rejected all subsequent `update-profile` messages permanently — meaning the sender's display name and tag could never be updated on the receiver again after any key rotation.

`update-profile` is itself the mechanism for announcing a new inbox key. Since signature verification already happened in the outer non-repudiability block, rejecting based on inbox mismatch is both redundant and incorrect for this message type.

Fix: Removed the inbox mismatch `return` guard from both `update-profile` handlers. The `inboxAddress` derived from `publicKey` is still written to `participant.inbox_address`, correctly updating the stale value.

---

## Updates

**2025-12-30 - Claude**: Initial task creation from `feat/space-tags` branch analysis
**2025-12-30 - Claude**: Added data flow specification, confirmed global tag selection (matching Discord)
**2025-12-30 - Claude**: Added Design Specifications (pill shape, ColorPicker, validation, image upload patterns)
**2026-01-08 - Claude**: Replaced ColorPicker with IconPicker color system (use `FOLDER_COLORS` + `ColorSwatch` primitive instead of `@uiw/react-color-sketch`)
**2026-01-08 - Claude**: Added feature-analyzer recommendations: DB schema spec, UpdateProfileMessage payload, ColorSwatch code example, expanded edge cases with handler locations, i18n section, performance verification in DoD
**2026-01-08 - Claude**: Changed to embed full tag data in profile broadcast (Option A) - recipients don't need access to source Space to render tags
**2026-01-08 - Claude**: Added auto-clear tag when user leaves space (better UX than manual clearing)
**2026-01-08 - Claude**: Removed "Space becomes private" edge case - `isPublic` is set at creation and cannot be changed
**2026-01-08 - Claude**: Made SpaceTag memoization mandatory (renders on every message)
**2026-01-08 - Claude**: Added auto-refresh stale tag on app startup - compares last broadcast with current Space tag, re-broadcasts only if different
**2026-01-09 - Claude**: Added "Future Enhancements" section for space profile modal on tag hover/click - deferred until Public Space Directory is implemented due to decentralization constraints
**2026-02-16 - Claude**: Expert panel review (arch 7/10, impl 7.5/10, pragmatism 6/10). Applied accepted recommendations: added `onError` handler on `<img>` with graceful fallback to letters-only display, wrapped all async operations in auto-refresh and auto-clear with try/catch + logger.error for error resilience. Auto-refresh on startup kept as-is (confirmed: must be fully automatic, no user action required). Image URL sanitization was initially added but removed after codebase analysis confirmed all image uploads go through canvas re-encoding (compressorjs), producing safe base64 data URIs — no raw user URLs reach `<img src>`.
**2026-02-18 - Claude**: Implementation started (Phase 1 complete). Discovered that full cross-platform sync requires quorum-shared updates. Decision: proceed with Option B — implement desktop fully now, update quorum-shared later. Added "quorum-shared Integration" section documenting all required changes to quorum-shared and what minimal changes this repo will need when that happens. Phase 1 done: `SpaceTag`/`BroadcastSpaceTag` types added to `quorumApi.ts`, `spaceTag` added to `Space` and `UpdateProfileMessage`, `spaceTagId` added to `UserConfig`, `spaceTag` added to `space_members` DB schema (DB_VERSION 7→8), `validateSpaceTagLetters` added to `validation.ts`.
**2026-02-18 - Claude**: All phases complete. Post-implementation debug session found and fixed three bugs in `src/services/MessageService.ts` that prevented recipients from seeing space tags: (1) `decryptedContent.spaceId` used instead of `spaceId` parameter in both `update-profile` handlers causing `getSpaceMember` to fail; (2) hardcoded `'post'` in non-repudiability message ID hash caused guaranteed mismatch for `update-profile`, silently clearing `publicKey`/`signature` and dropping the message; (3) inbox address mismatch guard permanently blocked profile updates after any inbox key rotation — removed for `update-profile` since this message type is itself the key rotation announcement and signature is already verified upstream. Feature now confirmed working end-to-end.
**2026-02-18 - Claude**: Task re-opened after documentation review revealed two Phase 4 items were never implemented: (1) re-broadcast `update-profile` with `spaceTag: undefined` when user leaves a space — config is cleared but other users still see the stale tag; (2) auto-refresh stale tag on app startup — `checkAndRefreshSpaceTag()` was never implemented, meaning users must manually re-save settings for their tag to reflect owner changes or deletions. Status changed back to `in-progress`.
**2026-02-18 - Claude**: Implemented both remaining items. (1) `useSpaceLeaving.ts`: added `updateUserProfile` call with `spaceTag: undefined` after clearing config — other users now stop seeing the tag immediately on leave. (2) Created `useSpaceTagStartupRefresh.ts` — one-shot hook (guarded by `hasRun = useRef(false)`) integrated into `NavMenuContent`; compares `config.lastBroadcastSpaceTag` snapshot against current space tag; re-broadcasts only if letters/url/backgroundColor changed; clears tag if space no longer has one. Added `lastBroadcastSpaceTag` field to `UserConfig` in `db/messages.ts`. Task status set to `done`.

---

*Last Updated: 2026-02-18*
