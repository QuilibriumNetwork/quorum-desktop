---
type: doc
title: Space Tags
status: done
ai_generated: true
reviewed_by: null
created: 2026-02-18
updated: 2026-02-18
related_docs:
  - docs/cryptographic-architecture.md
  - docs/features/messages/message-signing-system.md
related_tasks:
  - tasks/space-tags.md
---

# Space Tags

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Space Tags are owner-defined pill badges that members can optionally display next to their username in messages. Each tag consists of a circular image and a 4-character alphanumeric code displayed on a colored background — similar to Discord server tags.

Only public spaces (`isPublic: true`) can define a tag. Members choose at most one tag to display globally (same tag shown across all spaces, matching Discord behavior). Full tag data is embedded in profile broadcasts so any user can render another user's tag without needing to be a member of the source space.

---

## Data Model

### Types (`src/api/quorumApi.ts`)

```typescript
export type SpaceTag = {
  letters: string;          // Exactly 4 uppercase alphanumeric (e.g., "GAME", "DEV1")
  url: string;              // Tag image as base64 data URI (canvas-encoded, always safe)
  backgroundColor: IconColor; // From the standard IconColor palette
};

// Extends SpaceTag with source space reference — sent in profile broadcasts
export type BroadcastSpaceTag = SpaceTag & {
  spaceId: string;          // Reference to the space that owns this tag
};
```

### Space type extension

```typescript
export type Space = {
  // ...existing fields
  spaceTag?: SpaceTag;      // Owner-defined tag (only meaningful for public spaces)
};
```

### UpdateProfileMessage extension

```typescript
export type UpdateProfileMessage = {
  displayName: string;
  userIcon: string;
  spaceTag?: BroadcastSpaceTag; // Full tag data; non-members can render without access to source space
};
```

### User config

```typescript
// In UserConfig (src/db/messages.ts)
{
  spaceTagId?: string;  // spaceId of the space whose tag the user wants to display
  lastBroadcastSpaceTag?: {
    letters: string;
    url: string;
    backgroundColor: string;
  };  // Snapshot of tag as of last profile broadcast — used by startup refresh hook
}
```

### space_members DB schema (DB_VERSION 8)

`spaceTag?: BroadcastSpaceTag` added to the `space_members` IndexedDB object store. The field is optional — existing records without it continue to work. DB_VERSION was incremented from 7 to 8 with a no-op migration (field is optional).

**Why embed full tag data instead of just `spaceId`?** Recipients may not be members of the space that owns the tag. Embedding the full tag (letters, url, backgroundColor) allows any user to render the tag without needing access to the source space.

---

## Architecture

### Key Components

| File | Role |
|------|------|
| `src/components/space/SpaceTag/SpaceTag.tsx` | Memoized pill badge component |
| `src/components/space/SpaceTag/SpaceTag.scss` | Size variant styles (sm/md/lg) |
| `src/hooks/business/spaces/useSpaceTag.ts` | Space owner tag editor state + image upload |
| `src/components/modals/SpaceSettingsModal/SpaceTagSettings.tsx` | Owner tag configuration UI |
| `src/components/modals/SpaceSettingsModal/Navigation.tsx` | "Space Tag" tab entry |
| `src/components/modals/UserSettingsModal/General.tsx` | Member tag selector dropdown |
| `src/hooks/business/user/useUserSettings.ts` | `spaceTagId` state + resolves to `BroadcastSpaceTag` on save |
| `src/hooks/business/spaces/useSpaceLeaving.ts` | Auto-clears `spaceTagId` config on space leave + re-broadcasts profile with no tag |
| `src/hooks/business/spaces/useSpaceTagStartupRefresh.ts` | One-shot startup hook — detects stale tag data and re-broadcasts |
| `src/services/MessageService.ts` | Receives incoming `update-profile`, persists `spaceTag` |
| `src/hooks/business/channels/useChannelData.ts` | Passes `spaceTag` through the members map |
| `src/components/message/Message.tsx` | Renders `<SpaceTag>` next to sender username |
| `src/utils/validation.ts` | `validateSpaceTagLetters()` — 4-char alphanumeric validation |
| `src/components/space/IconPicker/types.ts` | `SPACE_TAG_COLORS_LIGHT/DARK`, `getSpaceTagColorHex()` |

### Data Flow

