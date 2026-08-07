---
type: bug
title: "Bookmarks are 656 KB of an 873 KB config blob, against a ~1 MB ceiling"
status: done
priority: medium
created: 2026-08-05
updated: 2026-08-07
severity: the config blob is the cross-device sync payload for everything; if it stops uploading, every setting on that device stops syncing, silently
area: config sync / bookmarks / payload size
repos: quorum-desktop + quorum-mobile (same blob, same limit)
related:
  - ".agents/docs/config-sync-system.md (→ Size Limits)"
  - ".agents/issues/.open/2026-07-31-spaces-list-cross-device-sync.md"
  - ".agents/issues/.open/2025-12-09-encryption-state-evals-bloat.md"
  - ".agents/docs/features/messages/bookmarks.md"
---

# Bookmarks are three quarters of the config blob

## Status

**2026-08-07 — CLOSED. Both clients ship the strip.** Mobile landed in mobile
PR [#242](https://github.com/QuilibriumNetwork/quorum-mobile/pull/242) (`fix:
mobile no longer re-publishes bookmark avatars into the config blob`), which was
the last item this issue was holding for. Write-up:
`quorum-mobile/.agents/issues/.done/2026-08-07-mobile-republishes-bookmark-avatars-into-the-config-blob.md`.

Mobile stripped at `getLocalBookmarks` and `saveLocalBookmarks` — the only read
and write points for its MMKV bookmark store, so the upload, the stored config
copy and the remote merge are covered at once. 15 tests, asserting against the
**decrypted uploaded payload**, each group confirmed able to fail by neutering
the code under it. It deliberately did **not** port desktop's one-time sweep:
the mobile equivalent is a write inside a getter, which is the only line that
could lose a bookmark, and mobile has no bookmark surface so nobody would see it
happen. Any write there already rewrites the whole array through the strip, so
the store reclaims itself on the first config pull that carries bookmarks.

Mobile also added an `Array.isArray` guard its own store needed — stripping maps
over the parsed value, and `saveConfig` reads bookmarks outside its try/catch, so
valid JSON that is not an array would have gone from "returns junk" to "this
device cannot save its config at all". **Desktop is not exposed to that**: its
store is IndexedDB, which returns typed rows rather than a parsed JSON string.

The §4.3 size guard is NOT a remainder of this issue — it was deliberately kept
out of the branch and has its own file,
`.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md`.

**2026-08-05 — DESKTOP SHIPPED in PR #314** (`fix(bookmarks): bookmarks stop
eating three quarters of the config sync payload`), with the matching
`quorum-shared` change in shared PR #75 (`2.1.0-40`).

What landed: bookmarks no longer store the sender's avatar. It is resolved at
render from `cachedPreview.senderAddress`, and the field is stripped on config
upload, on config adopt, and by a one-time local sweep. Also fixes an adjacent
bug where the differential bookmark sync called `addBookmark` (which uses
`IDBObjectStore.add` and rejects existing keys) for rows it had classified as
updates, throwing `ConstraintError` and aborting both the apply and the restore.

**Verified on the affected real account, not just by tests:** bookmarks
656.5 KB → **37.1 KB**, `senderIcon` 619.8 KB → **0.0 KB**, live store and blob
copy both converged, and a real `saveConfig` + upload completed.

**~~Still open — this is why the issue has NOT moved to `.done/`:~~ Both
resolved, 2026-08-07:**

- ~~**Mobile has no strip**~~ — **DONE**, mobile PR #242. The shared publish that
  blocked it (`2.1.0-40` was merged but the repo has no CI publish step, so npm
  served `2.1.0-39`) has happened; mobile took the pin in `eb069a3`.
- §4.3, the pre-flight size guard, was deliberately left out of this branch and
  now has its own issue:
  `.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md`.
  It is a different failure mode with its own UX question, not a remainder of
  this one.

> ⚠️ **The headline number moved for a reason worth knowing.** This issue opened
> against an 873 KB blob. After the fix forced a fresh save, the same account read
> **4205 KB** — 98% encryption states, from two created test spaces. Nothing grew;
> `config.spaceKeys` is a snapshot refreshed only by `saveConfig`, so **873 KB was
> a stale lower bound.** Bookmarks were never the biggest thing in the blob, they
> were the biggest thing anyone could *see*. Detail in
> `.open/2025-12-09-encryption-state-evals-bloat.md` → MEASURED 2026-08-05.

### Original pre-ship assessment (kept for the record)

What is claimed below is labelled, because the distinction matters: the code is
verified by tests, and the 873 KB → ~253 KB prediction was arithmetic from §3-A
rather than an observation at the time it was written.

| | |
|---|---|
| ✅ **MEASURED** | 44 new tests: 13 shared (the stripper), 12 render-ladder (pure precedence), 9 resolution (the hook against a fake IndexedDB), 8 sweep (the migration, including its failure modes), 2 ConfigService (both sync directions). Desktop 1035/1035, shared 598/598, tsc clean, lint 0 errors |
| ✅ **MEASURED** | every group was confirmed able to FAIL by neutering the code under it — the stripper (6 red), the two ConfigService call sites (2 red), the counterpart gate (4 red), the changed-rows-only skip (2 red), the migration's completion flag moved before its writes (2 red) |
| ✅ **MEASURED** | the plaintext handed to `crypto.subtle.encrypt` (literally the uploaded blob) contains no `senderIcon` and no avatar bytes, while both bookmarks and their `senderAddress` survive |
| ✅ **MEASURED** | the sweep writes only rows that changed, and does NOT set its completion flag when a read or write fails — so a partial failure retries next launch instead of being permanently skipped |
| ✅ **MEASURED 2026-08-05 on the real account** | **the sweep works.** After one launch on this branch the live `bookmarks` store holds 19 rows carrying **0.0 KB** of `senderIcon`, down from 619.8 KB. Every embedded avatar is gone from local storage |
| ✅ **RESOLVED 2026-08-05, prediction falsified for an unrelated reason** | this row read "⏳ PREDICTED — the whole blob at ~253 KB". The save was taken: bookmarks landed at **37.1 KB** and both stores converged (see Status). The blob total did NOT land near 253 KB — it read 4205 KB, 98% of it encryption states from two test spaces, which is the ⚠️ note below and a different issue. The bookmark half of the arithmetic held; the whole-blob half was measuring something else |

~~**To close this issue**~~ — **this was run on 2026-08-05 and is no longer
outstanding.** For anyone re-measuring later:
`.agents/tools/dm-debug/08-self-identity-sources.js` in the console **on a build
containing this branch**, after one launch (the sweep runs once, on mount, gated
by `localStorage['bookmarkSenderIconsStripped:v1:<address>']`). Read the verdict
line, which names the state directly instead of leaving it to be inferred from a
number.

That console paste was the entire residue. It could not be automated because
it measures **this account's real stored bookmarks** — the 873 KB figure came
from 18 real bookmarks with 18 real avatars, and a synthetic fixture would only
re-measure a fixture. Everything else that was once "open the app and look" is
now covered above, including avatar rendering: `bookmarkSenderIconResolution.unit.test.tsx`
drives the real hook against a fake IndexedDB and asserts which store is read,
on which address, and what renders when each tier is empty.

### ⚠️ The tool measured the wrong store, and would have reported a false negative

Found 2026-08-05 when the baseline was re-run. **`bookmarks` and `user_config`
are separate IndexedDB object stores.** The size table reads
`config.bookmarks` — the copy embedded in the *stored config blob* — but the
sweep rewrites the live `bookmarks` store. They reconcile only on the next
`saveConfig`.

So on a correctly-fixed device, freshly launched, the old tool would still have
printed **656.5 KB** and looked like the fix had done nothing, when in fact the
sweep had run and every upload was already thin (`saveConfig` strips on the way
out regardless of what is on disk). The verification instruction given earlier
in this file was wrong for exactly one launch's worth of time, which is precisely
when someone would run it.

The tool now reads **both** stores side by side and reports one of four states:

| verdict | meaning |
|---|---|
| ✖ avatars present, sweep has not run | this build does not have the fix — a BASELINE reading, not a verification |
| ✔ sweep run, blob copy stale | live store clean, uploads already thin, local copy catches up on the next config save (change any setting and re-run) |
| ✔ converged | both stores clean |
| ✔ nothing to strip | account never had embedded avatars |

All four branches smoke-tested against a stubbed IndexedDB before committing.

**Baseline re-measured 2026-08-05** on the real account and identical to §1 to
the byte — 873.2 KB blob, 656.5 KB bookmarks, 619.8 KB `senderIcon`, 18
bookmarks — so the instrument is deterministic and the pre-fix number is not a
one-off reading.

**Post-sweep reading, same account, one launch on this branch:**

| store | rows | `senderIcon` |
|---|---|---|
| live `bookmarks` | 19 | **0.0 KB** (was 619.8) |
| `user_config.bookmarks` (blob copy) | 18 | 619.8 KB — stale, exactly as the new verdict predicts |

The row counts differ (19 vs 18) because a bookmark was added after the last
config save: `addBookmark` writes the `bookmarks` store and does not call
`ConfigService.saveConfig`. That is the same staleness, visible from a second
angle, and not a fault.

### The stale blob copy is left alone ON PURPOSE — do not "fix" it in the sweep

It is tempting to have the sweep also rewrite `user_config.bookmarks`, so local
storage reclaims the bytes immediately instead of waiting for the next save.
**Do not.** The reasoning, so this is not re-litigated:

1. **It is already harmless.** Nothing outside `ConfigService` reads
   `config.bookmarks` (checked 2026-08-05) — every bookmark surface renders from
   the `bookmarks` object store via `useBookmarks`. Uploads are thin from the
   first save regardless, because `saveConfig` strips on the way out. The stale
   field is dead weight on local disk, not a wrong value anyone can see.
2. **The fix would introduce a clobber race on the highest-blast-radius object
   in the app.** The sweep would read the config at T0; an ordinary
   `ConfigService.saveConfig` can land at T1 with a new timestamp and unrelated
   changes; the sweep's write at T2 would put the T0 snapshot back and silently
   lose them. `MessageDB.saveUserConfig` is a bare `store.put` with no
   timestamp guard, so nothing would catch it. The config blob is exactly the
   object whose corruption is silent and account-wide.

Trading a real race against the config blob for some local disk and one less
verification step is a bad trade. It self-heals on the next save.

### Two defects the tests caught after the code was written

Recorded because both were live in a version already described as verified, and
both were found by an instrument rather than by re-reading:

1. **The DM counterpart avatar.** `conversation.icon` is the counterpart's, and
   it was being read without checking who sent the message — so bookmarking your
   own message in a DM rendered your name beside the other person's face. Found
   while writing up how rendering worked; fixed by passing the conversation
   record whole and gating in the pure resolver.
2. **The public-profile fallback never actually fell back.** The gate was
   `!localIcon`, but on first render the IndexedDB read is still in flight, so
   `localIcon` is always undefined and the request always fired. The code comment
   claimed the opposite. On a 200-bookmark page that is one network request per
   distinct sender on open. Fixed by also waiting on the local query's
   `isFetched`. **This one was invisible to every pure test** — it only exists in
   the wiring, which is exactly the layer that had no test until the question
   "is there another way to test this?" was asked.

### What shipped

| Layer | File | Change |
|---|---|---|
| Type | `quorum-shared/src/types/bookmark.ts` | `senderIcon` REMOVED from `BookmarkPreview`, so writing it is a compile error. Kept on a separate `LegacyBookmarkPreview` purely so the strippers can read old rows |
| Pure helper | `quorum-shared/src/utils/bookmarkPayload.ts` | `stripBookmarkSenderIcon(s)` / `hasLegacySenderIcon`. Returns the same reference when there is nothing to strip, so callers can skip a pointless DB write |
| Write path | `useBookmarks.ts`, `useMessageActions.ts` | the avatar is no longer captured at bookmark time; the parameter is gone from `addBookmark`/`toggleBookmark` |
| Sync OUT | `ConfigService.saveConfig` | strips before the payload is built, so legacy rows still on disk never reach the blob |
| Sync IN | `ConfigService.getConfig` | strips the inbound remote config, so a device on an older build cannot re-inflate this device's store or its next upload |
| Local sweep | `useStripBookmarkSenderIcons.ts` (mounted in `Layout.tsx`) | one-time rewrite of stored bookmarks, reclaiming the IndexedDB copy. No recovery log, unlike the per-space override clear: this removes a render cache, so nothing is lost |
| Render | `useBookmarkSenderIcon.ts`, `BookmarkCard.tsx` | resolves from `senderAddress` on the standard ladder — per-space override → roster global slot → DM conversation → own avatar → public profile → coloured initials |
| DB | `MessageDB.putBookmark` | `addBookmark` uses `IDBObjectStore.add`, which REJECTS an existing key. The differential sync was calling it for `toUpdate`, whose keys exist by definition — a `ConstraintError` that aborted the whole apply, and then aborted the restore too. Adjacent bug, fixed while here |

### Not done, and why

1. ~~**MOBILE has no strip.**~~ **DONE 2026-08-07, mobile PR #242.** It never
   wrote `senderIcon` itself, but bookmarks it adopted from desktop before this
   change still carried one, and it publishes the same blob. It was blocked on a
   `quorum-shared` PUBLISH rather than a merge — the helper was in shared
   `master` (PR #75) at `2.1.0-40`, but that repo has no CI publish workflow, so
   npm still served `2.1.0-39`, which is what mobile pinned. That is resolved.
   The strip went where predicted: `getLocalBookmarks` and `saveLocalBookmarks`
   in `services/config/configService.ts`, which between them are the only read
   and write points for MMKV bookmark storage, covering the upload, the stored
   config and the remote merge at once. Mobile's `BookmarksPanel` never rendered
   an avatar, so there was no render-side work.

   ⚠️ **Found while checking this: bookmarks are write-only on mobile.**
   `setBookmarksPanelVisible(true)` appears nowhere in the mobile repo, so
   `BookmarksPanel` — a finished component — can never open. A mobile user can
   bookmark a message (the action sheet offers it, and it syncs) and then has no
   way to see their bookmarks. No task file exists for it in either repo, so it
   is logged as candidate **#39** in
   `.agents/issues/port-to-mobile/candidates.md`, which carries the strip above,
   the publish dependency, and the counterpart-avatar trap in one place. Worth
   knowing here because it means the mobile strip is a **sync-hygiene** fix, not
   a user-visible one: on mobile nothing renders these bookmarks either way.
2. **§4.3, the pre-flight blob size check, is still open** and still worth doing.
   It is a different failure mode with its own UX question (what does the user
   see when a save is held?), so it was kept out of this branch rather than
   bolted on. Nothing about this fix makes it less necessary — it only buys
   headroom.

## §1. MEASURED 2026-08-05

Taken on a real account with `08-self-identity-sources.js`, which prints the blob's
size breakdown:

| part | bytes | KB | share |
|---|---|---|---|
| **whole blob** | 894,142 | **873.2** | — |
| **bookmarks** | 672,210 | **656.5** | **75%** |
| spaceKeys / encryption states | 164,431 | 160.6 | 18% |
| `profile_image` (one avatar) | 50,832 | 49.6 | 6% |
| notificationSettings | 1,433 | 1.4 | — |
| conversationSettings | 424 | 0.4 | — |
| everything else | 4,812 | 4.7 | — |

`config-sync-system.md` → "Size Limits" records a **typical** blob of 10-500 KB and
a **maximum observed working** blob of ~1 MB. This account is at 873 KB and rising
with every bookmark.

## §2. Why it matters more than its size suggests

The config blob is not just bookmarks. It is the **only** cross-device transport for
every synced setting: the Spaces list, notification settings, mutes, device names,
per-conversation DM settings, user notes, and the user's global profile. Its failure
mode is also the quiet kind — a device that cannot publish keeps working, looks
correct locally, and simply stops telling any other device anything.

That is already a documented dead end. `2026-07-31-spaces-list-cross-device-sync.md`
§3 records the desktop guard that **refuses to publish** when the blob cannot be
assembled cleanly, and notes that nothing retries a held save. One more contributor
to size pushes accounts toward the same class of silent stop.

## §3. Why bookmarks are so large

`Bookmark` (`quorum-shared/src/types/bookmark.ts:5-26`) embeds a `cachedPreview` per
bookmark, and that preview carries **`senderIcon`**, plus `imageUrl`, `thumbnailUrl`
and a `textSnippet`. Avatars and image URLs in this codebase are routinely base64
data URIs, not links — the measurement above shows one avatar alone at ~50 KB.

So a bookmarked image message, or a bookmark of a sender with an avatar, can cost
tens of KB, and the preview is duplicated per bookmark rather than referenced.

## §3-A. MEASURED 2026-08-05 — it is almost entirely sender avatars

Broken down on the same account, per `cachedPreview` field:

| field | size | share of bookmarks |
|---|---|---|
| **`senderIcon`** | **619.8 KB** | **94%** |
| `imageUrl` | 25.6 KB | 4% |
| `textSnippet` | 1.2 KB | <1% |
| `thumbnailUrl` | 0.0 KB | 0% |
| **total, 18 bookmarks** | **656.5 KB** | — |

**18 bookmarks, and each one carries its own embedded copy of the sender's
avatar** — roughly 34 KB apiece, duplicated per bookmark rather than referenced.
That single field is **69% of the entire config blob** and the reason the account
sits at 873 KB.

This settles the direction: option 1 below, and only the `senderIcon` half of it.
Dropping `senderIcon` alone would take the blob from ~873 KB to ~253 KB. Bookmark
previews would resolve the avatar at render from `senderAddress`, through the same
resolver every other surface already uses — which also means a bookmarked sender's
avatar stops being frozen at bookmark time.

## §4. Directions, none decided

1. **Stop embedding binary in the preview.** Keep `senderAddress` and resolve the
   avatar at render through the resolver every other surface already uses; keep an
   image *reference* rather than the image. Biggest win, and it aligns bookmarks
   with how identity is rendered everywhere else.
2. **Do not sync previews at all.** The preview is a render cache and is rebuildable
   from `messageId`. Sync the bookmark, rebuild the preview locally. Loses preview
   fidelity for a message this device cannot see.
3. **Cap the blob and fail loudly.** Independent of the above, and worth doing
   regardless: there is no size check today, so the failure is whatever the server
   returns. A pre-flight size check with a real user-facing signal would turn a
   silent stop into a visible one.

## §5. Next step — nothing remains

~~Break down the 656 KB by field before choosing.~~ **Done — see §3-A.** The answer
is `senderIcon`, at 94% of bookmarks and 69% of the whole blob.

~~The remaining question is migration.~~ **Done — see Status.** The sweep landed
alongside two sync-path chokes, because a sweep on its own does not converge: an
un-migrated sibling device would keep publishing the fat payload and this device
would keep re-adopting it. Stripping on adopt as well as on upload is what makes
the migration stick with no coordination between devices.

~~**Remaining: take the measurement.**~~ **Done 2026-08-05** — bookmarks
656.5 KB → 37.1 KB, `senderIcon` 619.8 KB → 0.0 KB on the real account, both
stores converged. The 873 KB → ~253 KB *whole-blob* arithmetic did not land,
because the blob's remaining bulk turned out to be encryption states rather than
anything this issue governs; that is
`.open/2025-12-09-encryption-state-evals-bloat.md`, not a residue here.

~~**Remaining: the mobile strip.**~~ **Done 2026-08-07** — mobile PR #242.

What this issue does NOT cover, and never did: the pre-flight size guard (§4.3,
its own issue) and giving mobile a way to actually *see* bookmarks
(port-to-mobile candidate #39).

---

*Last updated: 2026-08-07*
