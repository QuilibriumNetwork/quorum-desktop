---
type: task
title: Port per-space profile bio override to desktop's SpaceSettings → Account tab
status: in-progress
created: 2026-06-08
branch: feat/port-per-space-bio
worktree: .worktrees/secondary
scope: desktop (Account editor + receive-handler fix + UserProfile bio render)
candidate: candidates.md (new entry, not previously listed — see "Why this isn't in candidates.md yet" below)
---

# Port per-space profile bio override

## Capability (plain terms)

Let a user override their display name, **avatar, and bio** for a single space, distinct from their global profile. Mobile ships this; desktop ships display name + avatar override but not bio.

## Why this isn't in candidates.md yet

The 2026-06-01 inventory pass focused on top-level mobile screens/hooks and treated "public profile" (#6, shipped 2026-06-08) as the bio-related candidate. The per-space override UI lives inside mobile's `SpaceSettingsModal.tsx` as an inline section, not as a separate hook or screen, so it didn't surface in the original sweep. Desktop has the per-space displayName+avatar half via `useSpaceProfile` + `Account.tsx`, but bio was simply not wired through. User flagged it 2026-06-08. Add a row to candidates.md after the PR merges.

## Capability verification

- ✅ Mobile ships it: `quorum-mobile/components/SpaceSettingsModal.tsx:339-505` (state, picker, save handler) + `:1325-1328` (section copy "Override your display name, avatar, and bio for this space only").
- ✅ Mobile broadcasts via `maybeSendUpdateProfileMessage` with `bio` field (`services/space/spaceMessageService.ts:790-830, 876-891`).
- ✅ Mobile receives upsert-aware (`context/WebSocketContext.tsx:1796-1856`) — only writes fields present in the payload; specifically `...(profileContent.bio !== undefined ? { bio: profileContent.bio } : {})`.
- ✅ Mobile renders per-space `member.bio` in `UserProfileModal.tsx:238-243`.
- ❌ Desktop's `Account.tsx` exposes only displayName + avatar — no bio textarea.
- ❌ Desktop's `useSpaceProfile.ts` has no `bio` state and doesn't include `bio` in the `update-profile` submit payload.
- ❌ Desktop's `MessageService.ts` receive handlers (two sites: ~L1153 `saveMessage`, ~L1655 `addMessage`) don't apply `content.bio` to `participant.bio`. They also overwrite displayName and userIcon unconditionally — a present-but-empty-string field clobbers receivers' stored values.
- ❌ **Desktop has no space-side surface that renders `member.bio` today.** `UserProfile.tsx` (the in-space user-click card consumed from `Channel.tsx` and `Message.tsx`) shows displayName + address + roles + personal note + action buttons — no bio block. `DMUserProfileSidebar` does render bio but is DM-only. Without adding a bio render to `UserProfile.tsx`, the editor would land bio data with no visible effect for anyone in the space.

## Pre-flight verification findings (run before this scope was finalized)

1. **Existing `update-profile` senders on desktop don't intentionally send empty fields.** Audit of all `updateUserProfile(...)` callers (`UserProfileEdit.tsx`, `useUserSettings.ts`, `useSpaceTagStartupRefresh.ts`, `useSpaceLeaving.ts`) shows they pass `displayName ?? ''` and `pfpUrl ?? ''` — fall-throughs to empty string when the field is missing, NOT intentional clears. Today's receive-side overwrite-unconditionally clobbers other members' stored displayName/userIcon whenever a desktop sender has any undefined property locally. Switching to mobile's "skip empty" gate is a strict bug fix here.

2. **The two receive sites are structurally similar but not identical.** Both call `messageDB.saveSpaceMember(participant)`; only `addMessage` (~L1655) ALSO writes `queryClient.setQueryData(buildSpaceMembersKey(...), ...)`. Both need the same upsert-aware merge — that's straightforward — but I should not blindly copy the entire block from one to the other.

3. **No space-side bio render exists.** Confirmed above — this is the scope addition driving the UserProfile.tsx change.

## Mobile sources to read

- `quorum-mobile/components/SpaceSettingsModal.tsx` lines 339-505 (state + save), 1325-1380 (UI section).
- `quorum-mobile/services/space/spaceMessageService.ts` lines 790-830 (wire shape), 876-891 (dedup gate).
- `quorum-mobile/context/WebSocketContext.tsx` lines 1796-1875 (upsert-aware receive handler — the pattern to mirror).
- `quorum-mobile/components/UserProfileModal.tsx` lines 238-243 (how mobile renders `member.bio`).

## Desktop files to modify

### 1. `src/hooks/business/spaces/useSpaceProfile.ts`

Add `bio` state alongside `displayName`:

- Add `bio: string`, `setBio: (s: string) => void`, `bioErrors: string[]` to `UseSpaceProfileReturn`.
- Load `setBio(member?.bio ?? '')` in the existing `loadMember` effect (~L61-76).
- Run `validateUserBio(bio)` (from `@quilibrium/quorum-shared` via the existing `hooks/business/validation` re-export).
- Capture a baseline `{ displayName, bio, userIcon }` on load so the save payload can omit fields the user didn't change — matches mobile's "only include changed fields" sender-side discipline.
- Add `bio` to the `update-profile` payload in `onSave` (~L222-235) only when changed. Use `bio: bio.trim()` (allow explicit empty-string clear when the user deliberately empties the field — mobile's wire shape and our updated receiver both support this for bio specifically via `!== undefined`).
- Block save if `bioErrors.length > 0`. Surface via `hasValidationError`.

### 2. `src/components/modals/SpaceSettingsModal/Account.tsx`

Add bio TextArea below display name:

- New props: `bio`, `setBio`, `bioErrors`.
- Update section header copy to mobile's framing: **"Override your display name, avatar, and bio for this Space. Other Spaces and your global profile are unaffected."** (Current copy is "Change your avatar and name for this Space" — change anyway since it's already misleading.)
- TextArea: pattern lifted from `UserSettingsModal/General.tsx:132-158` — `placeholder="Tell people about yourself in this Space..."`, `rows={3}`, `maxLength={160}`, `variant="filled"`, error display tied to `bioErrors`.
- Layout: bio after the avatar/displayName row, before the Roles section.

### 3. `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`

Wire the new fields:

- Pull `bio`, `setBio`, `bioErrors` from the `spaceProfile` (useSpaceProfile) return.
- Pass through to `<Account ...>`.
- Save-disabled logic at ~L674-678 keys off `spaceProfile.hasValidationError` — already aggregated in the hook. No change needed beyond plumbing.

### 4. `src/services/MessageService.ts` — `saveMessage` receive (~L1153-1185)

Current code overwrites unconditionally:

```ts
participant.display_name = decryptedContent.content.displayName;
participant.user_icon = decryptedContent.content.userIcon;
participant.inbox_address = inboxAddress;
```

Replace with field-presence-aware merge (mobile's pattern):

```ts
if (decryptedContent.content.displayName) {
  participant.display_name = decryptedContent.content.displayName;
}
if (decryptedContent.content.userIcon) {
  participant.user_icon = decryptedContent.content.userIcon;
}
if (decryptedContent.content.bio !== undefined) {
  participant.bio = decryptedContent.content.bio;
}
participant.inbox_address = inboxAddress;
```

- `displayName` / `userIcon` use truthiness because the wire shape skips empty strings (mobile and our updated sender both do).
- `bio` uses `!== undefined` so an explicit empty string clears — matches the deliberate "clear my bio" flow.
- `inbox_address` stays unconditional (`update-profile` IS the key-rotation announcement).

### 5. `src/services/MessageService.ts` — `addMessage` receive (~L1655-1697)

Same upsert-aware merge as step 4. Then the existing block continues with `messageDB.saveSpaceMember(participant)` + the `queryClient.setQueryData(buildSpaceMembersKey({ spaceId }), ...)` cache update. The cache update is the only structural difference from step 4 — leave it intact.

### 6. `src/services/MessageService.ts` — tag-rotation broadcast (~L489-495)

The `UpdateProfileMessage` constructed during tag rebroadcast doesn't include `bio` from config. Add:

```ts
const updateProfileMessage: UpdateProfileMessage = {
  type: 'update-profile',
  displayName,
  userIcon,
  senderId: selfAddress,
  ...(config.bio ? { bio: config.bio } : {}),
  ...(resolvedTag ? { spaceTag: resolvedTag } : {}),
};
```

Low priority but cheap; the global bio gets carried into per-space SpaceMember records on the next tag-driven rebroadcast for users who haven't set a per-space override.

### 7. `src/components/user/UserProfile.tsx` — render bio

Add a bio block in the in-space user-click card. Renders only when `props.user.bio` is non-empty so users without a bio see no empty section.

Placement: after the Roles section, before the personal note section (~L270, before the `{!isOwnProfile && (...)}` block for the note). Keeps the visual hierarchy "identity → community role → bio (theirs) → your private note → actions".

```tsx
{props.user.bio && (
  <div className="user-profile-bio-section">
    <div className="user-profile-bio-label">
      <Trans>About</Trans>
    </div>
    <p className="user-profile-bio-text">{props.user.bio}</p>
  </div>
)}
```

SCSS: add two small rules to `UserProfile.scss` for `.user-profile-bio-section` (padding, optional border-top to match other sections) and `.user-profile-bio-text` (text-sm, text-main, whitespace-pre-wrap so newlines render). Use solid color tokens, no opacity modifiers on text.

The `props.user` object passed in already comes from `SpaceMember` records in most call sites (`Channel.tsx`, `Message.tsx`); verify by inspection that `.bio` flows through naturally. If any consumer constructs a `props.user` shape that doesn't include `bio`, add it.

## Shared promotion candidates

None for this port. All needed types already in shared:

- `UpdateProfileMessage.bio?: string` ✅ (`quorum-shared/src/types/message.ts:28`)
- `UserProfile.bio?: string` ✅ (`quorum-shared/src/types/user.ts:103`)
- `SpaceMember` extends `UserProfile` ✅ (inherits `bio`)
- `validateUserBio` + `MAX_BIO_LENGTH = 160` ✅ (`quorum-shared/src/validation/userBio.ts`)

## Build sequence

1. `useSpaceProfile.ts` — bio state, baseline tracking, validation, payload inclusion (changed-only).
2. `Account.tsx` + `SpaceSettingsModal.tsx` — textarea + prop plumbing + copy update.
3. `MessageService.ts` — upsert-aware fix in both receive sites.
4. `MessageService.ts` — bio in tag-rebroadcast payload.
5. `UserProfile.tsx` + `UserProfile.scss` — bio render.
6. Type-check + lint.
7. Smoke test (see below).
8. Doc updates: candidates.md row, shipped-log.md entry — commit on the branch, ship with the feature commits.

## Verification checklist

- [ ] Open Space A → Settings → Account: enter a bio, save. Modal closes cleanly.
- [ ] Reopen the same modal — bio is pre-filled from `SpaceMember.bio`.
- [ ] Enter > 160 chars — Save disabled, error shown.
- [ ] Enter HTML/XSS-flavored content (`<script>`) — Save disabled, validation error shown (validateNameForXSS catches it).
- [ ] Open Space B → Settings → Account: bio is empty (per-space, not global). Set a different bio. Save.
- [ ] Verify Space A's bio is unchanged when reopening A's settings.
- [ ] Edit only the bio (no displayName, no avatar change), save. Inspect outbound `update-profile` payload (DevTools network or via a logger.debug) — only `bio` should be present; no displayName, no userIcon.
- [ ] After step above, reopen Space A's Account modal — displayName and avatar still match what they were. (Confirms sender-side change-only gating.)
- [ ] In Space A, click another member's name/avatar in the channel — the `UserProfile` card opens. If they have a bio, an "About" section shows it; if they don't, no empty section is rendered.
- [ ] Same check on your own profile (click your own message author): your per-space bio shows in your own card.
- [ ] Global bio in UserSettingsModal → General still works (regression).
- [ ] DM profile sidebar still shows public bio (regression on existing `DMUserProfileSidebar`).
- [ ] Tag-rotation rebroadcast: change your spaceTag in UserSettingsModal → General, save. Other members eventually receive an `update-profile` that includes your global bio (if you have one). Verify the receiver's stored displayName/userIcon are NOT clobbered if your local values were defined (i.e. the upsert-aware merge is doing its job).

## Out of scope

- Member-list bio rendering (no member-list surface exists in the space sidebar today; if added later, it would naturally read `member.bio`).
- A "Reset to global bio" / "Clear override" affordance — mobile doesn't ship one either, and our upsert-aware receiver makes empty-string clears work correctly for explicit user action, which is enough.
- Public-profile (global) bio changes — those continue to flow through UserSettingsModal → General as today.
- Refactoring the existing `updateUserProfile(displayName ?? '', pfpUrl ?? '', ...)` callers to pass `undefined` instead of `''` — the new receiver gate makes the difference irrelevant. Leaving them as-is keeps the diff small.

## PR description draft

```markdown
## What
Port per-space profile bio override from `quorum-mobile` to `quorum-desktop`.

- Adds bio editing to Space Settings → Account (already had display name + avatar override; bio was missing).
- Adds an "About" section to the in-space `UserProfile` card so per-space bios are visible end-to-end.
- Bundles a fix to `MessageService` update-profile receive handlers so partial profile updates no longer clobber unrelated stored fields.

## Mobile source
- `quorum-mobile/components/SpaceSettingsModal.tsx` (per-space profile block + UI)
- `quorum-mobile/services/space/spaceMessageService.ts` (wire shape)
- `quorum-mobile/context/WebSocketContext.tsx` (upsert-aware receive handler pattern)
- `quorum-mobile/components/UserProfileModal.tsx` (bio render reference)

## Why
UX-parity gap flagged 2026-06-08. Users in multiple Spaces can already vary their display name and avatar per Space on desktop; bio is the missing third leg of the same override capability. Bundling the UserProfile bio render is what makes the feature visible to other members (previously: nothing on the space side rendered `member.bio`).

## Cross-repo summary
- **quorum-shared**: not touched — all types already exist (`UpdateProfileMessage.bio?`, `UserProfile.bio?`, `validateUserBio`).
- **quorum-desktop**: THIS PR.
- **quorum-mobile**: not touched.

## Smoke test
- [ ] Space A: set bio, save, reopen — bio persists.
- [ ] Bio > 160 chars or HTML — Save disabled, error shown.
- [ ] Space B: different bio, save — Space A's bio unchanged.
- [ ] Edit only bio (no displayName/avatar change) — receivers' displayName/avatar untouched.
- [ ] Click member with bio in channel — About section shows it. Member without bio — no empty section.
- [ ] Global bio in User Settings → General still works (regression).
- [ ] DM profile sidebar still shows public bio (regression).
```

---

*Last updated: 2026-06-08 — finalized scope after verification pass. Added step 7 (UserProfile.tsx bio render) after confirming no space-side surface renders `member.bio` today. Documented sender-audit finding (low risk for the upsert-aware fix) and structural difference between the two receive sites (`addMessage` also writes the React Query cache).*

*Previously: 2026-06-08 — initial draft on the primary clone, then moved to .worktrees/secondary to align with the standing workflow convention.*
