# SyncService Manual Testing Guide

Quick reference for manually testing SyncService operations in the UI.

## Quick Test Checklist

- [ ] Request sync - Manually trigger space sync
- [ ] Synchronize all - Full space data sync to peer
- [ ] Initiate sync - Start sync with candidate peers
- [ ] Direct sync - Sync specific data to peer
- [ ] Verify kicked users - Check and notify kicked status
- [ ] Inform sync data - Send sync info to peer

---

## Detailed Test Procedures

### Function 1: requestSync()

**What it does:** Automatically requests sync from other space members
**Where to test:** Triggered automatically when joining space or detecting missing data
**Prerequisites:** Be member of a space with other members

**Steps:**
1. Join a new space (you will have 0 messages)
2. Other members in space have messages
3. requestSync() automatically triggered
4. Wait for sync to complete (30 seconds timeout)
5. Watch console for sync activity

**Expected:**
- Sync request sent to space hub automatically
- Request includes current member count and message count
- Sync candidates collected from other members
- After 30 seconds, sync initiates with best candidate
- Messages and members synced to you

**Verify:**
- Check console for sync request activity
- syncInfo.current[spaceId] created with expiry
- Hub message sent (type: 'group')
- Sync request message includes:
  - inboxAddress
  - memberCount (your count)
  - messageCount (your count)
  - expiry timestamp
- After 30s, best candidate selected
- Data synced from candidate

**Errors:**
- ❌ No sync initiated - Hub key missing
- ❌ Timeout with no sync - No other members online
- ❌ "Hub key missing" - Space keys not configured

---

### Function 2: synchronizeAll()

**What it does:** Sends complete space data to a peer
**Where to test:** Automatically triggered when joining as new member
**Prerequisites:** Be space owner, have another member join

**Steps:**
1. Create a space
2. Invite another user
3. When they join, observe sync triggered
4. Watch console for sync activity

**Expected:**
- All space members synced to peer
- All space messages synced to peer
- Peer map (encryption state) synced
- Sync sent in chunks (5MB max per chunk)
- Hub key and owner key used for encryption

**Verify:**
- Check console for sync activity
- Multiple sync envelopes created (peer-map, members, messages)
- Members sent in chunks if > 5MB
- Messages sent in chunks if > 5MB
- Sync envelope type is 'sync'

**Errors:**
- ❌ "Owner key missing" - Owner key not found
- ❌ Sync incomplete - Chunking failed
- ❌ Messages missing - Query failed

---

### Function 3: initiateSync()

**What it does:** Starts sync with best candidate peer
**Where to test:** Automatically after requestSync timeout
**Prerequisites:** Have sync candidates from requestSync

**Steps:**
1. Request sync (from Function 1)
2. Wait 30 seconds for timeout
3. Observe sync initiation with best candidate
4. Watch sync data exchange

**Expected:**
- Selects candidate with highest message count
- Sends sync-initiate control message
- Includes inbox address and data counts
- Sync envelope sent to candidate's inbox
- Data synced from candidate

**Verify:**
- Check console for sync initiation
- Best candidate selected (highest messageCount)
- Sync-initiate message sent
- Message includes:
  - inboxAddress (local)
  - memberCount (local)
  - messageCount (local)
  - Latest/oldest message timestamps

**Errors:**
- ❌ No candidates - Early return (expected if no other members)
- ❌ Wrong candidate selected - Sorting failed
- ❌ Sync doesn't start - Hub/inbox keys missing

---

### Function 4: directSync()

**What it does:** Syncs specific data to a peer inbox
**Where to test:** Triggered when peer has less data than you
**Prerequisites:** Be in space, have more messages than peer

**Steps:**
1. Be in a space with messages
2. Another member joins or requests sync
3. Observe direct sync triggered
4. Watch data sent to peer

**Expected:**
- Peer map synced first
- Members synced in chunks
- Messages synced in chunks (excluding already-synced)
- Only missing messages sent (timestamp filtering)
- Sync envelope sent to peer's inbox

**Verify:**
- Check console for direct sync
- Peer map sent first (sync-peer-map)
- Members chunked if needed (5MB limit)
- Messages filtered by timestamp
- Only new messages sent (not duplicates)

**Errors:**
- ❌ All messages sent - Timestamp filtering failed
- ❌ Duplicate messages - Filter not working
- ❌ Chunks too large - 5MB limit exceeded

---

### Function 5: sendVerifyKickedStatuses()

**What it does:** Checks for kicked users and sends verification
**Where to test:** Automatically triggered periodically in spaces
**Prerequisites:** Have space with kick events

**Steps:**
1. Kick a user from space (see SpaceService manual test)
2. Later, user tries to join again
3. Observe verify-kicked check
4. Watch hub message sent

**Expected:**
- Scans all space messages for kick/join events
- Identifies users whose last event was 'kick'
- Sends verify-kicked message with kicked addresses
- Returns count of kicked users
- Hub message includes kicked addresses list

**Verify:**
- Check console for kicked user detection
- Kick/join events processed chronologically
- Last event per user tracked
- If last event is 'kick', user in kicked list
- Hub message sent if kicked users exist
- Returns 0 if no kicked users

**Errors:**
- ❌ Kicked user not detected - Event processing failed
- ❌ User marked as kicked after rejoining - Join event not processed
- ❌ No hub message sent - sendHubMessage failed

---

### Function 6: informSyncData()

**What it does:** Informs peer of your current sync data counts
**Where to test:** Automatically when you have more data than peer
**Prerequisites:** Have more members/messages than peer

**Steps:**
1. Be in space with many messages
2. Another member joins with fewer messages
3. Observe sync-info sent
4. Peer receives your data counts

**Expected:**
- Early return if inboxAddress matches yours
- Early return if peer has >= your data
- Sync-info message sent if you have more data
- Message includes your memberCount and messageCount
- Sent to peer's inbox address

**Verify:**
- Check console for sync info
- Early return cases work correctly:
  - Same inbox address → no message
  - Peer has more data → no message
- Sync-info sent only when you have more
- Message includes correct counts

**Errors:**
- ❌ Message sent to self - Inbox check failed
- ❌ Message sent when peer has more - Count check failed
- ❌ Incorrect counts - Query failed

---

## Testing Tips

**Console Monitoring:**
- Keep browser DevTools open (F12)
- Watch for sync activity messages
- Check WebSocket for sync envelopes
- Monitor timing (30s timeout for initiate)

**Common Patterns:**
1. New member joins → synchronizeAll triggered
2. Request sync → Wait 30s → initiateSync
3. Peer has less data → informSyncData
4. Kicked users check → sendVerifyKickedStatuses

**Multi-Device Testing Required:**
- Device A: Request sync
- Device B: Respond with data
- Verify sync completes
- Check message counts match

**Sync Flow Example:**
```
1. Device A joins space (few messages)
2. Device A requests sync
3. Device B (many messages) receives request
4. Device B sends sync-info (has more data)
5. Device A initiates sync with Device B
6. Device B sends all members and messages
7. Device A receives and saves data
```

**Best Practices:**
- Test with spaces of varying sizes
- Test with 0 messages (empty space)
- Test with kicked users
- Monitor sync envelope sizes
- Verify chunking works (>5MB data)

**Integration Points:**
SyncService interacts with:
- **Database**: getSpaceMembers, getAllSpaceMessages, getSpaceKey
- **Encryption**: SealSyncEnvelope, SealHubEnvelope
- **WebSocket**: enqueueOutbound for sync messages
- **SpaceService**: sendHubMessage
- **syncInfo ref**: Tracks sync state and candidates

---

_Last updated: 2025-10-03_
