---
type: plan
title: Align desktop notification settings UX with mobile — implementation plan
status: ready-for-implementation
created: 2026-06-07
updated: 2026-06-07
branch: feat/align-notification-settings-with-mobile
scope: desktop-only
design_doc: .agents/tasks/2026-06-07-align-notification-settings-with-mobile.md
related_bugs:
  - .agents/bugs/2026-06-07-mention-type-filter-not-synced.md (NOT in this PR — separate)
---

# Implementation plan — Notification settings UX alignment

This plan operationalizes the agreed scope in the [design doc](2026-06-07-align-notification-settings-with-mobile.md). All work is desktop-only; no mobile or shared-package changes.

## Files touched

1. **[`src/components/modals/SpaceSettingsModal/Account.tsx`](../../src/components/modals/SpaceSettingsModal/Account.tsx)** — primary UI work (rename, restructure Notifications section, add per-channel list)
2. **[`src/services/MessageService.ts`](../../src/services/MessageService.ts)** — Bug #1 fix (one-line: add channel-mute check to OS notification suppression)
3. **i18n catalogs** — automatic via `yarn lingui extract` after string changes

## Files NOT touched (intentional)

- `ChannelEditorModal.tsx` — stays as the admin-edit modal; personal preferences live in Space Settings instead
- `useSpaceContextMenu.tsx`, `ChannelItem.tsx` context menu items — `Mute Space` / `Mute Channel` labels unchanged
- `ChannelList.tsx`, `ChannelGroup.tsx` — visual treatment of muted channels unchanged
- `useChannelMute.ts` — API unchanged, only call sites in Account.tsx change framing
- `NotificationPanel.tsx` — already correctly respects mute settings
- Any mobile or shared file

## Step-by-step

### Step 1 — Bug #1 fix in MessageService.ts

This is independent of the UI work, so do it first — gives a clean small commit that's easy to revert if the rest of the plan changes.

**File:** [`src/services/MessageService.ts`](../../src/services/MessageService.ts), around lines 4288–4319

**Current (relevant block):**
```ts
// Check if this space message should trigger a desktop notification
if (
  decryptedContent?.content?.type === 'post' &&
  decryptedContent.content.senderId !== self_address
) {
  const spaceId = conversationId.split('/')[0];
  const config = await this.messageDB.getUserConfig({ address: self_address });
  const settings = config?.notificationSettings?.[spaceId];

  // Don't notify if space is muted
  if (settings?.isMuted !== true) {
    // ... mention/reply checks then notification fire
  }
}
```

**Change:** extend the suppression check so muted channels also short-circuit.

```ts
// Don't notify if space is muted OR if this specific channel is muted
const channelId = decryptedContent.channelId;
const isChannelMuted = !!channelId &&
  config?.mutedChannels?.[spaceId]?.includes(channelId);

if (settings?.isMuted !== true && !isChannelMuted) {
  // ... rest unchanged
}
```

**Verification:** mute a channel via right-click → "Mute Channel" → post a `@you` mention in that channel from another account → confirm NO OS notification fires. Unmute → confirm OS notification fires again.

**Commit message suggestion:** `fix(notifications): channel mute now suppresses OS notifications`

---

### Step 2 — Rename "Mute this Space" to "Space notifications" (inverted)

**File:** [`src/components/modals/SpaceSettingsModal/Account.tsx`](../../src/components/modals/SpaceSettingsModal/Account.tsx), lines 273–282

**Current:**
```tsx
<Flex className="items-center gap-3 mt-4 mb-3">
  <Switch
    value={isSpaceMuted}
    onChange={toggleSpaceMute}
    accessibilityLabel={t`Mute all notifications from this Space`}
  />
  <div className="text-label-strong">
    <Trans>Mute this Space</Trans>
  </div>
</Flex>
```

**Change to:**
```tsx
<Flex className="items-center gap-3 mt-4 mb-3">
  <Switch
    value={!isSpaceMuted}
    onChange={toggleSpaceMute}
    accessibilityLabel={t`Notifications for this Space`}
  />
  <div className="text-label-strong">
    <Trans>Space notifications</Trans>
  </div>
</Flex>
```

**Key inversion:** `value={!isSpaceMuted}` — the Switch now shows "on" when notifications are enabled (the default state). `toggleSpaceMute` is correct as-is because flipping the switch should still toggle the mute flag — the visual just shows the inverse.

**Move this Switch to the TOP of the Notifications section** (above the event-type Select), since it's the master control. The current ordering (Select first, Switch second) doesn't match the new mental model.

---

### Step 3 — Make event-type Select a sub-control of the master toggle

**Same file:** lines 234–272 (the Select)

