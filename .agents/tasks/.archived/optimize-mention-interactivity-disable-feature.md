---
type: task
title: Optimize Mention Interactivity Disable Feature
status: on-hold
complexity: high
ai_generated: true
created: 2025-11-17T00:00:00.000Z
updated: '2026-01-09'
---

# Optimize Mention Interactivity Disable Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Files**:
- `src/components/message/MessagePreview.tsx:18,30,44,143-144`
- `src/hooks/business/messages/useMessageFormatting.ts:20,53,147,161,178,199,242`
- `src/components/message/Message.tsx:833-838`
- `src/hooks/business/messages/useMessageActions.ts:26,46,141`
- `src/hooks/business/messages/usePinnedMessages.ts:26,242`
- `src/components/message/PinnedMessagesPanel.tsx:18,36,48,125,243,265`
- `src/components/space/Channel.tsx:843-845`
- `src/components/message/MessageMarkdownRenderer.tsx:720-744` ⚠️ **CRITICAL MISSING**

## What & Why

**Current State**: Mentions (@users, @roles, #channels) in MessagePreview contexts (delete confirmations, pin/unpin modals, pinned message lists) are clickable, causing users to accidentally navigate away during important actions.

**Desired State**: Mentions preserve visual styling for consistency but disable interactivity in preview contexts, while remaining fully functional in regular message display.

**Technical Value**: Improves UX by preventing accidental navigation during confirmations and maintaining clear interaction patterns between preview and interactive contexts.

## Context
- **Existing pattern**: Token-based mention rendering in `useMessageFormatting` hook
- **Constraints**: Must work for both token-based AND markdown rendering paths
- **Dependencies**: MessagePreview used in multiple confirmation modals and pinned message displays
- **Architecture**: Current prop-drilling approach functional but has maintenance issues

## Current Implementation Status

### ✅ **COMPLETED - Token-Based Rendering Path**
- **MessagePreview.tsx**: Added `disableMentionInteractivity?: boolean` prop
- **useMessageFormatting.ts**: Added `isInteractive` property to all mention tokens
- **Message.tsx**: Channel mentions respect `tokenData.isInteractive`
- **useMessageActions.ts**: Delete confirmations use `disableMentionInteractivity: true`
- **usePinnedMessages.ts**: Pin/unpin confirmations use `disableMentionInteractivity: true`
- **PinnedMessagesPanel.tsx**: Pinned message display uses `disableMentionInteractivity: true`

**Result**: Works for token-based rendering - mentions show styling but aren't clickable in preview contexts.

### 🚨 **CRITICAL ISSUES IDENTIFIED BY FEATURE-ANALYZER**

#### **1. FUTURE ENHANCEMENT - Markdown Rendering Path (Severity: Low - Currently Non-Issue)**
- **Issue**: `MessageMarkdownRenderer.tsx` (lines 720-744) has click handlers that are ALWAYS active
- **Current Status**: **NON-ISSUE** - Preview contexts (MessagePreview, PinnedMessagesPanel, NotificationPanel) use token-based rendering, NOT markdown rendering
- **Future Consideration**: If we decide to render markdown in preview contexts, this would need implementation
- **Files affected**: `src/components/message/MessageMarkdownRenderer.tsx` (only used in regular Message.tsx)
- **Status**: DEFERRED (not currently needed)

#### **2. INCONSISTENT Implementation (Severity: Major)**
- **Issue**: Two sources of truth for interactivity checks
- **Problem**: `MessagePreview.tsx:143-144` checks `disableMentionInteractivity` prop directly instead of using `tokenData.isInteractive`
- **Impact**: Mixed patterns make maintenance harder
- **Status**: NEEDS REFACTOR

#### **3. ARCHITECTURAL - Unnecessary Prop Drilling (Severity: Minor)**
- **Issue**: Props flow through 5+ layers unnecessarily
- **Path**: `usePinnedMessages` → `MessagePreview` → `useMessageFormatting` → token data
- **Impact**: Tight coupling, harder refactoring
- **Status**: OPTIMIZATION OPPORTUNITY

## Prerequisites
- [ ] Review .agents documentation: INDEX.md, AGENTS.md, and agents-workflow.md for context
- [ ] Check existing tasks in .agents/tasks/ for similar patterns and solutions
- [ ] Review related documentation in .agents/docs/ for architectural context
- [ ] ✅ Feature analyzed by feature-analyzer agent for complexity and best practices
- [ ] Current implementation tested in token-based rendering path
- [ ] Branch created from `develop`
- [ ] No conflicting PRs affecting mention rendering

## Implementation

### Phase 1: CRITICAL FIXES (requires immediate attention)

> **🎯 GOAL**: Fix the inconsistent way we check if mentions should be clickable
>
> **PROBLEM**: Right now, we have two different ways to check if a mention should be clickable:
> 1. Some places check a prop directly: `disableMentionInteractivity`
> 2. Other places check token data: `tokenData.isInteractive`
>
> **WHY THIS IS BAD**: Having two ways to do the same thing makes the code confusing and harder to maintain. If we change one, we might forget to change the other.
>
> **SOLUTION**: Make all components use the same approach (the token data way)

#### **1.1 Fix MessagePreview Inconsistency**
- [ ] **Unify channel mention implementation** (`MessagePreview.tsx:143-144`)
  - Done when: Uses `tokenData.isInteractive` instead of checking `disableMentionInteractivity` directly
  - Verify: Single source of truth for all mention types
  - Reference: Pattern from `Message.tsx:833` (uses tokenData.isInteractive)

### Phase 2: OPTIMIZATION - Context API Migration (requires Phase 1)

> **🎯 GOAL**: Replace "prop drilling" with React Context to make the code cleaner
>
> **WHAT IS PROP DRILLING?**: When you have to pass a prop through many components just to get it to a deeply nested component:
> ```
> ChannelPage → PinnedPanel → MessagePreview → useMessageFormatting
>           ↓              ↓              ↓
>    (passes prop)  (passes prop)  (passes prop)
> ```
>
> **PROBLEM**: We're passing `disableMentionInteractivity` through 5+ components that don't actually need it
>
> **WHY CONTEXT IS BETTER**:
> - Context lets us "skip" the middle components
> - The component that needs the data can directly grab it from context
> - Less props to manage, cleaner interfaces
>
> **ANALOGY**: Instead of passing a message person-to-person through a chain, we put it on a bulletin board that anyone can read

#### **2.1 Create Mention Behavior Context**
- [ ] **Create MentionInteractivityContext** (`src/components/context/MentionInteractivityProvider.tsx`)
  - Done when: Context provides `{ isInteractive: boolean }` with default `true`
  - Verify: Context properly typed and exported
  - Reference: Follow pattern from existing context providers

#### **2.2 Migrate useMessageFormatting to Context**
- [ ] **Remove disableMentionInteractivity prop** (`useMessageFormatting.ts:20,53`)
  - Done when: Hook uses context instead of prop
  - Verify: Hook works with context, maintains backward compatibility during transition
  - Reference: Pattern from other hooks using context

#### **2.3 Update Preview Components to Use Provider**
- [ ] **Wrap confirmation modals with context** (`useMessageActions.ts`, `usePinnedMessages.ts`)
  - Done when: MessagePreview creation wrapped with `<MentionInteractivityProvider value={{ isInteractive: false }}>`
  - Verify: Confirmations disable mention clicks without prop drilling
  - Reference: Context provider patterns in existing modals

- [ ] **Wrap PinnedMessagesPanel with context** (`PinnedMessagesPanel.tsx`)
  - Done when: Component content wrapped with context provider
  - Verify: Pinned message previews disable mention clicks
  - Reference: Existing provider wrapping patterns

#### **2.4 Remove Prop Drilling**
- [ ] **Remove disableMentionInteractivity props** (All components)
  - Done when: Props removed from MessagePreview, PinnedMessagesPanel interfaces
  - Verify: TypeScript compiles, all functionality preserved
  - Reference: Clean up all prop drilling layers

### Phase 3: ENHANCEMENT - Testing & Documentation (requires Phase 2)

> **🎯 GOAL**: Make sure our changes work correctly and document how to use them
>
> **WHY TESTING IS IMPORTANT**:
> - **Integration tests**: Test the whole flow end-to-end (user clicks mention → does/doesn't navigate)
> - **Catch regressions**: Make sure we don't accidentally break things later
> - **Different scenarios**: Test both token-based and markdown rendering
>
> **WHY DOCUMENTATION MATTERS**:
> - Help future developers understand the Context pattern
> - Explain when/how to use mention interactivity controls
> - Document architectural decisions for reference

#### **3.1 Automated Tests**

> **🎯 GOAL**: Create automated Vitest tests to prevent regressions and document expected behavior
>
> **WHY AUTOMATED TESTS**:
> - **Regression Prevention**: Catches if someone accidentally breaks interactivity controls
> - **CI/CD Integration**: Runs on every PR to ensure feature keeps working
> - **Living Documentation**: Tests show exactly how mentions should behave
> - **Refactoring Safety**: Can confidently implement Context API knowing tests will catch issues
>
> **TESTING APPROACH**: Unit tests with vi.fn() mocks following existing project patterns

- [ ] **MessagePreview mention interactivity tests** (`src/dev/tests/components/message/MessagePreview.mention-interactivity.unit.test.tsx`)
  - Done when: Tests verify mentions in preview contexts don't trigger navigation
  - Test cases: Delete confirmation, pin/unpin confirmation modals
  - Uses: Vitest + React Testing Library + vi.fn() navigation mocks
  - Failure guidance: "Expected navigation not to be called but was called X times"
  - Reference: Follow `MessageService.unit.test.tsx` documentation patterns

- [ ] **PinnedMessagesPanel mention interactivity tests** (`src/dev/tests/components/message/PinnedMessagesPanel.mention-interactivity.unit.test.tsx`)
  - Done when: Tests verify mention clicks don't navigate in pinned message list
  - Test cases: Mobile and desktop rendering paths, all mention types (@user, @role, #channel, @everyone)
  - Uses: Vitest + React Testing Library + vi.fn() mocks
  - Failure guidance: Check if `disableMentionInteractivity` prop is properly passed through component hierarchy
  - Reference: Follow existing test structure with detailed PURPOSE and APPROACH comments

- [ ] **Markdown rendering tests** *(Future enhancement - only if preview contexts adopt markdown)*
  - Done when: Tests verify markdown mentions respect `disableMentionInteractivity` prop
  - Test cases: MessageMarkdownRenderer with interactivity disabled
  - Uses: Vitest + conditional rendering based on `ENABLE_MARKDOWN` flag
  - Note: Currently deferred since preview contexts use token-based rendering only

#### **3.2 Update Documentation**
- [ ] **Document Context API pattern** (`.agents/docs/features/`)
  - Done when: Architecture doc explains mention interactivity context usage
  - Verify: Includes usage examples and migration notes
  - Reference: Follow established feature documentation patterns

### Phase 4: FUTURE ENHANCEMENTS (deferred - not currently needed)

> **🎯 GOAL**: Prepare for the possibility that preview contexts might use markdown rendering in the future
>
> **CURRENT SITUATION**:
> - Preview contexts (delete modals, pin modals, pinned lists) use **token-based rendering**
> - Regular messages can use **markdown rendering** when `ENABLE_MARKDOWN = true`
> - The markdown renderer has its own click handlers that are always active
>
> **WHY THIS IS DEFERRED**:
> - Preview contexts currently only use token-based rendering (which we've fixed)
> - MessageMarkdownRenderer is only used in regular Message.tsx, not in previews
> - This would only become an issue if we decide to show rich markdown in preview contexts
>
> **IF WE NEED THIS LATER**: We'd need to add the same interactivity control to the markdown renderer

#### **4.1 Markdown Renderer Support (if preview contexts adopt markdown)**
- [ ] **Add interactivity prop to MessageMarkdownRenderer** (`src/components/message/MessageMarkdownRenderer.tsx:720-744`)
  - Done when: `disableMentionInteractivity?: boolean` prop added to interface
  - Verify: Prop properly typed in component interface
  - Reference: Follow pattern from `MessagePreview.tsx:18`
  - **Note**: Only needed if preview contexts switch from token-based to markdown rendering

- [ ] **Conditional click handlers for user mentions** (`MessageMarkdownRenderer.tsx:725-736`)
  - Done when: User mention click handlers only active when `!disableMentionInteractivity`
  - Verify: Preview contexts don't navigate on user mention clicks
  - Reference: Pattern from `MessagePreview.tsx:143-144`

- [ ] **Conditional click handlers for channel mentions** (`MessageMarkdownRenderer.tsx:739-743`)
  - Done when: Channel mention click handlers only active when `!disableMentionInteractivity`
  - Verify: Preview contexts don't navigate on channel mention clicks
  - Reference: Pattern from `Message.tsx:833-838`

- [ ] **Update Message.tsx to pass prop to markdown renderer**
  - Done when: `disableMentionInteractivity` passed to MessageMarkdownRenderer when used
  - Verify: Both token-based AND markdown rendering respect interactivity flag
  - Reference: Check Message.tsx usage of MessageMarkdownRenderer

## Verification

✅ **Token-based mentions work correctly**
   - Test: Delete confirmation → click user mention → no navigation occurs
   - Test: Pin confirmation → click channel mention → no navigation occurs
   - Test: Pinned message list → click role mention → no navigation occurs

✅ **Markdown mentions work correctly** *(Currently N/A - preview contexts use token-based rendering)*
   - Test: Enable markdown → delete confirmation with mentions → no navigation occurs *(deferred)*
   - Test: Regular message → markdown mentions → navigation works normally *(already working)*

✅ **TypeScript compiles cleanly**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
   - Verify: No type errors related to mention components

✅ **Performance maintained**
   - Test: Large pinned message lists render without lag
   - Test: Context changes don't cause unnecessary re-renders

✅ **Backward compatibility preserved**
   - Test: Regular messages maintain full mention interactivity
   - Test: Existing mention click handlers work in non-preview contexts

## Definition of Done
- [ ] Phase 1-3 complete (Phase 4 deferred for future enhancement)
- [ ] Token-based rendering path fully respects interactivity flag
- [ ] All verification tests pass
- [ ] No console errors or TypeScript issues
- [ ] Context API eliminates prop drilling
- [ ] Integration tests cover token-based rendering paths
- [ ] Documentation updated with architectural changes
- [ ] Task updated with implementation learnings

## Implementation Notes

> **FOR JUNIOR DEVELOPERS**: These notes explain the bigger picture of what we're building and why

### Key Architectural Decisions

#### **Context API over prop drilling**
- **What it eliminates**: 3-4 layers of unnecessary props
- **Why it's better**: Components that don't need the data don't have to handle it
- **Real example**: Instead of `Channel → PinnedPanel → MessageItem → MessagePreview → useFormatting`, we do `Channel sets context → useFormatting reads context`

#### **Single source of truth**
- **Problem we're solving**: Right now we check interactivity in two different ways
- **Solution**: All components use the same approach (context)
- **Benefit**: Change it in one place, everywhere updates automatically

#### **Progressive migration**
- **What this means**: We can implement changes step by step
- **Advantage**: Fix critical issues first, optimize architecture later
- **Less risky**: Each phase can be tested independently

### Risk Mitigation

#### **Token-based path focus**
- **What this means**: We confirmed preview contexts only use `useMessageFormatting` (token-based), not `MessageMarkdownRenderer`
- **Why this matters**: We don't need to fix the markdown renderer since previews don't use it

#### **Backward compatibility**
- **What to watch**: Make sure regular messages still work normally during our changes
- **How to test**: Verify mention clicks still navigate in non-preview contexts

#### **Performance monitoring**
- **Context concern**: Context changes can trigger re-renders of all child components
- **How to avoid**: Use stable context values, don't create objects in render
- **Example**: `const value = useMemo(() => ({ isInteractive }), [isInteractive])`

### Technical Concepts (Junior Developer Reference)

#### **Token-based rendering vs Markdown rendering**
- **Token-based**: Text is split into "tokens" (pieces) and each piece is handled separately
  - Example: `"Hello @user"` → `["Hello ", { type: "mention", name: "user" }]`
  - Used in: MessagePreview, PinnedMessagesPanel, NotificationPanel
- **Markdown rendering**: Full markdown processor that handles formatting, headers, links, etc.
  - Example: `"# Header **bold** @user"` → Full HTML with styling
  - Used in: Regular Message.tsx when `ENABLE_MARKDOWN = true`

#### **Props vs Context**
- **Props**: Data passed directly from parent to child component
  - Good for: Simple, direct relationships
  - Bad for: Deep nesting (prop drilling)
- **Context**: Shared data that any nested component can access
  - Good for: Cross-cutting concerns like themes, user settings
  - Bad for: Frequently changing data (performance)

#### **Current vs Target Architecture**

**CURRENT (Prop Drilling)**:
```
Channel.tsx
  ↓ (passes disableMentionInteractivity prop)
PinnedMessagesPanel.tsx
  ↓ (passes disableMentionInteractivity prop)
MessagePreview.tsx
  ↓ (passes disableMentionInteractivity prop)
useMessageFormatting.ts
  ↓ (creates tokenData.isInteractive)
Message.tsx (renders mentions)
```

**TARGET (Context API)**:
```
Channel.tsx
  ↓ (sets MentionInteractivityContext.Provider)
    ├── PinnedMessagesPanel.tsx (no props needed)
    └── MessagePreview.tsx (no props needed)
          ↓
        useMessageFormatting.ts (reads from context directly)
          ↓ (creates tokenData.isInteractive)
        Message.tsx (renders mentions)
```

**BENEFIT**: Middle components don't need to know about mention interactivity!

### Feature-Analyzer Recommendations (Updated)
- **Immediate**: ~~Fix markdown renderer~~ *(Confirmed non-issue - preview contexts use token-based rendering)*
- **High priority**: Unify token data usage (1 hour)
- **Medium priority**: Context API migration (2-4 hours)
- **Quality**: Add integration tests (2-3 hours)

**Total estimate**: 4-8 hours for production-ready implementation *(reduced from 6-10 due to markdown path being non-issue)*

### Quality Assessment from Feature-Analyzer (Updated)
- **Current Rating**: 8/10 (solid foundation, markdown path confirmed non-issue)
- **Target Rating**: 9/10 (after Context API migration and consistency fixes)
- **Key improvement**: Eliminate dual responsibility pattern, no need for markdown renderer changes

---

## Updates

### 2025-11-17 - Task Created
- Documented current implementation status (token-based path working)
- Identified critical gap in markdown rendering support
- Outlined Context API optimization path based on feature-analyzer recommendations
- Prioritized immediate fixes over architectural improvements

### 2025-11-17 - Markdown Renderer Issue Clarified
- **Verified**: Preview contexts (MessagePreview, PinnedMessagesPanel, NotificationPanel) use token-based rendering only
- **Confirmed**: MessageMarkdownRenderer only used in regular Message.tsx, not in preview contexts
- **Updated**: Downgraded markdown renderer from "Critical Major" to "Future Enhancement - Low Priority"
- **Result**: Reduced implementation estimate from 6-10 hours to 4-8 hours
- **Quality rating**: Improved from 7/10 to 8/10 due to confirmed non-issue

### 2025-11-18 - Testing Strategy Updated
- **Updated**: Section 3.1 to specify automated Vitest tests instead of unclear testing approach
- **Clarified**: Test structure to follow existing project patterns (`src/dev/tests/` with detailed documentation)
- **Added**: Specific test file paths and testing approach using vi.fn() mocks
- **Aligned**: Testing strategy with existing MessageService.unit.test.tsx patterns

---
