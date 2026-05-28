---
type: task
title: Investigate and fix structural type divergence between quorum-shared and quorum-desktop
status: partial-done
created: 2026-05-27
updated: 2026-05-28
priority: high
resolution_summary: |
  NotificationSettings — DONE via quorum-shared#18 (Space* rename) + quorum-desktop#160 (dedup). Desktop now re-exports from shared.
  Cross-device sync of notification prefs — moved to lead-dev decision; see reports/2026-05-28-notification-architecture-divergence.md and the GitHub issue draft in .temp/. Discovery: mobile uses a fundamentally different architecture (MMKV-based, not UserConfig-synced), not just a different shape.
  NavItem — DEFERRED. Mobile has no folder UI yet (constructs only space-variant items), so the desktop icon/color literal types don't conflict in practice. Revisit when mobile builds folders.
  UserNote — DONE in PR #17 (earlier).
---

# Investigate and fix structural type divergence between quorum-shared and quorum-desktop

## How this was discovered

While shipping the [YouTube previews privacy toggle](.done/2026-05-27-userconfig-type-drift.md) on branch `chore/userconfig-type-drift-and-yt-toggle`, I attempted to dedupe a local `UserConfig` type in `src/db/messages.ts` against the shared one in `quorum-shared/src/types/user.ts`. The local and shared `UserConfig` had identical shapes (after I added the missing fields), so deduping seemed safe.

It wasn't. Switching all imports of `UserConfig` to point at the shared type surfaced a **deeper structural problem**: `UserConfig` references `NavItem` and `NotificationSettings`, and **both of those types are also duplicated locally vs in shared, AND they have different shapes**.

The dedup attempt was reverted to keep the YouTube toggle PR small and focused. This task captures the bigger investigation that needs to happen in a dedicated branch.

## Confirmed divergences

### 1. `NavItem` — incompatible field types

| Field | Local (`src/db/messages.ts`) | Shared (`quorum-shared/src/types/user.ts`) | Problem |
|---|---|---|---|
| `icon` | `IconName \| undefined` | `string \| undefined` | Local is stricter (literal union from `components/primitives`) |
| `color` | `IconColor \| undefined` | `FolderColor \| undefined` (= `string`) | Local is stricter (literal union from `components/space/IconPicker/types`) |
| `iconVariant`, `type`, `id`, `name`, `spaceIds`, `createdDate`, `modifiedDate` | match | match | OK |

**Impact:** local `NavItem[]` is NOT assignable to shared `NavItem[]` and vice versa. Code reading config through the shared type loses the literal-narrowing on `icon`/`color`. Code constructing items locally and feeding them into shared code would have to widen them.

### 2. `NotificationSettings` — completely different feature designs

| Field | Local (`src/types/notifications.ts`) | Shared (`quorum-shared/src/types/user.ts`) |
|---|---|---|
| Identity | `spaceId: string` | (no spaceId; keyed by map in UserConfig) |
| Mute | `isMuted?: boolean` | (no equivalent) |
| Granularity | `enabledNotificationTypes: NotificationTypeId[]` (array of enum) | `mentions?: boolean`, `replies?: boolean`, `all?: boolean` (booleans) |
| Master | (none) | `enabled?: boolean` |

These are **fundamentally different models** for "what notifications do I want from this space":
- **Local**: opinionated, supports muting + a curated enum list of granular triggers (mentions, replies, etc.)
- **Shared**: simpler 4-boolean shape

**This is likely a real cross-device sync defect**, not just a type issue. If desktop writes `{ spaceId: "X", isMuted: true, enabledNotificationTypes: [...] }` into `config.notificationSettings[spaceId]` and uploads to the server, mobile downloads that same JSON and tries to read it as `{ enabled, mentions, replies, all }` — none of which are present. Mobile's notification settings would silently appear "default" regardless of what desktop set.

**Action item before any code change**: confirm whether mobile actually consumes `notificationSettings`. If mobile silently ignores it, the bug is latent (no user-visible damage yet). If mobile reads it, we have a real cross-device bug that's been shipping.

### 3. `UserNote` — minor

