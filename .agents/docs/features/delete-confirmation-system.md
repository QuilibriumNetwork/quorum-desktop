---
type: doc
title: Delete Confirmation System
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-05-30T00:00:00.000Z
---

# Delete Confirmation System

## Overview

The delete confirmation system protects destructive operations across the
application. It uses three patterns (inline double-click, modal with preview,
type-to-confirm) chosen by risk level, plus a small set of "sacred" rules
that block certain deletions entirely.

## Architecture

### Core components

- **`useConfirmation` hook** (`src/hooks/ui/useConfirmation.ts`) — drives
  inline double-click and modal flows. Supports smart escalation
  (inline → modal when content has weight), blocking conditions, optional
  Shift+click bypass.
- **`ConfirmationModal`** (`src/components/modals/ConfirmationModal.tsx`) —
  shared modal with title, body, optional preview slot, action buttons.
  Wraps the preview in a `ScrollContainer` with border + rounded frame
  so previews don't need their own outer wrapper.
- **Preview components**:
  - `MessagePreview.tsx`
  - `RolePreview.tsx`
  - `ChannelPreview.tsx` (`src/components/space/ChannelPreview.tsx`) —
    channel name + message count.
  - `GroupPreview` is inline in `SpaceSettingsModal/Channels.tsx`
    (group name + channel count); not extracted because it has a single
    callsite.
- **`ConfirmationModalProvider`** —  context that renders confirmations at
  layout level so they stack above navigation and other modals.

## Confirmation patterns

### Pattern A — inline double-click
- First click flips the button to "Click again to confirm". Second click
  within 5 s executes. After timeout, resets.
- Used for low-medium risk where there's nothing rich to preview.
- **Examples**: empty channel deletion in `ChannelEditorModal`, empty
  group deletion in `GroupEditorModal`.

### Pattern B — modal with preview
- Shows a `ConfirmationModal` with title, message body, and a content
  preview component bound to the target.
- Desktop: `enableShiftBypass: false` keeps the modal mandatory.
- **Examples**: channel deletion when messages exist (sidebar flow);
  every channel and group deletion from the Channels tab; role deletion;
  message deletion.

### Pattern C — blocked (visibly disabled)
- The action cannot proceed; the control itself is disabled with a
  tooltip explaining why. Replaces the older "always-enabled, error on
  click" approach.
- **Examples**:
  - Delete Group in `GroupEditorModal` when the group has channels —
    tooltip: "Delete all channels in this group first."
  - Trash icon in Channels tab on the default channel — tooltip:
    "You cannot delete the default channel."

### Pattern D — type-to-confirm
- Input field that must match a literal word (case-insensitive). Submit
  button disabled until input matches. No second confirmation step.
- Used for highly destructive operations where two-click is too weak.
- **Examples**:
  - **Space deletion** in the `Danger` tab (`SpaceSettingsModal`):
    type "DELETE". Shows space name + channel count + member count
    in a bordered preview frame above the input.
  - **App data reset** in `UserSettingsModal/DangerZone`: type "RESET".

## Smart escalation logic

Some flows pick between Pattern A and Pattern B based on content
weight:

```typescript
// useChannelManagement (ChannelEditorModal flow)
- Empty channel (0 messages) → Pattern A (double-click)
- Channel with messages    → Pattern B (modal + ChannelPreview)
- Default channel          → Pattern C (delete control replaced with
                                        muted text + info Callout at top)
```

The Channels tab in `SpaceSettingsModal` does NOT use smart escalation —
it always uses Pattern B with `ChannelPreview` / `GroupPreview`. This
intentional divergence keeps the tab's surface consistent (each row's
trash icon behaves the same way regardless of channel state).

## Sacred rules (cross-cutting safeguards)

These rules apply across ALL surfaces; they're enforced at the hook
layer, not just the UI:

### Default channel cannot be deleted
- `useChannelManagement` exposes `isDefaultChannel` and short-circuits
  `handleDeleteClick` when true.
- `ChannelEditorModal`:
  - Info Callout at the top of the modal explains the situation and
    points to Space Settings → General for reassignment.
  - The Delete Channel control is replaced with muted text
    "Default channels cannot be deleted." (no disabled-looking button).
- Channels tab: trash icon disabled with a tooltip.

### Group containing the default channel cannot be deleted
- Channels tab `handleDeleteGroup` blocks with a toast in this case.
- Reaching this state is rare in practice: to delete such a group the
  user would first have to move the default channel elsewhere, OR
  reassign the default to another channel via Space Settings → General.

### Group with channels cannot be deleted
- `GroupEditorModal`: Delete Group button visibly disabled with a
  tooltip; the inline "showChannelError" Callout still exists as a
  legacy fallback in `useGroupManagement` but is no longer reachable
  through the visible button.
- Channels tab: trash icon disabled, tooltip explains why.

### Space deletion is type-to-confirm AND nukes everything
- `useSpaceManagement.handleDeleteSpace` does NOT require the user to
  delete channels first (no `channels-exist` guard).
- The Danger tab is the single explicit "destroy this space, all
  channels, all messages" action. Type "DELETE" → button enabled →
  one click deletes.

## Two surfaces for channel and group operations

There are two entry points for editing/deleting channels and groups:

1. **Sidebar context menu / hover icons** → `ChannelEditorModal` and
   `GroupEditorModal`. These use `useChannelManagement` /
   `useGroupManagement` with smart escalation (Pattern A or B).
2. **Space Settings → Channels tab** → trash icons inline next to each
   row. This uses a per-component `pendingDelete` state and always
   shows Pattern B. The Channels tab also opens its own
   `ChannelEditorModal` / `GroupEditorModal` (via `createPortal` to
   `document.body`) for edits, so the user flow is consistent across
   both surfaces.

