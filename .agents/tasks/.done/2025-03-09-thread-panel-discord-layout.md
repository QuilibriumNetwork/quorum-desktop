# Discord-style Thread Panel Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move ThreadPanel from inside Channel.tsx to Space.tsx level (Discord-style), so the main chat doesn't shrink when a thread opens, and add a drag-to-resize handle.

**Architecture:** Create a ThreadContext that Channel.tsx populates with thread state/actions and ThreadPanel consumes. ThreadPanel moves to Space.tsx as a flex sibling of Channel. A resize handle on the panel's left edge allows width adjustment, persisted to localStorage.

**Tech Stack:** React Context, CSS custom properties, mousedown/mousemove/mouseup for resize, localStorage for persistence.

---

### Task 1: Create ThreadContext

**Files:**
- Create: `src/components/context/ThreadContext.tsx`

**Steps:**

1. Create `src/components/context/ThreadContext.tsx` with the context, provider shell, and hook:

```typescript
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type {
  Message as MessageType,
  Role,
  Channel,
  Sticker,
  Emoji,
} from '../../api/quorumApi';

export interface ThreadChannelProps {
  spaceId: string;
  channelId: string;
  members: any;
  roles: Role[];
  stickers?: { [key: string]: Sticker };
  customEmoji?: Emoji[];
  mapSenderToUser: (senderId: string) => any;
  isSpaceOwner?: boolean;
  canDeleteMessages: (message: MessageType) => boolean;
  canPinMessages?: (message: MessageType) => boolean;
  channel?: Channel;
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  onUserClick?: (...args: any[]) => void;
  spaceName?: string;
  isRepudiable?: boolean;
  skipSigning?: boolean;
  onSigningToggle?: () => void;
  users?: Array<{ address: string; displayName?: string; userIcon?: string }>;
  mentionRoles?: Role[];
  spaceGroups?: Array<{ groupName: string; channels: Channel[]; icon?: string; iconColor?: string }>;
  canUseEveryone?: boolean;
  onShowStickers?: () => void;
}

export interface ThreadContextValue {
  // State
  isOpen: boolean;
  threadId: string | null;
  rootMessage: MessageType | null;
  threadMessages: MessageType[];
  isLoading: boolean;

  // Actions
  openThread: (message: MessageType) => void;
  closeThread: () => void;
  submitMessage: (message: string | object, inReplyTo?: string) => Promise<void>;
  submitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;

  // Channel data needed by ThreadPanel
  channelProps: ThreadChannelProps | null;

  // Setters (called by Channel to populate context)
  setThreadState: (state: {
    isOpen: boolean;
    threadId: string | null;
    rootMessage: MessageType | null;
    threadMessages: MessageType[];
    isLoading: boolean;
  }) => void;
  setThreadActions: (actions: {
    openThread: (message: MessageType) => void;
    closeThread: () => void;
    submitMessage: (message: string | object, inReplyTo?: string) => Promise<void>;
    submitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  }) => void;
  setChannelProps: (props: ThreadChannelProps) => void;
}

const noop = () => {};
const noopAsync = async () => {};

const defaultValue: ThreadContextValue = {
  isOpen: false,
  threadId: null,
  rootMessage: null,
  threadMessages: [],
  isLoading: false,
  openThread: noop,
  closeThread: noop,
  submitMessage: noopAsync,
  submitSticker: undefined,
  channelProps: null,
  setThreadState: noop,
  setThreadActions: noop,
  setChannelProps: noop,
};

const ThreadContext = createContext<ThreadContextValue>(defaultValue);

export function ThreadProvider({ children }: { children: React.ReactNode }) {
  const [threadState, setThreadState] = useState<{
    isOpen: boolean;
    threadId: string | null;
    rootMessage: MessageType | null;
    threadMessages: MessageType[];
    isLoading: boolean;
  }>({
    isOpen: false,
    threadId: null,
    rootMessage: null,
    threadMessages: [],
    isLoading: false,
  });

  const [threadActions, setThreadActions] = useState<{
    openThread: (message: MessageType) => void;
    closeThread: () => void;
    submitMessage: (message: string | object, inReplyTo?: string) => Promise<void>;
    submitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  }>({
    openThread: noop,
    closeThread: noop,
    submitMessage: noopAsync,
  });

  const [channelProps, setChannelProps] = useState<ThreadChannelProps | null>(null);

  const value = useMemo<ThreadContextValue>(
    () => ({
      ...threadState,
      ...threadActions,
      channelProps,
      setThreadState,
      setThreadActions,
      setChannelProps,
    }),
    [threadState, threadActions, channelProps]
  );

  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
}

export function useThreadContext() {
  return useContext(ThreadContext);
}
```

2. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
3. Commit: `feat: add ThreadContext for sharing thread state between Channel and ThreadPanel`

---

### Task 2: Wire Channel.tsx to populate ThreadContext

**Files:**
- Modify: `src/components/space/Channel.tsx`

**Steps:**

1. Add import at top of Channel.tsx:

```typescript
import { useThreadContext } from '../context/ThreadContext';
```

2. Inside the Channel component, after the existing thread state/hooks section (around line 122), add a call to populate the context. Add this after `const threadMessages = threadData?.messages ?? [];`:

```typescript
  // Populate ThreadContext for ThreadPanel (rendered in Space.tsx)
  const threadCtx = useThreadContext();

  // Sync thread state to context
  React.useEffect(() => {
    threadCtx.setThreadState({
      isOpen: activePanel === 'thread',
      threadId: activeThreadId,
      rootMessage: activeThreadRootMessage,
      threadMessages,
      isLoading: isLoadingThread,
    });
  }, [activePanel, activeThreadId, activeThreadRootMessage, threadMessages, isLoadingThread]);
```

3. After the `handleSubmitThreadSticker` callback (around line 495), sync actions to context:

```typescript
  // Sync thread actions to context
  React.useEffect(() => {
    threadCtx.setThreadActions({
      openThread: handleOpenThread,
      closeThread: () => {
        setActivePanel(null);
        setActiveThreadId(null);
        setActiveThreadRootMessage(null);
      },
      submitMessage: handleSubmitThreadMessage,
      submitSticker: handleSubmitThreadSticker,
    });
  }, [handleOpenThread, handleSubmitThreadMessage, handleSubmitThreadSticker]);
```

4. Sync channel props to context. Add after the thread actions sync:

```typescript
  // Sync channel props to context for ThreadPanel
  React.useEffect(() => {
    threadCtx.setChannelProps({
      spaceId,
      channelId,
      members,
      roles,
      stickers,
      customEmoji: space?.emojis,
      mapSenderToUser,
      isSpaceOwner,
      canDeleteMessages,
      canPinMessages,
      channel,
      spaceChannels,
      onChannelClick: handleChannelClick,
      onUserClick: userProfileModal.handleUserClick as any,
      spaceName: space?.spaceName,
      isRepudiable: space?.isRepudiable,
      skipSigning,
      onSigningToggle: () => setSkipSigning(!skipSigning),
      users: Object.values(members),
      mentionRoles: roles?.filter(role => role.isPublic !== false),
      spaceGroups,
      canUseEveryone,
      onShowStickers: handleShowEmojiPanel,
    });
  }, [
    spaceId, channelId, members, roles, stickers, space?.emojis,
    mapSenderToUser, isSpaceOwner, canDeleteMessages, canPinMessages,
    channel, spaceChannels, handleChannelClick, userProfileModal.handleUserClick,
    space?.spaceName, space?.isRepudiable, skipSigning, spaceGroups,
    canUseEveryone, handleShowEmojiPanel,
  ]);
```

5. **Remove the `<ThreadPanel ... />` JSX block** from Channel.tsx (lines ~1217-1254). Delete the entire `{/* Thread sidebar */}` section.

6. Also remove the ThreadPanel import at the top: `import { ThreadPanel } from '../thread/ThreadPanel';`

7. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
8. Commit: `refactor: move thread state from Channel props to ThreadContext`

---

