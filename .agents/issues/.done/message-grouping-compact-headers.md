---
type: task
title: Implement Discord-Style Message Grouping with Compact Headers
status: done
complexity: medium
ai_generated: true
created: 2025-01-05T00:00:00.000Z
updated: '2026-01-09'
---

# Implement Discord-Style Message Grouping with Compact Headers

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/utils/messageGrouping.ts:51-61`
- `src/components/message/MessageList.tsx:231-293`
- `src/components/message/Message.tsx:68-111` (props)
- `src/components/message/Message.tsx:524-600` (header rendering)
- `src/components/message/Message.scss`
- `src/styles/_chat.scss:202-218` (`.message-sender-icon` responsive sizing)

## What & Why

Currently, every message displays a full header with avatar, username, and timestamp regardless of context. When users send multiple short messages in quick succession, this creates visual clutter and wastes vertical space. Implementing Discord-style message grouping will collapse headers for consecutive messages from the same sender within 5 minutes, showing only a compact timestamp on hover (desktop only) while keeping the message content left-aligned with grouped messages.

## Context
- **Existing pattern**: `shouldShowDateSeparator()` in `messageGrouping.ts:51-61` already compares adjacent messages
- **Avatar responsive sizing**: Define shared variables in `_variables.scss`:
  - `$message-avatar-size`: 44px (desktop)
  - `$message-avatar-size-mobile`: 36px (≤480px)
  - Both `.message-sender-icon` and `.message-sender-spacer` use these variables
- **Constraints**:
  - Must keep signature warning icon visible (security-critical) - show before message text
  - Must keep MessageActions working on hover for all messages
  - Must handle edge cases: replies, system messages, separators break grouping
- **Dependencies**: None - this is a self-contained UI enhancement

---

## Platform-Specific Behavior

### Desktop
- Compact messages show spacer (44px) instead of avatar
- Hide username row
- Show timestamp in spacer area on hover - **hour:minute only** (no date since messages are grouped within 5 minutes)
- MessageActions appear on hover (existing behavior)
- **Zero top/bottom padding** for compact messages
- **Zero bottom padding** for parent messages that have a compact message below them

### Mobile/Touch Devices
- Compact messages show spacer instead of avatar
- Hide username row
- **No hover timestamp** (touch devices can't hover)
- **Remove top border** (`border-t-2 border-t-surface-00 pt-2`) for compact messages - this border's purpose is to divide messages from different users, not needed within a group
- **Keep 3-dot menu** visible on right side for all messages (existing `MessageActionsDrawer` pattern)
- **Zero top/bottom padding** for compact messages
- **Zero bottom padding** for parent messages that have a compact message below them

---

## Implementation

### Phase 1: Grouping Logic
- [ ] **Add `shouldShowCompactHeader` function** (`src/utils/messageGrouping.ts`)
    - Done when: Function exported and returns correct boolean for grouping scenarios
    - Verify: Unit test or console.log shows correct grouping for test messages
    - Logic:
      ```typescript
      // Add after shouldShowDateSeparator function
      const MESSAGE_GROUP_TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms

      /**
       * Determines if a message should display a compact header (no avatar/username).
       * Messages are grouped when from same sender, within time threshold, and no separators between.
       */
      export function shouldShowCompactHeader(
        current: Message,
        previous: Message | null,
        hasDateSeparator: boolean,
        hasNewMessagesSeparator: boolean
      ): boolean {
        // Never compact if no previous message or separators exist
        if (!previous || hasDateSeparator || hasNewMessagesSeparator) return false;

        // Never compact system messages (join/leave/kick)
        if (['join', 'leave', 'kick'].includes(current.content.type)) return false;
        if (['join', 'leave', 'kick'].includes(previous.content.type)) return false;

        // Never compact if current message is a reply
        if ((current.content as any).repliesToMessageId) return false;

        // Must be same sender
        const currentSenderId = (current.content as any).senderId;
        const previousSenderId = (previous.content as any).senderId;
        if (!currentSenderId || !previousSenderId || currentSenderId !== previousSenderId) return false;

        // Must be within time threshold
        const timeDiff = current.createdDate - previous.createdDate;
        return timeDiff <= MESSAGE_GROUP_TIME_THRESHOLD;
      }
      ```

### Phase 2: Prop Threading (requires Phase 1)
- [ ] **Add `isCompact` prop to Message component** (`src/components/message/Message.tsx:68-111`)
    - Done when: `isCompact?: boolean` added to `MessageProps` interface
    - `isCompact`: This message should render in compact mode (no avatar, no username row)
    - ~~`hasCompactBelow`~~: **NOT NEEDED** - parent message bottom padding handled via CSS `:has()` selector
    - Verify: No TypeScript errors after adding prop

- [ ] **Memoize display info calculation** (`src/components/message/MessageList.tsx`)
    - Done when: Compact header calculations are memoized to prevent unnecessary re-renders
    - Reference: Follow `firstUnreadIndex` memoization pattern at lines 452-457
    - **Note**: Single-pass only - no need for second pass to calculate `hasCompactBelow`
    ```typescript
    // Single-pass memoization (parent padding handled via CSS :has() selector)
    const messageDisplayInfo = useMemo(() => {
      return messageList.map((message, index) => {
        const previousMessage = index > 0 ? messageList[index - 1] : null;
        const needsDateSeparator = shouldShowDateSeparator(message, previousMessage);
        const needsNewMessagesSeparator = newMessagesSeparator &&
          message.messageId === newMessagesSeparator.firstUnreadMessageId;
        const isCompact = shouldShowCompactHeader(
          message, previousMessage, needsDateSeparator, !!needsNewMessagesSeparator
        );
        return { needsDateSeparator, needsNewMessagesSeparator, isCompact };
      });
    }, [messageList, newMessagesSeparator]);
    ```

- [ ] **Pass `isCompact` in rowRenderer** (`src/components/message/MessageList.tsx:231-293`)
    - Done when: `isCompact` prop passed to each `<Message>` component from memoized data
    - Verify: console.log in Message shows correct `isCompact` value for grouped messages

### Phase 3: Compact UI Rendering (requires Phase 2)
- [ ] **Add message avatar size variables** (`src/styles/_variables.scss`)
    - Done when: Variables added after `$toast-gap` (line 313)
    - Add:
      ```scss
      /* === MESSAGE AVATAR SIZES === */
      /* Coupled sizes for message sender avatar and compact spacer */
      $message-avatar-size: $s-11;          /* 44px - desktop avatar size */
      $message-avatar-size-mobile: $s-9;    /* 36px - mobile avatar size (≤480px) */
      ```

- [ ] **Update `.message-sender-icon` to use variable** (`src/styles/_chat.scss:202-218`)
    - Done when: Uses `$message-avatar-size` and `$message-avatar-size-mobile` instead of `$s-11`/`$s-9`
    - Change:
      ```scss
      .message-sender-icon {
        // ...existing styles...

        @media (max-width: $screen-xs) {
          width: $message-avatar-size-mobile !important;
          height: $message-avatar-size-mobile !important;
          min-width: $message-avatar-size-mobile !important;
          // ...
        }
      }
      ```

- [ ] **Add `.message-sender-spacer` CSS class** (`src/styles/_chat.scss`)
    - Done when: Spacer uses same variables as `.message-sender-icon`
    - Add after `.message-sender-icon`:
      ```scss
      // Spacer for compact messages - uses same size variables as .message-sender-icon
      .message-sender-spacer {
        display: block;
        align-self: flex-start;
        width: $message-avatar-size;
        height: $message-avatar-size;
        min-width: $message-avatar-size;
        flex-shrink: 0;

        @media (max-width: $screen-xs) {
          width: $message-avatar-size-mobile !important;
          height: $message-avatar-size-mobile !important;
          min-width: $message-avatar-size-mobile !important;
        }
      }
      ```

- [ ] **Create compact header layout** (`src/components/message/Message.tsx:524-600`)
    - Done when: Compact messages show spacer instead of avatar, no username row
    - Verify: Visual inspection shows grouped messages with aligned content at all screen sizes
    - Changes needed:
      1. Replace `<UserAvatar size={44}>` with `<div className="message-sender-spacer" />` when `isCompact`
      2. Hide username/timestamp row when `isCompact`
      3. **Desktop only**: Show timestamp in spacer area on hover when `isCompact` - **hour:minute format only**
      4. **Keep** signature warning icon visible - show inline before message text content
      5. **Keep** MessageActions working exactly as before

- [ ] **Implement zero padding for compact messages** (`src/components/message/Message.tsx` + `Message.scss`)
    - Done when: Compact messages have 0 top/bottom padding, parent messages with compact below have 0 bottom padding
    - **CSS-first approach** (no `hasCompactBelow` prop needed - uses `:has()` selector)
    - Changes needed in Message.tsx:
      1. Add `message-container` class to the FlexRow wrapper
      2. Add `message-compact` class when `isCompact` is true
    - Changes needed in Message.scss:
      ```scss
      .message-container {
        padding-bottom: $s-2; // 8px default

        // Compact messages have no top/bottom padding
        &.message-compact {
          padding-top: 0;
          padding-bottom: 0;
        }

        // Any message followed by compact has no bottom padding (CSS :has() selector)
        &:has(+ .message-container.message-compact) {
          padding-bottom: 0;
        }
      }
      ```
    - **Why CSS `:has()` works**: Electron uses Chromium, which fully supports `:has()` selector

- [ ] **Handle touch device border removal** (`src/components/message/Message.tsx:405-418`)
    - Done when: Compact messages on touch devices don't have top border
    - Current code at line 411-413:
      ```typescript
      (isTouchDevice()
        ? 'border-t-2 border-t-surface-00 pt-2'
        : 'hover:bg-chat-hover ')
      ```
    - Change to:
      ```typescript
      (isTouchDevice()
        ? (isCompact ? '' : 'border-t-2 border-t-surface-00 pt-2')
        : 'hover:bg-chat-hover ')
      ```

- [ ] **Add compact hover timestamp styles** (`src/components/message/Message.scss`)
    - Done when: Hovering on compact message (desktop) shows timestamp in left spacer area
    - Verify: Timestamp appears smoothly on hover, disappears on mouse out
    - Note: Timestamp positioned within `.message-sender-spacer` area

### Phase 4: Edge Case Handling (requires Phase 3)
- [ ] **Verify deletion cascade works**
    - Done when: Deleting first message in group promotes next message to full header
    - Verify: Delete first grouped message → next message shows full header automatically
    - Note: Should work automatically since `messageList` re-renders with new `previousMessage`

- [ ] **Verify mobile touch behavior**
    - Done when: Compact messages work correctly on touch devices
    - Verify: 3-dot menu (MessageActionsDrawer) still accessible on all messages
    - Verify: No top border on compact messages, border appears on first message of each group

---

## Verification

✓ **Messages from same sender within 5 minutes are grouped**
    - Test: Send 3 quick messages → first shows full header, others show compact
    - Test: Wait 6+ minutes, send another → shows full header (new group)

✓ **Grouping breaks correctly**
    - Test: Send message, then reply to another message → both show full header
    - Test: Different user sends message between yours → all show full headers
    - Test: Date changes → new day shows full header

✓ **Compact messages still functional**
    - Test (Desktop): Hover on compact message → timestamp visible in spacer, action buttons appear
    - Test (Desktop): Right-click compact message → context menu works
    - Test: Unsigned compact message → warning icon visible before message text

✓ **Mobile-specific behavior**
    - Test: Compact messages have no top border (dark border between messages removed within groups)
    - Test: First message in group still has top border
    - Test: 3-dot menu accessible on all messages (compact and full)
    - Test: No timestamp shown on compact messages (expected - no hover on mobile)

✓ **Padding behavior**
    - Test: Compact messages have zero top and bottom padding
    - Test: Parent message (with compact below) has zero bottom padding
    - Test: First message in group retains normal padding (except bottom when has compact below)
    - Test: Messages are visually "tight" together in a group

✓ **Compact timestamp format**
    - Test (Desktop): Hover timestamp shows hour:minute only (e.g., "14:32" not "Jan 5 at 14:32")

✓ **Deletion edge case**
    - Test: Send 3 grouped messages → delete first → second now shows full header

✓ **TypeScript compiles**
    - Run: `npx tsc --noEmit`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority |
|----------|-------------------|--------|----------|
| First message deleted in group | Next message becomes full header | ✓ Should work automatically | P0 |
| Reply message | Always shows full header | 🔧 Implemented in logic | P0 |
| System messages (join/leave/kick) | Always shows full header, breaks grouping | 🔧 Implemented in logic | P0 |
| Date separator between messages | Breaks grouping | 🔧 Implemented in logic | P0 |
| New messages separator | Breaks grouping | 🔧 Implemented in logic | P0 |
| Unsigned message in group | Shows warning icon inline before message text | 🔧 Needs implementation | P1 |
| Pinned/bookmarked in compact | Icons hidden in compact mode | ⚠️ Acceptable | P2 |
| Mobile compact messages | No top border, no hover timestamp, 3-dot menu works | 🔧 Needs implementation | P0 |
| Compact message padding | Zero top/bottom padding for tight visual grouping | 🔧 Needs implementation | P0 |
| Parent message padding | Zero bottom padding via CSS `:has()` selector | 🔧 Needs implementation | P0 |
| Compact hover timestamp format | Hour:minute only (no date) | 🔧 Needs implementation | P0 |

---

## Definition of Done

- [ ] All Phase 1-4 checkboxes complete
- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] All verification tests pass
- [ ] No console errors or warnings
- [ ] Works on both desktop and mobile
- [ ] Signature warning icon always visible (inline before message text)
- [ ] Desktop: hover timestamp in spacer area (hour:minute format only)
- [ ] Mobile: no top border/dark border on compact messages, 3-dot menu accessible
- [ ] Compact messages have zero top/bottom padding
- [ ] Parent messages with compact below have zero bottom padding (via CSS `:has()`)
- [ ] Task document updated with implementation notes

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2025-01-05 - Claude**: Initial task creation
**2025-01-05 - Claude**: Updated with platform-specific behavior clarifications:
- Mobile: no hover timestamp, remove top border on compact messages, keep 3-dot menu
- Desktop: hover timestamp in spacer area
- Signature warning: show inline before message text
- Added memoization requirement for performance
- Added shared `$message-avatar-size` variables in `_variables.scss` for avatar and spacer to use
**2025-01-05 - Claude**: Added message spacing requirements:
- Compact messages must have zero top/bottom padding for tight visual grouping
- Parent messages with compact below must have zero bottom padding
- Desktop hover timestamp shows hour:minute only (no date since grouped within 5 minutes)
- No dark border between grouped messages on touch devices
**2025-01-05 - Claude**: Feature analysis - simplified approach:
- ~~Removed `hasCompactBelow` prop~~ - over-engineered solution
- Use CSS `:has()` selector instead for parent message bottom padding
- Single-pass memoization (no second iteration needed)
- `:has()` is fully supported in Electron (Chromium-based) and modern browsers
- Follows project's CSS-first patterns (Select, Switch components)
- ~30-40 lines of code reduction, better performance
