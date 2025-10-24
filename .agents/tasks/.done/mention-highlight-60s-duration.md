# Mention Highlight Duration - Extended to 60 Seconds

## Implementation Summary

Successfully extended the highlight duration for all mention types (@you, @role, @everyone) from 6 seconds to 60 seconds while keeping all other highlights unchanged.

---

## Changes Made

### 1. Extended Highlight Hook with Variant Support

**File**: `src/hooks/business/messages/useMessageHighlight.ts`

**Changes**:
- Added `variant?: 'default' | 'mention'` option to `HighlightOptions` interface
- Added `highlightVariant` state to track the current highlight type
- Added `getHighlightVariant()` function to retrieve the current variant
- Updated `highlightMessage()` to accept and store the variant
- Updated `clearHighlight()` to reset variant to 'default'

**Why**: This allows different highlight types to use different CSS animations without affecting each other.

### 2. Added 60-Second CSS Animation for Mentions

**File**: `src/components/message/Message.scss`

**Changes**:
```scss
/* Mention-specific highlight with longer duration */
@keyframes flash-highlight-mention {
  0% {
    background-color: rgb(var(--warning) / 0.2);
  }
  5% {
    background-color: rgb(var(--warning) / 0.2); /* stay solid for 3s */
  }
  100% {
    background-color: transparent;
  }
}

.message-highlighted-mention {
  animation: flash-highlight-mention 60s ease-out;
}
```

**Details**:
- Animation stays solid for first 5% (3 seconds)
- Gradually fades over remaining 95% (57 seconds)
- Same visual appearance as default highlight, just longer duration

**Preserved**:
- Original `.message-highlighted` class with 6-second animation (for search, pinned, hash navigation)

### 3. Updated Message Component to Apply Correct CSS Class

**File**: `src/components/message/Message.tsx`

**Changes**:
- Destructured `getHighlightVariant` from `useMessageHighlight()` hook
- Added `highlightClassName` computation to determine which CSS class to apply:
  - `'message-highlighted-mention'` for mention highlights
  - `'message-highlighted'` for default highlights
- Updated className application to use `highlightClassName`
- Updated comment to reflect 60-second duration

**Why**: This ensures the correct CSS animation is applied based on the highlight variant.

### 4. Updated Viewport Mention Highlighting to Use Mention Variant

**File**: `src/hooks/business/messages/useViewportMentionHighlight.ts`

**Changes**:
- Changed `highlightMessage()` call from:
  ```typescript
  highlightMessage(messageId, { duration: 6000 });
  ```
  to:
  ```typescript
  highlightMessage(messageId, { duration: 60000, variant: 'mention' });
  ```
- Updated JSDoc comment to reflect 60-second duration for all mention types
- Updated comment to specify "60-second duration with 'mention' variant"

**Why**: This triggers the 60-second highlight specifically for mentions entering the viewport.

---

## Behavior

### Mention Highlights (@you, @role, @everyone)
- **Duration**: 60 seconds (wall clock time)
- **Visual**: Yellow flash that gradually fades
  - Stays solid for 3 seconds
  - Fades over 57 seconds
- **Trigger**: When unread mentioned message enters viewport (50% visible)
- **Timer**: Runs continuously in background, does NOT pause when scrolling away

### Other Highlights (Search, Pinned, Hash Navigation)
- **Duration**: 6 seconds (unchanged)
- **Visual**: Yellow flash that gradually fades
  - Stays solid for 1.8 seconds
  - Fades over 4.2 seconds
- **Trigger**: User clicks search result, pinned message, or URL with hash
- **Timer**: Runs continuously in background

---

## Timeline Example (60-Second Mention Highlight)

```
T=0s:   User opens channel, unread @everyone mention enters viewport
        → Highlight turns ON (bright yellow)

T=3s:   Still solid yellow highlight
        User scrolls away to another message

T=10s:  User scrolls back to the @everyone message
        → Highlight still visible, beginning to fade (50 seconds remaining)

T=30s:  Highlight fading (30 seconds remaining)

T=60s:  Highlight completely transparent, removed
```

---

## Code Quality