**Current behavior:** Select is always visible and enabled (unless `isMentionSettingsLoading`).

**New behavior:** Select is visually subordinate to the master toggle. When notifications are off, the Select is disabled.

**Specifically:**
- Move the master toggle (Step 2) above the Select.
- Reword the descriptive line above the Select from "Select which types of notifications you want to receive" to "When enabled, notify me for:" (subordinate phrasing).
- Add `disabled={isSpaceMuted || isMentionSettingsLoading}` to the Select.
- Optionally wrap the Select in a `<div>` with reduced opacity when muted, for visual hierarchy (matches the pattern of "the master is the parent, the sub-controls are children"). Use `className="opacity-50 pointer-events-none"` or similar — check what existing patterns the codebase uses.

**Result structure (pseudo-JSX):**
```tsx
<>
  <Spacer borderTop />
  <div className="text-subtitle-2"><Trans>Notifications</Trans></div>

  {/* Master toggle — first */}
  <Flex className="items-center gap-3 mt-4 mb-3">
    <Switch value={!isSpaceMuted} onChange={toggleSpaceMute} />
    <div className="text-label-strong"><Trans>Space notifications</Trans></div>
  </Flex>

  {/* Event-type sub-control — disabled when master is off */}
  <div className="text-label pt-1">
    <Trans>When enabled, notify me for:</Trans>
  </div>
  <div className="pt-2">
    <Select
      value={selectedMentionTypes}
      onChange={...}
      disabled={isSpaceMuted || isMentionSettingsLoading}
      {/* ... rest unchanged */}
    />
  </div>

  {/* Per-channel list — new (Step 4) */}

  {/* "Hide muted channels" — unchanged label, stays at the bottom */}
  <Flex className="items-center gap-3 mt-4">
    <Switch value={!showMutedChannels} onChange={handleShowMutedToggle} />
    <div className="text-label-strong"><Trans>Hide muted channels</Trans></div>
  </Flex>
  <Spacer borderBottom />
</>
```

---

### Step 4 — Add per-channel notification list

This is the new UX element — a list of channels in the space, each with an on/off Switch row.

**Same file:** insert between the event-type Select and the "Hide muted channels" toggle.

**Data sources:**
- Channels: `useSpace({ spaceId }).data?.groups` — iterate `space.groups[].channels[]`. The existing [`Channels.tsx`](../../src/components/modals/SpaceSettingsModal/Channels.tsx#L611) does this iteration; mirror the pattern.
- Per-channel mute state + toggle: `useChannelMute({ spaceId })` already exposes `isChannelMuted(channelId)` and `toggleMute(channelId)`. No new hook needed.

**JSX shape:**
```tsx
{/* Per-channel notifications list */}
<div className="text-label pt-4 pb-2">
  <Trans>Channels</Trans>
</div>
<div className={`flex flex-col gap-2 ${isSpaceMuted ? 'opacity-50 pointer-events-none' : ''}`}>
  {space?.groups?.flatMap((group) =>
    group.channels.map((channel) => (
      <Flex key={channel.channelId} className="items-center gap-3">
        <Switch
          value={!isChannelMuted(channel.channelId)}
          onChange={() => toggleMute(channel.channelId)}
          accessibilityLabel={t`Notifications for #${channel.channelName}`}
          disabled={isSpaceMuted}
        />
        <div className="text-label-strong"># {channel.channelName}</div>
      </Flex>
    ))
  )}
</div>
```

**Behavior notes:**
- When space is muted, the whole list is visually disabled (opacity 50%, pointer-events none). Individual channel state is preserved in `mutedChannels` but the switches don't respond — because space-mute supersedes channel-state for notification firing.
- Channel list inherits the space's existing group ordering (no separate sort).
- Default channel is shown like any other; no special treatment.
- For very large spaces (many channels), the list could get long. Acceptable for now; if it becomes a problem, add a `max-h-[Npx] overflow-y-auto` wrapper. Don't pre-optimize.

**Imports to add to Account.tsx:**
- `useSpace` from `'../../../hooks'` (likely already used elsewhere in this directory; check).
- Pull `isChannelMuted` and `toggleMute` from the existing `useChannelMute(...)` destructure on line 101–103.

**Update line 101 from:**
```ts
const { showMutedChannels, toggleShowMutedChannels, isSpaceMuted, toggleSpaceMute } = useChannelMute({ spaceId });
```
**to:**
```ts
const {
  showMutedChannels,
  toggleShowMutedChannels,
  isSpaceMuted,
  toggleSpaceMute,
  isChannelMuted,
  toggleMute,
} = useChannelMute({ spaceId });
```

---

### Step 5 — Update the section description text

The current paragraph (line 229–233) says "Select which types of notifications you want to receive" — this references the Select control specifically.

After restructuring, the section needs a description that fits the new layout. Either:
- Remove the descriptive paragraph entirely (the labels speak for themselves), OR
- Replace with something covering the whole section: "Choose how this Space notifies you."

**Recommend: remove it.** The section heading + labeled controls are self-explanatory. Less text = cleaner.

---

### Step 6 — i18n extraction

After all string changes are made:

```bash
yarn lingui extract
```

Verify in `src/locales/en/messages.po`:
- New keys added: `Space notifications`, `Notifications for this Space`, `When enabled, notify me for:`, `Channels`, `Notifications for #${channel.channelName}`
- Old keys marked obsolete: `Mute this Space`, `Mute all notifications from this Space`, `Select which types of notifications you want to receive`

