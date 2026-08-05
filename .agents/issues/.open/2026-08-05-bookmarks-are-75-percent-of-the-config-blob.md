---
type: bug
title: "Bookmarks are 656 KB of an 873 KB config blob, against a ~1 MB ceiling"
status: open
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

INFERRED, not measured: the exact split between `senderIcon`, `imageUrl` and
`thumbnailUrl` inside those 656 KB has not been broken down. Do that first — it
decides whether the fix is "stop embedding sender avatars", "stop embedding image
data", or both.

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

Break down the 656 KB by field before choosing. One console pass over the
`bookmarks` array summing `cachedPreview.senderIcon`, `.imageUrl`, `.thumbnailUrl`
and `.textSnippet` separately answers it.

---

*Last updated: 2026-08-05*