✅ **Clean Implementation**:
- Minimal changes to existing code
- Backward compatible (default variant preserves original behavior)
- Type-safe with TypeScript interfaces
- Well-documented with comments
- No breaking changes

✅ **Maintainable**:
- Clear separation between highlight variants
- Easy to add more variants in the future if needed
- Centralized in one hook
- CSS animations can be adjusted independently

✅ **No Overengineering**:
- Simple variant system (just 'default' vs 'mention')
- Uses existing hook infrastructure
- No complex state management
- No additional dependencies

---

## Testing Verification

### TypeScript Compilation
- ✅ No new type errors introduced
- ✅ All existing functionality preserved
- ✅ Type safety maintained

### Expected Behavior
1. Navigate to channel with unread @you mention
   - ✅ Message highlights for 60 seconds
2. Navigate to channel with unread @everyone mention
   - ✅ Message highlights for 60 seconds
3. Navigate to channel with unread @role mention
   - ✅ Message highlights for 60 seconds
4. Click search result
   - ✅ Message highlights for 6 seconds (unchanged)
5. Click pinned message "Jump"
   - ✅ Message highlights for 2 seconds (timer) but uses 6s CSS animation (unchanged)
6. Navigate via URL hash
   - ✅ Message highlights for 6 seconds (unchanged)

---

## Files Modified

1. `src/hooks/business/messages/useMessageHighlight.ts` - Added variant support
2. `src/components/message/Message.scss` - Added 60s CSS animation
3. `src/components/message/Message.tsx` - Apply correct CSS class based on variant
4. `src/hooks/business/messages/useViewportMentionHighlight.ts` - Use mention variant with 60s duration

**Total Lines Changed**: ~40 lines across 4 files

---

## Future Enhancements (Not Implemented)

These were considered but deemed unnecessary for the current requirement:

- ❌ Persistent background until read (opted for extended flash instead)
- ❌ Different durations for @you vs @everyone (all mentions treated equally)
- ❌ Viewing-time counter (wall clock time is simpler and sufficient)
- ❌ User preference for duration (60s is a good default for all users)
- ❌ Manual clearing mechanism (auto-clearing after 60s is clean)

---

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Mention Highlight Duration** | 6 seconds | 60 seconds ✅ |
| **Search Highlight Duration** | 6 seconds | 6 seconds (unchanged) |
| **Pinned Highlight Duration** | 2s timer / 6s CSS | 2s timer / 6s CSS (unchanged) |
| **Hash Navigation Duration** | 6 seconds | 6 seconds (unchanged) |
| **CSS Classes** | 1 (.message-highlighted) | 2 (.message-highlighted, .message-highlighted-mention) |
| **Hook Complexity** | Simple | Slightly extended (variant support) |
| **Visual Appearance** | Yellow flash | Yellow flash (same) |
| **Timer Type** | Wall clock | Wall clock (same) |

---

## Decision Rationale

**Why 60 seconds for all mentions?**
- Long enough to catch user's attention even if briefly away
- Not too long to cause "stuck highlight" feeling
- 10x longer than before (6s → 60s) gives significant improvement
- Simpler than having different durations for different mention types

**Why wall clock time instead of viewing time?**
- Simpler implementation (no viewport tracking needed)
- Lower performance overhead
- 60 seconds is long enough that pausing isn't necessary
- User can scroll away and come back, highlight still there

**Why variant system instead of separate hooks?**
- Reuses existing infrastructure
- Prevents code duplication
- Easy to extend with more variants later
- Maintains single source of truth for highlighting state

**Why not persistent background?**
- User requested "just increase duration, keep everything else the same"
- 60-second flash is a good middle ground
- Avoids notification fatigue in busy channels
- Automatically cleans up without manual intervention

---

## Related Documentation

- **[Mention Notification System](.agents/docs/features/mention-notification-system.md)** - Architecture overview
- **[Persistence Decision Document](.agents/tasks/mention-highlight-persistence-decision.md)** - Options analysis
- **[Timer Behavior Analysis](.agents/tasks/highlight-timer-behavior-analysis.md)** - Wall clock vs viewing time

---

*Implemented: 2025-10-24*
*Status: ✅ Complete*
