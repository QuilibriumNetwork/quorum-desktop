---
type: task
title: Investigate and fix structural type divergence between quorum-shared and quorum-desktop
status: todo
created: 2026-05-27
priority: high
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

The user (Kyn) noted this is surprising because we did extensive analysis during prior `quorum-shared` migration work and nothing like this surfaced. Possible explanations:

1. **Earlier migrations focused on *adding* shared types and consumers, not *replacing* local duplicates.** Adding doesn't fail at the type level because TypeScript happily allows two definitions of the same name in different modules. Drift only surfaces when you try to dedupe.

2. **The shared `NotificationSettings` (lines 24-29 in `quorum-shared/src/types/user.ts`) was probably added as a placeholder during initial migration**, while desktop's `NotificationSettings` (in `src/types/notifications.ts`) is the real, evolved one. The original migration didn't notice because no consumer actually crossed the boundary.

3. **Cross-repo audits checked for missing-in-shared, not for shape-mismatch.** A migration audit asks "is `UserConfig` exported from shared?" — yes. It doesn't ask "is the entire transitive type closure compatible?" — which is the actual question.

4. **The `UserConfig` consumer pattern is mostly `config?.field` access**, where TypeScript only enforces the immediate field type. If you access `config.notificationSettings[spaceId].isMuted`, TypeScript checks `NotificationSettings` against whichever local declaration is in scope where the code was written — not against what the shared type allows. So drift is invisible until you flip everything to shared.

## Recommended next steps (for a dedicated branch)

### Phase 0: investigation (read-only, no code change)
1. Check mobile's actual usage of `notificationSettings`: does mobile read this field? What shape does it expect? `git grep` in `quorum-mobile`.
2. Check on-wire JSON: dump a real synced config from production (Kyn's account) and inspect the shape of `notificationSettings` actually present in the encrypted blob.
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

*Created: 2026-05-27 — uncovered during YouTube previews toggle work. Reverted dedup attempt because NavItem and NotificationSettings shapes diverge structurally, not just on field presence. Needs dedicated investigation before any cleanup.*
