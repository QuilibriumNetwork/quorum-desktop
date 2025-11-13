/co# Implement Unread Message Features for Direct Messages

**Status**: In Progress
**Priority**: High
**Estimated Effort**: 1.5 hours
**Related**: `.agents/tasks/direct-message-features-comparison.md` (analysis)

---

## Overview

Implement the complete unread message feature set for DirectMessage.tsx to achieve parity with Channel.tsx. These features work together as a cohesive package:

- **Auto-jump** → Navigates user to first unread
- **Separator** → Explains why user is in middle of conversation
- **Jump button** → Provides escape route back to present
- **Hash nav** → Enables personal bookmarking/reference

---

## Prerequisites

✅ **DONE**: Fix read time tracking bug (`Date.now()` → actual message timestamp)
**Commit**: `6885faea`

---

## Task Breakdown

### Task 1: Add hasNextPage Support ⏳

**Files**:
- `src/hooks/business/conversations/useDirectMessagesList.ts`
- `src/components/direct/DirectMessage.tsx`

**Effort**: 5 minutes

**Changes**:

1. **Update `useDirectMessagesList.ts`**:
   ```typescript
   // Line 9-16: Update interface
   export interface UseDirectMessagesListReturn {
     messageList: MessageType[];
     acceptChat: boolean;
     fetchNextPage: () => void;
     fetchPreviousPage: () => void;
     hasNextPage?: boolean;  // ✅ Add this
     saveReadTime: () => void;
     canDeleteMessages: (message: MessageType) => boolean;
   }

   // Line 30-35: Destructure hasNextPage
   const {
     data: messages,
     fetchNextPage,
     fetchPreviousPage,
     hasNextPage,  // ✅ Add this
   } = useMessages({ spaceId: address!, channelId: address! });

   // Line 96-103: Return hasNextPage
   return {
     messageList,
     acceptChat,
     fetchNextPage,
     fetchPreviousPage,
     hasNextPage,  // ✅ Add this
     saveReadTime,
     canDeleteMessages,
   };
   ```

2. **Update `DirectMessage.tsx`**:
   ```typescript
   // Line 106-112: Destructure hasNextPage
   const {
     messageList,
     acceptChat,
     fetchPreviousPage,
     fetchNextPage,
     hasNextPage,  // ✅ Add this
     canDeleteMessages,
   } = useDirectMessagesList();

   // Line 528-542: Pass to MessageList
   <MessageList
     fetchPreviousPage={() => { fetchPreviousPage(); }}
     fetchNextPage={() => { fetchNextPage(); }}  // ✅ Add this
     hasNextPage={hasNextPage}                    // ✅ Add this
     ...
   />
   ```

**Testing**:
- [ ] Verify TypeScript compiles without errors
- [ ] Check that prop is passed correctly to MessageList

---

### Task 2: Implement Auto-Jump to First Unread ⏳

**Files**:
- `src/components/direct/DirectMessage.tsx`

**Effort**: 30 minutes

**Changes**:

1. **Add imports** (after line 11):
   ```typescript
   import { loadMessagesAround } from '../../hooks/queries/messages/loadMessagesAround';
   import { buildMessagesKey } from '../../hooks/queries/messages/buildMessagesKey';
   ```

2. **Add state** (after line 61):
   ```typescript
   // Auto-jump to first unread state
   const [scrollToMessageId, setScrollToMessageId] = useState<string | undefined>();
   ```

3. **Get lastReadTimestamp** (after line 74):
   ```typescript
   // Get last read timestamp from conversation
   const lastReadTimestamp = conversation?.conversation?.lastReadTimestamp || 0;
   ```

