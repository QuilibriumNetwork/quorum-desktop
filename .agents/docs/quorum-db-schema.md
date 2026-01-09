---
type: doc
title: 'IndexedDB Schema Reference: `quorum_db`'
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-23T00:00:00.000Z
---

# IndexedDB Schema Reference: `quorum_db`

Quick reference for debugging and creating console snippets.

## Database Overview

| Property | Value |
|----------|-------|
| **Database Name** | `quorum_db` |
| **Current Version** | 7 |
| **Schema Location** | `src/db/messages.ts` |

---

## Object Stores Summary

| Store | Key Path | Indexes |
|-------|----------|---------|
| **messages** | `messageId` | `by_conversation_time`, `by_channel_pinned` |
| **conversations** | `[conversationId]` | `by_type_time` |
| **encryption_states** | `[conversationId, inboxId]` | — |
| **conversation_users** | `address` | `by_conversation` |
| **user_info** | `address` | — |
| **inbox_mapping** | `inboxId` | — |
| **latest_states** | `conversationId` | — |
| **spaces** | `spaceId` | — |
| **space_keys** | `[spaceId, keyId]` | — |
| **space_members** | `[spaceId, user_address]` | `by_address` |
| **user_config** | `address` | — |
| **bookmarks** | `bookmarkId` | `by_message`, `by_created` |
| **muted_users** | `[spaceId, targetUserId]` | `by_space`, `by_mute_id` |
| **action_queue** | `id` (auto-increment) | `status`, `taskType`, `key`, `nextRetryAt` |
| **deleted_messages** | `messageId` | `by_space_channel`, `by_deleted_at` |

---

## Store Details

### messages

**Key:** `messageId` (string)

**Indexes:**
- `by_conversation_time` → `[spaceId, channelId, createdDate]`
- `by_channel_pinned` → `[spaceId, channelId, isPinned, pinnedAt]`

```typescript
{
  messageId: string
  channelId: string
  spaceId: string
  digestAlgorithm: string
  nonce: string
  createdDate: number
  modifiedDate: number
  lastModifiedHash: string
  content: PostMessage | EventMessage | EmbedMessage | ReactionMessage | ...
  reactions: Reaction[]
  mentions: Mentions
  replyMetadata?: { parentAuthor: string; parentChannelId: string }
  publicKey?: string
  signature?: string
  isPinned?: boolean
  pinnedAt?: number
  pinnedBy?: string
  edits?: Array<{ text: string | string[]; modifiedDate: number; lastModifiedHash: string }>
  sendStatus?: 'sending' | 'sent' | 'failed'  // Ephemeral
  sendError?: string                           // Ephemeral
}
```

---

### conversations

**Key:** `[conversationId]` (compound)

**Indexes:**
- `by_type_time` → `[type, timestamp]`

```typescript
{
  conversationId: string    // "address/address" for DMs, "spaceId/channelId" for spaces
  type: 'direct' | 'group'
  timestamp: number
  address: string
  icon: string
  displayName: string
  lastReadTimestamp?: number
  isRepudiable?: boolean
  saveEditHistory?: boolean
  lastMessageId?: string
}
```

---

### encryption_states

**Key:** `[conversationId, inboxId]` (compound)

```typescript
{
  conversationId: string
  inboxId: string
  state: string      // JSON-serialized Double/Triple Ratchet state
  timestamp: number
  sentAccept?: boolean
}
```

---

### conversation_users

**Key:** `address` (string)

**Indexes:**
- `by_conversation` → `[conversationId]`

```typescript
{
  conversationId: string
  address: string
}
```

---

### user_info

**Key:** `address` (string)

```typescript
// UserProfile from quilibrium-js-sdk-channels
{
  address: string
  name?: string
  profile_image?: string
  // ... other profile fields
}
```

---

### inbox_mapping

**Key:** `inboxId` (string)

```typescript
{
  inboxId: string
  conversationId: string
}
```

---

### latest_states

**Key:** `conversationId` (string)

```typescript
// Same structure as encryption_states
{
  conversationId: string
  inboxId: string
  state: string
  timestamp: number
}
```

---

### spaces

**Key:** `spaceId` (string)

```typescript
{
  spaceId: string
  spaceName: string
  description?: string
  vanityUrl: string
  inviteUrl: string
  iconUrl: string
  bannerUrl: string
  defaultChannelId: string
  hubAddress: string
  createdDate: number
  modifiedDate: number
  isRepudiable: boolean
  isPublic: boolean
  saveEditHistory?: boolean
  groups: Group[]
  roles: Role[]
  emojis: Emoji[]
  stickers: Sticker[]
}
```

---

### space_keys

**Key:** `[spaceId, keyId]` (compound)

```typescript
{
  spaceId: string
  keyId: string
  address?: string
  publicKey: string
  privateKey: string
}
```

---

### space_members

**Key:** `[spaceId, user_address]` (compound)

**Indexes:**
- `by_address` → `[user_address]`

```typescript
{
  spaceId: string
  user_address: string
  inbox_address: string
  isKicked?: boolean
  // ... UserProfile fields
}
```

---

### user_config

**Key:** `address` (string)

