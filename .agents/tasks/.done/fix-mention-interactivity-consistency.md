---
type: task
title: Fix Mention Interactivity Consistency
status: done
complexity: low
created: 2025-11-18T00:00:00.000Z
updated: '2026-01-09'
---

# Fix Mention Interactivity Consistency

> **✅ AI-Reviewed**: Analyzed by feature-analyzer agent
> **Original task**: optimize-mention-interactivity-disable-feature.md (over-engineered)


**Estimated effort**: 15-30 minutes


## What & Why

**Current Issue**: Channel mentions in MessagePreview have inconsistent interactivity checks - some use `disableMentionInteractivity` prop directly, others use `tokenData.isInteractive`.

**Desired State**: All mention types use the same consistent pattern (`tokenData.isInteractive`) for cleaner, maintainable code.

**Technical Value**: Eliminates dual responsibility pattern and ensures single source of truth for mention interactivity.

## Current Implementation Status

### ✅ **WORKING CORRECTLY**
- **User mentions**: Use `tokenData.isInteractive` consistently
- **Role mentions**: Use `tokenData.isInteractive` consistently
- **@everyone mentions**: Use `tokenData.isInteractive` consistently
- **Token generation**: `useMessageFormatting` correctly sets `isInteractive` flag from prop

### 🔧 **NEEDS FIX**
- **Channel mentions in MessagePreview**: Lines 143-144 check `disableMentionInteractivity` prop directly instead of using `tokenData.isInteractive`

**Files affected**:
- `src/components/message/MessagePreview.tsx:143-144`

## Implementation

### Single Fix Required

**File**: `src/components/message/MessagePreview.tsx` (lines 143-144)

**Current (inconsistent)**:
```typescript
<span
  className={`message-name-mentions-you ${disableMentionInteractivity ? '' : 'cursor-pointer'}`}
  onClick={disableMentionInteractivity ? undefined : () => onChannelClick && onChannelClick(tokenData.channelId)}
>
```

**Fixed (consistent)**:
```typescript
<span
  className={`message-name-mentions-you ${tokenData.isInteractive ? 'cursor-pointer' : ''}`}
  onClick={tokenData.isInteractive ? () => onChannelClick?.(tokenData.channelId) : undefined}
>
```

**Changes**:
1. Replace `disableMentionInteractivity ? '' : 'cursor-pointer'` with `tokenData.isInteractive ? 'cursor-pointer' : ''`
2. Replace `disableMentionInteractivity ? undefined : () => onChannelClick && onChannelClick(tokenData.channelId)` with `tokenData.isInteractive ? () => onChannelClick?.(tokenData.channelId) : undefined`

## Verification

**Manual Testing** (5 minutes):
- [ ] **Delete confirmation modal**: Click channel mention → should not navigate
- [ ] **Pin confirmation modal**: Click channel mention → should not navigate
- [ ] **Pinned messages panel**: Click channel mention → should not navigate
- [ ] **Regular message**: Click channel mention → should navigate normally

**Code check**:
- [ ] All mention types in MessagePreview use `tokenData.isInteractive`
- [ ] TypeScript compiles without errors
- [ ] No console warnings or errors

## Optional: Unit Test

**File**: `src/dev/tests/components/message/MessagePreview.mention-consistency.test.tsx`

**Purpose**: Prevent future regressions of the consistency pattern

**Test cases**:
```typescript
describe('MessagePreview mention consistency', () => {
  it('channel mentions respect tokenData.isInteractive flag', () => {
    // Test with disableMentionInteractivity: true → mentions not clickable
    // Test with disableMentionInteractivity: false → mentions clickable
  });
});
```

**Effort**: 30 minutes (optional)

## Definition of Done

- [ ] Channel mentions in MessagePreview use `tokenData.isInteractive` consistently
- [ ] Manual verification tests pass
- [ ] TypeScript compiles cleanly
- [ ] No regression in existing functionality
- [ ] Optional: Unit test added for future regression prevention

## Why This Approach

**Feature-analyzer findings**:
- **Current prop drilling**: Only 2-3 layers (not "5+ layers" as originally thought)
- **Context API migration**: Would add 50-80 lines of code for 2-line fix (25-40x over-engineering)
- **Performance**: Current approach is optimal, Context API has re-render risks
- **Maintainability**: Explicit props are clearer than hidden Context dependencies

**Architecture principles followed**:
- ✅ YAGNI (You Aren't Gonna Need It)
- ✅ KISS (Keep It Simple, Stupid)
- ✅ Single Responsibility Principle
- ✅ Explicit is better than implicit

**Quality rating**: 10/10 (vs 5/10 for Context API approach)

## Implementation Notes

### Why Not Context API?

The original task proposed Context API migration, but feature-analyzer identified this as over-engineering:

1. **Scope**: Only 3 call sites use `disableMentionInteractivity: true`
2. **Depth**: Actual prop drilling is 2-3 levels (manageable)
3. **Performance**: Context API could cause unnecessary re-renders in virtualized lists
4. **Complexity**: 50-80 lines of new infrastructure vs 2-line fix
5. **Pattern**: All existing contexts are app-wide; this would break architectural consistency

### Single Source of Truth

**How it works**:
```
useMessageFormatting receives disableMentionInteractivity prop
  ↓
Sets tokenData.isInteractive = !disableMentionInteractivity
  ↓
MessagePreview renders using tokenData.isInteractive
  ↓
Consistent behavior across all mention types
```

**Result**: One place controls interactivity (useMessageFormatting), all components follow that decision.

---

## Related Files

**No changes needed** (already working correctly):
- `src/hooks/business/messages/useMessageFormatting.ts` - Correctly sets `isInteractive` flag
- `src/hooks/business/messages/useMessageActions.ts` - Correctly passes `disableMentionInteractivity: true`
- `src/hooks/business/messages/usePinnedMessages.ts` - Correctly passes `disableMentionInteractivity: true`
- `src/components/message/PinnedMessagesPanel.tsx` - Correctly passes `disableMentionInteractivity: true`
- `src/components/message/Message.tsx` - Already uses `tokenData.isInteractive` correctly

**Supersedes**:
- `optimize-mention-interactivity-disable-feature.md` (over-engineered Context API approach)

---
