---
type: doc
title: New Messages Separator
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-24T00:00:00.000Z
---

# New Messages Separator

## Overview

### Problem
When auto-jumping to the first unread message in a channel or direct message, users need a clear visual indicator marking where the new unread messages begin. The existing subtle unread line was insufficient for drawing attention.

### Solution
Display an accent-colored separator line above the first unread message when auto-jumping. The separator features a "New" pill on the right side and persists until scrolled out of view.

**Key Features:**
- Accent-colored horizontal line spanning the full width
- Compact "New" pill positioned on the right in accent color
- Automatically dismisses when scrolled out of viewport
- Reappears on next channel visit if unreads remain

---

## How It Works

### Trigger Flow
```
1. User opens channel or DM with unreads
2. Auto-jump logic (Channel.tsx or DirectMessage.tsx) triggers
3. Checks thresholds: 5+ unreads OR first unread is 5+ minutes old
4. If threshold met: Sets newMessagesSeparator state + scrolls to first unread
5. If threshold not met: Only scrolls to first unread (no separator)
6. MessageList renders separator before first unread message (if shown)
7. User scrolls → Virtuoso's rangeChanged detects visibility change
8. When separator leaves viewport (up or down) → dismissed
```

**Thresholds (prevents separator spam during active chatting):**
- Show separator if **5+ unread messages**, OR
- Show separator if **first unread is 5+ minutes old**
- Always scroll to first unread (even if no separator shown)

### Visual Appearance

**Styling:**
- Line: Full-width accent-colored line (`border-accent`)
- Pill: "New" text in accent background with white text, positioned on the right
- Layout: Line extends full width, pill attached to right end
- Internationalization: Lingui i18n for "New" label

**Example:**
```
[...read messages...]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ [NEW]  ← Accent color line + pill
[First unread message]
[More unread messages]
[...newest messages...]
```

---

## Implementation

### 1. NewMessagesSeparator Component (NewMessagesSeparator.tsx)

```typescript
interface NewMessagesSeparatorProps {
  className?: string;      // Additional CSS classes
}

export const NewMessagesSeparator: React.FC<NewMessagesSeparatorProps> = ({
  className = '',
}) => {
  return (
    <FlexRow
      align="center"
      justify="center"
      className={`my-4 px-4 ${className}`}
      data-testid="new-messages-separator"
    >
      {/* Full-width separator line */}
      <div className="flex-1 h-px border-t border-accent" />

      {/* "New" pill on the right */}
      <Text
        size="xs"
        className="ml-2 px-2 py-0.5 rounded-full bg-accent text-white select-none uppercase font-semibold tracking-wide"
        testId="new-messages-separator-label"
      >
        {i18n._(t`New`)}
      </Text>
    </FlexRow>
  );
};
```

**Key Features:**
- Uses primitive components (FlexRow, Text) for cross-platform compatibility
- Accent-colored pill with white text for high visibility
- Lingui i18n with `i18n._()` and `t` macro for translations
- Compact design - just "New" label, no count
- No ref forwarding needed (dismissal handled by Virtuoso)

### 2. State Management

**Channels** (Channel.tsx:124-128) and **Direct Messages** (DirectMessage.tsx:69-72) share identical state:

```typescript
// New Messages separator state (consolidated)
const [newMessagesSeparator, setNewMessagesSeparator] = useState<{
  firstUnreadMessageId: string;
  initialUnreadCount: number;  // Used for threshold logic, not displayed
} | null>(null);
```

**State Lifecycle:**
- Set when auto-jump triggers **and thresholds met**
  - Channels: Channel.tsx:390-406, 435-452
  - Direct Messages: DirectMessage.tsx:390-411, 437-450
- `initialUnreadCount` used only for threshold checks (not displayed in UI)
- Reset to `null` when channel/conversation changes
  - Channels: Channel.tsx:467-470
  - Direct Messages: DirectMessage.tsx:461-462
- Dismissed when scrolled out of view (via callback from MessageList)

