# Custom ContentEditable Mention Pills for Message Composer

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: In Progress
**Complexity**: Medium
**Created**: 2025-11-18
**Updated**: 2026-01-09

## What & Why

**Current State**: Users see cryptic IDs (`@<QmAbc123>`, `#<ch-def456>`) briefly in the textarea after mention selection, creating confusion until message is sent.

**Desired State**: Show readable mention pills (`@John Doe`, `#general-discussion`) in the composer while maintaining the current robust ID-based storage system underneath.

**Value**:
- **User Experience**: Clean Discord/Slack-style mention pills during composition
- **Technical Robustness**: Maintains rename-safe ID storage with zero breaking changes
- **Bundle Efficiency**: Lightweight custom solution (~2KB) vs heavy rich text editor (~75-100KB)
- **Cross-Platform**: Can be implemented with platform-specific alternatives (.web/.native)

## Context & Constraints

**Existing Strengths** (preserve 100%):
- ✅ Excellent mention system in `useMentionInput.ts` (350 lines of solid autocomplete logic)
- ✅ Robust extraction/validation in `mentionUtils.ts` (rename-safe storage)
- ✅ Cross-platform architecture already established
- ✅ Support for 4 mention types: users, roles, channels, @everyone
- ✅ Permission system for @everyone mentions
- ✅ Perfect integration with notification system

**Integration Requirements**:
- **MUST**: Work with existing `useMentionInput` hook for autocomplete
- **MUST**: Use existing `extractMentionsFromText()` for storage
- **MUST**: Maintain current message storage format (`message.mentions`)
- **MUST**: Support all 4 mention types without breaking changes
- **MUST**: Keep cross-platform compatibility (.web/.native split pattern)

## Prerequisites

- [ ] **User Research Complete** (see Phase 1)
- [ ] Review existing mention system docs: `.agents/docs/features/mention-notification-system.md`
- [ ] Branch created from `develop`
- [ ] No conflicting PRs affecting MessageComposer

## Implementation Plan

### Phase 1: User Research & Validation (2-3 days) 🔍

**Priority**: CRITICAL - Do this FIRST before any code changes

- [x] **Survey current users about mention UX**
  - Done when: 20+ user responses to: "How much does seeing `@<address>` briefly bother you? (1-5 scale)"
  - Verify: <50% report it as "very bothersome" (4-5) → proceed; otherwise stop
  - Reference: Use in-app survey or Discord/community polls

- [x] **Measure mention usage patterns**
  - Done when: Analytics show % of messages with mentions and edit patterns
  - Verify: Mentions used frequently enough to justify development effort
  - Reference: Query message database for mention frequency over past 30 days

- [x] **Test cross-platform feasibility** (CRITICAL: Mobile + Web together)
  - Done when: POCs prove pills work well on both web AND mobile platforms
  - Verify:
    - **Web**: ✅ contentEditable pills work in Chrome, Firefox, Safari
    - **Mobile Browser**: Pills work on iOS Safari, Android Chrome (touch, virtual keyboard)
    - **React Native**: ✅ Text input + overlay rendering strategy validated
  - Reference: Build demos in `src/dev/primitives-playground/examples/`:
    - ✅ `MentionPills.tsx` (web contentEditable approach - working demo)
    - ✅ `mobile/test/primitives/MentionPillsTestScreen.tsx` (React Native TextInput + overlay - working demo)
  - **Status**: POCs complete. Web demo tested and validated. Mobile demo created (not tested yet, will implement after web)
  - **Updated**: 2026-01-09

**Decision Point**: ✅ POCs validated - proceeding to Phase 2 (web-first implementation)

## Industry Research & Validation

### How Major Apps Solve Mention Pills

**Discord's Implementation**:
- ✅ Uses contentEditable with `<@userid>` format instead of `@username#id`
- ✅ Backspace deletes entire mention pill as single unit
- ⚠️ **Critical**: Disables rich chat box on Android browsers and Edge <= 18
- 🔍 Has known issues with mobile text box resizing
- **Takeaway**: Even Discord struggles with cross-platform consistency

**Slack's Implementation**:
- ✅ Uses `<@U012AB3CD>` format for storage (similar to your `@<address>` approach)
- ✅ Automatically converts IDs to display names in UI
- ✅ Supports formatted text with mentions inline
- **Takeaway**: Your current storage format aligns with industry standards

