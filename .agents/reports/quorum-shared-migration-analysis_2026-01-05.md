---
type: report
title: quorum-shared Migration Analysis
status: done
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# quorum-shared Migration Analysis

> **AI-Generated**: May contain errors. Verify before use.

This report analyzes the current state of `@quilibrium/quorum-shared` (v2.1.0) and identifies migration candidates from `quorum-desktop` that could be shared with `quorum-mobile`.

**Key Finding**: The desktop codebase has 25+ primitive components, a complete theme system, 80+ hooks, and extensive utilities that are strong candidates for migration to the shared package.

**Recommended Priority**: Primitives and Theme System should be migrated first, as they form the foundation for consistent UI across platforms.

---

## Part 1: Current quorum-shared Contents (v2.1.0)

### Package Overview

| Property | Value |
|----------|-------|
| **Package** | `@quilibrium/quorum-shared` |
| **Version** | 2.1.0-2 |
| **Description** | Shared types, hooks, and utilities for Quorum mobile and desktop apps |
| **Build** | Dual ESM/CJS with TypeScript declarations |
| **Peer Deps** | React 18+, TanStack React Query 5+ |

### Module Structure

```
@quilibrium/quorum-shared/src/
├── api/           # API client interface and errors
├── crypto/        # E2E encryption (WASM-based)
├── hooks/         # React Query hooks for data fetching
├── signing/       # Ed448 signing (WASM-based)
├── storage/       # Platform-agnostic storage adapter
├── sync/          # Hash-based delta synchronization
├── transport/     # HTTP and WebSocket communication
├── types/         # Comprehensive type definitions
└── utils/         # Formatting, validation, encoding
```

### Detailed Module Contents

#### Types (`src/types/`)
- **Space Types**: Space, Channel, Group, Role, Permission, Emoji, Sticker
- **Message Types**: Message, PostMessage, EventMessage, EmbedMessage, ReactionMessage, EditMessage, PinMessage, DeleteConversationMessage, StickerMessage, MuteMessage, JoinMessage, LeaveMessage, KickMessage, UpdateProfileMessage, RemoveMessage
- **User Types**: UserProfile, SpaceMember, UserConfig, NotificationSettings, NavItem, FolderColor
- **Conversation Types**: Conversation (direct/group)
- **Bookmark Types**: Bookmark configuration

#### Sync Protocol (`src/sync/`)
- **SyncService class**: Orchestrates hash-based delta sync
- **Protocol steps**: sync-request → sync-info → sync-initiate → sync-manifest → sync-delta
- **Features**: Session management, manifest comparison (SHA-256), chunking, reaction sync, member sync, peer map sync, tombstone management
- **Types**: SyncManifest, MessageDelta, ReactionDelta, MemberDelta, PeerMapDelta

#### Storage Adapter (`src/storage/`)
- **Interface**: Platform-agnostic storage operations
- **Operations**: Spaces, Channels, Messages, Conversations, User Config, Space Members
- **Sync-specific**: Message digests, member digests, tombstones, sync timestamps

#### React Query Hooks (`src/hooks/`)
- **Query Hooks**: useSpaces, useSpace, useSpaceMembers, useChannels, useMessages, useInvalidateMessages
- **Mutation Hooks**: useSendMessage, useEditMessage, useDeleteMessage, useAddReaction, useRemoveReaction
- **Features**: Optimistic updates, automatic rollback, query invalidation, offline-first caching

#### Crypto & Signing (`src/crypto/`, `src/signing/`)
- Ed448/X448 keypairs, X3DH key exchange
- Double ratchet (1:1), Triple ratchet (groups)
- WasmCryptoProvider, WasmSigningProvider

#### Transport (`src/transport/`)
- HTTP TransportClient interface
- BrowserWebSocketClient, RNWebSocketClient
- Sealed messaging with encryption wrapper

#### Utilities (`src/utils/`)
- **Formatting**: formatTime, formatDate, formatDateTime, formatRelativeTime, formatMessageDate, truncateText, formatFileSize, formatMemberCount
- **Other**: Validation helpers, mention parsing, encoding/decoding, logger

---

## Part 1b: Current quorum-mobile Contents

quorum-mobile already has its own UI components and theme system (not from quorum-shared):

**UI Components** (`components/ui/`):
- Avatar, DefaultAvatar
- Button, Card
- EmptyState, ErrorState, LoadingState
- IconSymbol (with iOS variant)
- OfflineBanner, TabBar

