# SpaceService Manual Testing Checklist

**Created:** 2025-10-01
**Purpose:** Verify all 7 SpaceService functions work correctly in the UI after extraction

---

## ✅ Wiring Verification (Automated - PASSED)

- ✅ SpaceService import present
- ✅ Forward references created (updateSpace, sendHubMessage)
- ✅ Correct instantiation order
- ✅ All 7 delegations present and calling spaceService methods
- ✅ All dependencies passed correctly
- ✅ No duplicate declarations
- ✅ All 61 tests passing

---

## 📋 Manual UI Testing Checklist

### 1. **Create Space** (`createSpace`)
**Location:** Home → Create Space button

**Test Steps:**
- [ ] Click "Create Space" or equivalent button
- [ ] Fill in space name (e.g., "Test Space Manual")
- [ ] Choose space icon (optional)
- [ ] Select "Public" or "Private"
- [ ] Click "Create"

**Expected Result:**
- ✅ Space is created successfully
- ✅ You are redirected to the new space
- ✅ Space appears in the sidebar/space list
- ✅ Default "general" channel is created
- ✅ You are the only member initially

**Verification Points:**
- Check console for errors
- Verify space ID is generated (starts with 'z')
- Verify encryption keys are created
- Verify you can send a message in the general channel

---

### 2. **Update Space** (`updateSpace`)
**Location:** Space Settings → Edit Space

**Test Steps:**
- [ ] Open a space you own
- [ ] Click space settings/edit (usually top-right menu or space name)
- [ ] Change space name (e.g., "Test Space Manual UPDATED")
- [ ] Change space description
- [ ] Change space icon
- [ ] Save changes

**Expected Result:**
- ✅ Space details are updated
- ✅ Changes reflect immediately in UI
- ✅ Space list shows new name
- ✅ Other members see the update (if multi-device testing)

**Verification Points:**
- Check console for errors
- Verify space manifest is encrypted and uploaded
- Refresh the page - changes should persist

---

### 3. **Delete Space** (`deleteSpace`)
**Location:** Space Settings → Delete Space

**Test Steps:**
- [ ] Create a test space (or use existing non-important space)
- [ ] Open space settings
- [ ] Find "Delete Space" option (usually in danger zone)
- [ ] Confirm deletion
- [ ] Observe the deletion process

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ Space is removed from your space list
- ✅ Space is removed from local database
- ✅ Config is updated to remove spaceId
- ✅ You are redirected away from the deleted space

**Verification Points:**
- Check console for errors
- Verify space no longer appears in sidebar
- Verify encryption states are cleaned up
- Refresh page - space should still be gone

---

### 4. **Kick User** (`kickUser`)
**Location:** Space → Members → Kick User (requires multi-user setup)

**Test Steps:**
- [ ] Have 2+ members in a space
- [ ] You must be the space owner
- [ ] Right-click a member or open member menu
- [ ] Click "Kick User" or equivalent
- [ ] Confirm the action

**Expected Result:**
- ✅ User is removed from member list
- ✅ Kick message appears in the space
- ✅ Space is re-keyed with new encryption
- ✅ Kicked user loses access (verify on their device if possible)

**Verification Points:**
- Check console for errors
- Verify kick message type in chat
- Verify new config public key is generated
- Verify space manifest is updated
- **IMPORTANT:** Cannot kick the space owner (should show error)

**Note:** This requires 2 devices/accounts. If not available, check:
- [ ] Kick button is NOT shown for space owner (yourself)
- [ ] Console shows proper permission check

---

### 5. **Create Channel** (`createChannel`)
**Location:** Space → Add Channel

**Test Steps:**
- [ ] Open a space you own
- [ ] Find "Add Channel" or "+" button in channels section
- [ ] Click to create new channel
- [ ] Observe channel creation

**Expected Result:**
- ✅ New channel appears in channel list
- ✅ Channel has a unique ID (starts with 'Qm' or similar)
- ✅ ED448 key pair is generated for the channel
- ✅ You can switch to the new channel
- ✅ You can send messages in the new channel