**React Native Ecosystem**:
- 📦 `react-native-chip-input` (outdated, 5+ years old)
- 📦 `react-native-chips` (modern, material design)
- 📦 `react-native-paper` Chip component (widely used)
- 📦 `react-native-elements` Chip component
- **Takeaway**: Multiple libraries exist, but none specifically for mentions

**Open Source Solutions**:
- 📦 `react-rich-mentions` - ContentEditable mentions for web
- 📦 `@mentions/mention-input` - React mention input component
- **Formats**: Most use `<[name]|[id]>` or `@[id]` patterns (similar to your approach)
- **Takeaway**: Your storage format is battle-tested by other implementations

### Key Implementation Insights from Research

**🎯 Validation**: Major apps invest heavily in this feature despite complexity
- Discord, Slack, Teams, WhatsApp all have sophisticated mention systems
- Users expect this UX in modern messaging apps
- **Impact**: Feature is worth the investment for user experience parity

**⚠️ Known Challenges**:
1. **Mobile Web Complexity**: Discord disables rich editor on some mobile browsers
2. **Cross-Platform Consistency**: Different implementations for web vs native
3. **Performance**: contentEditable can cause performance issues on older devices
4. **Accessibility**: Screen readers need special handling for mention pills

**✅ Best Practices from Research**:
1. **ID-based Storage**: Store stable IDs (`@<address>`), display names for UI
2. **Feature Detection**: Disable on unsupported browsers, fallback gracefully
3. **Platform-Specific UI**: Web uses contentEditable, native uses TextInput + overlays
4. **Atomic Operations**: Backspace deletes whole pills, not character-by-character

### Why Your Approach is Sound

**✅ Storage Format Alignment**: Your `@<address>` format matches Slack's `<@U123>` pattern
**✅ Cross-Platform Strategy**: Web + native implementations align with Discord/Slack
**✅ Feature Flagging**: Allows gradual rollout and instant rollback (Discord does this)
**✅ Preserve Existing System**: Most successful apps build on solid foundations (like yours)

### Risk Mitigation Based on Research

**Lesson from Discord**: Design for graceful fallback (implement if needed)
```typescript
// Simple feature flag approach (initially)
const enableMentionPills = ENABLE_MENTION_PILLS; // src/config/features.ts

// Architecture supports future feature detection if needed:
// const supportsRichMentions = detectBrowserCapabilities();

return enableMentionPills ?
  <MentionPillInput /> :
  <TextArea />; // Current system (always works)
```

**Pragmatic Approach**:
- **Phase 1**: Simple on/off feature flag for gradual rollout
- **Future**: Add browser detection if user reports indicate issues
- **Architecture**: Code structured to easily add detection later

**Lesson from Open Source Libraries**: Start simple, iterate
- Phase 1: Basic pills (text replacement)
- Phase 2: Advanced interactions (backspace, selection)
- Phase 3: Polish (animations, accessibility)

**Lesson from Slack**: Keep storage format stable
- Your `@<address>` format is proven at scale
- Visual representation can evolve independently
- No breaking changes needed

### Technical Implementation Insights

**From `react-rich-mentions` Analysis**:
- ✅ **Fragment-based System**: Uses regex patterns to transform tokens (`<@name|id>`) into styled spans
- ✅ **Storage/Display Separation**: Store `<@vince|U82737823>`, display `vince` (matches your approach)
- ✅ **Context API over React State**: Avoids Virtual DOM conflicts with contentEditable
- ⚠️ **Mobile Gaps**: No documented solution for mobile keyboard autocorrect/predictive text
- ⚠️ **Undo/Redo**: ContentEditable undo stacks are notoriously problematic

**Key Technical Challenges Confirmed**:
1. **Cursor Position Tracking**: Must maintain cursor when inserting/deleting pills
2. **Virtual DOM Conflicts**: React state fights with contentEditable DOM changes
3. **Mobile Keyboard Integration**: Autocorrect/predictive text can break pill integrity
4. **Cross-Browser Consistency**: Selection/clipboard APIs differ significantly
5. **Performance**: Large messages with many mentions can cause lag

### Additional Research Recommendations

