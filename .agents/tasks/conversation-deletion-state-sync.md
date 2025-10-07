# Conversation Deletion State Synchronization

Added to GitHub issues

## Issue

When a user deletes a conversation, the other party has no indication that messages will no longer be received. This creates a broken communication loop where users send messages into the void without any feedback.

## Current Behavior

- User A deletes conversation with User B via `ConversationSettingsModal`
- `deleteConversation` only removes local data (`src/db/messages.ts:1108-1119`)
- User B continues sending messages thinking they're being delivered
- User A never receives these messages (conversation is gone)
- No delivery status or error indication for User B

## Root Cause

The messaging protocol lacks conversation lifecycle management:

- No conversation state synchronization between parties
- No message delivery status tracking
- Message types only include `post`, `reaction`, `event` etc. (see `src/api/quorumApi.ts:75-174`)
- Missing conversation management types like `conversation-deleted`

## Potential Solutions

### 1. Pre-deletion Notification (Medium complexity) **RECOMMENDED**

Send deletion notice before deleting conversation locally:

- User confirms deletion → Send "I am deleting this conversation on my side" message
- After message sent → Execute local `deleteConversation()`
- Other party sees deletion notice in their conversation thread

**Implementation:**

- Add `ConversationDeletedMessage` type to `src/api/quorumApi.ts`
- Update deletion flow in `ConversationSettingsModal.tsx:85-118` to call `submitMessage()` first
- Handle display of deletion notices in message UI (similar to system messages)

**Advantages:** Leverages existing message infrastructure, simple failure mode, clear communication

### 2. Simple Warning (High complexity)

Show warning when sending to potentially inactive conversations - **Actually complex** because requires conversation state detection mechanisms that don't exist.

### 3. Delivery Status Tracking (High complexity)

- Track message delivery failures
- Show delivery status indicators
- Warn users when messages consistently fail

### 4. Full Conversation State Sync (High complexity)

- Extend protocol with bidirectional conversation state queries
- Real-time conversation existence validation
- Handle complex edge cases and race conditions

## Key Files

- `src/components/modals/ConversationSettingsModal.tsx:85-118` - Deletion logic
- `src/db/messages.ts:1108-1119` - Local deleteConversation method
- `src/components/context/MessageDB.tsx:2509+` - submitMessage flow
- `src/api/quorumApi.ts:75-174` - Message type definitions

## Investigation Needed

- Analyze message delivery reliability mechanisms
- Research protocol extension feasibility
- Define conversation state synchronization requirements
- Assess impact on existing message flows

---

_Created: 2025-01-27_
