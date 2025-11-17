# Implement Discord-Like Mention Pills in Message Composer

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: High
**Created**: 2025-11-17
**Files**:
- `src/components/message/MessageComposer.tsx` (main component)
- `src/hooks/business/mentions/useMentionInput.ts` (autocomplete logic)
- `src/utils/mentionUtils.ts` (mention extraction)
- `src/components/message/MessageMarkdownRenderer.tsx` (rendering)

## What & Why

**Current State**: Channel mentions use cryptic IDs (`#<ch-abc123>`) which are rename-safe but poor UX. Users see technical identifiers instead of readable channel names while typing.

**Desired State**: Discord-like mention pills that show readable names (`@John Doe`, `#general-discussion`) in the textarea while storing stable IDs underneath for rename-safety.

**Value**:
- Industry-standard UX matching Discord/Slack expectations
- Visual pills eliminate confusion between user mentions and channel mentions
- Maintains technical robustness (rename-safe storage) with improved user experience
- Foundation for future rich text features (bold, italic, code blocks)

## Context

- **Existing pattern**: Current system already stores stable IDs in message.mentions for rename-safety
- **Constraints**: Must maintain backward compatibility with existing message format
- **Dependencies**: Cross-platform architecture (web/native) requires different implementations

## Research Notes

> **⚠️ RESEARCH REQUIRED**: Need to evaluate alternatives before proceeding with Lexical approach.

**Core Objective**: Transform cryptic IDs (`@<QmAbc123>`, `#<ch-def456>`) to readable names (`@John Doe`, `#general-discussion`) in the textarea BEFORE sending message. CSS highlighting alone cannot achieve this - only rich text editor can replace IDs with display names.

**Feature-Analyzer Insights**:
- **Bundle size concern**: Lexical + plugins may be 75-100KB (not 50KB as estimated)
- **Alternative approaches to evaluate**:
  - `react-textarea-highlighter` (~3KB) - lightweight mention library
  - `react-mentions` (~5KB) - battle-tested solution
  - Custom contentEditable overlay approach (~100-150 lines)
  - Hybrid: CSS interim + rich editor later

