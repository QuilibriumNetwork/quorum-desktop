---
type: task
title: "Space message list: missing name/avatar (public-profile fallback not applied)"
status: planned
created: 2026-06-10
related_docs:
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md"
  - ".agents/docs/features/avatar-initials-system.md"
related_files:
  - "src/components/space/Channel.tsx"
  - "src/components/message/MessageList.tsx"
  - "src/hooks/business/user/useMembersWithPublicProfileFallback.ts"
  - "src/hooks/business/channels/useChannelData.ts"
---

# Space message list: missing name/avatar

> **⚠️ AI-investigated 2026-06-10.** Verify the root cause with a live test before implementing (see "How to confirm").

## Symptom

In a space channel's **main message list**, some senders render as a 6-char
truncated address (e.g. `CRcRk8`, `UB6CqT`, `PhEcvj`) with an initials-only
avatar, instead of their real name/pfp. Observed on the **test website**
(deployed, ~2026-06-09 baseline), not specific to the DM-sidebar fix branch.
Same class of issue as the DM identity gap, but a separate code path.

## Root cause (high confidence)

The public-profile back-fill is computed in `Channel.tsx` but **never reaches
the message list render**.

1. `Channel.tsx:289` builds `effectiveMembers = useMembersWithPublicProfileFallback(members, visibleSenderAddresses)` and an enriched `mapSenderToUser` (`Channel.tsx:298-313`) that reads from `effectiveMembers`.
2. That enriched `mapSenderToUser` IS passed to side panels (bookmarks, pinned, composer, typing indicator — `Channel.tsx:1436/1470/1503/1535/1669/1695`).
3. **It is NOT passed to `<MessageList>`.** The MessageList JSX (`Channel.tsx:~1638`) passes only `members={members}` — the **raw** map from `useChannelData`, with no public-profile fallback.
4. `MessageList.tsx:290-305` builds its **own** internal `mapSenderToUser` from that raw `members` prop, and passes it to each `<Message>` (`MessageList.tsx:374`). When a member has no `displayName`, it falls back to `senderId.slice(-6)` (`MessageList.tsx:296`) — the truncated address you see.

So the `Channel.tsx:294-297` comment ("all message-path consumers see the
enriched data") is **inaccurate** — MessageList was missed. The enriched data
exists; it just isn't wired into the one surface that renders the chat.

### Secondary consideration (verify, may be a non-issue or an additional gap)

`useMembersWithPublicProfileFallback` only fetches when a member has
**neither** `displayName` **nor** `userIcon` (`useMembersWithPublicProfileFallback.ts:65`).
`useChannelData` already nulls out the default icon to `undefined`
(`useChannelData.ts:69-71`), so a member with no name and no real avatar
*should* satisfy the condition and trigger a fetch. Confirm this holds for the
affected users; if a member has a real icon but no name (or vice-versa) the
condition would skip them — but that's not the case in the screenshot (initials
avatars = no icon).

If after wiring the fallback into MessageList some users STILL show as
addresses, the remaining cause is benign: **those users have no public profile**
(opted out / never created one → 404 → null). Nothing client-side can recover
that; it needs a space `update-profile` broadcast from the user. Confirm with
the diagnostic before assuming a code bug.

## How to confirm (before coding)

1. On a build that has the message-path fallback (>= 2026-06-08), open the
   affected channel.
2. In DevTools, check the Network tab for `GET /users/<addr>/public-profile`
   calls for the truncated-address senders.
   - **No request fired** → the fallback isn't reaching these senders (wiring
     bug — this task). Most likely.
   - **Request fired, 404** → user has no public profile (not recoverable
     client-side; out of scope).
   - **Request fired, 200 with display_name/profile_image** but still shows
     address → confirms the enriched data isn't reaching MessageList render
     (this task).
3. Optionally adapt `.agents/tools/dm-debug/05-profile-sources.js` to read
   `space_members` instead of `conversations` for a per-user source table.

## Proposed fix

Wire the enriched identity into the message list. Two clean options:

**Option A (preferred) — pass the enriched `mapSenderToUser` to MessageList,
and use it instead of the internal one.**
- `Channel.tsx`: add `mapSenderToUser={mapSenderToUser}` to the `<MessageList>` props.
- `MessageList.tsx`: accept an optional `mapSenderToUser` prop; when provided,
  use it instead of the internally-built one (keep the internal one as fallback
  for any caller that doesn't pass it — DMs, etc.).
- Smallest blast radius; the enriched mapper already handles the
  `displayName || slice(-6)` fallback identically.

**Option B — pass `effectiveMembers` as the `members` prop to MessageList.**
- `Channel.tsx`: `members={effectiveMembers}` on `<MessageList>`.
- MessageList's internal `mapSenderToUser` then reads enriched data for free.
- Risk: `members` is also used by MessageList for other things (mention
  resolution, `users={Object.values(members)}`, `resolveSender`); changing the
  identity of that prop could shift those behaviors. Audit every `members`
  consumer in MessageList before choosing this.

Recommend **Option A** — it's targeted and doesn't repurpose the `members` prop.

### Scope / fetch-storm guard (already handled)

The fetch set is already bounded to `visibleSenderAddresses` (senders in the
loaded message list), NOT the whole roster — see `Channel.tsx:280-287`. So
wiring the existing `effectiveMembers`/`mapSenderToUser` into MessageList does
**not** introduce a roster-wide fetch storm. (The member-list *sidebar* — a
separate surface — still uses raw `members` by design and is out of scope here.)

## Out of scope

- The space **member-list sidebar** (the `users` panel toggled by the people
  icon) deliberately uses raw `members` to avoid fetching the whole roster.
  Fixing that needs a virtualization-aware bounded fetch — separate task.
- DM surfaces — already fixed (branch `fix/dm-sidebar-profile-fallback`,
  2026-06-10).
- Users with no public profile — not client-side recoverable.

## Verification

- Affected senders show real name + avatar in the message list (for users who
  have a public profile).
- No regression in DM message rendering (which also uses MessageList — confirm
  the optional-prop fallback path).
- No fetch storm: Network tab shows public-profile calls only for visible
  senders, not the full roster.
- `npx tsc --noEmit --skipLibCheck` clean; `yarn lint` clean.

---
*Last updated: 2026-06-10*
