# InvitationService Manual Testing Guide

Quick reference for manually testing InvitationService operations in the UI.

## Quick Test Checklist

- [ ] Generate invite link - Create shareable space invite URL
- [ ] Send invite to user - Send invite via direct message
- [ ] Process invite link - Parse and validate invite URL
- [ ] Join via invite - Join space using invite link
- [ ] Construct invite link - Build invite URL with keys

---

## Detailed Test Procedures

### Function 1: generateNewInviteLink()

**What it does:** Generates a new invite link for a space
**Where to test:** Space Settings → Invite Members → Generate Link
**Prerequisites:** Must own or admin a space

**Steps:**
1. Open a space you own
2. Go to Space Settings or Members section
3. Click "Invite Members" or "Generate Invite Link"
4. Click "Create New Invite Link" or similar
5. Copy the generated link

**Expected:**
- Invite link generated (format: https://qm.one/invite#...)
- Link contains spaceId and configKey parameters
- Link is copyable
- Space's inviteUrl updated in database
- Link is shareable

**Verify:**
- Check console for no errors
- Link format: `https://qm.one/invite#spaceId=...&configKey=...`
- Space updated with inviteUrl
- Link persists after reload
- ConfigKey is encrypted

**Errors:**
- ❌ Link not generated - Encryption failed
- ❌ Invalid link format - URL construction failed
- ❌ Link doesn't persist - Database update failed

---

### Function 2: constructInviteLink()

**What it does:** Returns existing invite link or creates one
**Where to test:** Space Settings → Invite section
**Prerequisites:** Be in a space

**Steps:**
1. Open a space
2. Navigate to invite/members section
3. Look for existing invite link
4. If no link exists, it creates one automatically

**Expected:**
- Returns existing inviteUrl if available
- Creates new link if none exists
- Link is valid and contains required parameters
- Space database updated

**Verify:**
- Check console for no errors
- If link exists, returns immediately (no regeneration)
- If no link, creates one via generateNewInviteLink
- Link format is correct

**Errors:**
- ❌ "Space not found" - Invalid spaceId
- ❌ Link regenerated each time - Not returning existing link

---

### Function 3: sendInviteToUser()

**What it does:** Sends space invite via direct message
**Where to test:** Space → Invite Members → Send to User
**Prerequisites:** Need user to invite, must be in space

**Steps:**
1. Open a space
2. Click "Invite Members"
3. Search for or select a user
4. Click "Send Invite" or similar
5. Check that DM is sent

**Expected:**
- Invite link sent as direct message
- User receives DM with invite link
- Message contains space name and invite URL
- User can click link to join

**Verify:**
- Check console for no errors
- DM appears in sent messages
- Recipient receives message
- Link in message is clickable
- Invite message created correctly

**Errors:**
- ❌ Message not sent - submitMessage failed
- ❌ User not found - Invalid user address
- ❌ Link missing from message - Construction failed

---

### Function 4: processInviteLink()

**What it does:** Parses and validates invite link parameters
**Where to test:** Click an invite link from outside app
**Prerequisites:** Have a valid invite link

**Steps:**
1. Get a space invite link (from step 1 or 2)
2. Log out or open in incognito
3. Click the invite link
4. Observe link being processed

**Expected:**
- Link parameters extracted (spaceId, configKey)
- Space manifest fetched from API
- Space details decrypted
- Ready to join space

**Verify:**
- Check console for no errors
- spaceId extracted correctly
- configKey extracted correctly
- API call to getSpaceManifest succeeds
- Manifest decrypted successfully

**Errors:**
- ❌ "Invalid invite link format" - URL malformed
- ❌ "Missing spaceId" - spaceId not in URL
- ❌ "Missing configKey" - configKey not in URL
- ❌ "Could not obtain manifest" - API fetch failed
- ❌ Decryption failed - Invalid configKey

---

### Function 5: joinInviteLink()

**What it does:** Joins a space using invite link
**Where to test:** After clicking invite link, click "Join"
**Prerequisites:** Valid invite link, not already in space

**Steps:**
1. Click a valid invite link
2. See space preview (name, members, etc.)
3. Click "Join Space" or similar button
4. Wait for join process

**Expected:**
- Space added to your spaces list
- You become a member of space
- Space keys saved locally
- Encryption state initialized
- Join message sent to space
- Redirected to space

**Verify:**
- Check console for no errors
- Space appears in sidebar
- You're in members list
- Can send messages
- Space persists after reload
- Encryption keys exist

**Errors:**
- ❌ Returns undefined for invalid link - Expected behavior
- ❌ "Space already joined" - Already a member
- ❌ Join fails - Encryption setup failed
- ❌ Can't send messages - Keys not configured

---

## Testing Tips

**Console Monitoring:**
- Keep browser DevTools open (F12)
- Watch for invite parsing errors
- Check Network tab for manifest fetches
- Monitor encryption operations

**Common Error Messages:**
- "Invalid invite link format" - URL doesn't match expected pattern
- "Missing spaceId" - spaceId parameter not in URL
- "Missing configKey" - configKey parameter not in URL
- "Could not obtain manifest for Space" - API call failed
- "Decryption failed" - Invalid config key

**Link Format:**
```
https://qm.one/invite#spaceId=z...&configKey=...
```

**Best Practices:**
- Test invite flow end-to-end (generate → send → join)
- Test with different users/devices
- Test invalid links (missing parameters, bad keys)
- Verify space access after joining
- Test joining same space twice (should prevent)

**Multi-Device Testing:**
- Device A: Generate and send invite
- Device B: Receive and join via invite
- Verify Device B can access space
- Verify Device A sees Device B as member

**Edge Cases to Test:**
- Click expired invite link (if expiration exists)
- Click invite for space you're already in
- Click malformed invite link
- Process invite while offline
- Join multiple spaces via invites

**Integration Points:**
InvitationService interacts with:
- **API**: getSpaceManifest, getUser, postHubAdd
- **Encryption**: js_decrypt_inbox_message, js_generate_ed448
- **Database**: saveSpace, saveSpaceKey, saveEncryptionState
- **MessageService**: submitMessage for invite DMs
- **ConfigService**: For space restoration

---

_Last updated: 2025-10-03_