**Theme System** (`theme/`):
- ThemeProvider.tsx
- colors.ts, fonts.ts, themes.ts

**Other Components**: Chat/, SocialFeed/, onboarding/, shared/, plus various modals (Profile, Space, Invite, etc.)

**Key Insight**: quorum-mobile has independently developed UI components. Migration to quorum-shared needs to reconcile these with desktop primitives - either:
- Replace mobile's components with shared primitives
- Merge best of both into quorum-shared
- Keep some mobile-specific components locally

---

## Part 2: Gap Analysis

### What's Missing from quorum-shared

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GAP ANALYSIS VISUALIZATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ IN quorum-shared:              ❌ NOT IN quorum-shared:          │
│  ──────────────────────            ─────────────────────────         │
│  • Core types (Message, Space)     • UI Primitives (25+ components) │
│  • Sync protocol                   • Theme system (colors, tokens)  │
│  • Basic React Query hooks         • Extended hooks (50+ additional)│
│  • Storage adapter interface       • Mention utilities              │
│  • Crypto/Signing (WASM)           • Markdown processing            │
│  • Transport layer                 • Image processing               │
│  • Basic formatting utils          • Search service                 │
│                                    • Notification types             │
│                                    • Action queue system            │
│                                    • Additional business hooks      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Critical Gap: No UI Layer

The most significant gap is that **quorum-shared has no UI components**:
- No primitives (Button, Input, Modal, etc.)
- No theme system (colors, design tokens)
- No styling infrastructure

This means quorum-mobile cannot currently share UI consistency with quorum-desktop.

---

## Part 3: Migration Candidates from Desktop

### HIGH PRIORITY - Foundation Layer

#### 1. Primitive Components

**Location**: `src/components/primitives/`

| Component | Platform Support | Files |
|-----------|-----------------|-------|
| Button | .web.tsx, .native.tsx | Full dual implementation |
| Input | .web.tsx, .native.tsx | Full dual implementation |
| TextArea | .web.tsx, .native.tsx | Full dual implementation |
| Select | .web.tsx, .native.tsx | Full dual implementation |
| Switch | .web.tsx, .native.tsx | Full dual implementation |
| Modal | .web.tsx, .native.tsx | Full dual implementation |
| Icon | .web.tsx, .native.tsx | Full dual implementation |
| Text | .web.tsx, .native.tsx | Full dual implementation |
| Tooltip | .web.tsx, .native.tsx | Full dual implementation |
| RadioGroup | .web.tsx, .native.tsx | Full dual implementation |
| FileUpload | .web.tsx, .native.tsx | Full dual implementation |
| ColorSwatch | .web.tsx, .native.tsx | Full dual implementation |

| Component | Platform Support | Notes |
|-----------|-----------------|-------|
| Container | Shared | Layout primitive |
| FlexRow | Shared | Layout primitive |
| FlexColumn | Shared | Layout primitive |
| FlexBetween | Shared | Layout primitive |
| FlexCenter | Shared | Layout primitive |
| Spacer | Shared | Layout primitive |
| ScrollContainer | Shared | Layout primitive |
| ResponsiveContainer | Shared | Layout primitive |
| OverlayBackdrop | Shared | Modal support |
| ModalContainer | Shared | Modal support |
| Portal | Web-only | DOM-specific |
| Callout | Shared | Display component |

**Migration Complexity**: Medium
**Value**: Critical - enables UI consistency across platforms

#### 2. Theme System

**Location**: `src/styles/`

| File | Contents | Shareability |
|------|----------|--------------|
| `_variables.scss` | Spacing ($s-0 to $s-96), typography ($text-xs to $text-5xl), shadows, borders, transitions | 100% shareable as tokens |
| `_colors.scss` | Light/dark themes, 6 accent colors (blue, purple, fuchsia, orange, green, yellow), semantic colors | 100% shareable |

**Design Tokens to Extract**:
```
Spacing:     $s-0, $s-1, $s-2... $s-96
Typography:  $text-xs, $text-sm, $text-base... $text-5xl
             $font-message, $font-input, $font-label-small
Colors:      Accent themes (6), surface levels, text colors, borders
Shadows:     Component shadows, elevation levels
Transitions: Standard timing functions
```

**Migration Complexity**: Low-Medium (need JS object format for React Native)
**Value**: Critical - design consistency foundation

---

### MEDIUM PRIORITY - Extended Functionality

#### 3. Extended Hooks