**Critical Research Questions**:
- [ ] **POC First**: Build Lexical proof-of-concept BEFORE committing to 5-phase plan
- [ ] **Bundle Impact**: Measure actual bundle size with all required Lexical plugins
- [ ] **User Value**: Conduct user research - how much does current ID visibility bother users?
- [ ] **Cross-platform**: Document strategy for React Native (Lexical doesn't support RN)
- [ ] **Performance**: Benchmark editor initialization time vs current textarea
- [ ] **Alternatives**: Test lightweight libraries that might provide 80% of value

**Complexity Concerns**:
- Current mention system already works well (rename-safe, good autocomplete)
- Main issue is brief ID visibility (0.5s) after mention selection
- Risk of over-engineering for visual polish vs functional improvement

**Decision Point**: Complete research phase before proceeding with any implementation approach.

## Prerequisites

- [ ] Review .agents documentation: INDEX.md, AGENTS.md, and agents-workflow.md for context
- [ ] Check existing tasks in .agents/tasks/ for similar patterns and solutions
- [ ] Review mention notification system docs in .agents/docs/features/mention-notification-system.md
- [ ] Feature analyzed by feature-analyzer agent for complexity and best practices
- [ ] Frontend components reviewed by frontend-style-validator agent for cross-platform compliance
- [ ] Branch created from `develop`
- [ ] No conflicting PRs affecting MessageComposer

## Implementation

### Phase 1: UX Improvements to Current System
- [ ] **Enhance autocomplete dropdown** (`src/hooks/business/mentions/useMentionInput.ts:143`)
  - Done when: Shows user avatars, role colors, channel topics in dropdown
  - Verify: Dropdown visually distinguishes between user/role/channel types
  - Reference: Follow avatar patterns from `src/components/space/ChannelList.tsx`

- [ ] **Add mention highlighting** (`src/components/message/MessageComposer.tsx:148`)
  - Done when: Subtle background highlight for `@mentions` and `#mentions` in textarea
  - Verify: Typing `@<address>` shows visual feedback without interfering with typing
  - Reference: Use CSS patterns from `.message-name-mentions-you` class

- [ ] **Improve mobile touch targets** (`src/hooks/business/mentions/useMentionInput.ts:174`)
  - Done when: Dropdown options have larger touch areas on mobile
  - Verify: Easy to tap mention options on touch devices
  - Reference: Mobile-friendly dimensions from existing mobile components

### Phase 2: Comprehensive Research & POC (do FIRST before Phase 1)
- [ ] **Evaluate lightweight alternatives** (separate branch for testing)
  - Done when: Tested `react-textarea-highlighter`, `react-mentions`, custom overlay
  - Verify: Each approach shows `@John Doe` instead of `@<QmAbc123>` in textarea
  - Reference: Document bundle size, UX quality, cross-platform support for each

- [ ] **Build Lexical proof-of-concept** (new files in `src/components/message/RichMessageComposer/`)
  - Done when: Working Lexical editor with mention plugin in isolation
  - Verify: Can type text, trigger mentions with @/# characters, see visual pills
  - Reference: Lexical docs https://lexical.dev/docs/demos/playground

- [ ] **Measure ALL bundle size impacts** (`package.json` and build analysis)
  - Done when: Bundle size measured for each approach (Lexical, alternatives)
  - Verify: Real impact measured (likely 75-100KB for Lexical, not 50KB)
  - Reference: Use webpack-bundle-analyzer, document exact plugin requirements

- [ ] **Test mention conversion for each approach**
  - Done when: Bidirectional conversion works: Pills ↔ Plain text with IDs
  - Verify: `@John Doe` pill converts to `@<QmAbc123>` for storage
  - Reference: Maintain compatibility with `src/utils/mentionUtils.ts:198`

- [ ] **Cross-platform compatibility strategy**
  - Done when: Plan documented for web vs native implementation per approach
  - Verify: Clear strategy since Lexical doesn't support React Native
  - Reference: Follow patterns from existing `.web.tsx` / `.native.tsx` splits

- [ ] **User research & feedback collection**
  - Done when: Survey/interviews about current ID visibility bothering users
  - Verify: Quantify actual user pain vs development effort
  - Reference: In-app survey or user interview sessions

- [ ] **Performance benchmarking**
  - Done when: Editor initialization time, memory usage measured per approach
  - Verify: No significant performance regression vs current textarea
  - Reference: Measure typing latency, render time with many mentions

- [ ] **Decision matrix & recommendation**
  - Done when: Documented comparison of all approaches with trade-offs
  - Verify: Clear recommendation based on research findings
  - Reference: Bundle size, UX quality, complexity, maintenance cost

### Phase 3: Full Lexical Integration (requires Phase 2 approval)
- [ ] **Replace textarea with Lexical editor** (`src/components/message/MessageComposer.tsx:284`)
  - Done when: MessageComposer uses Lexical instead of textarea
  - Verify: All existing functionality preserved (auto-resize, multiline, etc)
  - Reference: Maintain same props interface as current MessageComposer

- [ ] **Integrate mention autocomplete** (`src/hooks/business/mentions/useMentionInput.ts` adaptation)
  - Done when: @ and # trigger autocomplete with Lexical positioning
  - Verify: Dropdown appears correctly positioned relative to cursor
  - Reference: Lexical TypeaheadMenuPlugin examples

- [ ] **Implement mention pills rendering** (new Lexical decorator nodes)
  - Done when: Mentions appear as styled pills during typing
  - Verify: Pills show display names, are non-editable, removable with backspace
  - Reference: Visual styling from `.message-name-mentions-you` CSS

- [ ] **Add serialization/deserialization** (new utility functions)
  - Done when: Editor content converts to/from current message storage format
  - Verify: Rich editor state serializes to plain text + extracted mentions
  - Reference: Maintain compatibility with `extractMentionsFromText()` output

### Phase 4: Edge Cases & Polish (requires Phase 3)
- [ ] **Handle copy/paste operations** (Lexical paste handlers)
  - Done when: Copying pills preserves underlying format, pasting mentions creates pills
  - Verify: Copy `@John Doe` → paste gives `@<QmAbc123>`, plain paste creates pills for valid addresses
  - Reference: Lexical clipboard handling documentation

- [ ] **Test undo/redo functionality** (Lexical history plugin)
  - Done when: Undo/redo works correctly with mention operations
  - Verify: Can undo mention insertion, redo restores pills
  - Reference: Lexical HistoryPlugin configuration

- [ ] **Mobile web compatibility** (responsive design)
  - Done when: Rich editor works on mobile browsers
  - Verify: Touch selection, mobile keyboard, pill interactions work smoothly
  - Reference: Test on iOS Safari, Android Chrome

- [ ] **Accessibility compliance** (ARIA labels, keyboard navigation)
  - Done when: Screen readers and keyboard-only navigation supported
  - Verify: Pills are announced correctly, all functions accessible via keyboard
  - Reference: Follow WCAG patterns from existing accessible components

### Phase 5: Feature Flag Rollout (requires Phase 4)
- [ ] **Add feature flag** (`src/utils/featureFlags.ts` or config)
  - Done when: ENABLE_RICH_MENTIONS flag controls editor type
  - Verify: Can toggle between old textarea and new Lexical editor
  - Reference: Follow patterns from other feature flags in codebase

- [ ] **Performance monitoring** (analytics integration)
  - Done when: Bundle size, load time, error rates tracked
  - Verify: Can monitor real-world performance impact
  - Reference: Use existing performance monitoring tools

- [ ] **Gradual user rollout** (percentage-based feature flag)
  - Done when: Can control rollout percentage (10% → 50% → 100%)
  - Verify: Can quickly rollback if issues detected
  - Reference: Follow deployment patterns from other major features

## Verification

✅ **Core mention functionality preserved**
   - Test: Type @, select user from dropdown → pill appears with display name
   - Test: Type #, select channel from dropdown → pill appears with channel name
   - Test: Stored message contains correct IDs: `@<QmAbc123>`, `#<ch-def456>`

✅ **Visual pill behavior works**
   - Test: Pills are non-editable, show display names, removable with backspace
   - Test: Cursor navigation skips over pills as single units
   - Test: Selection works across text and pills

✅ **Copy/paste preserves format**
   - Test: Copy mention pill → paste preserves underlying ID format
   - Test: Paste plain text mention → creates pill if valid
   - Test: Cross-app paste works (fallback to display name)

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **Cross-platform compatibility**
   - Test: Web implementation works in all supported browsers
   - Test: Native fallback strategy works (plain text or custom pills)

✅ **Performance requirements met**
   - Test: Bundle size increase measured and justified (expect 75-100KB for Lexical)
   - Test: No noticeable lag when typing or creating pills (<100ms initialization)
   - Test: Memory usage acceptable for long editing sessions

✅ **Backward compatibility maintained**
   - Test: Existing messages render correctly
   - Test: Old clients can read new messages (see plain text)
   - Test: New editor can handle existing message formats

## Definition of Done

- [ ] All phases complete
- [ ] All verification tests pass
- [ ] Feature flag deployed with monitoring
- [ ] No breaking changes to message storage format
- [ ] Cross-platform strategy documented and implemented
- [ ] Performance benchmarks meet requirements
- [ ] User feedback collected and addressed
- [ ] Task updated with implementation learnings
- [ ] Documentation updated in .agents/docs/features/mention-notification-system.md

---

_Created: 2025-11-17_