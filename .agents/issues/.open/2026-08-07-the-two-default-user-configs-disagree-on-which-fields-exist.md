---
type: bug
title: "The two getDefaultUserConfig implementations disagree on which fields exist, and the type system cannot catch it"
status: open
priority: medium
ai_generated: true
created: 2026-08-07
updated: 2026-08-07
severity: latent — one confirmed catastrophic instance already shipped and was fixed; the remaining divergences need a trigger
area: config sync / cross-client parity / quorum-shared
repos: quorum-desktop + quorum-mobile + quorum-shared
related:
  - ".agents/issues/2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md"
  - ".agents/issues/.open/2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md"
  - ".agents/issues/.open/2026-08-07-config-sync-overhaul-design.md"
  - ".agents/issues/.open/2026-07-31-spaces-list-cross-device-sync.md"
---

# The two default user configs disagree on which fields exist

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Every citation below is **READ** against source on 2026-08-07. The reachability
> assessment is **INFERRED from that code trace** and has not been observed on a
> device. Nothing here is MEASURED.

## Why this is filed as a bug rather than a task

Nothing is observably broken for users today, which normally argues for `task`.
It is filed as `bug` because the code is wrong *now* — two implementations of one
wire contract disagree — and because **the same function already produced one
catastrophic defect from exactly this cause.** Retype it with a one-line
frontmatter edit if you disagree.

## The divergence

`getDefaultUserConfig` is implemented independently in each client and the two
have drifted:

| Field | Desktop `src/utils.ts:10-31` | Mobile `services/config/configService.ts:264-276` |
|---|---|---|
| `address` | ✅ | ✅ |
| `spaceIds` | `[]` | `[]` |
| `allowSync` | `false` | `false` |
| `nonRepudiable` | `true` | `true` |
| `timestamp` | `0` | `0` |
| `bookmarks` | `[]` | `[]` |
| `deletedBookmarkIds` | `[]` | `[]` |
| **`items`** | ❌ absent | `[]` |
| **`notificationSettings`** | ❌ absent | `{}` |
| **`spaceKeys`** | `[]` | ❌ absent |
| **`userNotes`** | `[]` | ❌ absent |
| **`deletedUserNoteAddresses`** | `[]` | ❌ absent |
| **`name`** | `undefined` (explicit) | ❌ absent |
| **`profile_image`** | `undefined` (explicit) | ❌ absent |

## Why the compiler is no help

In `quorum-shared/src/types/user.ts:66`, **only `address` and `spaceIds` are
required.** Every other field on `UserConfig` is optional. So both
implementations typecheck, both will keep typechecking as they drift further, and
adding a field to the type obliges neither of them to produce it. (READ)

This is the same structural weakness as
[the merge asymmetry](2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md):
a contract maintained as two hand-written copies, with nothing that fails when
they disagree.

## This has already fired once, catastrophically