**Location**: `src/hooks/`

**Query Hooks (50+ files)** - Organized by domain:
- `channels/`: useChannel, useInvalidateChannel
- `config/`: useConfig, useInvalidateConfig
- `conversation/`: useConversation
- `conversations/`: useConversations
- `messages/`: useInvalidateMessages
- `global/`: useGlobal, useInvalidateGlobal
- `inbox/`: useInbox, useInvalidateInbox
- `spaces/`: useSpaces, useInvalidateSpaces
- `spaceMembers/`: useInvalidateSpaceMembers
- `spaceOwner/`: useSpaceOwner
- `registration/`: useRegistration
- `userInfo/`: useInvalidateUserInfo

**Business Hooks (30+ files)**:
- `channels/`: useChannelManagement, useChannelPermissions, useGroupEditor, useGroupManagement
- `conversations/`: useConversationPolling, useConversationsData, useDirectMessageCreation
- `messages/`: useChannelUnreadCounts, useEmojiPicker, useMessageComposer, useMessageFormatting, useQuickReactions
- `search/`: useBatchSearchResultsDisplay, useGlobalSearchNavigation, useGlobalSearchState
- `mentions/`: useMentionInput, useMentionNotificationSettings
- `folders/`: useDeleteFolder, useFolderDragAndDrop, useNavItems

**Platform-Agnostic**: ~95%
**Migration Complexity**: Medium (need to verify no platform-specific deps)

#### 4. Utility Functions

**Location**: `src/utils/`

