# Manual Testing Guide - InvitationService

This guide covers manual testing procedures to verify the InvitationService extraction.

## Overview

InvitationService handles space invitation operations, including:
- Generating invite links (both old-style with embedded secrets and new-style public links)
- Sending invites directly to users via DM
- Processing invite links to extract space information
- Joining spaces via invite links
- Managing invitation encryption and key distribution

## Quick Smoke Test (3 minutes)

**Verifies core invitation workflow:**

1. Create a Space (or use existing space)
2. Click "Invite" button in space settings
3. Click "Generate New Link"
4. Copy the generated invite link
5. Open incognito/private browser window
6. Create new account or login with different account
7. Paste invite link and join
8. ✅ **Verify**: You successfully joined the space and can see the channel

If this works, all 5 core functions are operating correctly:
- `generateNewInviteLink` created the encrypted invite
- `constructInviteLink` or server-side eval generation worked
- `processInviteLink` decrypted the space manifest
- `joinInviteLink` set up encryption and joined the space

## Detailed Test Cases

### 1. Generate New Public Invite Link

**Tests**: `generateNewInviteLink()`

**Steps:**
1. Create or open a space you own
2. Open space settings → Invitations
3. Click "Generate New Link"
4. Wait for link generation (may take a few seconds)

**Expected Results:**
- ✅ Link generates without errors
- ✅ Link format: `https://mydomain.com/invite#spaceId=...&configKey=...`
- ✅ Link is automatically selected/copied
- ✅ No console errors during generation
- ✅ Existing members receive rekey message

**Failure Indicators:**
- ❌ "Failed to generate invite link" error
- ❌ Console error: encryption or signing failures
- ❌ Link missing `spaceId` or `configKey` parameters

---

### 2. Send Invite to User via DM

**Tests**: `sendInviteToUser()` and `constructInviteLink()`

**Steps:**
1. Open a space you own
2. Click "Invite" → "Send to User"
3. Select a user from your contacts
4. Send the invite

**Expected Results:**
- ✅ DM conversation opens with the invited user
- ✅ Invite link appears in the message
- ✅ Link is clickable
- ✅ Recipient receives the message

**Failure Indicators:**
- ❌ Message fails to send
- ❌ Link is malformed or empty
- ❌ Console error during invite construction

---

### 3. Process Invite Link (Preview)

**Tests**: `processInviteLink()`

**Steps:**
1. Get an invite link (from test case 1 or 2)
2. Open the link in a browser where you're not yet a member
3. Observe the preview/join screen

**Expected Results:**
- ✅ Space name displays correctly
- ✅ Space icon displays correctly
- ✅ Member count shows (if available)
- ✅ "Join Space" button is enabled
- ✅ No decryption errors

**Failure Indicators:**
- ❌ "Invalid invite link" error
- ❌ Console error: "invalid link"
- ❌ Console error: "invalid response"
- ❌ Space information fails to load
- ❌ Decryption errors in console

---

### 4. Join Space via Old-Style Invite Link

**Tests**: `joinInviteLink()` with embedded secrets

**Old-style link format**: `...#spaceId=...&configKey=...&template=...&secret=...&hubKey=...`

**Steps:**
1. Obtain an old-style invite link (with all 5 parameters)
2. Open in browser with different account
3. Click "Join Space"
4. Wait for join process to complete

**Expected Results:**
- ✅ Join succeeds without errors
- ✅ Space appears in your spaces list
- ✅ Default channel is visible
- ✅ Can send messages in the channel
- ✅ Can see channel history
- ✅ Other members see your join message

**Failure Indicators:**
- ❌ "Failed to join space" error
- ❌ Space doesn't appear in sidebar
- ❌ Can't send messages (encryption error)
- ❌ Console errors during join process

---

### 5. Join Space via New-Style Public Invite Link

**Tests**: `joinInviteLink()` with server-side invite eval

**New-style link format**: `...#spaceId=...&configKey=...` (only 2 parameters)

**Steps:**
1. Generate a new public invite link (test case 1)
2. Open in browser with different account
3. Click "Join Space"
4. Wait for join process (fetches invite eval from server)

**Expected Results:**
- ✅ Join succeeds without errors
- ✅ Space appears in your spaces list
- ✅ Default channel is visible
- ✅ Can send messages
- ✅ Encryption keys are properly established

**Failure Indicators:**
- ❌ "This public invite link is no longer valid" (404 error)
- ❌ "Failed to join space" error
- ❌ Encryption setup fails
- ❌ Can't decrypt existing messages

---

### 6. Expired or Invalid Invite Links