4. **Add auto-jump logic** (after line 326, before helper functions):
   ```typescript
   // Auto-jump to first unread message on conversation entry
   useEffect(() => {
     // Skip if there's a hash navigation in progress
     if (window.location.hash.startsWith('#msg-')) {
       return;
     }

     // Skip if no unread messages
     if (lastReadTimestamp === 0) {
       return;
     }

     const jumpToFirstUnread = async () => {
       try {
         // Get the first unread message
         const firstUnread = await messageDB.getFirstUnreadMessage({
           spaceId: address!,
           channelId: address!,
           afterTimestamp: lastReadTimestamp,
         });

         // If no unread message found, don't jump
         if (!firstUnread) {
           return;
         }

         // Check if the first unread is already in the loaded messages
         const isAlreadyLoaded = messageList.some(
           (m) => m.messageId === firstUnread.messageId
         );

         if (isAlreadyLoaded) {
           // Message is already loaded, just scroll to it
           setScrollToMessageId(firstUnread.messageId);
           return;
         }

         // Load messages around the first unread message
         const { messages, prevCursor, nextCursor } = await loadMessagesAround({
           messageDB,
           spaceId: address!,
           channelId: address!,
           targetMessageId: firstUnread.messageId,
           beforeLimit: 40,
           afterLimit: 40,
         });

         // Update React Query cache to replace current pages with new data
         queryClient.setQueryData(
           buildMessagesKey({ spaceId: address!, channelId: address! }),
           {
             pages: [{ messages, prevCursor, nextCursor }],
             pageParams: [undefined],
           }
         );

         // Set the message ID to scroll to
         setScrollToMessageId(firstUnread.messageId);
       } catch (error) {
         console.error('Failed to jump to first unread:', error);
         // Silently fail - user will see messages from bottom as usual
       }
     };

     // Only auto-jump on initial conversation mount
     const timer = setTimeout(() => {
       jumpToFirstUnread();
     }, 100);

     return () => clearTimeout(timer);
   }, [address, lastReadTimestamp, messageDB, messageList, queryClient]);

   // Reset scrollToMessageId when conversation changes
   useEffect(() => {
     setScrollToMessageId(undefined);
   }, [address]);
   ```

5. **Pass prop to MessageList** (line 528-542):
   ```typescript
   <MessageList
     scrollToMessageId={scrollToMessageId}  // ✅ Add this
     ...
   />
   ```

**Testing**:
- [ ] Open DM with no unreads → lands at bottom (normal behavior)
- [ ] Open DM with 5+ unread messages → auto-jumps to first unread
- [ ] Check that 40 messages before + 40 after are loaded (if needed)
- [ ] Verify scroll position is correct
- [ ] Test with hash navigation (`#msg-abc123`) → hash takes priority

---

### Task 3: Implement New Messages Separator ⏳

**Files**:
- `src/components/direct/DirectMessage.tsx`

**Effort**: 10 minutes

**Changes**:

1. **Add state** (after scrollToMessageId state):
   ```typescript
   // New Messages separator state
   const [newMessagesSeparator, setNewMessagesSeparator] = useState<{
     firstUnreadMessageId: string;
     initialUnreadCount: number;
   } | null>(null);
   ```

2. **Add threshold logic inside auto-jump `useEffect`** (modify existing code):
   ```typescript
   if (isAlreadyLoaded) {
     // Calculate initial unread count
     const unreadCount = messageList.filter(
       (m) => m.createdDate > lastReadTimestamp
     ).length;

     // Check if we should show separator (avoid showing during active chatting)
     const firstUnreadAge = Date.now() - firstUnread.timestamp;
     const MIN_UNREAD_COUNT = 5; // Show if 5+ unreads
     const MIN_AGE_MS = 5 * 60 * 1000; // Show if oldest unread is 5+ minutes old

     const shouldShowSeparator =
       unreadCount >= MIN_UNREAD_COUNT || firstUnreadAge > MIN_AGE_MS;

     setScrollToMessageId(firstUnread.messageId);

     // Only set separator if threshold is met
     if (shouldShowSeparator) {
       setNewMessagesSeparator({
         firstUnreadMessageId: firstUnread.messageId,
         initialUnreadCount: unreadCount,
       });
     }

     return;
   }

   // After loading messages around first unread:
   const unreadCount = messages.filter(
     (m) => m.createdDate > lastReadTimestamp
   ).length;

   const firstUnreadAge = Date.now() - firstUnread.timestamp;
   const MIN_UNREAD_COUNT = 5;
   const MIN_AGE_MS = 5 * 60 * 1000;

   const shouldShowSeparator =
     unreadCount >= MIN_UNREAD_COUNT || firstUnreadAge > MIN_AGE_MS;

   setScrollToMessageId(firstUnread.messageId);

   if (shouldShowSeparator) {
     setNewMessagesSeparator({
       firstUnreadMessageId: firstUnread.messageId,
       initialUnreadCount: unreadCount,
     });
   }
   ```

