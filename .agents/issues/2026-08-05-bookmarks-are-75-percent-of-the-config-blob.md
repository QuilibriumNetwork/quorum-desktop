---
type: bug
title: "Bookmarks are 656 KB of an 873 KB config blob, against a ~1 MB ceiling"
status: in-progress
priority: medium
created: 2026-08-05
updated: 2026-08-05
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

**Desktop fix built on branch `fix/bookmark-sender-icon-bloat`; the on-device
number has NOT been taken yet.** What is claimed below is labelled, because the
distinction matters: the code is verified by tests, the 873 KB → ~253 KB
prediction is arithmetic from §3-A, not an observation.

| | |
|---|---|
| ✅ **MEASURED** | 44 new tests: 13 shared (the stripper), 12 render-ladder (pure precedence), 9 resolution (the hook against a fake IndexedDB), 8 sweep (the migration, including its failure modes), 2 ConfigService (both sync directions). Desktop 1035/1035, shared 598/598, tsc clean, lint 0 errors |
| ✅ **MEASURED** | every group was confirmed able to FAIL by neutering the code under it — the stripper (6 red), the two ConfigService call sites (2 red), the counterpart gate (4 red), the changed-rows-only skip (2 red), the migration's completion flag moved before its writes (2 red) |
| ✅ **MEASURED** | the plaintext handed to `crypto.subtle.encrypt` (literally the uploaded blob) contains no `senderIcon` and no avatar bytes, while both bookmarks and their `senderAddress` survive |
| ✅ **MEASURED** | the sweep writes only rows that changed, and does NOT set its completion flag when a read or write fails — so a partial failure retries next launch instead of being permanently skipped |
| ⏳ **PREDICTED, not measured** | ~873 KB → ~253 KB on the real account. Arithmetic from §3-A (619.8 KB of `senderIcon` removed), not yet observed |

**To close this issue**, run `.agents/tools/dm-debug/08-self-identity-sources.js`
in the console on the affected account, after a launch on this build (the sweep
runs once, on mount, gated by `localStorage['bookmarkSenderIconsStripped:v1:<address>']`).
Expected: the bookmarks row drops from ~656 KB to under 40 KB and the whole blob
lands near 250 KB.

That single console paste is the entire residue. It cannot be automated because
it measures **this account's real stored bookmarks** — the 873 KB figure came
from 18 real bookmarks with 18 real avatars, and a synthetic fixture would only
re-measure a fixture. Everything else that was once "open the app and look" is
now covered above, including avatar rendering: `bookmarkSenderIconResolution.unit.test.tsx`
drives the real hook against a fake IndexedDB and asserts which store is read,
on which address, and what renders when each tier is empty.

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

1. **MOBILE has no strip.** It never wrote `senderIcon` itself, but bookmarks it
   adopted from desktop before this change still carry one, and it publishes the
   same blob. **Blocked on a `quorum-shared` PUBLISH, not a merge** — the helper
   is in shared `master` (PR #75) and the version is bumped to `2.1.0-40`, but
   that repo has **no CI publish workflow**, so `npm publish` has to be run by
   hand. npm's latest is still `2.1.0-39`, which is exactly what mobile pins, so
   mobile cannot import the helper until someone publishes. The change is two
   lines once it can: strip inside
   `getLocalBookmarks` and `saveLocalBookmarks`
   (`services/config/configService.ts:104` and `:115`), which between them are
   the only read and write points for MMKV bookmark storage — that covers the
   upload (`:599`), the stored config (`:465`) and the remote merge (`:410`) at
   once. Mobile's `BookmarksPanel` never rendered an avatar, so there is no
   render-side work.

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

## §5. Next step

~~Break down the 656 KB by field before choosing.~~ **Done — see §3-A.** The answer
is `senderIcon`, at 94% of bookmarks and 69% of the whole blob.

~~The remaining question is migration.~~ **Done — see Status.** The sweep landed
alongside two sync-path chokes, because a sweep on its own does not converge: an
un-migrated sibling device would keep publishing the fat payload and this device
would keep re-adopting it. Stripping on adopt as well as on upload is what makes
the migration stick with no coordination between devices.

**Remaining: take the measurement.**
`.agents/tools/dm-debug/08-self-identity-sources.js` prints the breakdown, so
re-measuring costs one console paste. Until that is run, the 873 KB → ~253 KB
figure is arithmetic, not an observation.

---

*Last updated: 2026-08-05*
