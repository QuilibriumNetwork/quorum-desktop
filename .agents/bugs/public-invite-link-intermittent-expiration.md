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