The row that is now `0` / `0` above read `Date.now()` / `0` until 2026-08-07
(desktop #320).
Desktop's default therefore claimed to be newer than the account's real config,
discarded it unopened, and — once the user enabled sync — published an **empty**
config over every other device. Fixed in
[the timestamp issue](../2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md).

That fix repaired **one row of this table.** The other seven were left, which is
what this issue is for. The lesson is not "defaults should be careful with
timestamps"; it is that a two-copy default will keep producing one of these until
there is one copy.

## The sharpest remaining divergence: `items`

`[]` is truthy in JavaScript, and desktop's legacy migration gates on truthiness:

```ts
// src/utils/folderUtils.ts:81-82
export const migrateToItems = (config: UserConfig): UserConfig => {
  if (config.items) return config; // Already migrated
```

It is called on every sidebar render, at
[`useNavItems.ts:48`](../../src/hooks/business/folders/useNavItems.ts#L48), whose
next line is `const items = migratedConfig.items || [];`. So:

| Incoming config | `migrateToItems` | Desktop sidebar |
|---|---|---|
| `items` **absent**, `spaceIds` populated | runs, builds items from `spaceIds` | renders the Spaces ✅ |
| `items: []`, `spaceIds` populated | returns early — `[]` is truthy | **renders nothing** ❌ |

An empty array does not mean "already migrated". It defeats the exact fallback
that exists to stop a config without `items` emptying the nav — and it does so
silently, because the early return is indistinguishable from a correctly migrated
config. This is one-directional: desktop's nav is config-driven, mobile's is
storage-driven (see
[the overhaul design](2026-08-07-config-sync-overhaul-design.md) §1.2), so only
desktop's sidebar is exposed.

### Why it is latent rather than live

Reaching it needs a config with `items: []` **and** a non-empty `spaceIds`. The
normal mobile paths keep the two in step — `spaceService.ts:401-405` appends to
both on join and create — and mobile's default seeds them both empty together.
(READ. INFERRED that no other path breaks the pairing; not exhaustively traced,
and not observed on a device.)

So this is a trap waiting for a trigger, not a reproduction. **The trigger is any
future code path that grows `spaceIds` without `items`** — and since mobile's own
UI never reads `items`, nothing on that side would notice it had stopped
maintaining them.

## The other divergences, assessed honestly

Recorded so nobody has to re-derive them, and so this issue is not overstated.

- **`notificationSettings` absent on desktop's default.** Every access found is
  guarded (`useChannelMute.ts`, `useMentionNotificationSettings.ts:144`,
  `useMutedSpacesSet.ts`). No known impact. (READ)
- **`spaceKeys` / `userNotes` / `deletedUserNoteAddresses` absent on mobile's
  default.** Mobile's reads are guarded — e.g. `configService.ts:478` checks
  presence and length before use. No known impact. (READ)
- **`name` / `profile_image` explicitly `undefined` on desktop.** `JSON.stringify`
  drops undefined-valued keys, so the distinction does not survive a round trip
  through the blob. Cosmetic. (READ)

The point of this issue is **not** these three. It is that there is no mechanism
preventing the next one from being another `timestamp`.

## Fix

**One `getDefaultUserConfig` in `quorum-shared`, consumed by both clients.**

- Add it beside the `UserConfig` type it fills in, so the default and the
  contract move together.
- Delete both local copies; re-export or import directly.
- **Decide each divergent field deliberately** rather than unioning the two.
  `items` in particular: prefer **absent** over `[]`, so desktop's migration
  fallback keeps working. An empty array is a claim ("this user has no nav
  items"); absence is the lack of one, and Rule 2 of
  [the overhaul design](2026-08-07-config-sync-overhaul-design.md) §5.5 says
  absence is never deletion.
- Consider making `migrateToItems` robust anyway (`if (config.items?.length)`),
  since a hostile or old blob can still carry `items: []` regardless of what our
  defaults do. Cheap, and independent of the extraction.

`quorum-shared` is additive-and-publish: it must land and be published before
either client consumes it, and desktop needs `yarn build` on shared's dist.

## Verification

- [ ] A shared unit test asserting the default's exact shape, so a field added to
      `UserConfig` without a default decision fails a test rather than silently
      differing between clients. This is the deliverable that stops recurrence —
      the extraction alone does not.
- [ ] Desktop: a config with `items: []` and non-empty `spaceIds` renders the
      Spaces rather than an empty sidebar. **Revert the `migrateToItems` guard
      and confirm this test goes red** — it asserts truthiness behaviour, which
      is easy to write in a way that passes either way.
- [ ] Both clients produce byte-identical defaults for the same address, asserted
      in shared rather than twice.
- [ ] Full suites green on both clients after the local copies are deleted.

## Prevention

The type cannot enforce this because the fields are optional, and they are
optional for a good reason: old blobs genuinely lack them. So the enforcement has
to be a **shared default plus a test on its shape**, not a stricter type.

More generally, and this is the same conclusion
[the timestamp issue](../2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md)
reached from the other direction: when one wire contract has two implementations,
the thing to share is not the *documentation* of the rule but the *code that
applies it*. A comment describing what both sides should do is invisible from the
side that isn't doing it.

---

*Last updated: 2026-08-07*
