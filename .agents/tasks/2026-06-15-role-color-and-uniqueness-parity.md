---
type: task
title: "Bring desktop roles to parity: shared color tokens + tag/name uniqueness + remove-from-user confirm"
status: in-progress
created: 2026-06-15
shared_dependency: "@quilibrium/quorum-shared 2.1.0-30 (merged to shared master; desktop sees it via link: on a local build; NOT yet published to npm — that's the mobile blocker, not desktop's)"
mobile_status: "shipped to mobile (branch held for the -30 publish); desktop is the remaining client"
---

# Desktop role parity: shared color tokens + uniqueness + remove-from-user confirm

## Why this exists

Two role features were just built into `@quilibrium/quorum-shared` (merged to master,
2.1.0-30) and consumed on **mobile**. Desktop is the remaining client and currently
lacks all of it. None of this is urgent or breaking — desktop works today — but the two
clients have now diverged, so this documents exactly what desktop needs to catch up.
Desktop is our high-confidence home turf, so this is normal self-mergeable work
(smoke-test runtime changes, then `/ship-pr`).

Desktop consumes shared via `link:`, so on a local build it already sees the new
exports. No publish is needed for desktop (the `-30` npm publish is the *mobile*
blocker). So this can be done independently, now.

### What shared now provides (all in `@quilibrium/quorum-shared`)

- **Color tokens:** `getRoleColorHex(color)` (token / raw hex / legacy `rgb(var(--success))` / fallback → render hex, never throws), `getDefaultRoleColor(seed)` (deterministic token from a seed like roleId), `ROLE_COLORS` (palette). `Role.color` is now documented as a portable token (store a token, resolve to hex at render — same pattern as the icon/folder picker). `ICON_COLORS`/`FOLDER_COLORS` were extended (+teal/sky/indigo/pink; yellow `#ca8a04`→`#eab308`).
- **Uniqueness:** `findRoleConflict(roles, candidate, excludeRoleId?)`, `isRoleIdentityAvailable(...)`, `getUniqueRoleDefaults(roles, baseName?, baseTag?)` (auto-numbered `New Role 2` / `newrole-2`).

### The core problem on desktop today

`role.color` is hardcoded to the **literal string `'rgb(var(--success))'`** on create
(`src/hooks/business/spaces/useRoleManagement.ts:51`) — a web CSS variable that the
browser resolves at paint, which is why every desktop role is the **same green** and
there's no color picker. React Native can't parse that string, which is the cross-platform
bug the shared token system fixes. Desktop also never dedupes role tag/name, so spamming
"Add Role" makes identical roles.

## Scope (minimal parity — each item independent)

### 1. Color: store a token on create — **S**
`src/hooks/business/spaces/useRoleManagement.ts:51` — replace
`color: 'rgb(var(--success))'` with `color: getDefaultRoleColor(newRole.roleId)`
(import from shared). New roles get a stable, distinct, deterministic color that syncs.

### 2. Color: resolve the token at every render site — **S–M (×5 sites)**
Desktop renders `role.color` **raw** everywhere (it relied on the browser resolving the
css-var). Wrap each in `getRoleColorHex(...)`:
- `src/components/modals/SpaceSettingsModal/Roles.tsx:116` — `backgroundColor: r.color`
- `src/components/message/MentionDropdown.tsx:219` — `backgroundColor: option.data.color`
- `src/components/modals/SpaceSettingsModal/Account.tsx:252-255` — currently hardcodes the css-var + ignores `r.color`; switch to `getRoleColorHex(r.color)`
- `src/components/user/UserProfile.tsx:290` and `:299` — add `style={{ backgroundColor: getRoleColorHex(r.color) }}` to the `user-profile-role-tag` span (both branches); currently colored purely by CSS class hardcoded to the css-var
- The hardcoded css-var in `UserProfile.scss:136` / `_modal_common.scss:950` can stay as a harmless visual fallback; no CSS change required for correctness.

### 3. Uniqueness: auto-numbered defaults on add — **S**
`src/hooks/business/spaces/useRoleManagement.ts:48-55` — replace the hardcoded
`displayName: 'Role Name'` / `roleTag: 'role-tag'` with `getUniqueRoleDefaults(roles)`.
Spamming "Add Role" then yields `Role Name 2` / `role-tag-2`, never duplicates.

### 4. Uniqueness: collision check on edit — **M (UX decision)**
`updateRoleTag` (`useRoleManagement.ts:86`) and `updateRoleDisplayName` (`:92`) set values
with **no validation**. Wire `findRoleConflict(roles, { roleTag, displayName }, roleId)`.
**Desktop uses an explicit Save button** (not autosave like mobile) — `categoryNeedsSave`
includes Roles; `saveChanges` (`SpaceSettingsModal.tsx:348`) broadcasts all role edits at
once. So the natural fit is: show the conflict inline AND block Save while a conflict
exists. There's already a wired-but-unused `roleValidationError` slot
(`SpaceSettingsModal.tsx:325-326`, displayed at `Roles.tsx:231`) — it's only ever set to
`''`. Either drive that bottom-of-list error, or refactor to per-field inline errors.
**Open choice:** per-field vs bottom-of-list error placement (the wired slot makes
bottom-of-list the cheaper path).

### 5. Remove-role-from-user confirmation — **SKIPPED (deliberate desktop divergence)**
`src/components/user/UserProfile.tsx` calls `removeRole(...)` immediately, no confirm.
Mobile just added a confirm here. **Decision (2026-06-15, user): desktop keeps the
immediate, no-confirm behavior** — removing a role from a member is cheap and reversible
on desktop, so the modal is friction we don't want. This is an intentional UX divergence
from mobile, not an oversight. (Desktop still confirms role *deletion* from the Roles tab,
which is a destructive action — that's untouched.)

> **Lead-dev note:** worth a short Telegram heads-up that desktop chose NOT to mirror
> mobile's remove-from-member confirm. Per atlas rules, the platform-divergence call is
> the lead's to be aware of, even though the desktop UX call is ours.

## Legacy data — no migration needed (verified)

Existing desktop roles all carry `color: 'rgb(var(--success))'` in already-broadcast
manifests. `getRoleColorHex` maps that exact string to green, so once the render sites
(item 2) resolve through it, **legacy roles keep rendering green with zero migration, no
re-broadcast, no schema change.** Item 2 is the only change legacy roles need.

## Beyond parity — optional follow-up (NOT in this scope)

**A desktop role color PICKER.** Parity only needs storing the deterministic default token
+ rendering it. But desktop has no way to *choose* a role's color (every role is one
color today). A picker drawing from the shared `ROLE_COLORS` palette would be a real UX
addition to the Roles settings tab. Mobile also has no explicit picker (it auto-assigns),
so this isn't a parity gap, just an opportunity — spin it into its own task if wanted.

## Suggested sequencing

Items 1+2 (color) ship together — they're the actual cross-platform fix and the lowest
risk. 3 is trivial. 4 and 5 each carry a small UX choice (error/confirm placement) but are
otherwise straightforward. All consume already-merged shared code via `link:`; no shared
work, no publish dependency for desktop. Standard desktop flow: smoke-test, `/ship-pr`.

---
*Last updated: 2026-06-15*
