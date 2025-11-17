# Implement Copy Message Raw Text Option

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: Low
**Created**: 2025-11-16
**Files**:
- `src/components/message/MessageActions.tsx` - Add copy message icon (desktop)
- `src/components/message/MessageActionsDrawer.tsx` - Add copy message button (mobile/touch)
- `src/hooks/business/messages/useMessageActions.ts` - Shared copy text handler
- `src/api/quorumApi.ts` - Message content type analysis
- `src/utils/clipboard.ts` - Clipboard utility functions

## What & Why

**Current State**: Users cannot easily copy the raw text content of messages, including markdown syntax and formatting.

**Desired State**: Users can access "Copy Message" functionality through device-appropriate UI (desktop hover toolbar or mobile drawer) to copy the complete raw text content to clipboard, preserving all markdown syntax, code blocks, and formatting.

**Value**: Enables users to easily copy message content for external use, documentation, or sharing while preserving original formatting and syntax.

## Context
- **Dual UI System**: Desktop uses `MessageActions` (hover toolbar), touch devices use `MessageActionsDrawer` (bottom drawer)
- **Device Detection**: App uses `isTouchDevice()` and responsive breakpoints to determine UI mode
- **Existing pattern**: Both components have Copy link, Reply, Edit, Pin, Delete actions
- **Message types**: Need to handle PostMessage, EmbedMessage, and other content types appropriately
- **Dependencies**: Uses browser clipboard API for reliable copying

## Prerequisites
- [ ] Review existing MessageActions and MessageActionsDrawer component structures
- [ ] Check useMessageActions hook pattern for shared handlers (e.g., handleCopyLink)
- [ ] Verify clipboard permissions and browser compatibility
- [ ] Branch created from `develop`

## Implementation

### Phase 1: Content Extraction Logic
- [ ] **Add content extraction utility** (`src/utils/clipboard.ts`)
  - Done when: Function extracts raw text from different message content types
  - Verify: Handles PostMessage text, EmbedMessage descriptions, code blocks
  - Reference: Analyze Message content union types in quorumApi.ts

- [ ] **Handle markdown preservation** (`src/utils/clipboard.ts`)
  - Done when: Raw markdown syntax is preserved (```code```, **bold**, *italic*, etc.)
  - Verify: Copy operation maintains original formatting characters
  - Reference: Ensure no HTML rendering artifacts are included

### Phase 2: Shared Business Logic
- [ ] **Add handleCopyMessageText to useMessageActions hook** (`src/hooks/business/messages/useMessageActions.ts`)
  - Done when: Hook returns copy text handler that extracts and copies raw message content
  - Verify: Handler works for all message content types and provides feedback
  - Reference: Follow pattern of handleCopyLink around line 88-96

### Phase 3: Desktop UI Integration
- [ ] **Add Copy Message icon** (`src/components/message/MessageActions.tsx`)
  - Done when: Copy text icon appears in floating actions toolbar after existing copy link icon
  - Verify: Icon appears with proper tooltip and hover effects
  - Reference: Follow pattern of existing icons (reply, copy link, edit) around line 172-179

### Phase 4: Mobile/Touch UI Integration
- [ ] **Add Copy Message button** (`src/components/message/MessageActionsDrawer.tsx`)
  - Done when: "Copy Message" button appears in drawer after existing copy link button
  - Verify: Button shows proper label and triggers drawer auto-close after copy
  - Reference: Follow pattern of existing buttons around line 178-190

### Phase 5: Content Type Support
- [ ] **Support PostMessage content**
  - Done when: Regular text messages copy their raw content
  - Verify: Markdown syntax, links, mentions preserved exactly
  - Reference: PostMessage type definition in quorumApi.ts

- [ ] **Support EmbedMessage content**
  - Done when: Embed descriptions/titles are copyable
  - Verify: Falls back gracefully if no text content available
  - Reference: EmbedMessage type definition in quorumApi.ts

- [ ] **Handle edge cases**
  - Done when: Non-text messages show appropriate behavior (disabled/alternative text)
  - Verify: Stickers, reactions, system messages handled appropriately
  - Reference: Complete Message content union types

