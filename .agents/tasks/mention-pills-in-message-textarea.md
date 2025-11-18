# Custom ContentEditable Mention Pills for Message Composer

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: Medium
**Created**: 2025-11-18
**Updated**: 2025-11-18

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

- [ ] **Test cross-platform feasibility** (CRITICAL: Mobile + Web together)
  - Done when: POCs prove pills work well on both web AND mobile platforms
  - Verify:
    - **Web**: contentEditable pills work in Chrome, Firefox, Safari
    - **Mobile Browser**: Pills work on iOS Safari, Android Chrome (touch, virtual keyboard)
    - **React Native**: Text input + overlay rendering strategy validated
  - Reference: Build demos in `src/components/_playground/`:
    - `MentionPillsDemo.web.tsx` (contentEditable approach)
    - `MentionPillsDemo.native.tsx` (TextInput + overlay approach)

**Decision Point**: Only proceed to Phase 2 if user research shows genuine need

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

### Phase 2: Cross-Platform Architecture (5-7 days) 🛠️

**Focus**: Design platform-agnostic system from the start

- [ ] **Create shared pill rendering system** (`src/components/message/pills/`)
  - Done when: Platform-agnostic pill components work on both web and native
  - Verify: `MentionPill.tsx`, `RolePill.tsx`, `ChannelPill.tsx` components render consistently
  - Reference: Shared styling, touch-friendly sizing, accessibility support
  - Files: `PillRenderer.tsx`, `PillTypes.ts`, `PillStyling.ts`

- [ ] **Abstract text ↔ pills conversion logic** (`src/utils/mentionPillsUtils.ts`)
  - Done when: Platform-independent conversion functions work identically on web/native
  - Verify: `textToPills()`, `pillsToText()`, `insertPillAtPosition()` work everywhere
  - Reference: Use existing `extractMentionsFromText()` for storage compatibility
  - Integration: No DOM dependencies, pure data transformation

- [ ] **Design platform-specific input components**:

  **Web**: `MentionPillInput.web.tsx`
  - Done when: contentEditable with embedded pill rendering works smoothly
  - Verify: Types text, creates pills, handles backspace/arrow keys
  - Reference: Use `contentEditable="true"` with careful DOM manipulation

  **Native**: `MentionPillInput.native.tsx`
  - Done when: TextInput + absolutely positioned pill overlays work on iOS/Android
  - Verify: Virtual keyboard, touch selection, pill interactions work naturally
  - Reference: Use TextInput with custom overlay rendering

- [ ] **Integrate with existing useMentionInput** (shared across platforms)
  - Done when: Autocomplete dropdown works identically on both platforms
  - Verify: @ triggers user/role dropdown, # triggers channel dropdown, keyboard nav works
  - Reference: Reuse `useMentionInput` hook without ANY modifications

- [ ] **Handle mention selection from autocomplete** (platform-aware)
  - Done when: Selecting from dropdown creates pills using appropriate platform method
  - Verify: User types `@jo`, selects "John Doe", gets pill rendered with platform-specific input
  - Reference: Shared `onMentionSelect` logic with platform-specific pill insertion

- [ ] **Support all 4 mention types across platforms** (consistent behavior)
  - Done when: All mention types render as pills with identical UX on web and native
  - Verify: User pills, role pills, channel pills, @everyone pills look/behave the same
  - Reference: Shared pill components with platform-specific input handling

### Phase 3: Integration & Polish (3-4 days) 🔧

- [ ] **Replace textarea in MessageComposer** (both platforms simultaneously)
  - Done when: `MessageComposer.web.tsx` and `MessageComposer.native.tsx` both use `MentionPillInput`
  - Verify: All existing functionality preserved (auto-resize, onKeyDown, file upload, reply-to)
  - Reference: Use feature flag `ENABLE_MENTION_PILLS` for gradual rollout - use src\config\features.ts

- [ ] **Handle copy/paste correctly** (platform-specific implementations)
  - **Web**: Copy pills preserves underlying IDs, paste creates pills from text
  - **Native**: Clipboard integration with React Native clipboard APIs
  - Verify: Cross-platform copy/paste behavior consistent
  - Reference: Custom clipboard handlers for each platform

- [ ] **Platform-specific optimizations**:

  **Web Optimizations**:
  - Done when: Pills work smoothly on desktop browsers with mouse and keyboard
  - Verify: Mouse selection, keyboard navigation, focus management
  - Reference: DOM manipulation optimization, event delegation

  **Mobile Browser Optimizations**:
  - Done when: Pills work correctly with touch and virtual keyboard
  - Verify: Touch selection, iOS/Android keyboard behavior, zoom handling
  - Reference: Touch event handling, viewport meta optimization

  **React Native Optimizations**:
  - Done when: Pills render smoothly with 60fps on iOS and Android
  - Verify: Scroll performance, memory usage, animation smoothness
  - Reference: Native driver animations, avoid JS bridge when possible

- [ ] **Accessibility & performance validation** (cross-platform)
  - Done when: Screen readers work correctly on all platforms, no performance regressions
  - Verify:
    - **Web**: NVDA/JAWS/VoiceOver support, WCAG compliance
    - **Native**: TalkBack (Android), VoiceOver (iOS) support
    - **Performance**: Typing latency <50ms on all platforms
  - Reference: Platform-specific accessibility APIs

## Cross-Platform Architecture Strategy

### Mobile-First Design Considerations