3. **Pass props to MessageList**:
   ```typescript
   <MessageList
     newMessagesSeparator={newMessagesSeparator}
     onDismissSeparator={() => setNewMessagesSeparator(null)}
     ...
   />
   ```

4. **Reset on conversation change** (modify existing reset useEffect):
   ```typescript
   useEffect(() => {
     setScrollToMessageId(undefined);
     setNewMessagesSeparator(null);  // ✅ Add this
   }, [address]);
   ```

**Testing**:
- [ ] Open DM with 5+ unread messages → separator appears
- [ ] Check separator shows correct count (e.g., "5 New Messages")
- [ ] Scroll separator out of view → verify it dismisses
- [ ] Reopen DM with unreads → separator reappears
- [ ] Open DM with 1-4 unreads < 5 minutes old → NO separator (threshold not met)
- [ ] Open DM with 1-4 unreads > 5 minutes old → separator shows (age threshold met)

---

### Task 4: Add Jump to Present Button ⏳

**Files**:
- `src/components/direct/DirectMessage.tsx`

**Effort**: 15 minutes

**Changes**:

1. **Add imports**:
   ```typescript
   import { useScrollTracking } from '../../hooks/ui/useScrollTracking';
   ```

2. **Add state and handlers** (after line 61):
   ```typescript
   const [init, setInit] = useState(false);

   // Scroll tracking for jump to present button
   const { handleAtBottomStateChange, shouldShowJumpButton } = useScrollTracking();

   // Combined bottom state handler
   const handleBottomStateChange = useCallback(
     (atBottom: boolean) => {
       handleAtBottomStateChange(atBottom);
       if (atBottom && init) {
         fetchNextPage();
       }
     },
     [handleAtBottomStateChange, fetchNextPage, init]
   );

   // Jump to present handler
   const handleJumpToPresent = useCallback(() => {
     if (messageListRef.current) {
       messageListRef.current.scrollToBottom();
     }
   }, []);

   // Initialize
   useEffect(() => {
     if (!init) {
       setTimeout(() => setInit(true), 200);
     }
   }, []);
   ```

3. **Update MessageList props** (modify fetchNextPage call):
   ```typescript
   <MessageList
     // Remove inline fetchNextPage, use handler instead
     fetchNextPage={handleBottomStateChange}  // ✅ Change this
     ...
   />
   ```

4. **Add Jump to Present button** (after MessageList component, inside message-list container at line ~543):
   ```typescript
   </MessageList>

   {/* Jump to Present Button */}
   {shouldShowJumpButton && (
     <div className="absolute bottom-6 right-6 z-50 bg-chat rounded-full transition-all duration-300">
       <Button
         type="secondary"
         onClick={handleJumpToPresent}
         className="shadow-lg"
       >
         <Trans>Jump to present</Trans>
       </Button>
     </div>
   )}
   ```

**Testing**:
- [ ] Open DM → no button visible (at bottom)
- [ ] Auto-jump to unread → button appears
- [ ] Scroll up manually → button appears
- [ ] Click button → scrolls to bottom
- [ ] Scroll to bottom manually → button disappears
- [ ] Send new message → auto-scrolls to bottom, button disappears

---

### Task 5: Implement Hash Navigation ⏳

**Files**:
- `src/components/direct/DirectMessage.tsx`

**Effort**: 20 minutes

**Changes**:

1. **Add state** (after line 61):
   ```typescript
   const [isLoadingHashMessage, setIsLoadingHashMessage] = useState(false);
   ```

2. **Add handler** (after helper functions, before return statement):
   ```typescript
   const handleHashMessageNotFound = useCallback(
     async (messageId: string) => {
       try {
         setIsLoadingHashMessage(true);

         const { messages, prevCursor, nextCursor } = await loadMessagesAround({
           messageDB,
           spaceId: address!,
           channelId: address!,
           targetMessageId: messageId,
           beforeLimit: 40,
           afterLimit: 40,
         });

         queryClient.setQueryData(
           buildMessagesKey({ spaceId: address!, channelId: address! }),
           {
             pages: [{ messages, prevCursor, nextCursor }],
             pageParams: [undefined],
           }
         );
       } catch (error) {
         console.error('Failed to load hash message:', error);
         setTimeout(() => {
           window.history.replaceState(
             null,
             '',
             window.location.pathname + window.location.search
           );
         }, 100);
       } finally {
         setIsLoadingHashMessage(false);
       }
     },
     [messageDB, address, queryClient]
   );
   ```