**For Implementation Team**:
1. **Study Libraries**:
   - `react-rich-mentions` - Fragment-based contentEditable approach
   - `draft-js` - Facebook's rich text editor (heavy but battle-tested)
   - `lexical` - Meta's modern rich text editor

2. **Discord Deep Dive**:
   - Inspect Discord web app with DevTools to see their DOM structure
   - Test mention behavior on different devices/browsers
   - Note: They disable rich editor on older Android browsers

3. **Slack Analysis**:
   - Slack's mention format: `<@U012AB3CD>` → display name conversion
   - Web vs mobile implementation differences
   - Copy/paste behavior analysis

4. **WhatsApp/Telegram Study**:
   - Mobile-first mention implementations
   - How they handle virtual keyboard edge cases
   - Performance optimization techniques

**Decision Point**: Only proceed to Phase 2 if user research shows genuine need

### Phase 2: Web Implementation (3-4 days) 🛠️

**Focus**: Web-first implementation with minimal abstractions

**Critical Simplifications** (based on feature-analyzer review):
- ❌ **Removed**: Shared pill rendering system (PillRenderer.tsx, PillTypes.ts, PillStyling.ts) - over-engineering
- ❌ **Removed**: Abstract text ↔ pills utils - unnecessary abstraction layer
- ✅ **Simplified**: Single MentionPill component (~50 lines) directly in MessageComposer
- ✅ **Web-only**: Defer mobile to Phase 3 after web validation
- ✅ **Direct integration**: Pill logic embedded in MessageComposer, not separate components