Both surfaces respect the sacred rules above; the data layer enforces
them so a sneaky path can't bypass the UI guard.

## Implementation example

```typescript
// useConfirmation usage (still the canonical path for sidebar flows)
const deleteConfirmation = useConfirmation({
  type: 'inline',
  escalateWhen: () => hasMessages,
  modalConfig: hasMessages ? {
    title: t`Delete Channel`,
    message: t`Are you sure you want to delete this channel? All messages will be lost. This action cannot be undone.`,
    preview: React.createElement(ChannelPreview, { channelName, messageCount }),
    confirmText: t`Delete`,
    variant: 'danger',
  } : undefined,
});

const handleDeleteClick = (e: React.MouseEvent) => {
  if (isDefaultChannel) return; // sacred rule
  deleteConfirmation.handleClick(e, performDelete);
};
```

```typescript
// Channels tab uses local state (no useConfirmation) because every
// delete goes straight to Pattern B and the preview content is
// computed per click.
const [pendingDelete, setPendingDelete] = useState<...>(null);

const handleDeleteChannel = async (group, channel) => {
  const result = await messageDB.getMessages({
    spaceId, channelId: channel.channelId, limit: 50,
  });
  setPendingDelete({
    kind: 'channel', groupName: group.groupName,
    channelId: channel.channelId, channelName: channel.channelName,
    messageCount: result.messages.length,
  });
};

{pendingDelete?.kind === 'channel' && (
  <ConfirmationModal
    visible={true}
    title={t`Delete Channel`}
    message={...}
    preview={<ChannelPreview channelName={...} messageCount={...} />}
    confirmText={t`Delete`}
    variant="danger"
    onConfirm={confirmDelete}
    onCancel={() => setPendingDelete(null)}
  />
)}
```

## Configuration options

```typescript
interface UseConfirmationOptions {
  type: 'inline' | 'modal';
  escalateWhen?: () => boolean;
  blockedWhen?: () => boolean;
  enableShiftBypass?: boolean;
  doubleClickTimeout?: number;
  modalConfig?: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
  };
  blockedError?: string;
}
```

## Current usage

**Protected operations:**
- Message deletion (modal with `MessagePreview`).
- Role deletion (modal with `RolePreview`).
- Channel deletion — sidebar (smart escalation A/B + sacred rule for default).
- Channel deletion — Channels tab (always Pattern B + sacred rule for default).
- Group deletion — sidebar (Pattern A when empty, Pattern C when not).
- Group deletion — Channels tab (always Pattern B + sacred rule).
- Conversation deletion (modal).
- Space deletion — Danger tab (Pattern D, type "DELETE").
- App data reset — User Settings DangerZone (Pattern D, type "RESET").

**Integration points:**
- `src/hooks/business/channels/useChannelManagement.ts` — channel delete,
  exposes `isDefaultChannel` for the sacred rule.
- `src/hooks/business/channels/useGroupManagement.ts` — group delete,
  exposes `hasChannels`.
- `src/hooks/business/spaces/useSpaceManagement.ts` — space delete
  (no per-channel guard since 2026-05-30).
- `src/hooks/business/spaces/useRoleManagement.ts` — role delete.
- `src/hooks/business/messages/useMessageActions.ts` — message delete.
- `src/components/modals/SpaceSettingsModal/Channels.tsx` — Channels-tab
  inline confirmations.
- `src/components/modals/SpaceSettingsModal/Danger.tsx` — space delete
  with type-to-confirm + stats preview.
- `src/components/modals/UserSettingsModal/DangerZone.tsx` — app reset
  with type-to-confirm.

## Files structure

```
src/
├── hooks/ui/
│   └── useConfirmation.ts                   # Core hook
├── components/
│   ├── modals/
│   │   ├── ConfirmationModal.tsx            # Web modal
│   │   ├── ConfirmationModal.native.tsx     # Mobile modal
│   │   ├── ChannelEditorModal.tsx           # Sidebar channel editor
│   │   ├── GroupEditorModal.tsx             # Sidebar group editor
│   │   ├── SpaceSettingsModal/
│   │   │   ├── Channels.tsx                 # Channels tab (Pattern B)
│   │   │   └── Danger.tsx                   # Space delete (Pattern D)
│   │   └── UserSettingsModal/
│   │       └── DangerZone.tsx               # App reset (Pattern D)
│   ├── context/
│   │   └── ConfirmationModalProvider.tsx    # Layout-level rendering
│   ├── message/
│   │   └── MessagePreview.tsx
│   ├── role/
│   │   └── RolePreview.tsx
│   └── space/
│       └── ChannelPreview.tsx               # Used in Pattern B for channels
└── hooks/business/
    ├── channels/useChannelManagement.ts
    ├── channels/useGroupManagement.ts
    ├── spaces/useSpaceManagement.ts
    ├── spaces/useRoleManagement.ts
    └── messages/useMessageActions.ts
```

---

*Last updated: 2026-05-30 — refreshed for: (1) Pattern D type-to-confirm
on space deletion, replacing the old two-click + 5s-timeout flow.
(2) Pattern C visibly-disabled controls for default channel and groups
with channels. (3) "Sacred rules" section codifying default-channel-is-
immutable and space-delete-nukes-everything. (4) Channels tab as a
second surface for channel/group ops, using local state instead of
useConfirmation. (5) ChannelPreview path correction (components/space/,
not components/channel/). (6) Removed pin/unpin references (feature
dropped 2026-05-30).*

*Previously verified: 2025-12-09 — file paths confirmed current.*