**Virtual Keyboard Challenges** (Mobile Browser + React Native):
- **Issue**: Virtual keyboards can affect pill positioning and selection
- **Solution**: Dynamic viewport height detection, scroll-into-view for pills
- **Testing**: iOS Safari (iPhone/iPad), Android Chrome, Samsung Internet

**Touch Interactions** (All Mobile Platforms):
- **Issue**: Pills need large enough touch targets, precise selection
- **Solution**: Minimum 44px touch targets, haptic feedback on native
- **Design**: Touch-friendly pill spacing, clear visual feedback

**Performance Constraints** (React Native especially):
- **Issue**: React Native bridge communication can cause lag during typing
- **Solution**: Optimize text measurement, minimize re-renders, use native animations
- **Metrics**: 60fps scrolling, <50ms typing latency

### Platform-Specific Implementation Details

**Web (contentEditable approach)**:
```typescript
// MentionPillInput.web.tsx approach:
- contentEditable div with careful DOM manipulation
- Pills as non-editable inline elements
- Custom selection/cursor management
- Paste handler for clipboard integration
```

**React Native (TextInput + overlay approach)**:
```typescript
// MentionPillInput.native.tsx approach:
- TextInput for text entry (hidden/transparent)
- Absolutely positioned pills overlaid on text
- Custom text measurement for pill positioning
- Platform-specific clipboard handling
```

**Mobile Browser (hybrid approach)**:
```typescript
// Same as web but with mobile optimizations:
- Touch event handling instead of mouse events
- Virtual keyboard viewport adjustments
- Zoom/pinch gesture handling
- iOS Safari-specific selection quirks
```

### Shared Architecture Components

**Platform-Agnostic Logic**:
- `useMentionInput.ts` - NO CHANGES (works on all platforms)
- `mentionPillsUtils.ts` - Text conversion logic (no DOM dependencies)
- `PillTypes.ts` - TypeScript interfaces and data structures
- `extractMentionsFromText()` - Storage format (unchanged)

**Platform-Specific Rendering**:
- `MentionPill.tsx` - Shared pill component (works web + native)
- `MentionPillInput.web.tsx` - Web input implementation
- `MentionPillInput.native.tsx` - React Native input implementation
- `MessageComposer.web.tsx` / `MessageComposer.native.tsx` - Integration points

### Cross-Platform Testing Strategy

**Web Testing**:
- Chrome, Firefox, Safari desktop
- Chrome mobile, Safari mobile (iOS), Samsung Internet (Android)
- Keyboard + mouse interactions
- Touch interactions on tablet devices

**React Native Testing**:
- iOS Simulator + Physical devices (iPhone, iPad)
- Android Emulator + Physical devices (various screen sizes)
- Virtual keyboard behavior variations
- Performance profiling with 60fps target

**Consistency Validation**:
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

✅ **Visual pill experience works**
   - Test: Type `@j` → select "John Doe" → see `@John Doe` pill in composer
   - Test: Type `#g` → select "general" → see `#general` pill in composer
   - Test: Pills are non-editable, deletable with backspace

✅ **Storage format unchanged**
   - Test: Send message with pills → stored as `@<QmAbc123>`, `#<ch-def456>`
   - Test: Existing messages display correctly
   - Test: Message.mentions object structure identical

✅ **Autocomplete integration preserved**
   - Test: Dropdown appears correctly positioned
   - Test: All keyboard navigation works (arrows, enter, escape)
   - Test: All 4 mention types work in autocomplete

✅ **Cross-platform compatibility**
   - Test: Web implementation works in Chrome, Firefox, Safari
   - Test: Native implementation strategy documented and working
   - Test: No functionality lost on any platform

✅ **Performance requirements met**
   - Test: Bundle size increase <5KB total
   - Test: Typing latency unchanged (<50ms)
   - Test: Memory usage stable during long editing sessions

✅ **Existing functionality preserved**
   - Test: Auto-resize works correctly
   - Test: onKeyDown handlers work (Enter to send, etc.)
   - Test: File upload, reply-to, markdown toolbar all work
   - Test: All MessageComposer props interface unchanged

## Definition of Done

- [ ] User research validates need for pills (>50% users want improvement)
- [ ] All 4 mention types render as pills during composition
- [ ] Storage format 100% compatible (no breaking changes)
- [ ] Existing autocomplete system works without modification
- [ ] Cross-platform strategy implemented
- [ ] Performance benchmarks met (bundle <5KB, typing <50ms)
- [ ] Feature flag controls web vs textarea fallback
- [ ] All verification tests pass
- [ ] Documentation updated in `.agents/docs/features/mention-notification-system.md`

## Risk Mitigation

**Low-risk approach**:
- Phase 1 validates user need before development
- ContentEditable is standard web API (not external dependency)
- Existing mention system unchanged (no integration risk)
- Feature flag allows instant rollback
- Cross-platform fallback maintains functionality

**Rollback plan**:
- Feature flag immediately disables pills
- Falls back to current textarea behavior
- Zero data loss or breaking changes

## Success Metrics

**User Experience**:
- Users can compose with clean mention pills
- No confusion during message composition
- Visual feedback matches user expectations

**Technical**:
- Bundle size increase <5KB
- Zero breaking changes to storage or API
- 100% feature parity with current system
- Cross-platform compatibility maintained

---

*Created: 2025-11-18*
*Updated: 2025-11-18 by Claude Code*