| Where | Shape |
|---|---|
| Local (`src/db/messages.ts:UserNote`) | `interface UserNote { targetAddress: string; note: string; updatedAt: number }` |
| Shared (`quorum-shared/src/types/user.ts`, inline in UserConfig) | `{ targetAddress: string; note: string; updatedAt: number }` |

Structurally identical. Not a real divergence, just a stylistic difference (named interface vs inline). Easy to unify.

## Why didn't earlier migration work surface this?

This is surprising because extensive analysis was done during prior `quorum-shared` migration work and nothing like this surfaced. Possible explanations:

1. **Earlier migrations focused on *adding* shared types and consumers, not *replacing* local duplicates.** Adding doesn't fail at the type level because TypeScript happily allows two definitions of the same name in different modules. Drift only surfaces when you try to dedupe.

2. **The shared `NotificationSettings` (lines 24-29 in `quorum-shared/src/types/user.ts`) was probably added as a placeholder during initial migration**, while desktop's `NotificationSettings` (in `src/types/notifications.ts`) is the real, evolved one. The original migration didn't notice because no consumer actually crossed the boundary.

3. **Cross-repo audits checked for missing-in-shared, not for shape-mismatch.** A migration audit asks "is `UserConfig` exported from shared?" — yes. It doesn't ask "is the entire transitive type closure compatible?" — which is the actual question.

4. **The `UserConfig` consumer pattern is mostly `config?.field` access**, where TypeScript only enforces the immediate field type. If you access `config.notificationSettings[spaceId].isMuted`, TypeScript checks `NotificationSettings` against whichever local declaration is in scope where the code was written — not against what the shared type allows. So drift is invisible until you flip everything to shared.

## Recommended next steps (for a dedicated branch)

### Phase 0: investigation (read-only, no code change)
1. Check mobile's actual usage of `notificationSettings`: does mobile read this field? What shape does it expect? `git grep` in `quorum-mobile`.
2. Check on-wire JSON: dump a real synced config from production and inspect the shape of `notificationSettings` actually present in the encrypted blob.
3. Confirm whether the divergence is latent (mobile ignores) or active (mobile misreads).

### Phase 1: pick the canonical shape per type
- For `NotificationSettings`: which design wins? Desktop's `{ spaceId, isMuted, enabledNotificationTypes[] }` or shared's `{ enabled, mentions, replies, all }`? Desktop's seems more product-complete. Probably the shared one needs to be **replaced** with desktop's shape, then mobile needs to mirror.
- For `NavItem`: desktop's stricter `IconName`/`IconColor` is better but requires shared to know about those literal unions. Either lift them into shared, OR keep `NavItem.icon: string` in shared and let consumers widen/narrow at boundaries.
- For `UserNote`: easy — pull desktop's `interface UserNote` into shared, replace the inline def.

### Phase 2: shared changes (separate PR per type, or one bundled PR)
- Update `quorum-shared/src/types/user.ts` (and `IconName`/`IconColor` exports if needed).
- Bump version, push, merge.

### Phase 3: desktop dedup (only after Phase 2 ships)
- Re-attempt the import switch for `UserConfig` consumers (11 files).
- Drop local `NotificationSettings`, `NavItem`, `UserNote`.
- Run full typecheck + targeted manual testing of notification settings, folders, user notes.

### Phase 4: mobile parity
- If we changed shared's `NotificationSettings` shape, mobile needs to update its UI/storage code accordingly.
- Coordinate with mobile devs or do it ourselves.

## Risks

- **Data migration:** if `NotificationSettings` shape changes on the wire, existing synced configs in production will need a one-time read-side conversion. Possibly handled by treating old configs as having `enabledNotificationTypes: []` (no opt-ins, equivalent to "all off"). Needs careful thought.
- **Mobile coordination:** changes touching the synced contract require both clients to update before deployment. Versioned config schema?
- **Scope creep:** this branch (`chore/userconfig-type-drift-and-yt-toggle`) deliberately avoided this. Keep it scoped to a NEW branch when you tackle it.

## Files involved (read-only initial map)

**Local types to potentially remove:**
- `src/db/messages.ts:48-108` — `UserConfig` (already updated this branch)
- `src/db/messages.ts` `NavItem` definition (around line 30-45 — see file)
- `src/types/notifications.ts` — `NotificationSettings` (and `NotificationTypeId` enum)
- `src/db/messages.ts:UserNote` interface