Do NOT manually translate non-English locales. The existing translation workflow (Lingui PO file via the global skill) handles that downstream.

---

### Step 7 — Manual verification in the running Electron app

Start dev: `yarn dev` (from main checkout) OR run the Electron app however the project does it. Spin up two test accounts in the same space (one to receive notifications, one to send).

**Verification matrix:**

| Action | Expected result |
|---|---|
| Open Space Settings → Account tab → Notifications | New layout: master toggle on top, event-type Select below (enabled), channel list below (enabled), "Hide muted channels" at bottom |
| Master toggle off | Event-type Select visually disabled; channel list visually disabled; both still show their current state |
| Master toggle off → another user posts `@you` mention | NO badge, NO in-app entry, NO OS notification |
| Master toggle on → another user posts `@you` mention | Badge + in-app entry + OS notification all fire |
| Master on, individual channel off → another user posts `@you` in that channel | NO OS notification (this is Bug #1's fix), NO badge, NO in-app entry |
| Master on, individual channel off → another user posts `@you` in a DIFFERENT channel | All notifications fire normally |
| Right-click on space → "Mute Space" | Master toggle reflects the change immediately; menu label says "Unmute Space" |
| Right-click on channel → "Mute Channel" | Corresponding channel switch in the panel reflects the change; menu label says "Unmute Channel" |
| Toggle "Hide muted channels" | Sidebar channel list visibility behavior unchanged from before this PR |

**Negative checks:**
- ChannelEditorModal (admin → Edit Channel) does NOT have any notification toggles in it.
- Other tabs of SpaceSettingsModal (General, Channels, Roles, etc.) unchanged.

---

## Out of scope for this PR (do not implement here)

- Channel-level event-type filter (each channel having its own `@you`/`@everyone`/etc. preference). Currently only space-level. Mobile parity doesn't require this.
- Persisting per-channel notification preferences as anything other than the existing `mutedChannels[spaceId]: string[]`. The shape is sufficient.
- Any mobile change.
- Any `quorum-shared` change.
- Bug #2 (mention-type filter sync) — separate PR per its [bug doc](../bugs/2026-06-07-mention-type-filter-not-synced.md).
- A real "Channel Preferences" modal accessible per-channel from the channel header. Considered and deferred — the per-space list in SpaceSettingsModal + the existing right-click "Mute Channel" cover the use cases.

## Commit plan

Three small commits, in order:

1. `fix(notifications): channel mute now suppresses OS notifications` — Step 1 only. Self-contained.
2. `feat(notifications): rename space mute to notifications toggle in space settings` — Steps 2, 3, 5, 6. UI changes for space-level toggle and event-type Select.
3. `feat(notifications): add per-channel notifications list to space settings` — Step 4 (and any i18n keys for it).

This way each commit is reviewable in isolation and the bug-fix can be cherry-picked if needed.

## Verification checklist (before opening PR)

- [ ] All steps above completed
- [ ] `yarn lint` clean
- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` clean
- [ ] `yarn lingui extract` run, generated catalog diff committed
- [ ] Manual verification matrix passed (Step 7)
- [ ] No accidental changes outside the listed files (`git diff --stat`)
- [ ] No console errors in dev tools when toggling settings
- [ ] Right-click context menus still work and stay in sync with new panel toggles

## Open implementation questions

These should be resolved during implementation, NOT before:

1. **Exact opacity/disabled styling for sub-controls when master is off.** Look for existing patterns in the codebase (search `opacity-50` or `pointer-events-none` in `src/components`). Match what's already there.
2. **Does `useSpace` need to be added to imports?** Check Account.tsx's existing imports — it may already be there indirectly. If not, add it.
3. **Where to place the channel list when the space has zero channels.** Render a `<Trans>No channels in this space.</Trans>` placeholder or hide the section entirely. Recommend: hide entirely if `!space?.groups || groups.every(g => g.channels.length === 0)`.

---

*Last updated: 2026-06-07*
