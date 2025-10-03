# EncryptionService Manual Testing Guide

Quick reference for manually testing EncryptionService operations in the UI.

## Quick Test Checklist

- [ ] Delete encryption states - Clean up conversation encryption
- [ ] Ensure key for space - Verify/generate space encryption keys

---

## Detailed Test Procedures

### Function 1: deleteEncryptionStates()

**What it does:** Deletes encryption states for a conversation
**Where to test:** Triggered when deleting conversations or spaces
**Prerequisites:** Have existing conversation or space

**Steps:**
1. Create or use existing conversation (P2P or channel)
2. Send some encrypted messages
3. Delete the conversation (see MessageService manual test)
4. Observe encryption state cleanup

**Expected:**
- All encryption states for conversation deleted
- Inbox mappings deleted (if inboxId exists)
- Latest state deleted
- Conversation ID format: `spaceId/channelId` or user address
- No encryption states remain for that conversation

**Verify:**
- Check console for no errors
- Database query: encryption states for conversation = empty
- Inbox mappings removed (if they existed)
- Latest state removed
- Clean deletion (no orphaned data)

**Errors:**
- ❌ States not deleted - Database delete failed
- ❌ Inbox mappings remain - Cleanup incomplete
- ❌ Latest state remains - Delete call missed

---

### Function 2: ensureKeyForSpace()

**What it does:** Ensures space has valid encryption key, migrates if needed
**Where to test:** Automatically when accessing space with old key format
**Prerequisites:** Have space (especially old format with non-z spaceId)

**Steps:**
1. Access a space
2. If space has old-format ID (not starting with 'z')
3. Service automatically migrates to new format
4. Observe key generation and migration

**Expected (if key exists):**
- Returns existing spaceId immediately
- No migration needed
- Space key already valid

**Expected (if migration needed):**
- New ED448 space key pair generated
- New X448 config key pair generated
- Space address calculated (SHA-256 → base58btc)
- All existing keys migrated to new spaceId
- Messages migrated to new spaceId
- Conversations updated with new spaceId
- Encryption states migrated
- Members migrated with new spaceId
- Space posted to API with new address
- Config updated with new spaceId
- Old space deleted
- New space saved

**Verify (normal case):**
- Check console for no errors
- Space key exists in database
- spaceId format: starts with 'z'
- No unnecessary operations

**Verify (migration case):**
- Check console for migration activity
- New space keys generated
- All data migrated correctly
- Old spaceId removed
- New spaceId in config
- Messages reference new spaceId
- Members have new spaceId
- Space accessible with new ID

**Errors:**
- ❌ Migration fails - Key generation failed
- ❌ Data not migrated - Query/save failed
- ❌ Old space remains - Cleanup incomplete
- ❌ Messages lost - Migration failed
- ❌ Can't access space - Keys not saved

---

## Testing Tips

**Console Monitoring:**
- Keep browser DevTools open (F12)
- Watch for encryption state operations
- Check for key generation activity
- Monitor migration processes

**When Encryption States Are Deleted:**
- Deleting a conversation (MessageService.deleteConversation)
- Deleting a space (SpaceService.deleteSpace)
- Cleaning up after user kicked
- Manual cleanup operations

**When Key Migration Happens:**
- Accessing old-format space (non-z spaceId)
- First time opening space after format change
- Automatic migration on space access

**Migration Indicators:**
- Console shows key generation
- New spaceId starts with 'z'
- API call to postSpace with new address
- Config updated automatically

**Best Practices:**
- Don't manually trigger these functions (automatic)
- Test by deleting conversations/spaces
- Watch for clean encryption state removal
- Verify no orphaned encryption data
- Check migration completes fully (if triggered)

**Database Verification:**
- Encryption states table should be clean after delete
- Inbox mappings should be removed
- Latest states should be cleared
- Space keys should be migrated correctly

**Integration Points:**
EncryptionService interacts with:
- **Database**:
  - getEncryptionStates, deleteEncryptionState
  - deleteInboxMapping, deleteLatestState
  - getSpaceKey, saveSpaceKey, deleteSpaceKey
  - getSpaceMembers, saveSpaceMember, deleteSpaceMember
  - getMessages, saveMessage, getConversations
- **Encryption**: js_generate_ed448, js_generate_x448, js_sign_ed448
- **Crypto**: SHA-256, base58btc encoding
- **API**: postSpace (for migration)
- **ConfigService**: saveConfig (update spaceIds)
- **SpaceService**: updateSpace (after migration)

---

## Common Scenarios

### Scenario 1: Delete P2P Conversation
1. Have P2P conversation with messages
2. Delete conversation
3. Verify encryption states cleaned up
4. Database should have no states for that user address

### Scenario 2: Delete Channel
1. Have channel with messages
2. Delete conversation for that channel
3. Verify encryption states cleaned up
4. Database should have no states for spaceId/channelId

### Scenario 3: Delete Space
1. Have space with multiple channels
2. Delete entire space
3. All encryption states for all channels deleted
4. All space-related encryption data removed

### Scenario 4: Space Migration (Rare)
1. Access old-format space (if you have one)
2. Migration triggered automatically
3. All data migrated to new spaceId
4. Space accessible with new z-prefixed ID

---

## Edge Cases

**Multiple Encryption States:**
- Conversation might have multiple states
- All should be deleted
- Inbox mappings for each deleted
- Latest state deleted once

**States Without inboxId:**
- Some states may not have inboxId
- Should still be deleted
- No inbox mapping to remove (expected)

**Migration Edge Cases:**
- All existing keys must migrate
- All messages must migrate
- All members must migrate
- All conversations must update
- Config must update
- Old space must be deleted

---

_Last updated: 2025-10-03_