**Tests**: Error handling in `processInviteLink()` and `joinInviteLink()`

**Steps:**
1. Try to join with a completely invalid link: `https://mydomain.com/invite#garbage`
2. Try to join with missing parameters: `https://mydomain.com/invite#spaceId=xyz`
3. Try to join with an old public link after all invite evals are consumed

**Expected Results:**
- ✅ Clear error message: "Invalid invite link"
- ✅ For consumed public link: "This public invite link is no longer valid"
- ✅ User is not left in broken state
- ✅ Can try again with valid link

**Failure Indicators:**
- ❌ App crashes or becomes unresponsive
- ❌ Generic error with no explanation
- ❌ Half-joined state (space appears but unusable)

---

### 7. Cross-Device Invite Flow

**Tests**: Full invite workflow across devices

**Steps:**
1. On Desktop: Create space and generate invite link
2. On Mobile: Open invite link
3. On Mobile: Join the space
4. On Mobile: Send a message in the channel
5. On Desktop: Verify message appears

**Expected Results:**
- ✅ Mobile successfully joins from desktop-generated link
- ✅ Encryption keys sync properly
- ✅ Messages work bidirectionally
- ✅ Space state syncs across devices

**Failure Indicators:**
- ❌ Mobile can't decrypt space manifest
- ❌ Join fails due to key mismatch
- ❌ Messages don't sync between devices

---

## Console Monitoring

Watch for these log messages in the browser console (F12):

### Success Messages:
- `"new link session"` - New invite link session created
- `"Mock: Generating crypto token"` (in tests) - Invite generation started

### Warning Messages:
- `"This public invite link is no longer valid."` - All invite evals consumed (404)

### Error Messages:
- `"invalid link"` - Missing required parameters or malformed link
- `"invalid response"` - Server returned unexpected data
- `"Failed to generate invite link"` - Invite generation failed
- `"Could not obtain manifest for Space"` - Space manifest fetch failed

---

## Test Environment Notes

- **Browser Console**: Keep F12 open to catch errors
- **Network Tab**: Monitor API calls to `/api/space-manifest`, `/api/space-invite-eval`, `/api/hub-add`
- **Multiple Accounts**: Test with 2-3 different accounts for best results
- **Incognito Mode**: Use incognito/private windows to test with fresh sessions
- **Link Expiration**: Public invite links have limited uses (typically 200), old-style links never expire

---

## Integration Points

InvitationService interacts with:
- **ConfigService**: Uses `getConfig` and `saveConfig` to persist space membership
- **SyncService**: Uses `requestSync` to sync space state after joining
- **SpaceService**: Uses `sendHubMessage` to notify members of new joins
- **Backend API**: `getSpaceManifest()`, `getSpaceInviteEval()`, `postSpace()`, `postSpaceInviteEvals()`, `postSpaceManifest()`, `postHubAdd()`

---

## Encryption Details

### Private Invites (Direct Link Sharing):
- **Template**: Full encryption state template embedded in URL
- **Secret**: Individual DKG secret embedded in URL
- **Hub Key**: Space hub private key embedded in URL
- **Security**: Less secure (all keys in URL), but works offline

### Public Invites (Server-Side Eval):
- **Config Key**: Only inbox key in URL (for manifest decryption)
- **Server Eval**: Encrypted invite eval stored on server
- **Limited Uses**: Typically 200 invite uses per generation
- **Security**: More secure (secrets not in URL), requires server

### Key Exchange During Join:
- **X448**: Ephemeral key exchange for invite encryption
- **ED448**: Inbox key signing for hub authentication
- **DKG Ratchet**: Triple ratchet state initialization
- **AES-GCM**: Message encryption after join

---

## Common Issues & Debugging

### Issue: "Invalid invite link"
- **Cause**: URL parameters missing or malformed
- **Debug**: Check URL has `spaceId` and `configKey` at minimum
- **Fix**: Generate fresh invite link

### Issue: "This public invite link is no longer valid"
- **Cause**: All invite evals consumed (404 from server)
- **Debug**: Check Network tab for 404 on `/api/space-invite-eval`
- **Fix**: Space owner generates new invite link

### Issue: Join succeeds but can't send messages
- **Cause**: Encryption state not properly initialized
- **Debug**: Check console for encryption errors, verify inbox key saved
- **Fix**: Leave and rejoin space, or check encryption state in DB

### Issue: Other members don't see new joiner
- **Cause**: Join message not sent or sync not triggered
- **Debug**: Check `sendHubMessage` call, verify hub connection
- **Fix**: Manually trigger sync or have new member send test message

---

**Last Updated**: 2025-10-01 (InvitationService extraction)