| Category | Files | Shareability |
|----------|-------|--------------|
| **Validation** | validation.ts | 100% - XSS prevention, name validation, IPFS CID validation |
| **Permissions** | permissions.ts, channelPermissions.ts | 100% |
| **Date Formatting** | dateFormatting.ts | 100% - moment-timezone based |
| **Mention Processing** | mentionUtils.ts, mentionHighlighting.ts | 100% |
| **Markdown** | markdownFormatting.ts, markdownStripping.ts | 100% |
| **Code Formatting** | codeFormatting.ts | 100% |
| **Message Utils** | messageGrouping.ts, messageLinkUtils.ts, messagePreview.ts | 100% |
| **Crypto** | crypto.ts, bytes.ts, canonicalize.ts | With platform adapters |
| **Image Processing** | imageProcessing/* (compressor, gifProcessor, etc.) | 100% |

**Migration Complexity**: Low
**Value**: High - prevents code duplication

#### 5. Extended Types

**Location**: `src/types/`

| File | Types | Notes |
|------|-------|-------|
| actionQueue.ts | ActionType enum (~30 types), TaskStatus, QueueTask, QueueStats | Background task system |
| notifications.ts | NotificationTypeId, NotificationSettings, NotificationSettingOption, ReplyNotification | Notification preferences |

**Migration Complexity**: Low
**Value**: Medium

---

### LOW PRIORITY - Application Layer

#### 6. Services (Requires Refactoring)

**Location**: `src/services/`

| Service | Lines | Shareability | Notes |
|---------|-------|--------------|-------|
| MessageService | ~1000+ | Partial | Has React MutableRef deps |
| EncryptionService | ~500 | High | Key management |
| SyncService | ~300 | Already using shared | Uses SharedSyncService |
| SpaceService | ~400 | High | CRUD operations |
| ConfigService | ~200 | High | User config |
| ActionQueueService | ~300 | High | Background tasks |
| SearchService | ~200 | High | MiniSearch based |
| NotificationService | ~150 | Partial | Platform-specific notifications |

**Migration Complexity**: High (need to remove React refs)
**Value**: Medium

#### 7. Constants

**Location**: `src/constants/`

- `touchInteraction.ts`: TOUCH_INTERACTION_CONFIG, TOUCH_INTERACTION_TYPES
- `ui.ts`: UI-related constants

**Migration Complexity**: Low
**Value**: Low

---

### DO NOT MIGRATE - Platform-Specific

| Item | Reason |
|------|--------|
| `src/db/messages.ts` (MessageDB) | IndexedDB implementation - mobile needs AsyncStorage |
| `useResponsiveLayout.native.ts` | Platform-specific |
| `useSearchContext.native.ts` | Platform-specific |
| `src/utils/mock/` | Development only |
| Electron wrapper | Desktop only |
| Platform detection utilities | Keep in respective platforms |

---

## Part 4: Architectural Recommendations

### Recommended Package Structure

```
@quilibrium/quorum-shared/
├── src/
│   ├── api/              # ✅ Existing
│   ├── crypto/           # ✅ Existing
│   ├── hooks/            # ✅ Existing + extend
│   ├── signing/          # ✅ Existing
│   ├── storage/          # ✅ Existing
│   ├── sync/             # ✅ Existing
│   ├── transport/        # ✅ Existing
│   ├── types/            # ✅ Existing + extend
│   ├── utils/            # ✅ Existing + extend
│   │
│   ├── primitives/       # 🆕 NEW - from desktop
│   │   ├── Button/
│   │   │   ├── Button.web.tsx
│   │   │   ├── Button.native.tsx
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Modal/
│   │   └── ...
│   │
│   └── theme/            # 🆕 NEW - from desktop
│       ├── tokens.ts     # Design tokens as JS objects
│       ├── colors.ts     # Color definitions
│       ├── ThemeProvider.web.tsx
│       ├── ThemeProvider.native.tsx
│       └── index.ts
```

### Migration Strategy

```
Phase 1: Foundation (Primitives + Theme)
├── Extract design tokens to JS format
├── Migrate primitive components
├── Set up platform resolution in build
└── Test in both desktop and mobile

Phase 2: Extended Hooks
├── Audit existing hooks for overlap with quorum-shared
├── Migrate non-overlapping hooks
├── Consolidate duplicates
└── Update imports in desktop

Phase 3: Utilities & Types
├── Migrate utility functions
├── Add extended types
└── Update documentation

Phase 4: Services (Optional)
├── Refactor to remove React refs
├── Extract platform-agnostic logic
└── Test thoroughly
```

### Build Configuration Considerations

For primitives to work across platforms, the shared package needs:

```javascript
// tsup.config.ts (or similar bundler config)
{
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // DON'T bundle platform files - let consumers resolve
  external: [/\.native\.tsx?$/, /\.web\.tsx?$/],
  // Or use conditional exports in package.json
}
```

```json
// package.json exports
{
  "exports": {
    "./primitives": {
      "react-native": "./dist/primitives/index.native.js",
      "default": "./dist/primitives/index.web.js"
    }
  }
}
```

---

## Part 5: Questions

Before proceeding with migration, the following should be clarified:

1. **Theme format**: Desktop uses SCSS variables. Should the shared theme be:
   - Pure JS/TS objects (works everywhere)?
   - SCSS for web + JS for mobile?
   - CSS custom properties?

2. **Package versioning**: How should we handle version coordination between quorum-shared, quorum-desktop, and quorum-mobile?

3. **Hook duplication**: quorum-shared already has `useSpaces`, `useMessages`, etc. Are desktop's versions using those, or custom implementations that need consolidation?

4. **Sync service**: Desktop has SyncService that uses SharedSyncService. What's the intended boundary between them?

5. **Breaking changes**: Is it okay to update imports in desktop as we migrate, or do we need backwards compatibility shims?

6. **quorum-mobile reconciliation**: Mobile already has Button, Card, Avatar, theme system, etc. Should shared primitives replace these, merge with them, or coexist?

**Note**: The desktop `mobile/` folder contains a complete Expo test playground (16 primitive + 8 business test screens) that can be ported to quorum-mobile for testing shared primitives.

---

## Summary: Migration Priority Matrix

| Category | Items | Platform-Agnostic | Effort | Value | Priority |
|----------|-------|-------------------|--------|-------|----------|
| **Primitives** | 25+ components | Mixed (dual impl) | Medium | Critical | **HIGH** |
| **Theme System** | Colors, tokens | 100% | Low-Med | Critical | **HIGH** |
| **Extended Hooks** | 80+ hooks | ~95% | Medium | High | **MEDIUM** |
| **Utilities** | 40+ modules | ~90% | Low | High | **MEDIUM** |
| **Extended Types** | ActionQueue, Notifications | 100% | Low | Medium | **MEDIUM** |
| **Services** | 7 services | ~80% | High | Medium | **LOW** |
| **Constants** | Touch, UI | 100% | Low | Low | **LOW** |

---

## Related Documentation

- [Cross-Platform Repository Implementation](.agents/docs/cross-platform-repository-implementation.md) - Current desktop structure
- [Primitives Architecture](.agents/docs/primitives-architecture.md) - Component design patterns
- quorum-shared package: `node_modules/@quilibrium/quorum-shared/`

---


_Report Type: Analysis/Migration Planning_