**Verification Points:**
- Check console for errors
- Verify channel ID is a valid base58 address
- Verify channel keys are saved in database

---

### 6. **Send Hub Message** (`sendHubMessage`)
**Location:** Internal - used by other functions (indirect test)

**Test Steps (Indirect):**
- [ ] Perform any space operation that triggers hub communication:
  - Join a space via invite link
  - Request sync for a space
  - Send a control message (like verify-kicked)

**Expected Result:**
- ✅ Hub messages are sent without errors
- ✅ Messages are properly sealed with hub key
- ✅ WebSocket shows outbound message in network tab

**Verification Points:**
- Open browser DevTools → Network → WS tab
- Watch for messages with `type: "group"`
- Verify messages are encrypted (base64 payload)

**Easier Alternative Test:**
- [ ] Simply create a space (uses sendHubMessage for space manifest)
- [ ] Join an invite link (uses sendHubMessage to announce join)

---

### 7. **Submit Update Space** (`submitUpdateSpace`)
**Location:** Internal - triggered when space manifest changes

**Test Steps (Indirect via updateSpace):**
- [ ] Update space settings (name, description, icon)
- [ ] Save the changes
- [ ] Observe space manifest submission

**Expected Result:**
- ✅ Space manifest is submitted to hub
- ✅ Other members receive the update
- ✅ Manifest is encrypted with space keys

**Verification Points:**
- Check browser DevTools → Network → WS
- Look for message with `type: "control"` and `message.type: "space-manifest"`
- Verify no console errors

---

## 🔍 Additional Checks

### Console Error Check
During ALL tests above:
- [ ] No errors in browser console
- [ ] No TypeScript errors
- [ ] No React warnings about missing dependencies

### Database Integrity
After performing operations:
- [ ] Open IndexedDB in DevTools
- [ ] Check `spaces` table has correct data
- [ ] Check `spaceKeys` table has encryption keys
- [ ] Check `spaceMembers` table is updated correctly

### Network Monitoring
- [ ] Open DevTools → Network → WS (WebSocket)
- [ ] Observe messages being sent during operations
- [ ] Verify messages have correct structure
- [ ] Check for any failed requests

---

## 🚨 Critical Test Cases

### Edge Cases to Test:

1. **Cannot kick yourself** (space owner)
   - [ ] Try to kick your own user → Should show error or button disabled

2. **Space deletion cleanup**
   - [ ] Delete space → Verify all related data is cleaned:
     - Space keys deleted
     - Members deleted
     - Encryption states deleted
     - Config updated

3. **Concurrent operations**
   - [ ] Create multiple spaces quickly
   - [ ] Update space while creating a channel
   - [ ] Verify no race conditions or conflicts

4. **Offline behavior** (if applicable)
   - [ ] Disable network
   - [ ] Try space operations → Should queue or show error
   - [ ] Re-enable network → Operations should complete

---

## 📊 Test Results Template

```markdown
## Test Session: [Date/Time]
Tester: [Your Name]
Build: [Git commit hash]

### Results:
- Create Space: ✅ PASS / ❌ FAIL
  - Notes: _____
- Update Space: ✅ PASS / ❌ FAIL
  - Notes: _____
- Delete Space: ✅ PASS / ❌ FAIL
  - Notes: _____
- Kick User: ✅ PASS / ❌ FAIL / ⏭️ SKIP (no multi-user)
  - Notes: _____
- Create Channel: ✅ PASS / ❌ FAIL
  - Notes: _____
- Send Hub Message: ✅ PASS / ❌ FAIL
  - Notes: _____
- Submit Update Space: ✅ PASS / ❌ FAIL
  - Notes: _____

### Overall Result: ✅ ALL PASS / ❌ FAILURES FOUND

### Issues Found:
1. _____
2. _____

### Console Errors:
_____
```

---

## 🔧 Quick Smoke Test (5 minutes)

If you only have 5 minutes, test these critical flows:

1. **Create a new space** → Send a message
2. **Update the space name** → Verify it saves
3. **Create a new channel** → Send a message
4. **Check console** → No errors

This covers the most commonly used functions.

---

**Last Updated:** 2025-10-01
