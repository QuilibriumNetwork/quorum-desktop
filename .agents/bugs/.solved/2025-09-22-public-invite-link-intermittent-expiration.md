---
type: bug
title: Public Invite Link Intermittent Expiration Bug
status: solved
created: 2026-01-09T00:00:00.000Z
updated: 2026-06-08
solved-by: PR #183 (task `2026-06-08-fix-join-invite-link.md`)
verified-by: user end-to-end smoke test, 2026-06-08
---

> **2026-06-08 — solved.** The 2026-06-07 `likely-resolved-by-consolidation` marker (below) was over-optimistic: the mobile-side server change to "serve the same eval to every joiner" was necessary but not sufficient. The actual desktop-side bug was that `InvitationService.joinInviteLink` decrypted the invite eval using the manifest's `ephemeral_public_key`, but every `broadcastSpaceUpdate` (kick, role grant, settings edit, channel binding) re-encrypts the MANIFEST with a fresh ephemeral key while leaving the EVAL untouched. After any space update post-publish, the manifest's ephemeral key no longer matched the eval's — eval decryption failed — joiner saw "expired/invalid".
>
> Mobile's join code at [`quorum-mobile/hooks/chat/useSpaceActions.ts:271-279`](../../../../quorum-mobile/hooks/chat/useSpaceActions.ts) handles this by using the eval's OWN ephemeral pubkey when the server provides it, falling back to the manifest's only on legacy servers. Desktop now does the same — see [task `2026-06-08-fix-join-invite-link.md`](../../tasks/2026-06-08-fix-join-invite-link.md) for the full diagnosis and fix.
>
> The original "first 1-2 joiners succeed, later ones fail" pattern was the same root cause: the owner's actions (kicking spammers, granting moderator roles, renaming a channel) interleave with join attempts, rotating the manifest's ephemeral key. The "regenerate the public link" workaround worked because regenerating re-uploads the manifest with a fresh ephemeral key, briefly aligning with the new eval. Now that desktop uses the eval's own ephemeral key, the workaround is no longer needed.
>
> Verified by user smoke test, 2026-06-08: as owner, published a public invite then updated the space; as non-owner, clicked the same link and joined successfully. Private one-time invites also tested as a regression check — still working as expected.

> **Original 2026-06-07 marker (kept for history)**: the invite-system consolidation (see `tasks/2026-06-07-consolidate-invite-system-with-mobile.md`) likely makes this no longer reproducible. [...] To verify: in a fresh space, generate a public link, then have 5+ users join in quick succession. If all succeed, mark solved and move to `.solved/`. **— That verification was never run, and turned out to be insufficient anyway because the failure mode wasn't about concurrency, it was about post-publish space updates rotating the manifest ephemeral key. The actual fix landed in PR #183.**

# Public Invite Link Intermittent Expiration Bug

**Reported:** September 22, 2025
**Status:** Investigating
**Severity:** Medium
**Component:** Space Invite System

## Bug Description

Public invite links intermittently show "expired" or "invalid" errors after initially working correctly. This occurs when the same public invite URL works for the first 1-2 people but fails for subsequent users (typically 3rd+ person) who attempt to join.

## Reproduction Steps

1. Create a space
2. Generate a public invite link
3. Send the public invite link to multiple people (5+ people)
4. Have them attempt to join in relatively quick succession

**Expected Result:** All users should be able to join using the same public invite link

**Actual Result:** First 1-2 users join successfully, but subsequent users get "expired" or "invalid link" errors

## Reproduction Reliability

- **Non-deterministic**: Does not happen every time
- **Timing sensitive**: More likely to occur when multiple people attempt to join within a short timeframe
- **Count dependent**: Usually fails starting with the 3rd person, rarely on 1st or 2nd

## Workaround

Generate a new public invite link when users report "expired" errors. The new link consistently works for all users.

## Investigation Notes

### Key Observations

1. **Not capacity related**: Occurs with only 2-3 total joins on fresh public links
2. **Not generation timing**: Immediate usage after generation works fine
3. **Membership related**: Appears connected to changes in space membership during concurrent joins
4. **Server-side component**: Error occurs during invite validation/joining process

### Technical Areas Investigated

- **Public invite link generation** (`generateNewInviteLink` in MessageDB.tsx)
- **Invite validation process** (`useInviteValidation.ts`)
- **Server-side invite eval system** (`postSpaceInviteEvals`/`getSpaceInviteEval`)
- **Ratchet ID sequencing** and space membership management

### Potential Root Causes

Several theories under investigation:

1. **Race condition** between concurrent join attempts affecting cryptographic state
2. **ID sequencing issues** where ratchet IDs become misaligned with actual space state
3. **Server-side eval management** inconsistencies during concurrent access
4. **Membership change conflicts** during the join process

### Code Areas of Interest

- `MessageDB.tsx` lines 3758-3818 (space_evals generation)
- `MessageDB.tsx` lines 4674-4703 (invite eval retrieval and validation)
- Ratchet ID calculation logic (idCounter usage)
- Space membership update synchronization

## Impact

- **User Experience**: Users unable to join spaces, requiring regeneration of invite links
- **Adoption**: May discourage space sharing due to unreliable invite links
- **Support Load**: Users may report "broken" invite links when they are working for others

## Next Steps

- [ ] Add logging to track ratchet ID sequences during joins
- [ ] Monitor server-side invite eval consumption patterns
- [ ] Test with controlled timing of concurrent joins
- [ ] Investigate space membership synchronization during joins
- [ ] Consider implementing join attempt queuing or locking mechanisms

---

**Note:** This bug report captures current understanding. Root cause analysis is ongoing and initial theories may require revision as more evidence is gathered.