**Key Design Decisions:**
- **Thresholds**: 5+ unreads OR 5+ minutes old (prevents spam during active chat)
- **Consolidated state**: Single object instead of multiple useState calls
- **DM-specific logic**: In Direct Messages, only counts messages from the other party (excludes current user's messages)

### 3. Integration in MessageList (MessageList.tsx)

**New Props (MessageList.tsx:71-75):**
```typescript
interface MessageListProps {
  // ... existing props
  newMessagesSeparator?: {
    firstUnreadMessageId: string;
    initialUnreadCount: number;  // For threshold logic only
  } | null;
  onDismissSeparator?: () => void;
}
```

**Rendering Logic (MessageList.tsx:207-225):**
```typescript
const rowRenderer = useCallback((index: number) => {
  const message = messageList[index];

  // Check if separator needed before this message
  const needsNewMessagesSeparator =
    newMessagesSeparator &&
    message.messageId === newMessagesSeparator.firstUnreadMessageId;

  return (
    <React.Fragment>
      {/* Date separator (if needed) */}
      {needsDateSeparator && <DateSeparator ... />}

      {/* New Messages separator (if needed) */}
      {needsNewMessagesSeparator && <NewMessagesSeparator />}

      {/* Message */}
      <Message ... />
    </React.Fragment>
  );
}, [/* dependencies including newMessagesSeparator */]);
```

### 4. Dismissal Logic (MessageList.tsx:405-446)

**Virtuoso `rangeChanged` Implementation:**

```typescript
// Track if separator has been visible (for dismissal logic)
const [separatorWasVisible, setSeparatorWasVisible] = useState(false);

// Reset tracking when separator changes
useEffect(() => {
  if (!newMessagesSeparator) {
    setSeparatorWasVisible(false);
  }
}, [newMessagesSeparator]);

// Handle separator dismissal via Virtuoso's rangeChanged callback
const handleRangeChanged = useCallback(
  (range: { startIndex: number; endIndex: number }) => {
    if (!newMessagesSeparator || !onDismissSeparator) {
      return;
    }

    const firstUnreadIndex = messageList.findIndex(
      (m) => m.messageId === newMessagesSeparator.firstUnreadMessageId
    );

    if (firstUnreadIndex === -1) return;

    const isVisible =
      firstUnreadIndex >= range.startIndex &&
      firstUnreadIndex <= range.endIndex;

    if (isVisible && !separatorWasVisible) {
      // First time separator becomes visible
      setSeparatorWasVisible(true);
    } else if (!isVisible && separatorWasVisible) {
      // Separator scrolled out of view - dismiss it
      onDismissSeparator();
    }
  },
  [newMessagesSeparator, onDismissSeparator, messageList, separatorWasVisible]
);

// Attach to Virtuoso
<Virtuoso
  // ... other props
  rangeChanged={handleRangeChanged}
/>
```

**Why Virtuoso's `rangeChanged` Instead of Intersection Observer:**
- ✅ Works natively with Virtuoso's virtualization system
- ✅ No ref management or DOM observation needed
- ✅ More reliable - not affected by virtualized unmounting/remounting
- ✅ Tracks index ranges Virtuoso already computes internally
- ✅ Simpler code (~30 lines vs ~80 lines with Intersection Observer)
- ✅ No timing issues or race conditions

**Dismissal Triggers:**
- User scrolls separator out of visible range (up or down)
- User switches to different channel/conversation (state reset in Channel.tsx or DirectMessage.tsx)

**Persistence:**
- Separator stays visible while in Virtuoso's rendered range
- Natural dismissal - no arbitrary timers
- Reappears on channel revisit if unreads remain

---

## Edge Cases Handled

### Active Chatting (Threshold Protection)
- **Scenario**: User actively chatting, 1-4 new messages < 5 minutes old
- **Behavior**: Auto-jumps to first unread, but **no separator** shown (prevents spam)
- **Code**: Threshold checks
  - Channels: Channel.tsx:390-406, 435-452
  - Direct Messages: DirectMessage.tsx:390-411, 437-450

### Direct Message Sender Filtering
- **Scenario**: In DMs, user sends messages after having unread messages from the other party
- **Behavior**: Only counts messages from the other party, not the current user's own messages
- **Rationale**: In 1-on-1 conversations, user's own messages are not "new" to them
- **Implementation**: Filters by `m.content.senderId !== currentUserId` in DirectMessage.tsx
- **Note**: In Spaces/Channels, all unread messages are counted (acceptable UX for group contexts)

### Hash Navigation Priority
- **Scenario**: URL contains `#msg-{messageId}`
- **Behavior**: Separator NOT shown (hash navigation takes priority)

---

## Performance

**Threshold Calculation:**
- O(n) calculation happens once when auto-jump triggers (Channel.tsx or DirectMessage.tsx)
- In Direct Messages, includes additional sender ID check (negligible overhead)
- No additional database queries
- No UI count display - simpler rendering

**Virtuoso `rangeChanged` Callback:**
- Leverages Virtuoso's existing range tracking (no additional overhead)
- Only runs when visible range changes (user scrolls)
- Simple index comparison (O(n) worst case to find separator index)
- No DOM observers or ref management overhead

**Render Impact:**
- One additional component in render tree when visible
- Minimal re-renders (only when dependencies change)
- Same pattern as DateSeparator (proven performant)
- ~30 lines of dismissal logic (very lightweight)

---

## Code References

**New Files:**
- `src/components/message/NewMessagesSeparator.tsx` - Separator component

**Modified Files:**
- `src/components/message/MessageList.tsx:15,71-75,118-119,142-143,207-225,285,405-446,497` - Separator rendering and dismissal logic via Virtuoso
- `src/components/space/Channel.tsx:124-128,390-406,435-452,467-470,971-972` - State management with thresholds and props passing (Channels)
- `src/components/direct/DirectMessage.tsx:69-72,390-411,437-450,461-462,720-721` - State management with thresholds and props passing (Direct Messages, with sender filtering)

---

## Related Documentation

- [auto-jump-first-unread.md](./auto-jump-first-unread.md) - Auto-jump infrastructure
- [hash-navigation-to-old-messages.md](./hash-navigation-to-old-messages.md) - Shared bidirectional loading
- [date-separators-messages-list.md](../../tasks/.done/date-separators-messages-list.md) - DateSeparator pattern
- [new-messages-separator-intersection-observer-issues.md](../../bugs/new-messages-separator-intersection-observer-issues.md) - Bug investigation & solution

## Implementation Notes

**Key Technical Decisions:**
1. **Hybrid thresholds**: 5+ unreads OR 5+ minutes old (prevents spam during active chat)
2. **Virtuoso `rangeChanged` over Intersection Observer**: More reliable with virtualized lists
3. **Consolidated state object**: Single `newMessagesSeparator` object instead of multiple useState calls
4. **Simple "New" pill**: Compact design without count for cleaner UI
5. **DM sender filtering**: Only count other party's messages in Direct Messages (better UX for 1-on-1 conversations)

**Lessons Learned:**
- Intersection Observer doesn't work reliably with Virtuoso's virtualization (components unmount when out of view)
- Using Virtuoso's built-in APIs (`rangeChanged`, `itemsRendered`) is more reliable than DOM observation
- Scroll containers require special handling - default Intersection Observer observes viewport, not nested containers
- Consolidated state reduces complexity and prevents state synchronization bugs

---

*Last updated: 2025-12-24 - Simplified to "New" pill design (no count)*
*Verified: 2025-12-09 - File paths confirmed current*