```typescript
{
  address: string
  spaceIds: string[]              // Legacy, kept for backwards compatibility
  items?: NavItem[]               // Source of truth for ordering & folders
  timestamp?: number
  nonRepudiable?: boolean
  allowSync?: boolean
  name?: string
  profile_image?: string
  spaceKeys?: Array<{
    spaceId: string
    encryptionState: EncryptionState
    keys: SpaceKey[]
  }>
  notificationSettings?: { [spaceId: string]: NotificationSettings }
  bookmarks?: Bookmark[]
  deletedBookmarkIds?: string[]
}

type NavItem =
  | { type: 'space'; id: string }
  | { type: 'folder'; id: string; name: string; spaceIds: string[]; icon?: string; color?: string; createdDate: number; modifiedDate: number }
```

---

### bookmarks

**Key:** `bookmarkId` (string)

**Indexes:**
- `by_message` → `messageId`
- `by_created` → `createdAt`

```typescript
{
  bookmarkId: string
  messageId: string
  spaceId?: string
  channelId?: string
  conversationId?: string
  sourceType: 'channel' | 'dm'
  createdAt: number
  cachedPreview: {
    senderName: string
    textSnippet: string
    messageDate: number
    sourceName: string
    contentType: 'text' | 'image' | 'sticker'
    imageUrl?: string
    thumbnailUrl?: string
    stickerId?: string
  }
}
```

---

### muted_users

**Key:** `[spaceId, targetUserId]` (compound)

**Indexes:**
- `by_space` → `spaceId`
- `by_mute_id` → `lastMuteId`

```typescript
{
  spaceId: string
  targetUserId: string
  mutedAt: number
  mutedBy: string
  lastMuteId: string
  expiresAt?: number    // undefined = forever
}
```

---

### action_queue

**Key:** `id` (auto-increment)

**Indexes:**
- `status` → `status`
- `taskType` → `taskType`
- `key` → `key`
- `nextRetryAt` → `nextRetryAt`

```typescript
{
  id?: number
  taskType: 'send-channel-message' | 'send-dm' | 'save-user-config' | 'update-space' |
            'kick-user' | 'mute-user' | 'unmute-user' | 'reaction' | 'pin-message' |
            'unpin-message' | 'edit-message' | 'delete-message' | 'reaction-dm' |
            'delete-dm' | 'edit-dm'
  context: Record<string, unknown>
  key: string           // Grouping key for serial processing (e.g., "spaceId/channelId")
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retryCount: number
  maxRetries: number
  nextRetryAt: number
  createdAt: number
  processedAt?: number
  processingStartedAt?: number
  error?: string
}
```

---

### deleted_messages

**Key:** `messageId` (string)

**Indexes:**
- `by_space_channel` → `[spaceId, channelId]`
- `by_deleted_at` → `deletedAt`

```typescript
{
  messageId: string
  spaceId: string
  channelId: string
  deletedAt: number
}
```

---

## Console Snippets

### Open Database

```javascript
const db = await new Promise((resolve, reject) => {
  const req = indexedDB.open('quorum_db', 7);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
```

### Read All from Store

```javascript
const readAll = (storeName) => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const req = store.getAll();
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

// Usage
const messages = await readAll('messages');
const conversations = await readAll('conversations');
const spaces = await readAll('spaces');
const actionQueue = await readAll('action_queue');
```

### Query by Index

```javascript
const queryByIndex = (storeName, indexName, range) => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, 'readonly');
  const index = tx.objectStore(storeName).index(indexName);
  const req = index.getAll(range);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
```

### Common Queries

```javascript
// Messages for a specific channel
const channelMsgs = await queryByIndex(
  'messages',
  'by_conversation_time',
  IDBKeyRange.bound([spaceId, channelId, 0], [spaceId, channelId, Infinity])
);

// Pending action queue tasks
const pending = await queryByIndex('action_queue', 'status', 'pending');

// Failed tasks
const failed = await queryByIndex('action_queue', 'status', 'failed');

// DM conversations only
const dms = await queryByIndex('conversations', 'by_type_time',
  IDBKeyRange.bound(['direct', 0], ['direct', Infinity])
);

// Muted users in a space
const muted = await queryByIndex('muted_users', 'by_space', spaceId);
```

### Get Single Record

```javascript
const getOne = (storeName, key) => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, 'readonly');
  const req = tx.objectStore(storeName).get(key);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

// Usage (compound keys as arrays)
const space = await getOne('spaces', 'some-space-id');
const member = await getOne('space_members', ['spaceId', 'userAddress']);
const encState = await getOne('encryption_states', ['convId', 'inboxId']);
```

### Delete Records

```javascript
const deleteRecord = (storeName, key) => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, 'readwrite');
  const req = tx.objectStore(storeName).delete(key);
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
});

// Clear entire store
const clearStore = (storeName) => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, 'readwrite');
  const req = tx.objectStore(storeName).clear();
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
});
```

### Count Records

```javascript
const countStore = (storeName) => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, 'readonly');
  const req = tx.objectStore(storeName).count();
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

// Get counts for all stores
const stores = ['messages', 'conversations', 'spaces', 'action_queue', 'bookmarks'];
for (const s of stores) console.log(s, await countStore(s));
```

---

## Migration History

| Version | Changes |
|---------|---------|
| 1 | Initial: messages, conversations, encryption_states, conversation_users, user_info, inbox_mapping, latest_states |
| 2 | Added: spaces, space_keys, space_members, user_config |
| 3 | Added: `by_channel_pinned` index on messages |
| 4 | Added: bookmarks store |
| 5 | Added: muted_users store |
| 6 | Added: action_queue store |
| 7 | Added: deleted_messages store |

---

*Last updated: 2025-12-23*