```
1. OWNER CONFIGURES TAG
   SpaceSettingsModal → SpaceTagSettings → useSpaceTag hook
   Image uploaded via react-dropzone → processEmojiImage() → base64 data URI
   Tag saved to Space config: { letters, url, backgroundColor }

2. MEMBER SELECTS TAG
   UserSettingsModal/General → spaceTagId stored in UserConfig
   Dropdown filters to: public spaces + has tag defined + user is member

3. PROFILE UPDATE BROADCAST (on save)
   useUserSettings.saveChanges()
     → resolves spaceTagId to full BroadcastSpaceTag from local spaces DB
     → calls updateUserProfile(displayName, icon, passkey, resolvedSpaceTag)
     → updateUserProfile broadcasts update-profile message to all spaces
       with full tag data embedded

4. OTHER USERS RECEIVE TAG
   MessageService handles incoming update-profile:
     → getSpaceMember(spaceId, senderId)
     → participant.spaceTag = decryptedContent.content.spaceTag
     → saveSpaceMember(spaceId, participant)  ← persists to IndexedDB
     → queryClient.setQueryData(...)          ← updates React Query cache

5. MESSAGE RENDERING
   useChannelData.members map includes spaceTag per member address
   Message.tsx: {sender.spaceTag && <SpaceTag tag={sender.spaceTag} size="sm" />}
```

---

## Components

### SpaceTag (`src/components/space/SpaceTag/SpaceTag.tsx`)

Pill-shaped badge rendered next to usernames in messages. Memoized with `React.memo` because it renders on every message in the list.

```typescript
interface SpaceTagProps {
  tag: BroadcastSpaceTag;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Size variants** (defined in `SpaceTag.scss`):

| Size | Height | Image | Font | Use Case |
|------|--------|-------|------|----------|
| `sm` | 20px | 16px | 11px | Message headers (default) |
| `md` | 24px | 18px | 11px | Settings previews, dropdowns |
| `lg` | 32px | 24px | 13px | Space Settings editor |

**Color system**: Uses `SPACE_TAG_COLORS_LIGHT` / `SPACE_TAG_COLORS_DARK` palettes from `IconPicker/types.ts` — separate from `FOLDER_COLORS` to allow independent tuning. The helper `getSpaceTagColorHex(color, isDarkTheme)` resolves an `IconColor` to the appropriate hex for the current theme.

**Image fallback**: When `tag.url` fails to load, `onError` sets `imageError = true` and the image is hidden. The letters remain visible on the colored background — no broken image icon.

**Image safety**: All tag images are uploaded through the `processEmojiImage()` pipeline (canvas re-encoding via compressorjs), producing safe base64 data URIs. Raw user-supplied URLs never reach `<img src>`.

### SpaceTagSettings (`src/components/modals/SpaceSettingsModal/SpaceTagSettings.tsx`)

Owner-facing tag configuration panel. Receives all state via props from `useSpaceTag` (managed in `SpaceSettingsModal`).

- **Image upload**: react-dropzone, accepts PNG/JPG/GIF up to 5MB, processed via `processEmojiImage()`
- **Letters input**: auto-uppercase, max 4 chars, strips non-alphanumeric, validates with `validateSpaceTagLetters()`
- **Color picker**: `ColorSwatch` primitives using the theme-aware `SPACE_TAG_COLORS_LIGHT/DARK` palettes
- **Live preview**: shows all three sizes (lg, md, sm) when letters are valid

### useSpaceTag (`src/hooks/business/spaces/useSpaceTag.ts`)

Editor state hook for the space owner configuration panel. Manages:
- `letters`, `backgroundColor` state initialized from `initialTag`
- Image upload lifecycle via `useDropzone` (drag state, upload progress, error messages)
- `buildTag()` — returns a `SpaceTag` object only when letters are valid (exactly 4 chars)
- Syncs with `initialTag` prop changes (e.g., when the space finishes loading)

---

## User Settings Integration

### Member Tag Selection (`src/hooks/business/user/useUserSettings.ts`)

`spaceTagId` is stored in `UserConfig` (per-user config, synced across devices via config sync). On `saveChanges()`:

1. Resolves `spaceTagId` → full `BroadcastSpaceTag` by looking up the space in the local DB
2. Calls `updateUserProfile(displayName, icon, passkey, resolvedSpaceTag)` which broadcasts `update-profile` to all spaces
3. Enqueues `save-user-config` via `actionQueueService` (deduped, non-blocking)

If the space no longer has a tag defined (e.g., owner deleted it), `resolvedSpaceTag` is `undefined` and the broadcast clears the tag for other users.

### Eligible Space Filtering (`src/components/modals/UserSettingsModal/UserSettingsModal.tsx`)

The dropdown only shows spaces where all three conditions hold:
1. `space.isPublic === true`
2. `space.spaceTag?.letters` is defined and non-empty
3. User is a member (space appears in their local spaces DB)

### Auto-Clear on Space Leave (`src/hooks/business/spaces/useSpaceLeaving.ts`)

Before deleting the space, `leaveSpace()` checks if `config.spaceTagId === spaceId`. If so:
1. Enqueues a config save with `spaceTagId: undefined` via `actionQueueService`
2. Calls `updateUserProfile(displayName, pfpUrl, passkey, undefined)` to broadcast `update-profile` with no tag

This ensures other members stop seeing the tag immediately on leave, rather than waiting for a subsequent profile update. The tag-clearing step is non-blocking — a failure is logged but does not interrupt the leave flow.

### Startup Tag Refresh (`src/hooks/business/spaces/useSpaceTagStartupRefresh.ts`)

Runs once per session inside `NavMenuContent` (behind the Suspense boundary where both `spaces` and `config` are loaded). Guarded by `hasRun = useRef(false)` — fires exactly once regardless of re-renders.

**Logic**:
1. Returns early if `config.spaceTagId` is not set
2. Looks up the space in the already-loaded `spaces` array — no network call
3. If the space no longer has a tag (owner deleted it, or user left), clears `spaceTagId` from config and broadcasts `update-profile` with no tag
4. If the space still has a tag, compares `lastBroadcastSpaceTag` (stored in config) against current `space.spaceTag` by checking `letters`, `url`, `backgroundColor`
5. If any field differs, broadcasts `update-profile` with fresh tag data and saves the new snapshot to `config.lastBroadcastSpaceTag`

**Performance**: Negligible — one ref check, one `.find()` on in-memory array, three string comparisons. The broadcast only fires when the tag actually changed.

---

## Color Palette

Space tags use dedicated color palettes separate from `FOLDER_COLORS` to allow independent tuning of saturation and brightness per theme:

```typescript
// src/components/space/IconPicker/types.ts
export const SPACE_TAG_COLORS_LIGHT: ColorOption[]  // Soft/pastel tones
export const SPACE_TAG_COLORS_DARK: ColorOption[]   // Low-saturation, dimmed for dark backgrounds

