# Space Tags

> **:warning: AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: High
**Created**: 2025-12-30
**Reference**: [GitHub Issue #14](https://github.com/QuilibriumNetwork/quorum-desktop/issues/14), [PR #15](https://github.com/QuilibriumNetwork/quorum-desktop/pull/15)
**Prior Art**: `origin/feat/space-tags` branch (incomplete implementation)

**Files**:
- `src/api/quorumApi.ts:28-47` (Space type - add SpaceTag)
- `src/components/space/SpaceTag.tsx` (new)
- `src/components/space/SpaceTag.scss` (new)
- `src/components/modals/UserSettingsModal/General.tsx` (add Space Tag selector)
- `src/components/message/Message.tsx` (display tag next to username)
- `src/components/modals/SpaceEditorSettings/General.tsx` (Space owner configures tag)
- `src/hooks/business/useUserSettings.ts` (add spaceTagId to config)

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
export type SpaceTag = {
  letters: string;      // Exactly 4 uppercase letters/numbers (e.g., "GAME", "DEV1")
  url: string;          // Tag image URL (data: URI or hosted URL)
  backgroundColor: string;  // Hex color for pill background (e.g., "#7C3AED")
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
- Background color is customizable by Space owner (via ColorPicker)
- Text color: white (or auto-contrast based on background)
- Default background: `var(--primary)` if not set

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

### ColorPicker Integration

Port `ColorPicker.tsx` from old branch (uses `@uiw/react-color-sketch`):
- Show in Space Settings when configuring tag
- Preset colors for quick selection
- Alpha disabled (solid colors only)

### User Settings Selector

Use existing `Select` primitive (NOT custom SpaceTagSelector from old branch):
- Dropdown with Space name + tag preview
- "None" option to clear selection
- Filter to only show eligible Spaces

---

## Data Flow

How `spaceTagId` flows from user selection to message display:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. USER SAVES SELECTION                                                │
│     UserSettingsModal → useUserSettings.saveChanges()                   │
│     Stores spaceTagId in UserConfig (synced across devices)             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  2. PROFILE UPDATE BROADCAST                                            │
│     When config saved, send `update-profile` message to all Spaces      │
│     Include spaceTagId in profile payload                               │
│     File: src/services/MessageService.ts (update-profile handler)       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  3. OTHER USERS RECEIVE UPDATE                                          │
│     MessageService processes incoming update-profile                    │
│     Updates space_members table with sender's spaceTagId                │
│     File: src/db/messages.ts (space_members schema)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  4. MESSAGE RENDERING                                                   │
│     useChannelData.ts → members object includes spaceTagId              │
│     mapSenderToUser() returns { ...sender, spaceTagId }                 │
│     Message.tsx receives sender.spaceTagId via props                    │
│     Renders <SpaceTag spaceId={sender.spaceTagId} />                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key files in the flow:**
- `src/hooks/business/user/useUserSettings.ts` - Save spaceTagId to config
- `src/services/MessageService.ts` - Broadcast profile update, handle incoming updates
- `src/hooks/business/channels/useChannelData.ts` - Include spaceTagId in members
- `src/hooks/business/channels/useChannelMessages.ts` - mapSenderToUser includes spaceTagId
- `src/components/message/Message.tsx` - Render the tag

---

## Implementation

### Phase 1: Data Model & Types

- [ ] **Add SpaceTag type** (`src/api/quorumApi.ts:27`)
    - Done when: `SpaceTag` type exported and `Space.spaceTag` field added
    - Reference: Follow existing `Emoji` type pattern at line 16-20

- [ ] **Update useUserSettings hook** (`src/hooks/business/useUserSettings.ts`)
    - Done when: `spaceTagId` is saved/loaded from config
    - Reference: Follow `allowSync` / `nonRepudiable` pattern for boolean config fields

### Phase 2: Space Owner Configuration (requires Phase 1)

- [ ] **Add SpaceTag validation** (`src/utils/validation.ts`)
    - Done when: `validateSpaceTagLetters()` and `SPACE_TAG_LETTERS_LENGTH` exported
    - See: Design Specifications → 4-Letter Code Validation

- [ ] **Create SpaceTag component** (`src/components/space/SpaceTag.tsx`)
    - Done when: Renders pill-shaped tag with circular image + letters
    - Design: See Design Specifications → Visual Design
    - Props: `spaceId`, `size` ('sm' | 'md' | 'lg')
    - Fallback: Show letters on colored background if no image

- [ ] **Add SpaceTag styles** (`src/components/space/SpaceTag.scss`)
    - Done when: Pill shape with sizes (sm/md/lg) renders correctly
    - Reference: See Design Specifications → Sizes table

- [ ] **Port ColorPicker component** (`src/components/ui/ColorPicker.tsx`)
    - Done when: Color picker renders with preset colors
    - Port from: `origin/feat/space-tags:src/components/ColorPicker.tsx`
    - Dependency: `@uiw/react-color-sketch` (check if already installed)

- [ ] **Add tag config to SpaceSettingsModal** (`src/components/modals/SpaceSettingsModal/`)
    - Done when: Owner can upload image, set 4-letter code, pick background color
    - Condition: Only show when `space?.isPublic === true`
    - Image upload: Follow `Emojis.tsx` pattern (dropzone, compression, 5MB limit)
    - Validation: Use `validateSpaceTagLetters()` with auto-uppercase
    - Includes: Image dropzone, letters input, ColorPicker

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
    {sender.spaceTagId && <SpaceTag spaceId={sender.spaceTagId} size="sm" />}
    ```

- [ ] **Pass spaceTagId through sender mapping**
    - Done when: `mapSenderToUser` includes `spaceTagId` in returned user object
    - Files: Check `Channel.tsx`, `DirectMessage.tsx` where `mapSenderToUser` is defined

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

:white_check_mark: **TypeScript compiles**
    - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority |
|----------|-------------------|--------|----------|
| Space tag deleted by owner | User's tag disappears, config cleared | :hammer_and_wrench: Needs handling | P1 |
| User leaves space | Tag no longer displays | :hammer_and_wrench: Needs handling | P1 |
| Space becomes private | Tag hidden, remains in config | :hammer_and_wrench: Needs handling | P1 |
| User not member of selected space | Graceful fallback, no tag shown | :hammer_and_wrench: Needs handling | P0 |

---

## Code to Port from `origin/feat/space-tags`

### 1. ColorPicker.tsx (port as-is)

```bash
git show origin/feat/space-tags:src/components/ColorPicker.tsx
```

Move to `src/components/ui/ColorPicker.tsx`. Uses `@uiw/react-color-sketch`.

### 2. SpaceTag.tsx (redesign)

The old branch has a basic circular badge. We need a **pill-shaped** design:
- Port the logic (fetching space data, size classes)
- Redesign the visual to match Design Specifications
- Add `backgroundColor` support

### 3. SpaceEditor.tsx changes (adapt to SpaceSettingsModal)

The old branch modifies `SpaceEditor.tsx`. We should add to `SpaceSettingsModal/` instead:
- Port the dropzone pattern
- Port the 4-letter input
- Add ColorPicker integration
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
- [ ] Tested on desktop and mobile viewports

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2025-12-30 - Claude**: Initial task creation from `feat/space-tags` branch analysis
**2025-12-30 - Claude**: Added data flow specification, confirmed global tag selection (matching Discord)
**2025-12-30 - Claude**: Added Design Specifications (pill shape, ColorPicker, validation, image upload patterns)

---

*Last Updated: 2025-12-30*