## Verification
✅ **Desktop copy functionality works**
   - Test: Hover over message → Click copy text icon → clipboard contains raw text
   - Test: Tooltip shows proper labels and "Copied!" feedback
   - Test: Icon positioned correctly in actions toolbar

✅ **Mobile/touch copy functionality works**
   - Test: Long-press message or tap 3-dots → Tap "Copy Message" in drawer → clipboard contains raw text
   - Test: Drawer auto-closes after successful copy
   - Test: Button shows proper label and positioning

✅ **Content preservation**
   - Test: Markdown messages preserve ```code blocks``` and **formatting**
   - Test: Long messages are copied completely
   - Test: Special characters and emojis are preserved

✅ **Content type coverage**
   - Test: PostMessage text copies correctly
   - Test: EmbedMessage descriptions copy when available
   - Test: System messages show appropriate copy behavior
   - Test: Non-copyable messages handle gracefully

✅ **Browser compatibility**
   - Test: Works in Chrome, Firefox, Safari
   - Test: Handles clipboard permissions correctly
   - Test: Fallback behavior for unsupported browsers

✅ **Device mode compatibility**
   - Test: Works in all interaction modes (mobile-drawer, desktop-touch, desktop-hover)
   - Test: Proper component selection based on device detection
   - Test: Touch interface works correctly on tablets and mobile devices

## Definition of Done
- [ ] Copy Message icon added to MessageActions (desktop)
- [ ] Copy Message button added to MessageActionsDrawer (mobile/touch)
- [ ] Shared handleCopyMessageText logic in useMessageActions hook
- [ ] Raw text extraction works for all relevant message types
- [ ] Markdown syntax and formatting preserved
- [ ] User feedback provided on successful copy (tooltips/toast)
- [ ] Both desktop and mobile interfaces tested and working
- [ ] All verification tests pass
- [ ] No console errors
- [ ] Cross-browser and cross-device compatibility verified

## Implementation Notes

### Dual UI Architecture
The app uses a sophisticated device-aware system with three interaction modes:

1. **mobile-drawer** (responsive mobile): Uses `MessageActionsDrawer` component
2. **desktop-touch** (touch-capable desktop/tablet): Uses `MessageActions` with long-press
3. **desktop-hover** (traditional desktop): Uses `MessageActions` with hover

**Implementation Strategy:**
- Add shared business logic to `useMessageActions` hook (like existing `handleCopyLink`)
- Add UI to both `MessageActions` (icon) and `MessageActionsDrawer` (button)
- Use same handler for both UIs via hook pattern

### Message Content Extraction Strategy
```typescript
function extractRawText(message: Message): string {
  const content = message.content;

  switch (content.type) {
    case 'post':
      return content.text || '';
    case 'embed':
      return content.description || content.title || '';
    case 'sticker':
      return `[Sticker: ${content.name || 'sticker'}]`;
    default:
      return '[Message content not copyable]';
  }
}
```

### UI Integration Patterns
**Desktop (MessageActions):**
- Add icon after copy link icon (~line 179)
- Use `onMouseEnter` for tooltip, `onClick` for action
- Tooltip feedback: "Copy message" → "Copied!" (like copy link pattern)

**Mobile (MessageActionsDrawer):**
- Add `Button` component after copy link button (~line 178)
- Include icon + text label for clarity
- Auto-close drawer after copy (use `onClose()` callback)

### Clipboard Integration
- Use modern `navigator.clipboard.writeText()` API
- Provide fallback for older browsers using `document.execCommand()`
- Handle permissions gracefully with user feedback

### User Experience Considerations
**Desktop:**
- Tooltip shows "Copy message" → changes to "Copied!" for 2 seconds
- Icon-only interface (space constrained)

**Mobile:**
- Button with icon + "Copy Message" text label
- Drawer auto-closes after successful copy
- Toast notification for feedback (consistent with other mobile actions)

---

_Created: 2025-11-16_