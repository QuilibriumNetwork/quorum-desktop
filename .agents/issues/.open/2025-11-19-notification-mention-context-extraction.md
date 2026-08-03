---
type: task
title: Implement Smart Context Extraction Around Mentions in NotificationPanel
status: open
complexity: medium
ai_generated: true
created: 2025-11-19T00:00:00.000Z
updated: '2026-01-09'
---

# Implement Smart Context Extraction Around Mentions in NotificationPanel

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/components/notifications/NotificationItem.tsx:20-75`
- `src/components/notifications/NotificationPanel.tsx:224-271`
- `src/hooks/business/messages/useMessageFormatting.ts:94-131`

## What & Why

**Current State**: NotificationPanel truncates message text at 200 characters from the beginning, which can hide important context when mentions appear later in long messages.

**Desired State**: Smart context extraction that shows ~8 words before and after mentions when messages are truncated, similar to search results but preserving React component mention styling.

**Value**: Improved notification readability for long messages where mention context is cut off.

## Context
- **Existing pattern**: SearchResults uses context windows in `useSearchResultHighlight.ts` with 12-word windows
- **Constraints**: Must preserve React component mention styling (cannot use HTML string approach like search)
- **Dependencies**: Current `useMessageFormatting` hook and token processing system
- **User demand**: **IMPLEMENT ONLY IF users complain about current truncation** - no current user reports

## Prerequisites
- [ ] Review .agents documentation: INDEX.md, AGENTS.md, and agents-workflow.md for context
- [ ] Check existing tasks in .agents/tasks/ for similar patterns and solutions
- [ ] Review related documentation in .agents/docs/ for architectural context
- [ ] Feature analyzed by feature-analyzer agent for complexity and best practices
- [ ] **User complaints documented** - do not implement without clear user need
- [ ] Branch created from `develop`
- [ ] No conflicting PRs

## Implementation

### Phase 1: Context Detection Logic
- [ ] **Create mention position detection** (`NotificationItem.tsx:25-35`)
  - Done when: Function can find first mention token in message text
  - Verify: Test with messages containing mentions at start, middle, end
  - Reference: Similar logic in `useSearchResultHighlight.ts:60-85`

- [ ] **Implement smart truncation strategy** (`NotificationItem.tsx:30-40`)
  - Done when: Logic chooses truncation direction based on mention position
  - Algorithm: If mention in second half of long message, truncate from end to show context
  - Verify: Long messages show mention with surrounding words
  - Reference: Keep current token processing approach

### Phase 2: Context Window Extraction (requires Phase 1)
- [ ] **Add context window extraction** (`NotificationItem.tsx:35-45`)
  - Done when: Function extracts ~8 words before/after mention when needed
  - Verify: Context shows relevant surrounding text with proper ellipsis
  - Reference: Adapt `extractSearchSnippet` pattern but preserve token structure

- [ ] **Preserve React component rendering** (`NotificationItem.tsx:45-75`)
  - Done when: Mentions still render as styled React spans, not plain text
  - Verify: Mentions maintain `message-name-mentions-you` styling and interactivity
  - Critical: Do NOT use HTML string approach - keep token-by-token React components

## Verification
✅ **Long messages show mention context**
   - Test: Create 400-char message with @mention at position 250
   - Expected: Shows "...relevant context @mention more context..."
   - Expected: Mention styled with blue background

✅ **Short messages unchanged**
   - Test: 150-char message with mention at start
   - Expected: Shows full message without ellipsis

✅ **React styling preserved**
   - Test: Mentions still have hover effects and proper CSS classes
   - Expected: No broken styling, interactive elements work

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **Mobile compatible**
   - Test: Context extraction works in mobile drawer layout
   - Expected: No layout breaks, readable on small screens

## Definition of Done
- [ ] All phases complete
- [ ] All verification tests pass
- [ ] No console errors
- [ ] Performance impact <5ms per notification (measured)
- [ ] Task updated with learnings
- [ ] Feature-analyzer review completed with recommendations implemented

## Implementation Notes

### Design Decisions
- **Simple approach preferred**: Start with direction-based truncation before complex context windows
- **Alternative simple solution**: Just increase truncation limit from 200→300 characters
- **Performance consideration**: Context extraction adds ~1-3ms per notification (acceptable for on-demand rendering)

### Risk Mitigation
- **Over-engineering risk**: Feature-analyzer review required to prevent unnecessary complexity
- **User need validation**: Only implement with documented user complaints about truncation
- **Fallback plan**: If complex, implement simple truncation direction change first

### Future Considerations
- Could extend to show context around other special tokens (links, channel mentions)
- Integration with search result highlighting if patterns prove useful
- Performance monitoring for large notification volumes

---