export const getSpaceTagColorHex = (iconColor?: IconColor, isDarkTheme?: boolean): string
```

Available colors: `default`, `blue`, `purple`, `fuchsia`, `green`, `orange`, `yellow`, `red`.

---

## Validation

```typescript
// src/utils/validation.ts
export const validateSpaceTagLetters = (letters: string): boolean =>
  letters.length === 4 && /^[A-Z0-9]{4}$/.test(letters);

export const SPACE_TAG_LETTERS_LENGTH = 4;
```

Input is auto-uppercased and non-alphanumeric characters are stripped on keystroke. The 4-char constraint is enforced at both the input level (`maxLength={4}`) and in `buildTag()`.

---

## Known Limitations

### quorum-shared / Mobile Parity

`quorum-shared` has not been updated with `SpaceTag`, `BroadcastSpaceTag`, `spaceTagId` in `UserConfig`, or `spaceTag` in `SpaceMember`/`MemberDigest`. Consequences:
- Mobile does not send or render space tags
- Config sync of `spaceTagId` does not propagate to mobile devices
- Member sync does not detect tag changes across a user's own devices

See [tasks/space-tags.md — quorum-shared Integration](../../../.agents/tasks/space-tags.md#quorum-shared-integration-required-for-mobile--cross-device-sync) for the full list of required changes.

### Space Profile Modal on Tag Click

Hovering or clicking a space tag shows no modal. Full space discovery via tags requires a Public Space Directory API that does not yet exist. See the Future Enhancements section of the task file for the planned approach.

---

## Related Documentation

- [Cryptographic Architecture — Inbox Key Rotation](../cryptographic-architecture.md#inbox-key-rotation) — explains why `update-profile` is exempt from the inbox mismatch guard
- [Message Signing System — Receive-Side Verification](./messages/message-signing-system.md#receive-side-verification) — the verification pipeline that `update-profile` passes through
- [Space Tags Task](../../tasks/space-tags.md) — full implementation history, edge cases, and quorum-shared migration plan

---

_Last Updated: 2026-02-18 (startup refresh + leave re-broadcast implemented)_
