---
type: task
title: "Message Highlight System - Complete Analysis & Recommendations"
status: done
complexity: high
created: 2026-01-09
updated: 2025-10-24
---

# Message Highlight System - Complete Analysis & Recommendations

## Document Overview

This document consolidates all analysis, research, and recommendations for the message highlighting system. It provides a comprehensive view of the current implementation, how Discord handles similar features, and practical suggestions for future improvements.

---

## A. Current System Analysis

### Implementation Overview

Our message highlighting system uses a **centralized hook-based architecture** with variant support for different highlight types.

**Core Components**:

1. **State Management Hook**: `useMessageHighlight()` (`src/hooks/business/messages/useMessageHighlight.ts`)
   - Manages highlight state with React state
   - Supports variants: `'default'` and `'mention'`
   - Wall clock timer (setTimeout) for auto-clearing
   - Provides scroll-to-message functionality

2. **CSS Animations**: `Message.scss`
   - `.message-highlighted` - 6 seconds, 0.2 opacity (search, pinned, hash navigation)
   - `.message-highlighted-mention` - 60 seconds, 0.1 opacity (all mention types)

3. **Viewport Detection**: `useViewportMentionHighlight()`
   - IntersectionObserver for 50% visibility threshold
   - Auto-triggers highlight when unread mentions enter viewport
   - One-shot (won't re-trigger for same message)

### Current Behavior by Feature

| Feature | Duration | Opacity | Trigger | Variant |
|---------|----------|---------|---------|---------|
| **@you mentions** | 60s | 0.1 (subtle) | Viewport entry | `mention` |
| **@role mentions** | 60s | 0.1 (subtle) | Viewport entry | `mention` |
| **@everyone mentions** | 60s | 0.1 (subtle) | Viewport entry | `mention` |
| **Search results** | 6s | 0.2 (visible) | Click navigation | `default` |
| **Pinned messages** | 2s timer / 6s CSS | 0.2 (visible) | Jump button | `default` |
| **URL hash navigation** | 6s | 0.2 (visible) | Direct link | `default` |
| **Reply navigation** | No highlight | N/A | Reply header click | N/A |

### Technical Details

**Timer Behavior** (Wall Clock Time):
```typescript
// Runs continuously from trigger, does NOT pause when scrolling away
setTimeout(() => {
  setHighlightedMessageId(null);
  setHighlightVariant('default');
}, duration); // 60000ms for mentions, 6000ms for others
```

**Timeline Example** (60s mention):
```
T=0s:   Mention enters viewport → Highlight ON (bright yellow, 0.1 opacity)
T=3s:   User scrolls away → Timer keeps running
T=10s:  User returns → Highlight still visible (50s remaining)
T=57s:  Still solid yellow → About to fade
T=60s:  Quick fade to transparent → Highlight OFF
```

**CSS Animation** (Mention variant):
```scss
@keyframes flash-highlight-mention {
  0%, 95% { background-color: rgb(var(--warning) / 0.1); }  // Solid for 57s
  100% { background-color: transparent; }                    // Fade in last 3s
}
```

### Key Strengths

✅ **Centralized & Clean**:
- Single source of truth for highlight state
- No DOM manipulation, fully React-based
- Prevents race conditions between different highlight sources

✅ **Variant System**:
- Easy to add new highlight types
- Mentions vs. navigation clearly differentiated
- Backward compatible

✅ **Performance**:
- Simple setTimeout (no complex tracking)
- CSS animations (hardware-accelerated)
- Low memory footprint

✅ **Mobile-Safe**:
- Uses Virtuoso scrolling where available
- Fallback to DOM scrolling
- No desktop-specific APIs

### Current Limitations

❌ **No Persistence Beyond Timer**:
- All highlights disappear after duration expires
- Important @everyone mentions can be missed if user away >60s
- No "mark as read" mechanism

❌ **Wall Clock Time Only**:
- Timer doesn't pause when message off-screen
- User might miss highlight if they arrive after 58 seconds
- No guarantee of actual viewing time

❌ **Limited Visual Vocabulary**:
- Only two variants (default, mention)
- Single color (warning yellow)
- No visual distinction between @you vs @everyone vs @role

❌ **No User Control**:
- Can't disable highlights
- Can't customize duration
- No accessibility preferences

---

## B. Discord's Highlight System

### Research Findings

We analyzed Discord's approach through user feedback, community discussions, and CSS variable inspection.

### 1. Highlight Types in Discord

**A. Temporary Flash Highlight** (Jump-to-message):
- **Duration**: Not publicly documented (estimated 3-5 seconds)
- **Trigger**: Clicking search results, clicking message links, "Jump to" buttons
- **Behavior**: Brief flash animation, auto-fades
- **Color**: Yellow tint
- **User Feedback**: "Too weak and vanishes too quickly" - users want it more noticeable

**B. Persistent Mention Background**:
- **Duration**: Indefinite (hours, days, until manually cleared)
- **Trigger**: Messages containing @you, @everyone, @here, @role
- **Behavior**: Static background color, no animation
- **Color**: Yellow/orange (`--background-mentioned: hsl(var(--yellow-300-hsl)/0.1)`)
- **Clearing**: Manual action required (Mark as Read, press ESC, change channels)
- **User Feedback**: "Too persistent and annoying" - accumulates in busy servers

**C. Hover Highlight**:
- **Duration**: While hovering
- **Trigger**: Mouse over message
- **Behavior**: Temporary background change
- **Purpose**: Shows message action buttons
- **User Feedback**: "Irritating" when combined with persistent backgrounds

### 2. Discord's Notification Architecture

Discord separates **temporary feedback** from **persistent indicators**:

```
Temporary (Toasts/Flashes)
├─ Short duration (3-10s)
├─ Auto-dismiss
├─ Used for: Actions, confirmations, navigation
└─ Examples: Jump-to-message flash, "Message sent" toast

Persistent (Badges/Backgrounds)
├─ Indefinite duration
├─ Manual dismiss required
├─ Used for: Notifications, unread state, mentions
└─ Examples: Mention backgrounds, unread badges, DM counters
```

### 3. Visual Differentiation

Discord uses different colors for different notification priorities:

- **Red badges**: Mentions, DMs (high priority)
- **Grey badges**: Unread messages (low priority)
- **Yellow backgrounds**: Mentions (medium-high priority)
- **No badge**: Muted or read

### 4. Key Discord Problems (User Complaints)

Based on community feedback:

1. **Over-Persistence**:
   - "Muted channels with @everyone still show orange backgrounds"
   - "Can't disable mention highlights, they accumulate forever"
   - "Busy servers have hundreds of yellow messages"

2. **Under-Visibility**:
   - "Search highlights disappear too fast to find the message"
   - "Clicking search results doesn't highlight obviously enough"

3. **Lack of Control**:
   - "No option to disable the orange background"
   - "Can't customize highlight behavior"
   - "Reduced Motion setting removes all animations (too aggressive)"

### 5. What Discord Does Well

✅ **Clear Separation**:
- Temporary actions (jump-to) use flash
- Important notifications (mentions) use persistent backgrounds
- Visual distinction helps users understand context

✅ **Accessibility**:
- Reduced Motion setting available
- High contrast mode support
- Keyboard navigation works with highlights

✅ **Semantic Colors**:
- Red = urgent (DMs, mentions)
- Yellow = attention (mention backgrounds)
- Grey = informational (unread messages)

### 6. Discord vs. Quorum Comparison

| Aspect | Discord | Quorum (Current) |
|--------|---------|------------------|
| **Mention Highlight** | Persistent background forever | 60s flash (auto-clears) |
| **Search Highlight** | Brief flash (~3-5s) | 6s flash |
| **Clearing Mechanism** | Manual (Mark as Read) | Automatic (timer) |
| **Visual Variants** | 3+ types (flash, background, hover) | 2 types (default, mention) |
| **User Complaints** | "Too persistent" | "Not persistent enough" (was 6s) |
| **User Control** | Limited (all or nothing) | None |
| **Accessibility** | Reduced Motion setting | Not implemented |

---

## C. Suggestions for Future Improvements

These recommendations prioritize **practical enhancements** while **avoiding overengineering**. Each suggestion is rated by complexity and impact.

### Priority 1: Quick Wins (Low Complexity, High Impact)

#### 1.1 Add Reduced Motion Support ⭐⭐⭐

**Problem**: Users with motion sensitivity or preference for minimal animations have no control.

**Solution**:
```scss
// Respect prefers-reduced-motion
@media (prefers-reduced-motion: reduce) {
  .message-highlighted,
  .message-highlighted-mention {
    animation: none;
    background-color: rgb(var(--warning) / 0.15);
    transition: background-color 0.3s ease-out;
  }
}
```

**Impact**:
- ✅ Accessibility compliance
- ✅ Better UX for sensitive users
- ✅ CSS-only, no JS changes

**Effort**: 10 minutes

---

#### 1.2 Differentiate @everyone Visually ⭐⭐

**Problem**: @everyone mentions look identical to @you mentions, despite being more important.

**Solution**: Add a subtle left border for @everyone mentions.

```scss
.message-highlighted-mention {
  animation: flash-highlight-mention 60s ease-out;

  &[data-mention-type="everyone"] {
    border-left: 3px solid rgb(var(--danger) / 0.5);
  }
}
```

```typescript
// Message.tsx
const mentionType = message.mentions.everyone ? 'everyone' :
                   message.mentions.roleIds.length > 0 ? 'role' : 'you';

<FlexColumn data-mention-type={mentionType} ...>
```

**Impact**:
- ✅ Clear visual hierarchy
- ✅ Matches user expectation (@everyone = more important)
- ✅ Non-breaking change

**Effort**: 30 minutes

---

### Priority 2: Medium Enhancements (Medium Complexity, Medium Impact)

#### 2.1 Optional Persistent Background Until Read ⭐⭐

**Problem**: 60 seconds might not be enough if user is away for several minutes.

**Solution**: Combine flash highlight (60s) with persistent background (until read).

**Implementation**:
```scss
// Add persistent subtle background for unread mentions
.message-mentioned-unread {
  background-color: rgb(var(--warning) / 0.04); // Very subtle
  border-left: 2px solid rgb(var(--warning) / 0.2);
}
```

```typescript
// Message.tsx
const isPersistentMentionHighlight = isMentioned && isUnread;

className={`
  ${highlightClassName} // Flash animation (60s)
  ${isPersistentMentionHighlight ? 'message-mentioned-unread' : ''} // Persistent
`}
```

**Behavior**:
- Flash appears for 60s (bright yellow, 0.1 opacity)
- After flash fades, persistent background remains (very subtle, 0.04 opacity)
- Persistent background clears when channel's lastReadTimestamp updates

**Impact**:
- ✅ Best of both worlds: flash for attention + persistence for reliability
- ✅ Auto-clears when user views channel (no manual clearing needed)
- ✅ Subtle enough to not annoy in busy channels

**Effort**: 1-2 hours

---

#### 2.2 User Preference for Highlight Duration ⭐

**Problem**: Some users might prefer shorter/longer durations.

**Solution**: Add setting in Space Settings modal.

**Implementation**:
```typescript
// Store in user config
interface HighlightPreferences {
  mentionDuration: 30 | 60 | 120;      // seconds
  enableFlashHighlights: boolean;       // turn off entirely
}

// Use in hook
const duration = userPrefs.mentionDuration * 1000;
highlightMessage(messageId, { duration, variant: 'mention' });
```

**Impact**:
- ✅ User control
- ✅ Flexible for different use cases
- ⚠️ Adds configuration complexity

**Effort**: 2-3 hours

---

### Priority 3: Advanced Features (High Complexity, Lower Priority)

#### 3.1 Viewing-Time Counter ⭐

**Problem**: Wall clock time means user might miss highlight if they arrive late.

**Solution**: Implement pause/resume timer based on viewport visibility.

**When to Consider**:
- Only if user feedback indicates wall clock is insufficient
- Current 60s duration should cover most cases


**Recommendation**: **SKIP** - Current wall clock approach is simpler and 60s is sufficient.

---

#### 3.2 Manual "Mark as Read" for Mentions ⭐

**Problem**: No way to manually dismiss mention highlights.

**Solution**: Add button in NotificationPanel or channel header.

**When to Consider**:
- If implementing persistent backgrounds (Priority 2.1)
- If users report accumulation issues

**Recommendation**: **DEFER** - Auto-clearing via read time is cleaner UX.

---

### Priority 4: Polish & Accessibility

#### 4.1 Keyboard Shortcut to Jump to Next Mention ⭐⭐

**Problem**: No keyboard-only way to navigate between mentioned messages.

**Solution**:
```typescript
// Add global keyboard handler
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'n' && e.ctrlKey) { // Ctrl+N
      jumpToNextMention();
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

**Impact**:
- ✅ Accessibility (keyboard-only users)
- ✅ Power user feature
- ✅ Complements existing highlight system

**Effort**: 3-4 hours

---

#### 4.2 Screen Reader Announcements ⭐

**Problem**: Screen reader users don't get notified when highlights appear.

**Solution**:
```typescript
// Add ARIA live region
<div aria-live="polite" className="sr-only">
  {isMessageHighlighted && 'Message highlighted'}
</div>
```

**Impact**:
- ✅ Accessibility compliance
- ✅ Better experience for visually impaired users

**Effort**: 1 hour

---

### What NOT to Do (Avoiding Overengineering)

❌ **Multiple Color Schemes**: Don't add 5+ different colors for different mention types
- Current warning yellow is fine, visual hierarchy comes from borders/intensity

❌ **Complex Animation Library**: Don't use animation libraries (GSAP, Framer Motion)
- CSS animations are sufficient and performant

❌ **Per-Message Persistence Tracking**: Don't store acknowledgment state for each message
- Use existing read-time tracking at channel level

❌ **Real-time Sync of Highlight State**: Don't sync which messages are currently highlighted across devices
- Only sync read state (already implemented)

❌ **Machine Learning Duration**: Don't auto-adjust duration based on user behavior
- Fixed durations are predictable and debuggable

---

## Recommended Roadmap

### Phase 1: Immediate (This Week)
1. ✅ **DONE**: Extended mention highlights to 60 seconds
2. ✅ **DONE**: Added variant system for different highlight types
3. ✅ **DONE**: Made mention highlights more subtle (0.1 opacity)

### Phase 2: Quick Wins (Next 2 Weeks)
1. **Add Reduced Motion support** (10 min)
2. **Differentiate @everyone with border** (30 min)

### Phase 3: Medium Enhancements (Next Month)
1. **Persistent background for unread mentions** (1-2 hours)
   - Subtle background that stays until channel read
   - Combines with flash highlight
2. **User preference for duration** (2-3 hours)
   - Setting in Space Settings modal
   - Options: 30s, 60s, 120s

### Phase 4: Polish (As Needed)
1. **Keyboard shortcuts** for mention navigation (3-4 hours)
2. **Screen reader support** (1 hour)

---

## Conclusion

### Current State (Post-60s Implementation)

Our system is **simple, performant, and effective**:
- Mentions get 60 seconds of visibility (10x improvement from 6s)
- Subtle background (0.1 opacity) reduces distraction
- Clean variant system enables future extensions
- No overengineering, minimal complexity

### vs. Discord

**Where we're better**:
- ✅ Auto-clearing prevents accumulation (Discord's biggest complaint)
- ✅ Longer flash duration than Discord (60s vs ~3-5s)
- ✅ Simpler mental model (time-based, predictable)

**Where Discord is better**:
- ✅ Persistent backgrounds for critical mentions (but users complain it's too much)
- ✅ Reduced Motion accessibility setting
- ✅ Visual hierarchy (@everyone looks different from @you)

### Next Steps

**For most users**: Current 60s system is sufficient. Monitor user feedback.

**If feedback indicates issues**:
1. Add persistent background option (Priority 2.1)
2. Add @everyone visual distinction (Priority 1.2)
3. Add user preferences for duration (Priority 2.2)

**Don't overcomplicate**: The current system is clean and solves 90% of use cases. Only add complexity if specific user feedback demands it.

---

## Technical Reference

### File Locations

**Core Implementation**:
- `src/hooks/business/messages/useMessageHighlight.ts` - State management
- `src/hooks/business/messages/useViewportMentionHighlight.ts` - Viewport detection
- `src/components/message/Message.tsx` - Component integration
- `src/components/message/Message.scss` - CSS animations

**Related Systems**:
- `src/hooks/business/conversations/useUpdateReadTime.ts` - Read tracking
- `src/db/messages.ts` - Conversation data storage
- `.agents/docs/features/mention-notification-system.md` - Mention architecture

### Configuration Values

```typescript
// Current durations
const MENTION_HIGHLIGHT_DURATION = 60000;  // 60 seconds
const DEFAULT_HIGHLIGHT_DURATION = 6000;   // 6 seconds
const PINNED_HIGHLIGHT_TIMER = 2000;       // 2 seconds (but uses 6s CSS)

// Current opacities
const MENTION_OPACITY = 0.1;  // Subtle (10%) - stays for 60s
const DEFAULT_OPACITY = 0.2;  // Visible (20%) - stays for 6s

// Animation timing (mentions)
const MENTION_SOLID_PERCENTAGE = 95;       // Stay solid until 95% (57s)
const MENTION_FADE_PERCENTAGE = 5;         // Fade in last 5% (3s)

// Viewport detection
const INTERSECTION_THRESHOLD = 0.5;        // 50% visibility required
```

---

*Last updated: 2025-10-24*
*Current Implementation: ✅ Complete (60s mentions @ 0.1 opacity)*
*Future Enhancements: Documented in Section C*