### Task 3: Update ThreadPanel to consume ThreadContext

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`

**Steps:**

1. Replace the entire ThreadPanelProps interface and component to consume context instead of props:

```typescript
import React, { useRef, useMemo } from 'react';
import type { PostMessage } from '../../api/quorumApi';
import { Button, Icon } from '../primitives';
import { t } from '@lingui/core/macro';
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, { MessageComposerRef } from '../message/MessageComposer';
import { useMessageComposer } from '../../hooks';
import { useThreadContext } from '../context/ThreadContext';
import type { Message as MessageType } from '../../api/quorumApi';
import './ThreadPanel.scss';
```

2. Remove the `ThreadPanelProps` interface entirely. Keep the `getThreadTitle` function unchanged.

3. Replace the component to read from context:

```typescript
export const ThreadPanel: React.FC = () => {
  const {
    isOpen,
    threadId,
    rootMessage,
    threadMessages,
    isLoading: isLoadingThread,
    closeThread,
    submitMessage: onSubmitThreadMessage,
    submitSticker: onSubmitThreadSticker,
    channelProps,
  } = useThreadContext();

  const messageListRef = useRef<MessageListRef>(null);
  const composerRef = useRef<MessageComposerRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const composer = useMessageComposer({
    type: 'channel',
    onSubmitMessage: onSubmitThreadMessage,
    onSubmitSticker: onSubmitThreadSticker,
    hasStickers: !!channelProps?.stickers && Object.keys(channelProps.stickers).length > 0,
  });

  const threadTitle = useMemo(() => getThreadTitle(rootMessage), [rootMessage]);

  const starterName = useMemo(() => {
    if (!rootMessage?.content?.senderId || !channelProps?.mapSenderToUser) return null;
    const user = channelProps.mapSenderToUser(rootMessage.content.senderId);
    return user?.displayName || null;
  }, [rootMessage, channelProps?.mapSenderToUser]);

  if (!isOpen || !threadId || !channelProps) return null;

  return (
    <div className="thread-panel">
      {/* Header — same as before */}
      <div className="thread-panel__header">
        <div className="thread-panel__header-content">
          <h2 className="thread-panel__title">{threadTitle}</h2>
          {starterName && (
            <span className="thread-panel__started-by">
              {t`Started by`} <strong>{starterName}</strong>
            </span>
          )}
        </div>
        <Button type="unstyled" onClick={closeThread} className="thread-panel__close">
          <Icon name="x" size="md" />
        </Button>
      </div>

      {/* Thread messages */}
      <div className="thread-panel__messages">
        {isLoadingThread ? (
          <div className="thread-panel__loading">
            <Icon name="spinner" className="loading-icon icon-spin" />
            <span>{t`Loading thread...`}</span>
          </div>
        ) : (
          <MessageList
            ref={messageListRef}
            stickers={channelProps.stickers}
            roles={channelProps.roles}
            canDeleteMessages={channelProps.canDeleteMessages}
            canPinMessages={channelProps.canPinMessages}
            channel={channelProps.channel}
            isSpaceOwner={channelProps.isSpaceOwner}
            editor={textareaRef}
            messageList={threadMessages}
            setInReplyTo={composer.setInReplyTo}
            customEmoji={channelProps.customEmoji}
            members={channelProps.members}
            submitMessage={onSubmitThreadMessage}
            onUserClick={channelProps.onUserClick}
            lastReadTimestamp={undefined}
            onChannelClick={channelProps.onChannelClick}
            spaceChannels={channelProps.spaceChannels}
            fetchPreviousPage={() => {}}
            fetchNextPage={() => {}}
            hasNextPage={false}
            spaceName={channelProps.spaceName}
            users={channelProps.users}
            mentionRoles={channelProps.mentionRoles}
            groups={channelProps.spaceGroups}
            canUseEveryone={channelProps.canUseEveryone}
            alignToTop={true}
          />
        )}
      </div>

      {/* Thread composer */}
      <div className="thread-panel__composer">
        <MessageComposer
          ref={composerRef}
          canUseEveryone={channelProps.canUseEveryone}
          value={composer.pendingMessage}
          onChange={composer.setPendingMessage}
          onKeyDown={composer.handleKeyDown}
          placeholder={t`Reply in thread...`}
          calculateRows={composer.calculateRows}
          getRootProps={composer.getRootProps}
          getInputProps={composer.getInputProps}
          processedImage={composer.processedImage}
          clearFile={composer.clearFile}
          onSubmitMessage={composer.submitMessage}
          onShowStickers={channelProps.onShowStickers || (() => {})}
          inReplyTo={composer.inReplyTo}
          setInReplyTo={composer.setInReplyTo}
          mapSenderToUser={channelProps.mapSenderToUser}
          users={channelProps.users}
          roles={channelProps.mentionRoles}
          groups={channelProps.spaceGroups}
          fileError={composer.fileError}
          isProcessingImage={composer.isProcessingImage}
          mentionError={composer.mentionError}
          messageValidation={composer.messageValidation}
          characterCount={composer.characterCount}
          showSigningToggle={channelProps.isRepudiable}
          skipSigning={channelProps.skipSigning}
          onSigningToggle={channelProps.onSigningToggle}
        />
      </div>
    </div>
  );
};

