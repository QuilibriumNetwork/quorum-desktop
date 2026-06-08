---
type: task
title: Port non-owner read-only view of the public invite URL from mobile
status: in-progress
created: 2026-06-08
updated: 2026-06-08
candidate: 29
branch: feat/port-non-owner-invite-view-from-mobile
---

# Port #29 — Non-owner read-only view of the public invite URL

## What

Expose the existing public invite URL (`space.inviteUrl`) to non-owner members of a space, with Copy + "Send via DM" actions. No generate / regenerate / public-link-creation controls — non-owners cannot mutate the link, only forward what the owner already published.

## Why

Mobile already ships this affordance for non-owners (`app/(tabs)/spaces/[id]/index.tsx` header invite button + `components/InviteModal.tsx` post-generate display branch). The link is replicated to every member's local Space record via the encrypted space manifest, but desktop only exposes it through the owner-gated `SpaceSettings > Invites` tab. This port closes the gap with no new architectural decisions — pure UI exposure of an already-synced field.

Full capability investigation is in [`candidates.md #29`](candidates.md#29-non-owner-read-only-access-to-the-existing-public-invite-url--ready-to-pick). The framing took three rounds with the user; the captured lesson is at the bottom of that section.

## Mobile source (read-only reference)

- [`app/(tabs)/spaces/[id]/index.tsx`](../../../../quorum-mobile/app/(tabs)/spaces/[id]/index.tsx) — space landing page header, ungated invite icon.
- [`components/InviteModal.tsx`](../../../../quorum-mobile/components/InviteModal.tsx) — lines 56-67 = read `space.inviteUrl`; lines 222-296 = link display branch.
- [`components/ShareInviteSheet.tsx`](../../../../quorum-mobile/components/ShareInviteSheet.tsx) — contact-picker DM-send pattern (we don't port this directly; desktop's existing `DmPicker` + `invite(address, 'public')` covers it).
- [`services/space/inviteService.ts`](../../../../quorum-mobile/services/space/inviteService.ts) — lines 442-471 = manifest re-upload with `inviteUrl`; line 303-305 = the owner-only gate that makes regenerate fail for non-owners.

## Why desktop already has the plumbing

- `Space.inviteUrl` lives in [`quorum-shared/src/types/space.ts:69`](../../../../quorum-shared/src/types/space.ts) and is populated identically to mobile via the same manifest-sync path.
- [`InvitationService.sendInviteToUser`](../../../src/services/InvitationService.ts) already has a `mode: 'public'` branch (lines 172-179) that forwards `space.inviteUrl` to a contact via DM **without consuming any eval**. This is exactly the action a non-owner needs.
- [`useInviteManagement.invite(address, 'public')`](../../../src/hooks/business/spaces/useInviteManagement.ts) is the consumer-side entry point.
- The contact picker (`SearchableConversationSelect` + `DmPicker` in [`Invites.tsx`](../../../src/components/modals/SpaceSettingsModal/Invites.tsx)) is already a polished UX with search; mobile's `ShareInviteSheet` is not a UX upgrade over this on desktop.

## Files to modify

### 1. [`Navigation.tsx`](../../../src/components/modals/SpaceSettingsModal/Navigation.tsx)

- Change Invites tab icon `share` → `user-plus` (line 27). Cross-app consistency with mobile's `person.badge.plus` and with the sidebar context menu's existing "Invite Members" icon (already `user-plus`).
- Loosen the owner-only filter (lines 32-34) so non-owners see the Invites tab **if and only if** `space.inviteUrl` is set. Other owner-only categories (general, channels, roles, space-tag, emojis, stickers, danger) stay owner-only. Account stays visible to everyone.
- The component needs the space (it has `spaceId`; pull the space via `useSpace` or the existing pattern — verify what's already imported).

### 2. [`Invites.tsx`](../../../src/components/modals/SpaceSettingsModal/Invites.tsx)

Branch on `isSpaceOwner` early in the render:

- **Owner**: existing UI unchanged.
- **Non-owner**: render a stripped variant. Reuses the existing public-mode block (lines 681-789) MINUS:
  - `ModeToggle` (only one mode is available — public)
  - "Republish" button
  - "Generate Public Invite Link" empty-state button
  - The `<>` outer fragment that conditionally renders generate/republish callouts

  What remains for non-owners:
  - Header "Invites" (existing)
  - Read-only "Current Invite Link" label + `ClickToCopyContent` URL box
  - "Send via DM" button → expands existing `DmPicker` → `Send Link` button calls `invite(address, 'public')`
  - Membership-warning Callout (existing — also fires for non-owners when the recipient is already a member)
  - "Invite sent" success Callout (existing)

  The `mode` state should be locked to `'public'` for non-owners (it already defaults that way when `space?.inviteUrl` is set; we just need to make sure the toggle isn't rendered).

- The non-owner branch should be cleanly factored — either an inline conditional that hides the owner-only chunks, or a separate sub-component. Prefer the inline conditional to minimize duplication; the existing public-mode JSX is already exactly what we need with the controls removed.

### 3. [`useSpaceContextMenu.tsx`](../../../src/hooks/business/spaces/useSpaceContextMenu.tsx)

The "Invite Members" menu item (lines 197-201) is currently inside the `if (state.isOwner)` block. Extract it so it also shows for non-owners **when `space.inviteUrl` is set**. Both paths just call `openSpaceEditor(spaceId, 'invites')` and let the modal's Invites tab present the right UI.

This requires the context menu to know whether the space has an `inviteUrl`. The existing `state` only tracks `isOwner`; we need to add `hasPublicInvite` (resolved during `openContextMenu` alongside the owner check, by reading the space from `messageDB`).

### 4. [`SpaceSettingsModal.tsx`](../../../src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx)

The `useEffect` at lines 112-116 redirects non-owners from `'general'` to `'account'`. This logic was written when non-owners only had `'account'`. Now they may also have `'invites'`; verify the effect doesn't also redirect from `'invites'`. It shouldn't (the condition is `selectedCategory === 'general'`), but worth a smoke test.

## Files NOT to modify

- `useInviteManagement.ts` — `invite(address, 'public')` already does exactly what we need.
- `InvitationService.ts` — `sendInviteToUser` already supports the `'public'` mode.
- `useSpace` / message storage — `space.inviteUrl` is already populated for non-owners via the existing manifest sync.

## Shared promotion

None — nothing portable is being added; this is pure desktop UI exposure of an existing shared field.

## Smoke test plan

Test as **owner** of a space that already has `space.inviteUrl` set:
- [ ] Open SpaceSettings → Invites tab icon is `user-plus` (was `share`).
- [ ] The full owner UI is unchanged: ModeToggle works, Public mode shows the link + Send via DM + Republish, One-Time mode works for Copy a link and Send via DM.
- [ ] Sidebar right-click → "Invite Members" still works → opens SpaceSettings to Invites tab.

Test as **owner** of a space with NO `space.inviteUrl`:
- [ ] Invites tab still appears in the sidebar (owners see everything).
- [ ] Tab shows the "Generate Public Invite Link" button as before.

Test as **non-owner** of a space WITH `space.inviteUrl` (need to be invited to a space owned by another account):
- [ ] SpaceSettings sidebar shows: Account, Invites (with the user-plus icon). No General, Channels, Roles, etc.
- [ ] Invites tab shows: "Current Invite Link" box (read-only display, copyable), "Send via DM" button. No ModeToggle, no Republish, no Generate.
- [ ] Click the URL box / copy icon → URL copied to clipboard.
- [ ] Expand "Send via DM" → DM picker appears → search works → pick a contact → click Send Link → success callout. The recipient receives the **owner's existing public link** in their DM (verify the URL matches `space.inviteUrl`).
- [ ] Try to invite a user who's already a member → membership-warning callout fires.
- [ ] Sidebar right-click on the space → "Invite Members" entry appears → clicking opens SpaceSettings on the Invites tab.

Test as **non-owner** of a space WITHOUT `space.inviteUrl` (the owner has never generated a public invite):
- [ ] SpaceSettings sidebar shows ONLY Account. No Invites tab.
- [ ] Sidebar right-click on the space → no "Invite Members" entry (only Leave Space + the standard non-owner items).

Cross-cutting:
- [ ] Type check (`npx tsc --noEmit`) passes.
- [ ] `yarn lint` passes.
- [ ] No regression in i18n — the existing `t\`Invites\`` etc. strings keep working; no new strings should need translation (we're removing UI, not adding).

## Open question — eval-pool drain

`invite(address, 'public')` does NOT consume the eval pool (verified at [`InvitationService.ts:172-179`](../../../src/services/InvitationService.ts)) — it just reuses `space.inviteUrl`. So a non-owner forwarding the public link many times has no resource cost. **Confirmed safe.**

## PR description template

```markdown
## What
Expose the existing public invite URL to non-owner members of a space, with Copy + Send via DM actions. Owners' UI is unchanged.

## Mobile source
- `quorum-mobile/components/InviteModal.tsx` (link display branch)
- `quorum-mobile/app/(tabs)/spaces/[id]/index.tsx` (ungated invite icon)
- `quorum-mobile/services/space/inviteService.ts` (owner-only gate at line 303 + manifest replication at lines 442-471)

## Why
Closes capability gap #29 in `.agents/tasks/port-from-mobile/candidates.md`. The link is already replicated to every member's local Space record via the encrypted manifest, but desktop's only consumer (SpaceSettings > Invites tab) was owner-gated. Non-owners held the data but couldn't see it.

## Scope
- `Navigation.tsx`: change Invites icon `share` → `user-plus`; show the Invites tab to non-owners when `space.inviteUrl` is set.
- `Invites.tsx`: render a stripped-down public-mode-only variant for non-owners (URL display + Copy + Send via DM via the existing contact picker, which uses `mode: 'public'` and does not consume the eval pool).
- `useSpaceContextMenu.tsx`: extend "Invite Members" entry to non-owners when `space.inviteUrl` is set; deep-links to Invites tab.

## Cross-repo summary
- **quorum-shared**: not touched.
- **quorum-desktop**: THIS PR.
- **quorum-mobile**: not touched (read-only for this effort).

## Smoke test
- [ ] As owner: existing flows unchanged; only the tab icon changed.
- [ ] As non-owner of a space with `space.inviteUrl`: see the read-only tab; Copy works; Send via DM forwards the existing public link without consuming an eval.
- [ ] As non-owner of a space without `space.inviteUrl`: no Invites tab; no "Invite Members" in sidebar context menu.
- [ ] Type check + lint pass.
```

---

*Last updated: 2026-06-08*