**Shared types to potentially update:**
- `quorum-shared/src/types/user.ts:24-29` — `NotificationSettings` (probably wrong shape)
- `quorum-shared/src/types/user.ts:10-22` — `NavItem` (probably needs literal types or stay as string)
- `quorum-shared/src/types/user.ts:UserConfig.userNotes` — inline def, switch to named import

**Files importing the local types** (initial sample from grep):
- `UserConfig`: 10 import sites already mapped in this branch's prior task (see `.done/2026-05-27-userconfig-type-drift.md`)
- `NavItem`: 8+ files (folder utilities, navbar components)
- `NotificationSettings`: spread across mentions/replies hooks and `MessageService.ts`

## Related

- Prior task: [.done/2026-05-27-userconfig-type-drift.md](./2026-05-27-userconfig-type-drift.md) — the original UserConfig type drift discovery (now resolved at the field level, structural dedup deferred to this task)
- Architecture doc: [quorum-shared-architecture.md](../docs/quorum-shared-architecture.md)
- Sync system doc: [config-sync-system.md](../docs/config-sync-system.md)

---

## Phase 0 findings (2026-05-27)

### Mobile usage of `notificationSettings`

Inspected via local clone of `quorum-mobile` (commit at the time of investigation):

- `notificationSettings` is referenced in **3 files only**: `services/config/configService.ts`, `hooks/useUserConfig.ts`, and the architecture doc.
- The mobile hook `useNotificationSettings()` returns `config?.notificationSettings ?? { enabled: true }` — treating the field as a single flat object, not a per-space map.
- **No mobile UI consumer reads any specific field** (`enabled`, `mentions`, `replies`, `all` — or desktop's `isMuted`, `enabledNotificationTypes`). It's scaffolding only.
- The fallback shape `{ enabled: true }` matches the placeholder shared type, suggesting mobile's hook was written against the shared type without an actual UI design behind it.

**Implication**: there is NO active cross-device sync bug today. Mobile doesn't have a notifications UI yet (per recollection — needs verification against the latest mobile build, which is not currently accessible).

### Desktop usage of `NotificationSettings` (this codebase)

**This is a real, fully-implemented feature in desktop, NOT scaffolding.** Evidence:

- **19 files** reference `isMuted` or `enabledNotificationTypes`.
- **9+ files** call `config?.notificationSettings?.[spaceId]?.isMuted` to gate space-level notification suppression — covering mention counters, reply counters, notification panel, and channel mute behavior.
- The `NotificationTypeId` enum (`'mention-you'`, `'mention-everyone'`, `'mention-roles'`, `'reply'`) is consumed in 12 files, including:
  - [`useChannelMentionCounts.ts:66-70`](../../src/hooks/business/mentions/useChannelMentionCounts.ts) — filters mentions by which types the user has enabled per-space
  - [`useMentionNotificationSettings.ts:84-128`](../../src/hooks/business/mentions/useMentionNotificationSettings.ts) — loads/saves the array, drives a multi-select dropdown in the space settings modal
  - [`NotificationPanel.tsx`](../../src/components/notifications/NotificationPanel.tsx) — uses the type discriminator to render mentions vs replies
  - [`NotificationService.ts`](../../src/services/NotificationService.ts) — branches on `'reply'` for browser/OS notification text
- Backed by a dedicated feature doc: [features/mention-notification-system.md](../docs/features/mention-notification-system.md), and the original implementation lives in `.done/mention-notification-settings-phase4.md`.

### Conclusion on `notificationSettings`

The two type shapes describe genuinely different products:

| Question | Desktop | Shared (placeholder) |
|---|---|---|
| Per-space or global? | Per-space (`[spaceId]: { ... }`) | Global (flat object) |
| Granularity | Enum array (4 trigger types: mention-you / mention-everyone / mention-roles / reply) | 3 booleans (mentions, replies, all) |
| Mute | Yes, `isMuted` per-space | No equivalent |
| Production use | Yes, deeply wired into UI | No (placeholder; mobile has hook scaffolding but no UI) |

Desktop's design is the **only one that's actually shipped to users**. Mobile's hook code is scaffolding that hasn't been wired to UI yet.

### Recommendation (pending mobile parity check)

When mobile codebase access is unblocked, the path forward is most likely:

1. **Promote desktop's `NotificationSettings` shape to `@quilibrium/quorum-shared`** (replacing the placeholder). The shape should be exactly `{ spaceId, isMuted?, enabledNotificationTypes: NotificationTypeId[] }`, plus the `NotificationTypeId` literal union.
2. **Update mobile's `useNotificationSettings` hook** to use the new shape (low-impact since no UI consumes it).
3. **Remove desktop's local `src/types/notifications.ts` and import from shared.**

This is **not safe to do today** because we don't have visibility into whether mobile has a newer notifications UI that contradicts this assumption.

### What IS safe to do today (no mobile access needed)

While the `notificationSettings` decision is blocked, the following structural fixes are NOT blocked:

- **`UserNote`**: shapes are identical between local (`src/db/messages.ts:UserNote`) and inline-in-`UserConfig` (shared). Can be deduplicated by lifting it to a named `UserNote` type in shared and importing it. Zero risk.
- **`NavItem`**: desktop's stricter `icon: IconName` / `color: IconColor` are render-time refinements, not wire-format concerns. The shared `NavItem.icon: string` is the correct wire shape. Desktop should narrow at render boundaries, not maintain a duplicate type. Low risk.
- **Defensive comments**: add a "this is a sync-critical local copy, keep aligned with quorum-shared `UserConfig`" header comment in `src/db/messages.ts` so future agents/devs notice the constraint. Trivial.
- **Staleness audit of shared types**: check whether the placeholder `NotificationSettings` in `quorum-shared/src/types/user.ts` has been touched since the initial migration. If it's untouched, that's evidence it's a stub waiting for a real design.

---

*Created: 2026-05-27 — uncovered during YouTube previews toggle work. Reverted dedup attempt because NavItem and NotificationSettings shapes diverge structurally, not just on field presence. Needs dedicated investigation before any cleanup.*

*Updated: 2026-05-27 (Phase 0) — confirmed desktop's NotificationSettings is fully shipped production code; mobile's is scaffolding-only. Recommendation is to promote desktop's shape to shared, but blocked on mobile codebase access (needs latest mobile build to verify no newer UI exists).*

*Updated: 2026-05-27 (Phase 1 — unblocked work) — three small wins shipped on this branch:*
- *`UserNote` dedup done. Lifted the inline object type in `UserConfig.userNotes` to a named `UserNote` export in `quorum-shared` (2.1.0-16, PR #17). Desktop now imports and re-exports it instead of maintaining a duplicate interface.*
- *Defensive comment added to the local `UserConfig` in `src/db/messages.ts` noting it must stay aligned with shared. Trimmed during the comment-pruning pass to a two-line note.*
- *Reassessed `NavItem` after the dedup attempt earlier in this session. Initially thought it was unblocked, but the desktop literal `IconName` / `IconColor` types are tighter than shared's `string`. Deduping by widening would downgrade desktop's type safety; the right fix is a design discussion that benefits from mobile context (do mobile folder UIs need icons too?). Reclassified as mobile-blocked.*

*`NotificationSettings` structural alignment remains the main open item, still blocked on mobile codebase access.*

---

## Phase 0 confirmation (2026-05-28) — mobile codebase access unblocked

The latest `quorum-mobile` is now cloned locally at `D:\GitHub\Quilibrium\quorum-mobile`. Re-ran the Phase 0 grep against the real current source. Results below.

### Shared package versions (current)
- Desktop has `@quilibrium/quorum-shared@2.1.0-16` (from PR #17, with `UserNote` lift)
- Mobile has `@quilibrium/quorum-shared@2.1.0` (one minor behind desktop, no functional gap for this investigation)

### `notificationSettings` — mobile usage re-verified

Re-grepped `quorum-mobile` for `notificationSettings | NotificationSettings | NotificationTypeId | isMuted | enabledNotificationTypes`. Hits:

- `services/config/configService.ts` — only the default config initialiser: `notificationSettings: {}` (empty map). Never read, never branched on, never set elsewhere.
- `hooks/useUserConfig.ts` — declares `useNotificationSettings()` and `updateNotificationSettings()`, exposed as part of the hook surface. Returns `config?.notificationSettings ?? { enabled: true }`.
- `.agents/docs/quorum-shared-architecture.md` — docs only.

Confirmed: **`useNotificationSettings` is not imported anywhere else in `quorum-mobile`.** Zero UI consumers. Pure scaffolding.

The fallback `{ enabled: true }` is also wrong even against shared's *current* type: shared declares `notificationSettings?: { [spaceId: string]: NotificationSettings }` (a per-space map), so `{ enabled: true }` doesn't satisfy the map shape — it's reading the top level as if it were a single flat object. This is a long-dormant bug in the mobile hook; nothing depends on it being correct.

### `NavItem` — mobile usage re-verified

Mobile uses `NavItem` as a typed container in two places:
- `services/config/configService.ts` — imports the type for `validateItems(items: NavItem[])` (folder/space count limits, no field access on `icon`/`color`).
- `services/space/spaceService.ts` — constructs `const newSpaceItem: NavItem = { type: 'space', id: spaceAddress }` (space variant only, no folder fields).

**Mobile never reads or writes `icon` or `color` on a folder `NavItem`.** No folder UI exists yet. The shared widened `string` shape causes mobile no harm today.

(The `item.icon` hits in `components/Chat/DirectMessagesList.tsx` are unrelated — those refer to a chat-list item, not a `NavItem`.)

### Conclusion: both blockers cleared

| Type | Original status | New status |
|---|---|---|
| `NotificationSettings` | Blocked: "is mobile UI consuming this?" | **Unblocked.** Mobile has zero UI consumers. Scaffolding hook is the only touch point. |
| `NavItem.icon` / `.color` | Blocked: "do mobile folder UIs need icons?" | **Unblocked.** Mobile has no folder UI; constructs space-variant items only. |

### Action plan (now executable)

#### `NotificationSettings` — promote desktop's shape to shared

1. **Update `quorum-shared/src/types/user.ts`**: replace the placeholder `NotificationSettings` with desktop's shape:
   ```ts
   export type NotificationTypeId = 'mention-you' | 'mention-everyone' | 'mention-roles' | 'reply';

   export type NotificationSettings = {
     spaceId: string;
     enabledNotificationTypes: NotificationTypeId[];
     isMuted?: boolean;
   };
   ```
   `UserConfig.notificationSettings?: { [spaceId: string]: NotificationSettings }` stays as-is (already a per-space map). Bump shared to 2.1.0-17 (or next).

2. **Update `quorum-mobile`** in lockstep:
   - Fix `useNotificationSettings()` fallback in `hooks/useUserConfig.ts` — currently returns `{ enabled: true }`, which is wrong against the current shared type *and* the new one. Return `{}` (empty per-space map) and let future mobile UI work read `config.notificationSettings?.[spaceId]`. Or remove the hook entirely until mobile has a real consumer — preferred, since it's dead code.
   - `services/config/configService.ts` already initialises `notificationSettings: {}` — no change needed.

3. **Update `quorum-desktop`**:
   - Delete `src/types/notifications.ts`'s `NotificationSettings` and `NotificationTypeId` exports.
   - Re-export both from `@quilibrium/quorum-shared` (preserve the export path so the 19 consumer files don't have to change imports — same pattern used for `UserNote` in PR #17).
   - Keep desktop-only types in `src/types/notifications.ts`: `NotificationSettingOption`, `ReplyNotification` (UI concerns, not wire format).

4. **No wire migration needed.** Desktop has been writing `{ spaceId, enabledNotificationTypes, isMuted }` to the encrypted blob the whole time. Mobile reads but never consumes it. Promoting to shared just makes the type system match what's already on the wire.

#### `NavItem.icon` / `.color` — narrow shared, or narrow at boundary

Two viable approaches:

**Option A (preferred): lift `IconName` and folder `IconColor` literal unions into shared.**
- Pro: single source of truth, mobile gets the same narrow types when it eventually adds folder UI.
- Con: shared starts owning UI taxonomy (icon names). Worth doing only if the icon set is stable and shared between desktop and mobile.

**Option B: keep shared `NavItem.icon: string`, narrow at desktop boundary.**
- Pro: shared stays wire-format-only.
- Con: desktop has to do `as IconName` casts (or a `parseNavItem()` validator) at every IndexedDB read.

Given the icon set is already a stable, well-defined enum in desktop and mobile will likely consume the same icons when folder UI lands, **Option A is the cleaner long-term choice**. Lift `IconName` (the literal union of icon names) and folder `IconColor` into shared, then dedupe.

If mobile devs prefer not to take on the icon taxonomy yet, fall back to Option B.

### Suggested branch / PR sequencing

1. **Shared PR**: promote `NotificationSettings` + (Option A) lift `IconName`/`IconColor`. Bump shared. Get reviewed by mobile dev.
2. **Mobile PR**: bump shared dep, delete or fix `useNotificationSettings` fallback. Trivial change.
3. **Desktop PR**: bump shared dep, replace local `NotificationSettings` / `NotificationTypeId` with re-exports from shared, dedup `NavItem`.

Shared changes are backward-wire-compatible (the shape was already what desktop wrote), so PRs 1 and 3 can ship close together. Mobile PR is non-blocking since it has no consumer.

---

*Updated: 2026-05-28 — mobile codebase access unblocked. Re-ran Phase 0 grep against live `quorum-mobile` source. Confirmed: zero UI consumers of `notificationSettings` or `NavItem.icon`/`.color` on mobile. Both blockers cleared. Action plan above is executable.*

---

## What actually happened (2026-05-28 evening)

The plan above shipped, but with corrections discovered along the way:

### Shipped

1. **`UserNote`** — already done in PR #17 (March 2026). No further work needed.
2. **Notification settings dedup** — shipped as:
   - **quorum-shared#18** — `Space*` prefix rename. Investigation surfaced that the *real* `NotificationSettings` types had been in shared all along (commit `e9ef224` from March, during the utils migration prep). The "placeholder" `NotificationSettings` in `user.ts` is vestigial. The actual settings types lived under different filenames in `quorum-shared/src/types/notifications.ts` and were renamed to be more accurate about their per-space scope (`SpaceNotificationSettings`, `SpaceNotificationTypeId`, `SpaceNotificationSettingOption`). `ReplyNotification` kept its name (it's an event payload, not a settings type).
   - **quorum-desktop#160** — desktop's `src/types/notifications.ts` is now a re-export shim from shared. 21+ consumer files keep working unchanged.
   - **No mobile PR opened** — verified mobile doesn't import any of the renamed symbols. Per the cross-repo workflow doc's Pattern B (breaking shared change with zero mobile consumers), no mobile PR is needed.
3. **`UserConfig` mirror catch-up** (`isProfilePublic`, `farcasterLink`) — shipped as quorum-desktop#159 (separate warm-up PR).

### Deferred or moved

- **`NavItem.icon`/`.color`** — mobile only ever constructs `{ type: 'space', id }` items (no folder UI). Desktop's stricter `IconName`/`IconColor` literal types don't actually conflict in practice. **Deferred** — revisit when mobile builds folder UI.
- **Legacy `NotificationSettings` placeholder in `user.ts`** — left in place. Removing it would touch `UserConfig.notificationSettings`'s declared inner type, which is the surface the lead-dev needs to decide architecture on. Pre-emptively removing it now risks conflicting with whatever direction comes back.

### Big architectural discovery (NEW WORK, not part of this task's original scope)

Once mobile code was readable, it became clear desktop and mobile have **fundamentally different notification preference architectures**, not just different shapes:

- Desktop's per-space prefs live in `UserConfig.notificationSettings[spaceId]` (synced)
- Mobile's per-space prefs live in local-only MMKV (intentional: the iOS NSE reads MMKV, can't access JS state at notification time)

A cross-device sync of per-space mute is small in code terms (~50 LOC on mobile to bridge `UserConfig` ↔ MMKV) but is a real architectural decision the lead owns. Full investigation at [`reports/2026-05-28-notification-architecture-divergence.md`](../reports/2026-05-28-notification-architecture-divergence.md). GitHub issue drafted at [`../.temp/2026-05-28-notification-prefs-github-issue.md`](../.temp/2026-05-28-notification-prefs-github-issue.md).

This is no longer this task's problem — it's tracked as a separate "Notifications preference sync" open follow-up in the migration README.
