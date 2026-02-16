---
type: doc
title: Quorum Data Management Architecture
status: done
created: 2025-01-20T00:00:00.000Z
updated: 2026-01-02T00:00:00.000Z
---

# Quorum Data Management Architecture

A comprehensive guide to data storage, management, and flow patterns in the Quorum desktop application.


**Last Updated**: 2025-12-18

## Table of Contents

1. [Overview](#overview)
2. [Data Storage Architecture](#data-storage-architecture)
3. [Database Schema & Structure](#database-schema--structure)
4. [Message System](#message-system)
5. [User Data Management](#user-data-management)
6. [Space/Channel System](#spacechannel-system)
7. [Real-time Communication](#real-time-communication)
8. [Data Flow Patterns](#data-flow-patterns)
9. [Security & Encryption](#security--encryption)
10. [Configuration Management](#configuration-management)
11. [Search Implementation](#search-implementation)
12. [State Management](#state-management)

---

## Overview

Quorum uses a sophisticated multi-layer data architecture that combines local persistence, real-time communication, and end-to-end encryption. The application employs IndexedDB for primary data storage, localStorage for preferences, and a comprehensive caching system powered by TanStack Query.

**Architectural Update: Service-Oriented Design**
Following recent refactoring, core MessageDB functionalities have been extracted into dedicated services located in `src/services/`. The `MessageDB` class now primarily acts as an orchestration layer, providing a unified interface to these specialized services, which handle specific business logic and data interactions. This enhances modularity, maintainability, and testability.

### Key Components

- **MessageDB Orchestrator**: Coordinates interactions with specialized services and IndexedDB (`src/db/messages.ts`, `src/components/context/MessageDB.tsx`)
- **Specialized Services**: Encapsulate business logic for specific domains (`src/services/MessageService.ts`, `src/services/SpaceService.ts`, `src/services/EncryptionService.ts`, `src/services/SyncService.ts`, `src/services/InvitationService.ts`, `src/services/ConfigService.ts`, `src/services/SearchService.ts`, `src/services/NotificationService.ts`, `src/services/ActionQueueService.ts`, `src/services/ActionQueueHandlers.ts`, `src/services/BackupService.ts`)
- **Context Providers**: Data management contexts (`src/components/context/`)
- **Query System**: TanStack Query hooks (`src/hooks/queries/`)
- **API Layer**: RESTful client (`src/api/`)
- **WebSocket Provider**: Real-time communication (`src/components/context/WebsocketProvider.tsx`)

---

## Data Storage Architecture

### 1. IndexedDB (Primary Storage)

**Location**: `src/db/messages.ts` - `MessageDB` class

`src/db/messages.ts` now primarily handles low-level IndexedDB operations, providing a robust and efficient persistent storage layer. Higher-level business logic and data manipulation are delegated to specialized services within `src/services/`.

```typescript
class MessageDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'quorum_db';
  private readonly DB_VERSION = 6;
  private searchIndices: Map<string, MiniSearch<SearchableMessage>> = new Map();
}
```

**Object Stores**:

- `messages` - All chat messages with full content
- `conversations` - Direct message conversations
- `encryption_states` - Encryption state management
- `spaces` - Space/server data
- `space_keys` - Encryption keys for spaces
- `space_members` - Space membership data
- `user_config` - User configuration and preferences
- `user_info` - User profile information
- `inbox_mapping` - Inbox address mappings
- `latest_states` - Latest encryption states
- `conversation_users` - Users in conversations
- `bookmarks` - User bookmarked messages
- `action_queue` - Persistent background task queue (see [Action Queue](features/action-queue.md))

### 2. localStorage (Preferences & Settings)

**Usage Locations**:

- `src/components/context/ThemeProvider.tsx` - Theme preferences
- `src/components/ui/AccentColorSwitcher.tsx` - Accent color selection
- `src/i18n/i18n.ts` - Language preferences
- Various components for temporary state

**Stored Data**:

```typescript
// Theme and visual preferences
localStorage.setItem('theme', 'dark|light|system');
localStorage.setItem('accent-color', 'blue|red|green|...');
localStorage.setItem('locale', 'en|es|fr|...');

// User-specific temporary data
localStorage.setItem(`userStatus_${address}`, status);
```

### 3. Memory Storage (React State)

**Context Providers**: Manage in-memory state and provide data access patterns

- **MessageDB Context** (`src/components/context/MessageDB.tsx`): Provides access to the specialized services (e.g., MessageService, SpaceService) for interacting with application data and business logic.
- **WebSocket Context** (`src/components/context/WebsocketProvider.tsx`)
- **Registration Context** (`src/components/context/RegistrationPersister.tsx`)
- **Theme Context** (`src/components/context/ThemeProvider.tsx`)
- **QuorumApi Context** (`src/components/context/QuorumApiContext.tsx`)
- **Responsive Layout Context** (`src/components/context/ResponsiveLayoutProvider.tsx`)
- **Sidebar Context** (`src/components/context/SidebarProvider.tsx`)
- **Mobile Context** (`src/components/context/MobileProvider.tsx`)
- **Modal Providers** (`src/components/context/ModalProvider.tsx`, `ConfirmationModalProvider.tsx`, `ImageModalProvider.tsx`, `EditHistoryModalProvider.tsx`)
- **Action Queue Context** (`src/components/context/ActionQueueContext.tsx`) - Queue stats and online/offline state

### 4. Server Integration

**API Client**: `src/api/baseTypes.ts` and `src/api/quorumApi.ts`

```typescript
class QuorumApiClient {
  baseUrl: string; // https://api.quorummessenger.com
  webSocketUrl: string; // wss://api.quorummessenger.com/ws
}
```

---

## Database Schema & Structure

### IndexedDB Schema (Version 6)

#### Messages Store

```typescript
{
  keyPath: 'messageId',
  indexes: {
    'by_conversation_time': ['spaceId', 'channelId', 'createdDate']
  }
}
```

#### Conversations Store

```typescript
{
  keyPath: ['conversationId'],
  indexes: {
    'by_type_time': ['type', 'timestamp']
  }
}
```

#### Encryption States Store

```typescript
{
  keyPath: ['conversationId', 'inboxId'];
}
```

#### Spaces Store

```typescript
{
  keyPath: 'spaceId';
}
```

#### Space Members Store

```typescript
{
  keyPath: ['spaceId', 'user_address'],
  indexes: {
    'by_address': ['user_address']
  }
}
```

#### User Config Store

```typescript
{
  keyPath: 'address';
}
```

### Database Operations

**Message Retrieval**:

```typescript
async getMessages({
  spaceId,
  channelId,
  cursor,
  direction = 'backward',
  limit = 100
}): Promise<{
  messages: Message[];
  nextCursor: number | null;
  prevCursor: number | null;
}>
```

**Space Management**:

```typescript
async getSpace(spaceId: string): Promise<Space | undefined>
async saveSpace(space: Space): Promise<void>
async deleteSpace(spaceId: string): Promise<void>
```

---

## Message System

### Message Types

**Core Message Interface** (`src/api/quorumApi.ts`):

```typescript
export type Message = {
  channelId: string;
  spaceId: string;
  messageId: string;
  digestAlgorithm: string;
  nonce: string;
  createdDate: number;
  modifiedDate: number;
  lastModifiedHash: string;
  content:
    | PostMessage
    | EventMessage
    | EmbedMessage
    | ReactionMessage
    | RemoveReactionMessage
    | RemoveMessage
    | JoinMessage
    | LeaveMessage
    | KickMessage
    | UpdateProfileMessage
    | StickerMessage
    | PinMessage
    | DeleteConversationMessage
    | EditMessage;
  reactions: Reaction[];
  mentions: Mentions;
  publicKey?: string;
  signature?: string;
};
```

**Message Content Types**:

- `PostMessage` - Regular text messages
- `EventMessage` - System events
- `EmbedMessage` - Rich content embeds
- `ReactionMessage` - Emoji reactions
- `StickerMessage` - Sticker/image messages
- `JoinMessage` - User join events
- `LeaveMessage` - User leave events
- `KickMessage` - User kick events
- `UpdateProfileMessage` - Profile updates
- `PinMessage` - Message pin/unpin actions
- `DeleteConversationMessage` - Conversation deletion events
- `EditMessage` - Message edit events

### Message Flow

1. **Creation**: User composes message in UI
2. **Encryption**: Message encrypted using Quilibrium SDK
3. **Local Storage**: Saved to IndexedDB immediately
4. **Network Send**: Transmitted via WebSocket
5. **Server Processing**: Server validates and distributes
6. **Recipient Delivery**: Real-time delivery to other clients
7. **Decryption**: Recipients decrypt using their keys

### Message Submission

**Location**: Handled by `MessageService` via `MessageDB Context`

Message submission logic is now encapsulated within the `MessageService` (`src/services/MessageService.ts`), which is exposed through the `MessageDB Context`. This service handles the encryption, local storage, and network transmission of messages.

### Encryption & Decryption

**Encrypted Message Structure**:

```typescript
interface EncryptedMessage {
  encryptedContent: string;
  inboxAddress: string;
  timestamp: number;
}

interface DecryptionResult {
  decryptedMessage: Message;
  newState: any;
}
```

---

## User Data Management

### Authentication System

**Passkey-Based Authentication**: Uses Web Authentication API through Quilibrium SDK

**User Registration Flow**:

1. Passkey creation/selection
2. User registration with server
3. Local keyset generation
4. Profile configuration

**Registration Context** (`src/components/context/RegistrationPersister.tsx`):

```typescript
type RegistrationContextValue = {
  keyset: {
    userKeyset: secureChannel.UserKeyset;
    deviceKeyset: secureChannel.DeviceKeyset;
  };
};
```

### User Configuration

**User Config Structure**:

```typescript
// NavItem represents either a standalone space or a folder containing spaces
export type NavItem =
  | { type: 'space'; id: string }
  | {
      type: 'folder';
      id: string;
      name: string;
      spaceIds: string[];
      icon?: IconName;
      color?: FolderColor;
      createdDate: number;
      modifiedDate: number;
    };

export type UserConfig = {
  address: string;
  spaceIds: string[];               // Kept for backwards compatibility
  items?: NavItem[];                // Single source of truth for ordering & folders
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
  spaceKeys?: {
    spaceId: string;
    encryptionState: {
      conversationId: string;
      inboxId: string;
      state: string;
      timestamp: number;
    };
    keys: {
      keyId: string;
      address?: string;
      publicKey: string;
      privateKey: string;
      spaceId: string;
    }[];
  }[];
  notificationSettings?: {
    [spaceId: string]: NotificationSettings;
  };
  bookmarks?: Bookmark[];
  deletedBookmarkIds?: string[];
};
```

### Profile Management

**User Profile Data**:

- Display name
- Profile picture URL
- Online status
- User preferences
- Space memberships

**Profile Updates**: Managed through `UpdateProfileMessage` type and synchronized across all connected clients.

---

## Space/Channel System

### Hierarchical Structure

**Space → Groups → Channels**:

```typescript
export type Space = {
  spaceId: string;
  spaceName: string;
  description?: string;
  vanityUrl: string;
  inviteUrl: string;
  iconUrl: string;
  bannerUrl: string;
  defaultChannelId: string;
  hubAddress: string;
  createdDate: number;
  modifiedDate: number;
  isRepudiable: boolean;
  isPublic: boolean;
  saveEditHistory?: boolean;
  groups: Group[];
  roles: Role[];
  emojis: Emoji[];
  stickers: Sticker[];
};

export type Group = {
  groupName: string;
  channels: Channel[];
  icon?: string;
  iconColor?: string;
  iconVariant?: 'outline' | 'filled';
};

export type Channel = {
  channelId: string;
  spaceId: string;
  channelName: string;
  channelTopic: string;
  channelKey?: string;
  createdDate: number;
  modifiedDate: number;
  mentionCount?: number;
  mentions?: string;
  isReadOnly?: boolean;
  managerRoleIds?: string[];      // Roles that can manage read-only channels
  isPinned?: boolean;              // Pinned to top of group
  pinnedAt?: number;               // Timestamp for stack ordering
  icon?: string;                   // Custom icon name
  iconColor?: string;              // Custom icon color
  iconVariant?: 'outline' | 'filled';
};
```

### Permission System

**Role-Based Access Control**:

```typescript
export type Role = {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
  members: string[];
  permissions: Permission[];
  isPublic?: boolean; // Whether the role is visible to other users
};

export type Permission = 'message:delete' | 'message:pin' | 'user:kick' | 'mention:everyone';
```

### Space Operations

**Space Creation** (`src/services/SpaceService.ts` via `MessageDB Context`):

Space creation logic is now encapsulated within the `SpaceService` (`src/services/SpaceService.ts`), which is exposed through the `MessageDB Context`. This service handles key generation, API registration, initial channel setup, and data persistence for new spaces.

**Space Membership**: Managed through `space_members` object store with efficient indexing for membership queries.

### Space Data Synchronization

**Location**: `src/services/SyncService.ts`

Quorum uses a **peer-to-peer hash-based delta sync protocol** to synchronize Space data (messages, members, peer maps) between devices. This runs separately from user config sync (see [Config Sync System](config-sync-system.md)).

**New Protocol (v2) - Hash-Based Delta Sync:**

The sync protocol uses manifest hashes to efficiently identify what data needs to be exchanged:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPACE SYNC PROTOCOL                           │
├─────────────────────────────────────────────────────────────────┤
│  1. sync-request (broadcast)                                     │
│     → Includes SyncSummary with manifestHash                     │
│     → Other peers compare hash to detect differences             │
│                                                                  │
│  2. sync-info (response)                                         │
│     → Peers with different/more data respond                     │
│     → Includes their SyncSummary for comparison                  │
│                                                                  │
│  3. sync-initiate (to best candidate)                            │
│     → Sends full manifest (message digests)                      │
│     → Triggers bidirectional sync                                │
│                                                                  │
│  4. sync-manifest (response)                                     │
│     → Peer responds with their manifest                          │
│     → Both sides compute deltas                                  │
│                                                                  │
│  5. sync-delta (chunked)                                         │
│     → Contains only missing/updated messages                     │
│     → Includes member and peer map deltas                        │
│     → Marked with isFinal flag for last chunk                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key Types** (from `@quilibrium/quorum-shared`):

- `SyncSummary` - Compact hash + counts for quick comparison
- `SyncManifest` - Per-message digests for precise diff computation
- `SyncDeltaPayload` - Efficient delta with new/updated/deleted items

**Storage Adapter**: The `IndexedDBAdapter` (`src/adapters/indexedDbAdapter.ts`) wraps MessageDB to provide a platform-agnostic storage interface, enabling shared sync logic across desktop and other platforms.

---

## Real-time Communication

### WebSocket Provider

**Location**: `src/components/context/WebsocketProvider.tsx`

**Key Features**:

- Persistent connection management
- Message queuing for reliability
- Automatic reconnection
- Error handling and retry logic

```typescript
interface WebSocketContextValue {
  connected: boolean;
  setMessageHandler: (handler: MessageHandler) => void;
  enqueueOutbound: (message: OutboundMessage) => void;
  setResubscribe: (resubscribe: () => Promise<void>) => void;
}
```

### Message Processing

**Inbound Message Flow**:

1. Receive encrypted message via WebSocket
2. Queue message for processing
3. Decrypt message content
4. Update local IndexedDB
5. Invalidate React Query cache
6. Trigger UI updates

**Outbound Message Flow**:

1. Compose message in UI
2. Encrypt message content
3. Store locally first
4. Queue for WebSocket transmission
5. Send when connection available
6. Handle acknowledgments

### Queue Management

**Message Queuing System**:

```typescript
const messageQueue = useRef<EncryptedMessage[]>([]);
const outboundQueue = useRef<OutboundMessage[]>([]);

const processQueue = async () => {
  // Process inbound messages by inbox
  let inboxMap = new Map<string, EncryptedMessage[]>();

  // Batch process messages per inbox
  for (const [_, messages] of inboxMap) {
    for (const message of messages) {
      await handlerRef.current!(message);
    }
  }

  // Process outbound messages
  while ((outbound = dequeueOutbound())) {
    const messages = await outbound();
    // Send via WebSocket
  }
};
```

---

## Data Flow Patterns

### Query Management (TanStack Query)

**Query Organization**: Structured query hooks in `src/hooks/queries/`

**Key Query Types**:

- **Messages**: `useMessages`, `useInvalidateMessages`
- **Spaces**: `useSpaces`, `useSpace`, `useSpaceMembers`
- **Conversations**: `useConversations`, `useConversation`
- **User Data**: `useRegistration`, `useUserInfo`
- **Configuration**: `useConfig`

**Query Key Patterns**:

```typescript
// Message queries
buildMessagesKey({ spaceId, channelId, cursor });

// Space queries
buildSpaceKey({ spaceId });
buildSpaceMembersKey({ spaceId });

// Conversation queries
buildConversationKey({ conversationId });
```

### Caching Strategy

**Multi-Layer Caching**:

1. **React Query Cache** (Memory)
   - Fast access to frequently used data
   - Automatic background updates
   - Optimistic updates

2. **IndexedDB Cache** (Persistent)
   - Long-term message storage
   - Offline capability
   - Large data sets

3. **Search Index Cache** (Memory)
   - MiniSearch indices for full-text search
   - Context-specific search scopes

### Data Invalidation

**Cache Invalidation Patterns**:

```typescript
// Invalidate specific queries
const invalidateMessages = useInvalidateMessages();
invalidateMessages({ spaceId, channelId });

// Invalidate related data
const invalidateConversation = useInvalidateConversation();
invalidateConversation({ conversationId });
```

### Optimistic Updates

**Pattern**: Update UI immediately, then sync with server

```typescript
// Update local cache first
queryClient.setQueryData(messagesKey, (old) => [...old, newMessage]);

// Then send to server
await submitMessage(...);

// Handle errors by reverting if needed
```

### Background Action Queue

For operations that benefit from persistence, retry logic, and offline support, the application uses a background action queue. This system:
- Provides instant UI feedback via optimistic updates
- Persists tasks to IndexedDB for crash recovery
- Processes tasks asynchronously with exponential backoff retry
- Handles offline gracefully (queues accumulate, process when online)

See [Action Queue](features/action-queue.md) for detailed architecture and implementation.

---

## Security & Encryption

### End-to-End Encryption

**Quilibrium SDK Integration**: `@quilibrium/quilibrium-js-sdk-channels`

**Key Components**:

- User keysets for identity
- Device keysets for sessions
- Per-space encryption keys
- Message-level encryption

### Key Management

**Keyset Structure**:

```typescript
interface KeysetInfo {
  userKeyset: secureChannel.UserKeyset;
  deviceKeyset: secureChannel.DeviceKeyset;
}
```

**Key Storage**:

- User keys: Stored in `user_config` object store
- Space keys: Stored in `space_keys` object store
- Device keys: Generated per session

### Encryption States

**State Tracking**:

```typescript
interface EncryptionState {
  state: string;
  timestamp: number;
  conversationId: string;
  inboxId: string;
  sentAccept?: boolean;
}
```

**State Management**: Tracks encryption state for each conversation to ensure proper message ordering and key rotation.

### Security Practices

- **Local Storage**: Only non-sensitive preference data
- **IndexedDB**: Encrypted message content stored locally
- **Memory**: Decrypted content only held temporarily
- **Network**: All communication over HTTPS/WSS

---

## Configuration Management

### Application Configuration

**Location**: `src/config/`

**Configuration Files**:

- `config.ts` - Main configuration entry point
- `config.quorum.ts` - Production Quorum API endpoints
- `config.local.ts` - Local development endpoints

**Production Config**:

```typescript
export const getQuorumApiConfig = function () {
  return {
    quorumApiUrl: 'https://api.quorummessenger.com',
    quorumWsUrl: 'wss://api.quorummessenger.com/ws',
    apiVersion: 'v1',
    langId: 'en-US',
  };
};
```

### User Preferences

**Theme Management** (`src/components/context/ThemeProvider.tsx`):

- Light/dark/system theme selection
- Accent color customization
- Automatic system theme detection

**Internationalization** (`src/i18n/`):

- Multi-language support via Lingui
- Dynamic locale switching
- Persistent language preferences

---

## Search Implementation

### Search Architecture

**Location**: `src/services/searchService.ts`

**Search Service Features**:

- Full-text search using MiniSearch
- Context-aware search (space/DM scoped)
- Debounced queries for performance
- Result caching and pagination

```typescript
export class SearchService {
  private messageDB: MessageDB;
  private searchCache: Map<string, CachedSearchResult> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
}
```

### Search Index Management

**Searchable Message Structure**:

```typescript
interface SearchableMessage {
  id: string;
  messageId: string;
  spaceId: string;
  channelId: string;
  content: string;
  senderId: string;
  createdDate: number;
  type: string;
}
```

**Index Initialization**:

```typescript
// Per-context search indices
private searchIndices: Map<string, MiniSearch<SearchableMessage>> = new Map();

// Initialize index for space/conversation
await this.messageDB.initializeSearchIndices();
```

### Search Context

**Context Types**:

```typescript
interface SearchContext {
  type: 'space' | 'dm';
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
}
```

**Search Execution**:

- Scope search to current context
- Return ranked results with highlighting
- Cache results for performance

---

## State Management

### Context Provider Architecture

**Primary Contexts**:

1. **MessageDB Context** - Orchestrates access to specialized services for core data operations and business logic.
2. **WebSocket Context** - Real-time communication
3. **Registration Context** - User authentication
4. **Theme Context** - UI preferences
5. **Responsive Layout Context** - UI state management
6. **QuorumApi Context** - API client access
7. **Sidebar Context** - Sidebar state management
8. **Mobile Context** - Mobile-specific state
9. **Modal Providers** - Various modal management contexts

### State Synchronization

**Cross-Component State Flow**:

1. User action triggers state change
2. Context provider updates internal state
3. React Query cache updated/invalidated
4. IndexedDB persistence (if needed)
5. WebSocket message sent (if needed)
6. UI components re-render automatically

### Error Handling

**Error Boundary Implementation**:

```typescript
class ErrorBoundary extends React.Component {
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    // Log error for debugging
    console.log(error, info);
  }
}
```

**Network Error Handling**:

- Automatic retry with exponential backoff
- Offline state detection
- Queue management for failed operations
- User notifications for persistent errors

---

## Performance Considerations

### Database Optimization

**Indexing Strategy**:

- Composite indexes for common query patterns
- Time-based ordering for message pagination
- User-based indexes for membership queries

**Query Optimization**:

- Cursor-based pagination for large datasets
- Lazy loading of message content
- Efficient range queries using IDBKeyRange

### Caching Strategy

**Cache Layers**:

1. **Browser Cache** - Static assets
2. **React Query** - API responses and computed data
3. **IndexedDB** - Persistent application data
4. **Search Index** - Pre-computed search indices

### Network Optimization

**WebSocket Management**:

- Connection pooling and reuse
- Message batching for efficiency
- Compression for large payloads
- Heartbeat mechanism for connection health

---

## Development Guidelines

### Data Access Patterns

**Recommended Patterns**:

1. Use React Query hooks for server state
2. Use Context providers for cross-component state
3. Use IndexedDB directly only through MessageDB class
4. Implement optimistic updates for better UX

### Error Handling

**Best Practices**:

- Always handle async operation failures
- Provide meaningful user feedback
- Log errors for debugging
- Implement retry mechanisms for transient failures

### Security Considerations

**Development Guidelines**:

- Never store sensitive data in localStorage
- Always encrypt data before network transmission
- Validate all user inputs
- Use Content Security Policy headers
- Implement proper authentication flows

---

## File Reference Index

### Core Data Management Files

- **`src/db/messages.ts`** - Low-level IndexedDB interface and schema management.
- **`src/components/context/MessageDB.tsx`** - MessageDB React context, providing access to specialized services.
- **`src/services/`** - Directory containing specialized services for business logic:
  - `MessageService.ts` - Handles message-related operations.
  - `SpaceService.ts` - Manages space creation, membership, and operations.
  - `EncryptionService.ts` - Encapsulates encryption/decryption logic.
  - `SyncService.ts` - Manages Space data synchronization using hash-based delta protocol.
  - `InvitationService.ts` - Handles invitation-related logic.
  - `ConfigService.ts` - Manages user and application configuration.
  - `SearchService.ts` - Implements full-text search functionality.
  - `NotificationService.ts` - Manages application notifications.
  - `ActionQueueService.ts` - Persistent background task queue with retry logic.
  - `ActionQueueHandlers.ts` - Task handlers for each action type.
  - `BackupService.ts` - Encrypted DM backup export/import with domain-separated AES-256-GCM encryption.
- **`src/adapters/`** - Storage adapters for cross-platform compatibility:
  - `indexedDbAdapter.ts` - Wraps MessageDB to conform to `@quilibrium/quorum-shared` StorageAdapter interface.
- **`src/components/context/WebsocketProvider.tsx`** - WebSocket management
- **`src/components/context/RegistrationPersister.tsx`** - User authentication
- **`src/api/baseTypes.ts`** - API client implementation
- **`src/api/quorumApi.ts`** - Type definitions and API endpoints

### Query Management Files

- **`src/hooks/queries/`** - TanStack Query hooks directory
- **`src/hooks/queries/messages/`** - Message-related queries
- **`src/hooks/queries/spaces/`** - Space-related queries
- **`src/hooks/queries/conversations/`** - Conversation queries
- **`src/hooks/queries/search/`** - Search queries

### Configuration Files

- **`src/config/config.ts`** - Main configuration
- **`src/config/config.quorum.ts`** - Production endpoints
- **`src/components/context/ThemeProvider.tsx`** - Theme management
- **`src/i18n/`** - Internationalization

---

_Last updated: 2026-01-02_
