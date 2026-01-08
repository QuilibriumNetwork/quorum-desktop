# Space Tags

> **:warning: AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: High
**Created**: 2025-12-30
**Reference**: [GitHub Issue #14](https://github.com/QuilibriumNetwork/quorum-desktop/issues/14), [PR #15](https://github.com/QuilibriumNetwork/quorum-desktop/pull/15)
**Prior Art**: `origin/feat/space-tags` branch (incomplete implementation)

**Files**:
- `src/api/quorumApi.ts` (SpaceTag type, Space.spaceTag field, UpdateProfileMessage.spaceTagId)
- `src/db/messages.ts` (space_members schema + DB_VERSION increment)
- `src/components/space/SpaceTag.tsx` (new)
- `src/components/space/SpaceTag.scss` (new)
- `src/components/modals/UserSettingsModal/General.tsx` (add Space Tag selector)
- `src/components/message/Message.tsx` (display tag next to username)
- `src/components/modals/SpaceSettingsModal/` (Space owner configures tag)
- `src/hooks/business/user/useUserSettings.ts` (add spaceTagId to config)
- `src/services/MessageService.ts` (update-profile handler)
- `src/utils/validation.ts` (validateSpaceTagLetters)

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

- [ ] **Add SpaceTag types** (`src/api/quorumApi.ts`)
    - Done when: `SpaceTag` type exported and `Space.spaceTag` field added
    - Done when: `BroadcastSpaceTag` type exported (SpaceTag + spaceId)
    - Done when: `UpdateProfileMessage` includes `spaceTag?: BroadcastSpaceTag`
    - Reference: Follow existing `Emoji` type pattern

- [ ] **Update database schema** (`src/db/messages.ts`)
    - Done when: `space_members` store includes `spaceTag?: BroadcastSpaceTag`
    - Done when: `DB_VERSION` incremented (7 → 8)
    - Done when: Migration handles existing data (no-op, field is optional)

- [ ] **Update useUserSettings hook** (`src/hooks/business/user/useUserSettings.ts`)
    - Done when: `spaceTagId` is saved/loaded from config (user's selection)
    - Done when: Hook can fetch full tag data from selected Space for broadcasting
    - Reference: Follow `allowSync` / `nonRepudiable` pattern for config fields

### Phase 2: Space Owner Configuration (requires Phase 1)

- [ ] **Add SpaceTag validation** (`src/utils/validation.ts`)
    - Done when: `validateSpaceTagLetters()` and `SPACE_TAG_LETTERS_LENGTH` exported
    - See: Design Specifications → 4-Letter Code Validation

- [ ] **Create SpaceTag component** (`src/components/space/SpaceTag.tsx`)
    - Done when: Renders pill-shaped tag with circular image + letters
    - Design: See Design Specifications → Visual Design
    - Props: `tag: BroadcastSpaceTag`, `size` ('sm' | 'md' | 'lg')
    - Component receives full tag data (no fetching needed)
    - Fallback: Show letters on colored background if no image

- [ ] **Add SpaceTag styles** (`src/components/space/SpaceTag.scss`)
    - Done when: Pill shape with sizes (sm/md/lg) renders correctly
    - Reference: See Design Specifications → Sizes table

- [ ] **Add SpaceTag color constants** (`src/components/space/IconPicker/types.ts`)
    - Done when: `SPACE_TAG_COLORS` (or reuse `FOLDER_COLORS`) exported
    - Option A: Reuse existing `FOLDER_COLORS` from IconPicker
    - Option B: Clone and customize if different saturation needed for tags
    - Include helper function `getSpaceTagColorHex()` if creating new set

- [ ] **Add tag config to SpaceSettingsModal** (`src/components/modals/SpaceSettingsModal/`)
    - Done when: Owner can upload image, set 4-letter code, pick background color
    - Condition: Only show when `space?.isPublic === true`
    - Image upload: Follow `Emojis.tsx` pattern (dropzone, compression, 5MB limit)
    - Validation: Use `validateSpaceTagLetters()` with auto-uppercase
    - Color selection: Use `ColorSwatch` primitives with `FOLDER_COLORS` palette
    - Includes: Image dropzone, letters input, color swatches row

### Phase 3: User Settings Integration (requires Phase 2)

- [ ] **Add Space Tag selector to UserSettingsModal** (`src/components/modals/UserSettingsModal/General.tsx`)
    - Done when: Dropdown shows available Space tags user can display
    - Use: Existing `Select` primitive (see Design Specifications → User Settings Selector)
    - Filter: Only show spaces where:
      1. User is a member
      2. Space is public (`isPublic: true`)
      3. Space has a tag defined (`spaceTag?.letters.length === 4`)
    - Include "None" option to clear selection

- [ ] **Persist spaceTagId in config** (`src/hooks/business/useUserSettings.ts`)
    - Done when: Selected tag persists across sessions and syncs to other devices
    - Reference: Follow existing config save pattern

### Phase 4: Message Display (requires Phase 3)

- [ ] **Display tag in Message component** (`src/components/message/Message.tsx`)
    - Done when: Tag appears next to sender's display name
    - Location: After `displayName` in message header
    - Port from: `origin/feat/space-tags` Message.tsx changes

    ```tsx
    // In message header render
    <span className="message-sender-name">{sender.displayName}</span>
    {sender.spaceTag && <SpaceTag tag={sender.spaceTag} size="sm" />}
    ```

- [ ] **Pass spaceTag through sender mapping**
    - Done when: `mapSenderToUser` includes `spaceTag` (full data) in returned user object
    - Files: Check `Channel.tsx`, `DirectMessage.tsx` where `mapSenderToUser` is defined

- [ ] **Auto-clear tag when leaving space**
    - Done when: Leaving a space auto-clears `spaceTagId` if it matches that space
    - Done when: Profile re-broadcast with `spaceTag: undefined` after clearing
    - Location: `leaveSpace` handler (space management hook/service)

    ```typescript
    // When user leaves a space
    const handleLeaveSpace = async (spaceId: string) => {
      // ... existing leave logic ...

      // Clear space tag if it was from this space
      const userConfig = await getUserConfig();
      if (userConfig.spaceTagId === spaceId) {
        await saveUserConfig({ ...userConfig, spaceTagId: undefined });
        await broadcastProfileUpdate({ spaceTag: undefined });
      }
    };
    ```

- [ ] **Auto-refresh stale tag on app startup**
    - Done when: App compares user's last broadcast tag with current Space tag on startup
    - Done when: If tag data differs, auto-broadcast updated profile (no user action needed)
    - Location: App initialization / startup hook
    - Only runs if user has `spaceTagId` set in config
    - Handles: Space owner changed tag design → user's tag auto-updates

    ```typescript
    // On app startup (after spaces loaded)
    const checkAndRefreshSpaceTag = async () => {
      const userConfig = await getUserConfig();
      if (!userConfig.spaceTagId) return; // No tag selected

      const space = await getSpace(userConfig.spaceTagId);
      if (!space?.spaceTag) {
        // Space no longer has a tag - clear user's selection
        await clearSpaceTag();
        return;
      }

      const lastBroadcast = await getLastBroadcastedTag(); // From local storage
      const currentTag = space.spaceTag;

      // Compare tag data (letters, url, backgroundColor)
      if (!tagsEqual(lastBroadcast, currentTag)) {
        // Tag changed - re-broadcast with fresh data
        await broadcastProfileUpdate({ spaceTag: { ...currentTag, spaceId: space.spaceId } });
        await saveLastBroadcastedTag(currentTag);
      }
    };
    ```

    **Why this approach:**
    - Automatic - user never needs to manually refresh
    - Minimal network - only broadcasts when tag actually changed
    - Handles edge case: Space owner deletes tag → user's tag auto-clears

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
    - Test: Select a tag from Space A → Leave Space A → Tag is cleared
    - Test: Other users no longer see your tag after you leave

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

  const bgColor = getFolderColorHex(tag.backgroundColor, isDarkTheme);

  return (
    <div className={`space-tag space-tag--${size}`} style={{ backgroundColor: bgColor }}>
      {tag.url && <img src={tag.url} className="space-tag__image" />}
      <span className="space-tag__letters">{tag.letters}</span>
    </div>
  );
});

SpaceTag.displayName = 'SpaceTag';
```

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

## Definition of Done

- [ ] All Phase 1-4 checkboxes complete
- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] All verification tests pass
- [ ] Edge cases P0-P1 handled
- [ ] No console errors or warnings
- [ ] All user-facing strings wrapped in `<Trans>` from `@lingui/react/macro`
- [ ] Performance verified: Message list scroll smooth with 100+ messages containing tags
- [ ] SpaceTag component MUST be memoized with `React.memo` (tags render on every message)

---

## Implementation Notes

_Updated during implementation_

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

---

*Last Updated: 2026-01-08 20:00*