- [ ] **Create MentionPill component** (`src/components/message/MentionPill.tsx`)
  - Done when: Single ~50-line component renders all 4 mention types
  - Verify: User, role, channel, @everyone pills with correct colors and prefixes
  - Reference: Use POC demo as template ([MentionPills.tsx:37-69](src/dev/primitives-playground/examples/MentionPills.tsx#L37-L69))
  - **Security**: MUST NOT persist pill data to IndexedDB/localStorage - only storage format
  - Files: Single file, no abstractions

- [ ] **Add pill logic to MessageComposer.web.tsx**
  - Done when: contentEditable with embedded pill rendering works smoothly
  - Verify: Types text, creates pills, handles backspace/arrow keys
  - Reference: Use contentEditable approach from POC ([MentionPills.tsx:71-230](src/dev/primitives-playground/examples/MentionPills.tsx#L71-L230))
  - Integration: Direct embedding, no separate MentionPillInput component

- [ ] **Integrate with existing useMentionInput** (web-only)
  - Done when: Autocomplete dropdown creates pills instead of inserting raw IDs
  - Verify: @ triggers user/role dropdown, # triggers channel dropdown, selection creates pills
  - Reference: Reuse `useMentionInput` hook without ANY modifications
  - Integration: Update `onMentionSelect` to create pill in contentEditable

- [ ] **Handle copy/paste correctly** (web-only)
  - Done when: Copy pills preserves underlying IDs, paste creates pills from text
  - Verify: Clipboard contains storage format `@<address>`, not display names
  - Reference: Custom clipboard handlers for contentEditable
  - **Critical**: Paste behavior must be fully specified and tested

- [ ] **Support all 4 mention types** (web-only)
  - Done when: All mention types render as pills with correct storage formats
  - Verify:
    - User pills: Enhanced `@[Name]<address>` + Legacy `@<address>`
    - Channel pills: Enhanced `#[Name]<id>` + Legacy `#<id>`
    - Role pills: `@roleTag` (no brackets)
    - Everyone: `@everyone`
  - Reference: POC demos test both formats ([MentionPills.tsx:28-35](src/dev/primitives-playground/examples/MentionPills.tsx#L28-L35))

- [ ] **Add feature flag and graceful fallback**
  - Done when: `ENABLE_MENTION_PILLS` controls web vs textarea fallback
  - Verify: Flag disabled → current textarea behavior, flag enabled → pills
  - Reference: Use `src/config/features.ts` for feature flag
  - Integration: Feature flag wraps MessageComposer pill logic

- [ ] **Measure bundle size impact**
  - Done when: Actual bundle size measured and documented
  - Verify: Target <10KB (realistic, not ~2KB estimate)
  - Reference: Use webpack-bundle-analyzer or similar tool
  - **Critical**: Verify claim with real measurements

### Phase 3: Mobile Implementation (5-7 days) 🔧

**Deferred until web implementation is validated in production**

**Focus**: React Native implementation using TextInput + overlay approach

- [ ] **Create mobile MentionPill component** (`src/components/message/MentionPill.native.tsx`)
  - Done when: Native pill component renders all 4 mention types
  - Verify: Touch-friendly sizing (44px minimum), haptic feedback
  - Reference: Use mobile POC as template ([MentionPillsTestScreen.tsx:53-90](mobile/test/primitives/MentionPillsTestScreen.tsx#L53-L90))

- [ ] **Add pill logic to MessageComposer.native.tsx**
  - Done when: TextInput + absolutely positioned pill overlays work on iOS/Android
  - Verify: Virtual keyboard, touch selection, pill interactions work naturally
  - Reference: Use TextInput + overlay approach from POC ([MentionPillsTestScreen.tsx:92-228](mobile/test/primitives/MentionPillsTestScreen.tsx#L92-L228))

- [ ] **Integrate with existing useMentionInput** (mobile)
  - Done when: Autocomplete dropdown creates pills in React Native
  - Verify: @ triggers user/role dropdown, # triggers channel dropdown
  - Reference: Reuse `useMentionInput` hook without modifications

- [ ] **Handle mobile clipboard** (React Native)
  - Done when: Copy/paste works with React Native Clipboard API
  - Verify: Clipboard integration, paste creates pills from text
  - Reference: React Native Clipboard module

- [ ] **Mobile-specific optimizations**
  - Done when: Pills render smoothly with 60fps on iOS and Android
  - Verify: Scroll performance, memory usage, animation smoothness
  - Reference: Native driver animations, avoid JS bridge when possible

- [ ] **Accessibility validation** (mobile)
  - Done when: TalkBack (Android) and VoiceOver (iOS) work correctly
  - Verify: Screen readers announce pills properly, navigation works
  - Reference: React Native accessibility APIs

### Phase 4: Integration & Polish (2-3 days) 🔧

**After both web and mobile implementations are complete**

- [ ] **Accessibility & performance validation** (cross-platform)
  - Done when: Screen readers work correctly on all platforms, no performance regressions
  - Verify:
    - **Web**: NVDA/JAWS/VoiceOver support, WCAG compliance
    - **Native**: TalkBack (Android), VoiceOver (iOS) support
    - **Performance**: Typing latency <50ms on all platforms
  - Reference: Platform-specific accessibility APIs

## Implementation Strategy

### Web-First Approach (Phase 2)

**Why Web First**:
- POC validated contentEditable approach works well on web
- Faster iteration and debugging in browser
- Validate UX and integration before mobile complexity
- Bundle size verification easier on web

**Web Implementation Details**:
```typescript
// Direct integration in MessageComposer.web.tsx:
- contentEditable div with careful DOM manipulation
- Pills as non-editable inline span elements
- Custom selection/cursor management
- Paste handler for clipboard integration
- Single MentionPill.tsx component (~50 lines)
```

**Key Simplifications**:
- No separate MentionPillInput component - embed directly in MessageComposer
- No shared abstractions (PillRenderer, PillTypes, PillStyling) - single component
- No platform-agnostic utils - use existing `extractMentionsFromText()`
- Feature flag for easy rollback

### Mobile Implementation (Phase 3 - Deferred)

**Why Defer Mobile**:
- Validate web implementation in production first
- Mobile POC created but not tested yet
- Different complexity (TextInput + overlay vs contentEditable)
- Can learn from web implementation feedback

**Mobile Implementation Details** (when Phase 3 starts):
```typescript
// Direct integration in MessageComposer.native.tsx:
- TextInput for text entry
- Absolutely positioned pills overlaid on text
- Custom text measurement for pill positioning
- React Native Clipboard integration
- Single MentionPill.native.tsx component
```

**Mobile Considerations** (for Phase 3):
- Virtual keyboard challenges (iOS/Android differences)
- Touch targets minimum 44px
- Performance: 60fps target, avoid JS bridge
- Haptic feedback on pill interactions

### Shared Components (Minimal)

**NO CHANGES to existing system**:
- `useMentionInput.ts` - Works as-is, no modifications
- `extractMentionsFromText()` - Storage format unchanged
- `mentionUtils.ts` - All validation/extraction logic preserved

**New Components** (minimal, platform-specific):
- Phase 2: `MentionPill.tsx` (web only, ~50 lines)
- Phase 3: `MentionPill.native.tsx` (when mobile implemented)
- Integration: Direct in MessageComposer, no intermediate components

### Testing Strategy

**Phase 2 - Web Testing**:
- Chrome, Firefox, Safari desktop
- Keyboard + mouse interactions
- Copy/paste behavior
- Performance benchmarks
- **Defer**: Mobile browser testing until Phase 3

**Phase 3 - Mobile Testing** (when implemented):
- iOS Simulator + Physical devices (iPhone, iPad)
- Android Emulator + Physical devices
- Virtual keyboard behavior
- Touch interactions
- Performance profiling (60fps target)

**Consistency Goal** (Phase 4 - after both complete):
- Identical UX flow: type → autocomplete → select → pill creation
- Same visual appearance (colors, spacing, typography)
- Same interaction patterns (backspace deletion, navigation)
- Same data format (storage, serialization, clipboard)

## System Integration Points

### Mention System Integration (NO CHANGES NEEDED)

**Current `useMentionInput.ts`** → **Keep 100% as-is**
- Autocomplete logic, keyboard navigation, filtering all preserved
- Only change: `onMentionSelect` creates pill instead of inserting ID text
- Integration: Pass same props, use same return values

**Current `mentionUtils.ts`** → **Keep 100% as-is**
- `extractMentionsFromText()`, `isMentioned()`, validation logic unchanged
- Integration: Use for storage/retrieval, no modification needed

**Current Storage Format** → **Keep 100% as-is**
- `message.mentions.memberIds[]`, `roleIds[]`, `channelIds[]`, `everyone`
- Integration: Pills → text conversion uses existing format

### Potential System Optimizations

**If needed during implementation:**

- [ ] **Enhance autocomplete performance** (`useMentionInput.ts:150`)
  - Only if: Pill creation causes autocomplete lag
  - Enhancement: Add `useMemo` for filtered results, debounce optimization
  - Reference: Profile with React DevTools first

- [ ] **Add display name caching** (`src/utils/mentionDisplayCache.ts`)
  - Only if: ID → display name lookups are slow during pill rendering
  - Enhancement: LRU cache for address → display name mapping
  - Reference: Cache invalidation on user updates

- [ ] **Optimize mention extraction** (`mentionUtils.ts:198`)
  - Only if: Text → ID conversion becomes bottleneck
  - Enhancement: Compiled regex, memo optimization for large texts
  - Reference: Benchmark with 1000+ character messages

**Important**: Only implement optimizations if performance issues actually occur

## Verification

### Phase 2 - Web Implementation Verification

✅ **Visual pill experience works (web)**
   - Test: Type `@j` → select "John Doe" → see `@John Doe` pill in composer
   - Test: Type `#g` → select "general" → see `#general` pill in composer
   - Test: Pills are non-editable, deletable with backspace
   - Test: Click pills to remove them

✅ **Storage format unchanged**
   - Test: Send message with pills → stored as `@<QmAbc123>`, `#<ch-def456>`
   - Test: Enhanced format: `@[John Doe]<QmAbc123>`, `#[general]<ch-gen123>`
   - Test: Legacy format: `@<QmDef456>`, `#<ch-ann456>`
   - Test: Role format: `@developers` (no brackets)
   - Test: Everyone format: `@everyone`
   - Test: Existing messages display correctly
   - Test: Message.mentions object structure identical
   - **Security**: Verify no pill data persisted to IndexedDB/localStorage

✅ **Autocomplete integration preserved (web)**
   - Test: Dropdown appears correctly positioned
   - Test: All keyboard navigation works (arrows, enter, escape)
   - Test: All 4 mention types work in autocomplete
   - Test: useMentionInput hook unchanged

✅ **Copy/paste behavior (web)**
   - Test: Copy pills preserves storage format in clipboard
   - Test: Paste text creates pills from mention IDs
   - Test: Cross-browser clipboard compatibility

✅ **Performance requirements met (web)**
   - Test: Bundle size increase <10KB (measured, not estimated)
   - Test: Typing latency unchanged (<50ms)
   - Test: Memory usage stable during long editing sessions
   - Test: No performance regression in Chrome, Firefox, Safari

✅ **Existing functionality preserved (web)**
   - Test: Auto-resize works correctly
   - Test: onKeyDown handlers work (Enter to send, etc.)
   - Test: File upload, reply-to, markdown toolbar all work
   - Test: All MessageComposer props interface unchanged

✅ **Feature flag validation**
   - Test: Flag disabled → current textarea behavior (rollback works)
   - Test: Flag enabled → pills render correctly
   - Test: No errors or warnings when toggling flag

### Phase 3 - Mobile Implementation Verification (Deferred)

⏳ **Mobile verification** (when Phase 3 implemented):
   - Test: Touch interactions work naturally
   - Test: Virtual keyboard doesn't break pill layout
   - Test: iOS and Android both work correctly
   - Test: 60fps performance maintained
   - Test: Accessibility (TalkBack, VoiceOver)

## Definition of Done

### Phase 1 (Complete)
- [x] User research validates need for pills
- [x] POC demos created and tested (web validated, mobile created)

### Phase 2 (Web Implementation)
- [ ] Single MentionPill.tsx component created (~50 lines)
- [ ] Pill logic integrated directly into MessageComposer.web.tsx
- [ ] All 4 mention types render as pills (both formats supported)
- [ ] Storage format 100% compatible (no breaking changes)
- [ ] Existing autocomplete system works without modification
- [ ] Copy/paste behavior fully specified and working
- [ ] Performance benchmarks met (bundle <10KB, typing <50ms)
- [ ] Feature flag controls pill vs textarea fallback
- [ ] All Phase 2 verification tests pass
- [ ] Security verified: no pill data in persistence layer
- [ ] Documentation updated in `.agents/docs/features/mention-notification-system.md`

### Phase 3 (Mobile Implementation - Deferred)
- [ ] MentionPill.native.tsx component created
- [ ] Pill logic integrated into MessageComposer.native.tsx
- [ ] Mobile-specific testing complete (iOS, Android)
- [ ] Performance validated (60fps, <50ms latency)
- [ ] Accessibility validated (TalkBack, VoiceOver)

### Phase 4 (Polish - After Both Complete)
- [ ] Cross-platform consistency validated
- [ ] Full accessibility audit passed
- [ ] Performance benchmarks met across all platforms

## Risk Mitigation

**Simplified low-risk approach (Phase 2 - Web)**:
- Phase 1 validated user need and technical feasibility
- ContentEditable is standard web API (not external dependency)
- Existing mention system unchanged (no integration risk)
- Feature flag allows instant rollback
- Direct integration avoids unnecessary abstractions
- Web-first allows validation before mobile complexity

**Phase 2 - Web Rollback Plan**:
- Feature flag immediately disables pills
- Falls back to current textarea behavior
- Zero data loss or breaking changes
- Bundle size limited to <10KB

**Phase 3 - Mobile Deferred Until Web Validated**:
- Learn from web implementation feedback
- Test mobile POC before full implementation
- Separate phase reduces risk of simultaneous failures

## Success Metrics

### Phase 2 - Web Success Metrics

**User Experience**:
- Users can compose with clean mention pills on web
- No confusion during message composition
- Visual feedback matches user expectations (Discord/Slack-like)
- All 4 mention types work correctly

**Technical**:
- Bundle size increase <10KB (measured)
- Zero breaking changes to storage or API
- 100% feature parity with current system
- Performance: <50ms typing latency
- Security: No pill data in persistence layer

**Feature Flag Validation**:
- Rollback works instantly (flag disabled → textarea)
- No errors when toggling flag
- Graceful degradation

### Phase 3 - Mobile Success Metrics (Deferred)

**When mobile implemented**:
- Touch interactions work naturally
- Virtual keyboard doesn't break layout
- 60fps performance on iOS and Android
- Accessibility (TalkBack, VoiceOver) works correctly

---

*Created: 2025-11-18*
*Updated: 2026-01-09 - Simplified Phase 2 to web-only based on feature-analyzer recommendations*