3. **Pass props to MessageList**:
   ```typescript
   <MessageList
     onHashMessageNotFound={handleHashMessageNotFound}
     isLoadingHashMessage={isLoadingHashMessage}
     ...
   />
   ```

4. **Add loading indicator** (after Jump to Present button):
   ```typescript
   {/* Loading Hash Message Indicator */}
   {isLoadingHashMessage && (
     <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-chat-overlay rounded-lg p-4 shadow-lg">
       <div className="flex items-center space-x-3">
         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
         <span className="text-sm text-primary">
           <Trans>Loading message...</Trans>
         </span>
       </div>
     </div>
   )}
   ```

**Testing**:
- [ ] Open DM with `#msg-abc123` in URL → navigates to message
- [ ] Hash message in current view → scrolls to it (no loading)
- [ ] Hash message not loaded → loads messages around it + scrolls
- [ ] Hash message doesn't exist → shows error, removes hash
- [ ] Hash navigation takes priority over auto-jump

---

## Testing Checklist (End-to-End)

### Scenario 1: Normal Unread Flow
- [ ] User receives 10 DM messages while offline
- [ ] User opens DM
- [ ] Auto-jumps to first unread (message #1 of 10)
- [ ] Separator shows "10 New Messages"
- [ ] User reads messages
- [ ] User scrolls down to bottom
- [ ] Separator dismisses when scrolled out of view
- [ ] Jump button disappears when at bottom

### Scenario 2: Threshold Behavior
- [ ] User receives 3 DM messages (< 5 minutes old)
- [ ] Open DM → auto-jumps but NO separator
- [ ] User receives 3 DM messages (> 5 minutes old)
- [ ] Open DM → auto-jumps WITH separator (age threshold)

### Scenario 3: Hash Navigation Priority
- [ ] User has unreads in DM
- [ ] User opens DM with `#msg-xyz`
- [ ] Hash navigation takes priority (no auto-jump)
- [ ] Jumps to hash message, highlights it

### Scenario 4: No Unreads
- [ ] User opens DM with all messages read
- [ ] Lands at bottom (normal behavior)
- [ ] No auto-jump, no separator, no jump button

### Scenario 5: Very Long DM (500+ messages)
- [ ] Auto-jump to message #250
- [ ] Loads 40 before + 40 after (81 total visible)
- [ ] Scroll up → loads older messages
- [ ] Scroll down → loads newer messages
- [ ] Jump button visible
- [ ] Click jump button → goes to bottom (latest message)

### Scenario 6: Edge Cases
- [ ] Auto-jump, send new message → auto-scrolls to bottom
- [ ] Auto-jump, close DM, reopen → still shows unreads if not scrolled to bottom
- [ ] Auto-jump, scroll to separator, close DM, reopen → separator reappears

---

## Commit Strategy

**Previous Commit**: ✅ DONE - `🐛 fix: use message timestamp for DM read time tracking` (6885faea)

**Final Commit** (after all tasks complete):
```
✨ feat: add unread message features to DMs

- Auto-jump to first unread message
- New messages separator with smart thresholds
- Jump to Present button
- Hash navigation support
- hasNextPage support for forward pagination
```

---

## Files Modified

- `src/hooks/business/conversations/useDirectMessagesList.ts` - Add hasNextPage
- `src/components/direct/DirectMessage.tsx` - All features

---

## Success Criteria

- [ ] All 5 tasks completed
- [ ] All tests pass
- [ ] TypeScript compiles without errors
- [ ] No console errors in dev mode
- [ ] Features work on both desktop and mobile
- [ ] All 5 commits created
- [ ] Features match Channel.tsx behavior

---

*Created: 2025-11-12*
*Last updated: 2025-11-12*
