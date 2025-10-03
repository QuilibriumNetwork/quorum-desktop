# SpaceService Manual Testing Guide

Quick reference for manually testing SpaceService operations in the UI.

## Quick Test Checklist

- [ ] Create space - Create new space with channels
- [ ] Update space - Edit space name, description, icon
- [ ] Delete space - Remove space and all data
- [ ] Kick user - Remove member from space
- [ ] Create channel - Add new channel to space
- [ ] Send hub message - Internal space coordination

---

## Detailed Test Procedures

### Function 1: createSpace()

**What it does:** Creates a new space with default channel
**Where to test:** Home → Create Space button
**Prerequisites:** Valid user account

**Steps:**
1. Click "Create Space" button (usually in sidebar or home)
2. Enter space name (e.g., "Test Space Manual")
3. Optional: Upload space icon/avatar
4. Select Public or Private
5. Click Create/Submit

**Expected:**
- Space created successfully
- Redirected to new space
- Space appears in sidebar
- Default #general channel exists
- You are the only member (owner role)

**Verify:**
- Check console for no errors
- Space ID generated (format: z...)
- Encryption keys created (hub, config, owner, inbox, group)
- Can send message in default channel
- Space persists after reload

**Errors:**
- ❌ "Space creation failed" - API or encryption error
- ❌ No default channel - Channel creation failed
- ❌ Can't send messages - Encryption setup failed
- ❌ Space disappears after reload - Database save failed

---

### Function 2: updateSpace()

**What it does:** Updates space metadata (name, description, icon)
**Where to test:** Space Settings → Edit Space
**Prerequisites:** Must own a space or have admin permissions

**Steps:**
1. Open a space you own
2. Click space name or settings icon (usually top-right)
3. Select "Edit Space" or similar option
4. Change space name (e.g., add "UPDATED")
5. Change description
6. Optional: Upload new icon
7. Click Save

**Expected:**
- Changes save successfully
- Space name updates in sidebar immediately
- Description updates in space info
- Icon updates if changed
- Other members see changes (if multi-device)

**Verify:**
- Check console for no errors
- Space manifest encrypted and uploaded
- Changes persist after reload
- Space info updated in database

**Errors:**
- ❌ Changes don't save - API call failed
- ❌ Changes revert after reload - Manifest not saved
- ❌ Other members don't see changes - Sync issue

---

### Function 3: deleteSpace()

**What it does:** Permanently deletes space and all associated data
**Where to test:** Space Settings → Delete Space (Danger Zone)
**Prerequisites:** Must own the space

**Steps:**
1. Create or select a test space
2. Open space settings
3. Scroll to danger zone or advanced settings
4. Click "Delete Space"
5. Confirm deletion (may require typing space name)

**Expected:**
- Confirmation dialog appears
- Space removed from sidebar immediately
- Redirected to home or another space
- All messages deleted
- All members removed
- Encryption states cleaned up
- Config updated (space removed from spaceIds)

**Verify:**
- Check console for no errors
- Space no longer in database
- Messages deleted
- Members deleted
- Keys deleted
- Encryption states deleted
- Space doesn't reappear after reload

**Errors:**
- ❌ Space not deleted - Database operation failed
- ❌ Messages remain - Cleanup incomplete
- ❌ Space reappears - Config not updated
- ❌ "Hub key missing" - Hub key not found

---

### Function 4: kickUser()

**What it does:** Removes a member from space
**Where to test:** Space → Members List → User Actions
**Prerequisites:** Need 2+ members in space, must be owner/admin

**Steps:**
1. Invite another user to your space (or have existing member)
2. Go to Members list or user profile in space
3. Click on member to kick
4. Select "Kick" or "Remove from Space"
5. Confirm action

**Expected:**
- Kicked user removed from members list
- Kick message sent to space
- User loses access to space
- User no longer sees space in their sidebar
- Kicked user gets notification (if implemented)

**Verify:**
- Check console for no errors
- Member removed from database
- Kick message created (type: 'kick')
- Message contains senderId of kicked user
- Other members see kick message
- Kicked user can't send messages

**Errors:**
- ❌ Can kick space owner - Permission check failed
- ❌ "Cannot kick space owner" - Expected error for owner
- ❌ User still in members - Database update failed
- ❌ User can still send messages - Access not revoked

---

### Function 5: createChannel()

**What it does:** Creates a new channel in a space
**Where to test:** Space → Channels → Add Channel
**Prerequisites:** Must be in a space

**Steps:**
1. Open a space
2. Find channels list (usually sidebar)
3. Click "+" or "Add Channel"
4. Enter channel name (e.g., "announcements")
5. Optional: Set channel description
6. Click Create

**Expected:**
- New channel appears in channels list
- Channel has unique ID
- Can send messages in new channel
- Encryption keys created for channel
- Space updated with new channel

**Verify:**
- Check console for no errors
- Channel ID generated
- Channel key saved to database
- Space updated with new channel
- Can switch to new channel
- Messages work in new channel

**Errors:**
- ❌ Channel doesn't appear - Database save failed
- ❌ Can't send messages - Encryption key missing
- ❌ Channel disappears after reload - Space not updated

---

### Function 6: sendHubMessage()

**What it does:** Sends control messages to space hub (internal)
**Where to test:** Triggered by other operations (sync, updates)
**Prerequisites:** Be in a space

**Steps:**
1. Perform any space operation that triggers hub message:
   - Request sync
   - Update space
   - Send verify-kicked-statuses
2. Watch console for hub message activity

**Expected:**
- Hub message created with correct format
- Message sent via WebSocket
- Type is "group"
- Contains hub envelope structure

**Verify:**
- Check console for no errors
- Hub message in network tab
- Message contains hub address
- Message encrypted correctly

**Errors:**
- ❌ "Hub key missing" - Hub key not found
- ❌ Hub message not sent - WebSocket issue
- ❌ Invalid message format - Encryption failed

---

## Testing Tips

**Console Monitoring:**
- Keep browser DevTools open (F12)
- Watch for "Hub key or address missing" errors
- Check Network tab for API calls to spaces
- Monitor WebSocket for space messages

**Common Error Messages:**
- "Hub key or address missing for space" - Missing hub key
- "Cannot kick space owner" - Trying to kick owner (expected)
- "Space [id] not found" - Invalid space ID
- "Permission denied" - Insufficient permissions

**Best Practices:**
- Test with multiple users for kick/member operations
- Create test spaces (delete after testing)
- Test both public and private spaces
- Verify persistence by reloading page
- Check that changes sync to other devices

**Multi-Device Testing:**
- Device A: Create/update space
- Device B: Verify changes appear
- Test real-time updates
- Verify encryption keys sync correctly

**Integration Points:**
SpaceService interacts with:
- **Database**: Saves spaces, keys, members
- **API**: Posts space data, manifests
- **Encryption**: Generates keys (ED448, X448)
- **MessageService**: For kick messages
- **ConfigService**: Updates user config
- **SyncService**: Via sendHubMessage

---

_Last updated: 2025-10-03_
