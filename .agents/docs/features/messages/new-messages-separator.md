# New Messages Separator

## Overview

### Problem
When auto-jumping to the first unread message in a channel or direct message, users need a clear visual indicator marking where the new unread messages begin. The existing subtle unread line was insufficient for drawing attention.

### Solution
Display an accent-colored "New Messages" separator above the first unread message when auto-jumping. The separator shows the count of unread messages and persists until scrolled out of view.

**Key Features:**
- Accent-colored horizontal line with centered text
- Shows unread message count (e.g., "42 New Messages")
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
- Border: `border-accent` (theme-aware accent color)
- Text: `color="var(--accent)"` (dynamic accent color from CSS variables)
- Layout: Same structure as DateSeparator (lines on both sides)
- Internationalization: Lingui i18n with ICU message format
- Label format:
  - With count: "42 New Messages" (i18n with parameter)
  - Without count: "New Messages" (i18n)
  - Large numbers: "1,234 New Messages" (formatted with locale-aware commas)

**Example:**
```
[...read messages...]
━━━━━━━━━ 42 New Messages ━━━━━━━━━  ← Accent color
[First unread message]
[More unread messages]
[...newest messages...]
```

---

## Implementation

### 1. NewMessagesSeparator Component (NewMessagesSeparator.tsx)

```typescript
interface NewMessagesSeparatorProps {
  count?: number;          // Optional unread count
  className?: string;      // Additional CSS classes
}

export const NewMessagesSeparator: React.FC<NewMessagesSeparatorProps> = ({
  count,
  className = '',
}) => {
  const displayLabel = formatLabel(count);

  return (
    <FlexRow
      align="center"
      justify="center"
      className={`my-4 px-4 ${className}`}
      data-testid="new-messages-separator"
    >
      <div className="flex-1 h-px border-t border-accent" />
      <Text
        size="sm"
        color="var(--accent)"
        className="mx-3 select-none"
        testId="new-messages-separator-label"
      >
        {displayLabel}
      </Text>
      <div className="flex-1 h-px border-t border-accent" />
    </FlexRow>
  );
};

function formatLabel(count?: number): string {
  if (count === undefined || count === 0) {
    return i18n._(t`New Messages`);
  }
  const formattedCount = count.toLocaleString();
  return i18n._('{count} New Messages', { count: formattedCount });
}
```

**Key Features:**
- Uses primitive components (FlexRow, Text) for cross-platform compatibility
- Accent color via CSS variable (`var(--accent)`) for theme adaptation
- Lingui i18n with `i18n._()` and `t` macro for translations
- Format helper handles large numbers with locale-aware formatting
- No ref forwarding needed (dismissal handled by Virtuoso)

### 2. State Management

**Channels** (Channel.tsx:124-128) and **Direct Messages** (DirectMessage.tsx:69-72) share identical state:

```typescript
// New Messages separator state (consolidated)
const [newMessagesSeparator, setNewMessagesSeparator] = useState<{
  firstUnreadMessageId: string;
  initialUnreadCount: number;
} | null>(null);
```

**State Lifecycle:**
- Set when auto-jump triggers **and thresholds met**
  - Channels: Channel.tsx:390-406, 435-452
  - Direct Messages: DirectMessage.tsx:390-411, 437-450
- Contains snapshot of unread count (doesn't decrease as user reads)
- Reset to `null` when channel/conversation changes
  - Channels: Channel.tsx:467-470
  - Direct Messages: DirectMessage.tsx:461-462
- Dismissed when scrolled out of view (via callback from MessageList)

**Key Design Decisions:**
- **Thresholds**: 5+ unreads OR 5+ minutes old (prevents spam during active chat)
- **Consolidated state**: Single object instead of multiple useState calls
- **Fixed count**: `initialUnreadCount` captured once, doesn't recalculate
- **DM-specific logic**: In Direct Messages, only counts messages from the other party (excludes current user's messages)

### 3. Integration in MessageList (MessageList.tsx)

**New Props (MessageList.tsx:71-75):**
```typescript
interface MessageListProps {
  // ... existing props
  newMessagesSeparator?: {
    firstUnreadMessageId: string;
    initialUnreadCount: number;
  } | null;
  onDismissSeparator?: () => void;
}
```

**No Dynamic Count Calculation:**
- Count is passed directly from parent (Channel.tsx or DirectMessage.tsx)
- No `useMemo` needed - count is immutable once set
- Prevents count from decreasing as user reads messages

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
      {needsNewMessagesSeparator && (
        <NewMessagesSeparator
          count={newMessagesSeparator.initialUnreadCount}
        />
      )}

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

### Count Persistence During Reading
- **Scenario**: User reads messages after separator appears
- **Behavior**: Count stays fixed (doesn't decrease as they read)

### Large Unread Counts
- **Behavior**: Formatted with locale-aware commas (e.g., "1,234 New Messages")

---

## Performance

**Unread Count Calculation:**
- O(n) calculation happens once when auto-jump triggers (Channel.tsx or DirectMessage.tsx)
- In Direct Messages, includes additional sender ID check (negligible overhead)
- No additional database queries
- No recalculation needed (count is fixed snapshot)
- No memoization needed (count passed as immutable value)

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
4. **Fixed unread count**: Snapshot captured once, doesn't decrease as user reads
5. **DM sender filtering**: Only count other party's messages in Direct Messages (better UX for 1-on-1 conversations)

**Lessons Learned:**
- Intersection Observer doesn't work reliably with Virtuoso's virtualization (components unmount when out of view)
- Using Virtuoso's built-in APIs (`rangeChanged`, `itemsRendered`) is more reliable than DOM observation
- Scroll containers require special handling - default Intersection Observer observes viewport, not nested containers
- Consolidated state reduces complexity and prevents state synchronization bugs

---

*Last updated: 2025-11-13 (DM sender filtering added)*
