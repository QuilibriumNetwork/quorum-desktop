# MessageService Manual Testing Guide

Quick reference for manually testing MessageService operations in the UI.

## Quick Test Checklist

- [ ] Submit P2P message - Send direct message to another user
- [ ] Submit channel message - Send message in space channel
- [ ] Receive message - View incoming messages
- [ ] Reply to message - Reply to existing message
- [ ] Delete message - Remove sent message
- [ ] Add reaction - Add emoji reaction to message
- [ ] Remove reaction - Remove emoji reaction
- [ ] Delete conversation - Clear conversation history

---

## Detailed Test Procedures

### Function 1: submitMessage()

**What it does:** Sends a direct (P2P) message to another user
**Where to test:** Direct Messages → Select user → Message input
**Prerequisites:** Need another user account to message

**Steps:**
1. Go to Direct Messages
2. Select a user from contacts or search
3. Type a message (e.g., "Testing P2P message")
4. Press Enter or click Send

**Expected:**
- Message appears in chat immediately
- Message shows "sent" status
- Recipient receives the message
- Message persists after page reload

**Verify:**
- Check console for no errors
- Message ID is generated
- Message saved to database
- Cache updated (message visible)

**Errors:**
- ❌ "Cannot read properties of undefined (reading 'inbox_keyset')" - Wrong parameter order
- ❌ Message doesn't appear - Database save failed
- ❌ "Failed to send message" - Encryption or WebSocket error

---

### Function 2: submitChannelMessage()

**What it does:** Sends a message to a space channel
**Where to test:** Any Space → Channel → Message input
**Prerequisites:** Need to be a member of a space