export default ThreadPanel;
```

4. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
5. Commit: `refactor: ThreadPanel consumes ThreadContext instead of props`

---

### Task 4: Move ThreadPanel to Space.tsx and wrap with ThreadProvider

**Files:**
- Modify: `src/components/space/Space.tsx`

**Steps:**

1. Update Space.tsx imports:

```typescript
import { ThreadProvider } from '../context/ThreadContext';
import { ThreadPanel } from '../thread/ThreadPanel';
```

2. Wrap the `space-container` children with `ThreadProvider` and add `ThreadPanel` as a sibling of `Channel`:

```typescript
  return (
    <ThreadProvider>
      <div className="space-container">
        {/* Mobile backdrop overlay */}
        {(isMobile || isTablet) && leftSidebarOpen && (
          <div
            className={`fixed inset-y-0 right-0 bg-overlay z-[997] left-sidebar-backdrop ${!navMenuOpen ? 'nav-menu-hidden' : ''}`}
            onClick={closeLeftSidebar}
          />
        )}

        <div
          className={`space-container-channels ${leftSidebarOpen && (isMobile || isTablet) ? 'open' : ''} ${!navMenuOpen ? 'nav-menu-hidden' : ''}`}
        >
          <ChannelList spaceId={params.spaceId} />
        </div>
        <Channel
          key={`${params.spaceId}-${params.channelId}`}
          spaceId={params.spaceId}
          channelId={params.channelId}
        />
        <ThreadPanel />
      </div>
    </ThreadProvider>
  );
```

3. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
4. Commit: `feat: render ThreadPanel at Space level as Discord-style sidebar`

---

### Task 5: Add resize handle to ThreadPanel

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`
- Modify: `src/components/thread/ThreadPanel.scss`

**Steps:**

1. Add resize state and handlers to ThreadPanel. Add these inside the component, before the `if (!isOpen)` guard:

```typescript
  // Resize handle
  const STORAGE_KEY = 'thread-panel-width';
  const MIN_WIDTH = 300;
  const MAX_WIDTH_VW = 50; // 50vw
  const DEFAULT_WIDTH = 400;

  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH) return parsed;
    }
    return DEFAULT_WIDTH;
  });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - moveEvent.clientX; // dragging left = wider
      const maxWidth = window.innerWidth * (MAX_WIDTH_VW / 100);
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Persist
      const current = panelRef.current;
      if (current) {
        const width = current.getBoundingClientRect().width;
        localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);
```

2. Update the panel's root JSX to use `panelWidth` and include the resize handle:

```tsx
  return (
    <div
      className="thread-panel"
      ref={panelRef}
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resize handle */}
      <div
        className="thread-panel__resize-handle"
        onMouseDown={handleResizeStart}
      />

      {/* Header — unchanged */}
      ...
    </div>
  );
```

3. Add resize handle styles to `ThreadPanel.scss`. Replace the fixed `width: 400px` with a fallback and add the handle:

```scss
.thread-panel {
  display: flex;
  flex-direction: column;
  width: 400px; // fallback, overridden by inline style
  max-width: 50vw;
  height: 100%;
  background: var(--bg-chat);
  border-left: 1px solid var(--border-default);
  flex-shrink: 0;
  position: relative;

  &__resize-handle {
    position: absolute;
    left: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    transition: background-color $duration-150 $ease-out;

    &:hover,
    &:active {
      background-color: var(--text-link);
    }
  }

  // ... rest unchanged
}
```

4. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
5. Commit: `feat: add drag-to-resize handle on ThreadPanel with localStorage persistence`

---

### Task 6: Verify and clean up

**Files:**
- Verify: all modified files

**Steps:**

1. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck` — ensure no errors
2. Run: `yarn lint` — ensure no lint errors
3. Run: `yarn build` — ensure build succeeds
4. Manual verification checklist:
   - [ ] Thread panel opens as separate column at Space level (not inside Channel)
   - [ ] Main chat area width doesn't change when thread opens
   - [ ] Resize handle on left edge works (drag left = wider, drag right = narrower)
   - [ ] Width persists across page refreshes (localStorage)
   - [ ] Min 300px and max 50vw bounds respected
   - [ ] Thread panel header, messages, and composer still work correctly
   - [ ] Close button closes thread panel
   - [ ] "Start Thread" / "View Thread" from message actions still works
   - [ ] Users sidebar still visible when thread panel is open
5. Commit: `chore: verify Discord-style thread panel layout`

---

_Created: 2026-03-09_