**Steps:**
1. Open a space
2. Select a channel (e.g., #general)
3. Type a message (e.g., "Testing channel message")
4. Press Enter or click Send

**Expected:**
- Message appears in channel immediately
- Message shows your display name
- Other members can see the message
- Message persists after page reload

**Verify:**
- Check console for no errors
- Message appears in correct channel
- Timestamp is current
- Message is encrypted for group

**Errors:**
- ❌ Message doesn't appear - Group encryption failed
- ❌ "Space not found" - Invalid spaceId
- ❌ "Channel not found" - Invalid channelId

---

### Function 3: handleNewMessage() - Incoming Messages

**What it does:** Processes and routes incoming messages
**Where to test:** Receive messages from another user or device
**Prerequisites:** Two devices or two user accounts

**Steps:**
1. On Device A: Send a message to Device B
2. On Device B: Wait for message to arrive
3. Observe message appears in UI
4. Click on the message to view details

**Expected:**
- Message appears within seconds
- Correct sender name and avatar
- Message content is decrypted correctly
- Unread badge updates

**Verify:**
- Check console for no errors
- Message saved to database
- Cache updated with new message
- Conversation list shows message preview

**Errors:**
- ❌ Message doesn't appear - WebSocket not receiving
- ❌ "Decryption failed" - Encryption key issue
- ❌ Message appears in wrong conversation - Routing error

---

### Function 4: Reply to Message

**What it does:** Creates a reply linked to original message
**Where to test:** Any message → Right-click or Reply button
**Prerequisites:** Need existing messages to reply to

**Steps:**
1. Hover over an existing message
2. Click Reply icon (usually arrow or speech bubble)
3. Type your reply (e.g., "This is a reply")
4. Press Enter or click Send

**Expected:**
- Reply appears below original message
- Visual indicator shows it's a reply (indent, line, etc.)
- Original message preview shown in reply
- Reply is linked to original message

**Verify:**
- Check console for no errors
- Reply has `inReplyTo` field set
- Original message ID is referenced
- Threading works correctly

**Errors:**
- ❌ Reply not linked to original - `inReplyTo` not set
- ❌ Original message not shown - Preview missing

---

### Function 5: Delete Message

**What it does:** Removes a message from conversation
**Where to test:** Your own message → Delete option
**Prerequisites:** Need to have sent messages

**Steps:**
1. Find a message you sent
2. Hover over message to show menu
3. Click Delete (trash icon or menu option)
4. Confirm deletion if prompted

**Expected:**
- Message is removed from UI immediately
- Message shows "[Deleted]" or disappears
- Other users see message as deleted
- Action cannot be undone

**Verify:**
- Check console for no errors
- Message marked as deleted in database
- Cache updated to remove message
- Message still exists in DB (soft delete)

**Errors:**
- ❌ Message doesn't delete - Database delete failed
- ❌ Message reappears after reload - Cache not updated
- ❌ Can delete others' messages - Permission check failed

---

### Function 6: Add Reaction

**What it does:** Adds emoji reaction to a message
**Where to test:** Any message → Reaction picker
**Prerequisites:** Need existing messages

**Steps:**
1. Hover over any message
2. Click reaction/emoji icon
3. Select an emoji (e.g., 👍 or ❤️)
4. Observe reaction appears on message

**Expected:**
- Emoji appears below message
- Count shows "1" for your reaction
- Your avatar/name associated with reaction
- Other users see your reaction

**Verify:**
- Check console for no errors
- Reaction message sent via WebSocket
- Reaction saved to database
- Cache updated with reaction

**Errors:**
- ❌ Reaction doesn't appear - Message send failed
- ❌ Reaction count wrong - Cache update failed
- ❌ Can't remove own reaction - Delete logic broken

---

### Function 7: Remove Reaction

**What it does:** Removes your emoji reaction from a message
**Where to test:** Message with your reaction → Click same emoji
**Prerequisites:** Need message with your reaction

**Steps:**
1. Find a message where you added a reaction
2. Click the same emoji again
3. Observe reaction is removed

**Expected:**
- Your reaction disappears
- Count decrements (or emoji disappears if count = 0)
- Other users see reaction removed
- Action is reversible (can re-add)

**Verify:**
- Check console for no errors
- Remove message sent via WebSocket
- Database updated
- Cache reflects removal

**Errors:**
- ❌ Reaction doesn't remove - Delete message failed
- ❌ Count doesn't update - Cache not updated

---

### Function 8: deleteConversation()

**What it does:** Deletes entire conversation history
**Where to test:** Conversation → Settings → Delete Conversation
**Prerequisites:** Need existing conversation with messages

**Steps:**
1. Open a conversation (P2P or channel)
2. Open conversation settings/menu
3. Click "Delete Conversation" or equivalent
4. Confirm deletion

**Expected:**
- All messages in conversation deleted
- Conversation removed from list
- Cache cleared for conversation
- Action cannot be undone

**Verify:**
- Check console for no errors
- All messages deleted from database
- Conversation no longer in sidebar
- Encryption states cleaned up

**Errors:**
- ❌ Messages not deleted - Database delete failed
- ❌ Conversation reappears - Cache not cleared
- ❌ Other conversations affected - Wrong conversation ID

---

## Testing Tips

**Console Monitoring:**
- Keep browser DevTools open (F12)
- Watch for red errors in console
- Check Network tab for failed API calls
- Monitor WebSocket connection status

**Common Error Messages:**
- "Cannot read properties of undefined" - Parameter order issue
- "Message not found" - Database query failed
- "Encryption failed" - Missing or invalid keys
- "Failed to send message" - WebSocket or API error

**Best Practices:**
- Test with two devices/accounts for message flow
- Test both P2P and channel messages
- Test with various message types (text, reactions, replies)
- Verify persistence by reloading page
- Check message ordering and timestamps

**Integration Points:**
MessageService interacts with:
- **Database**: Saves/loads messages
- **WebSocket**: Sends/receives messages
- **Encryption**: Encrypts/decrypts content
- **Cache**: Updates QueryClient cache
- **SpaceService**: For channel messages

---

_Last updated: 2025-10-03_
