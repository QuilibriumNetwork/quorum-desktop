---
type: task
title: "Custom ContentEditable Mention Pills for Message Composer"
status: in-progress
complexity: medium
ai_generated: true
created: 2025-11-18
updated: 2026-01-09
related_report: mention-pills-research
security_notes: Phase 2 requires double-validation (display name lookup + message.mentions check) to prevent name-spoofing and fake mentions
reviewed_by: feature-analyzer
---

# Custom ContentEditable Mention Pills for Message Composer

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent
> **Research Report**: [mention-pills-research.md](../reports/mention-pills-research.md)


## What & Why

**Current State**: Users see cryptic IDs (`@<QmAbc123>`, `#<ch-def456>`) briefly in the textarea after mention selection, creating confusion until message is sent.

**Desired State**: Show readable mention pills (`@John Doe`, `#general-discussion`) in the composer while maintaining the current robust ID-based storage system underneath.

**Value**:
- **User Experience**: Clean Discord/Slack-style mention pills during composition
- **Technical Robustness**: Maintains rename-safe ID storage with zero breaking changes
- **Bundle Efficiency**: Lightweight custom solution (~2KB) vs heavy rich text editor (~75-100KB)
- **Cross-Platform**: Can be implemented with platform-specific alternatives (.web/.native)

## Quick Links

- **Research Report**: [mention-pills-research.md](../reports/mention-pills-research.md) - Industry research, POC validation, and technical insights
- **Related Docs**: [mention-notification-system.md](../docs/features/mention-notification-system.md) - Existing mention system documentation

## Context & Constraints

**Research & Validation**: ✅ Complete
- See [Research Report](../reports/mention-pills-research.md) for:
  - User research findings
  - Industry best practices (Discord, Slack, WhatsApp)
  - POC validation (web tested, mobile created)
  - Technical feasibility analysis

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

## Implementation Plan

### Phase 1: MessageComposer Web Implementation (3-4 days) 🛠️

**Focus**: Web-first implementation with minimal abstractions

**Implementation Approach Taken**:
- ❌ **No separate component**: Pills embedded directly as DOM elements in MessageComposer
- ✅ **ContentEditable-based**: Full implementation using contentEditable div instead of textarea
- ✅ **Inline pill spans**: Pills created as `<span contentEditable="false">` elements with data attributes
- ✅ **Direct integration**: All pill logic embedded in MessageComposer.tsx, no separate components
- ✅ **Reused CSS classes**: Uses existing `message-mentions-*` classes from Message.tsx for styling consistency

**Completed Tasks**:

- [x] ~~**Create MentionPill component**~~ - **NOT NEEDED**: Pills created directly as DOM elements
  - Implementation: Pills are `<span>` elements created via `document.createElement()` in `insertPill()` function
  - Location: [MessageComposer.tsx:250-274](src/components/message/MessageComposer.tsx#L250-L274)
  - CSS Classes: Reuses `message-mentions-user`, `message-mentions-role`, `message-mentions-channel`, `message-mentions-everyone`
  - Additional styling: `.message-composer-pill` class for composer-specific interactions
  - Security: ✅ Pills stored only in DOM, never persisted - storage uses existing format

- [x] **Add contentEditable logic to MessageComposer.tsx**
  - Implementation: Feature-flagged contentEditable div replaces textarea when `ENABLE_MENTION_PILLS` enabled
  - Location: [MessageComposer.tsx:1103-1115](src/components/message/MessageComposer.tsx#L1103-L1115)
  - Key functions:
    - `extractVisualText()`: Gets display text for mention detection ([MessageComposer.tsx:169-172](src/components/message/MessageComposer.tsx#L169-L172))
    - `extractTextFromEditor()`: Converts pills to storage format ([MessageComposer.tsx:175-210](src/components/message/MessageComposer.tsx#L175-L210))
    - `insertPill()`: Creates and inserts pill elements with DOM tree preservation ([MessageComposer.tsx:213-404](src/components/message/MessageComposer.tsx#L213-L404))
  - Backspace support: Custom handler deletes entire pills ([MessageComposer.tsx:533-560](src/components/message/MessageComposer.tsx#L533-L560))
  - Click to delete: Pills have click handlers to remove them ([MessageComposer.tsx:270-274](src/components/message/MessageComposer.tsx#L270-L274))

- [x] **Integrate with existing useMentionInput**
  - Implementation: `handleMentionSelect()` modified to call `insertPill()` when feature enabled
  - Location: [MessageComposer.tsx:407-452](src/components/message/MessageComposer.tsx#L407-L452)
  - Integration: Zero modifications to `useMentionInput` hook - only changed how selection is handled
  - Autocomplete: Uses visual text via `extractVisualText()` for mention detection
  - Focus fix: Added `onMouseDown={(e) => e.preventDefault()}` to dropdown to prevent focus loss ([MessageComposer.tsx:974-976](src/components/message/MessageComposer.tsx#L974-L976))

- [x] **Handle copy/paste correctly**
  - Implementation: Custom paste handler forces plain text insertion
  - Location: [MessageComposer.tsx:511-516](src/components/message/MessageComposer.tsx#L511-L516)
  - Copy handler: Custom copy exports storage format to clipboard ([MessageComposer.tsx:518-522](src/components/message/MessageComposer.tsx#L518-L522))
  - Paste behavior: Uses `document.execCommand('insertText')` to insert as plain text

- [x] **Support all 4 mention types**
  - Implementation: All types supported with correct storage formats
  - Formats verified:
    - ✅ User pills: Enhanced `@[Name]<address>` format ([MessageComposer.tsx:196-198](src/components/message/MessageComposer.tsx#L196-L198))
    - ✅ Channel pills: Enhanced `#[Name]<id>` format (same logic as users)
    - ✅ Role pills: `@roleTag` format ([MessageComposer.tsx:191-193](src/components/message/MessageComposer.tsx#L191-L193))
    - ✅ Everyone: `@everyone` format ([MessageComposer.tsx:194-195](src/components/message/MessageComposer.tsx#L194-L195))
  - Legacy support: Also supports legacy `@<address>` and `#<id>` formats ([MessageComposer.tsx:199-201](src/components/message/MessageComposer.tsx#L199-L201))
  - Data attributes: Pills store type, address, displayName, enhanced flag for conversion back to storage

- [x] **Add feature flag and graceful fallback**
  - Implementation: `ENABLE_MENTION_PILLS` flag controls contentEditable vs textarea
  - Location: [src/config/features.ts:31-39](src/config/features.ts#L31-L39)
  - Flag value: Currently `true` (enabled)
  - Fallback: When disabled, renders original `<TextArea>` component ([MessageComposer.tsx:1116-1132](src/components/message/MessageComposer.tsx#L1116-L1132))
  - Zero breaking changes: Existing textarea logic completely preserved

- [x] **Markdown toolbar integration**
  - Implementation: Added contentEditable support for markdown toolbar
  - Location: [MessageComposer.tsx:667-722](src/components/message/MessageComposer.tsx#L667-L722)
  - `handleEditorMouseUp()`: Detects text selection in contentEditable using Selection API
  - `handleMarkdownFormat()`: Applies markdown formatting to contentEditable content
  - Note: Formatting currently converts pills to plain text (simplification - can enhance later)

**Pending Tasks**:

- [ ] **Measure bundle size impact**
  - Done when: Actual bundle size measured and documented
  - Verify: Target <10KB (realistic, not ~2KB estimate)
  - Reference: Use webpack-bundle-analyzer or similar tool
  - **Status**: Deferred until implementation complete and ready for production

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

### Phase 1 - MessageComposer Web Implementation Verification

✅ **Visual pill experience works (web)** - NEEDS TESTING
   - Implementation: ✅ Complete
   - Test: Type `@j` → select "John Doe" → see `@John Doe` pill in composer
   - Test: Type `#g` → select "general" → see `#general` pill in composer
   - Test: Pills are non-editable, deletable with backspace ✅ (implemented)
   - Test: Click pills to remove them ✅ (implemented)

✅ **Storage format unchanged** - NEEDS TESTING
   - Implementation: ✅ Complete
   - Test: Send message with pills → stored as `@<QmAbc123>`, `#<ch-def456>`
   - Test: Enhanced format: `@[John Doe]<QmAbc123>`, `#[general]<ch-gen123>` ✅ (implemented)
   - Test: Legacy format: `@<QmDef456>`, `#<ch-ann456>` ✅ (supported)
   - Test: Role format: `@developers` (no brackets) ✅ (implemented)
   - Test: Everyone format: `@everyone` ✅ (implemented)
   - Test: Existing messages display correctly
   - Test: Message.mentions object structure identical
   - **Security**: ✅ Pills only in DOM, storage uses `extractTextFromEditor()`

✅ **Autocomplete integration preserved (web)** - PARTIALLY TESTED
   - Implementation: ✅ Complete
   - Test: Dropdown appears correctly positioned ✅ (working)
   - Test: All keyboard navigation works (arrows, enter, escape) ✅ (working)
   - Test: All 4 mention types work in autocomplete
   - Test: useMentionInput hook unchanged ✅ (zero modifications)

✅ **Copy/paste behavior (web)** - NEEDS TESTING
   - Implementation: ✅ Complete
   - Test: Copy pills preserves storage format in clipboard ✅ (implemented)
   - Test: Paste text creates pills from mention IDs (currently inserts as plain text)
   - Test: Cross-browser clipboard compatibility

⏳ **Performance requirements met (web)** - NEEDS MEASUREMENT
   - Implementation: ✅ Complete
   - Test: Bundle size increase <10KB (NOT YET MEASURED)
   - Test: Typing latency unchanged (<50ms)
   - Test: Memory usage stable during long editing sessions
   - Test: No performance regression in Chrome, Firefox, Safari

✅ **Existing functionality preserved (web)** - NEEDS TESTING
   - Implementation: ✅ Complete
   - Test: Auto-resize works correctly ✅ (implemented for contentEditable)
   - Test: onKeyDown handlers work (Enter to send, etc.) ✅ (implemented)
   - Test: File upload, reply-to, markdown toolbar all work
   - Test: All MessageComposer props interface unchanged ✅ (zero breaking changes)

✅ **Feature flag validation** - PARTIALLY TESTED
   - Implementation: ✅ Complete
   - Test: Flag disabled → current textarea behavior (rollback works)
   - Test: Flag enabled → pills render correctly ✅ (working)
   - Test: No errors or warnings when toggling flag

✅ **Markdown toolbar integration** - IMPLEMENTED
   - Implementation: ✅ Complete
   - Test: Selection in contentEditable shows markdown toolbar ✅ (implemented)
   - Test: Formatting works (converts to plain text currently)
   - Note: Formatting is simplified - pills convert to text (can enhance later)

### Phase 3 - Mobile Implementation Verification (Deferred)

**See Research Report**: [mention-pills-research.md](../reports/mention-pills-research.md) for mobile POC details

⏳ **Mobile verification** (when Phase 3 implemented):
   - Test: Touch interactions work naturally
   - Test: Virtual keyboard doesn't break pill layout
   - Test: iOS and Android both work correctly
   - Test: 60fps performance maintained
   - Test: Accessibility (TalkBack, VoiceOver)

## Definition of Done

### Phase 1 (MessageComposer Web Implementation - In Progress)
- [x] ~~Single MentionPill.tsx component~~ - Pills created directly as DOM elements (no component)
- [x] Pill logic integrated directly into MessageComposer.tsx (contentEditable implementation)
- [x] All 4 mention types render as pills (both enhanced and legacy formats supported)
- [x] Storage format 100% compatible (no breaking changes - uses `extractTextFromEditor()`)
- [x] Existing autocomplete system works without modification (zero changes to `useMentionInput`)
- [x] Copy/paste behavior implemented (custom handlers for clipboard)
- [ ] Performance benchmarks measured (bundle size not yet measured)
- [x] Feature flag controls pill vs textarea fallback (`ENABLE_MENTION_PILLS`)
- [ ] All Phase 2 verification tests pass (implementation complete, testing pending)
- [x] Security verified: Pills only in DOM, storage uses existing format functions
- [ ] Documentation updated in `.agents/docs/features/mention-notification-system.md`

**Implementation Files Modified**:
- [src/components/message/MessageComposer.tsx](src/components/message/MessageComposer.tsx) - Main implementation
- [src/components/message/MessageComposer.scss](src/components/message/MessageComposer.scss) - Pill styling
- [src/config/features.ts](src/config/features.ts) - Feature flag

**Next Steps Before Phase 1 Commit**:
- [ ] Comprehensive testing of all mention types
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Performance measurement (bundle size, typing latency)
- [ ] Full verification test suite execution

### Phase 2: MessageEditTextarea Pills Implementation (2-3 days) 🛠️ (Deferred)

**Focus**: Add pill support to message editing for consistency with composer


**Why This Matters**:
- User consistency: Editing should match composing experience
- When user clicks "Edit" on a message with mentions, they should see pills, not raw IDs
- Prevents confusion when editing messages with `@[Name]<address>` format

**Implementation Approach**:
The MessageEditTextarea implementation will mirror MessageComposer's approach but with key differences:
- **Input**: Receives `initialText` with stored format (e.g., `@[John Doe]<QmAbc123>`)
- **Parse on Load**: Convert stored mention format → pills in contentEditable
- **Edit Flow**: User sees/edits pills visually
- **Save**: Convert pills back → stored format via same `extractTextFromEditor()` logic

**Tasks**:

- [ ] **Add contentEditable support to MessageEditTextarea**
  - Done when: Feature-flagged contentEditable replaces textarea (same pattern as MessageComposer)
  - Implementation:
    - Add `editorRef` for contentEditable div
    - Reuse `extractTextFromEditor()` logic from MessageComposer (consider extracting to shared util)
    - Reuse `handleEditorInput()`, `handleEditorKeyDown()`, `handleEditorPaste()` patterns
    - Conditional render: contentEditable when `ENABLE_MENTION_PILLS`, else textarea
  - Location: [MessageEditTextarea.tsx:337-371](src/components/message/MessageEditTextarea.tsx#L337-L371)
  - Reference: Copy patterns from [MessageComposer.tsx:1103-1132](src/components/message/MessageComposer.tsx#L1103-L1132)

- [ ] **Create mention parser for edit mode**
  - Done when: Function parses stored format and creates pills on edit load
  - Implementation:
    - Function: `parseMentionsAndCreatePills(text: string, message: MessageType, spaceRoles: Role[], spaceChannels: Channel[], mapSenderToUser: Function): DocumentFragment`
    - Parse regex patterns (with double-validation for each):
      - Enhanced user: `/@\[([^\]]+)\]<([^>]+)>/g` → validate address in `message.mentions.memberIds`
      - Enhanced channel: `/#\[([^\]]+)\]<([^>]+)>/g` → validate channelId in `message.mentions.channelIds`
      - Legacy user: `/@<([^>]+)>/g` → validate address in `message.mentions.memberIds`
      - Legacy channel: `/#<([^>]+)>/g` → validate channelId in `message.mentions.channelIds`
      - Role: `/@([a-zA-Z0-9_-]+)/g` → validate roleId in `message.mentions.roleIds`
      - Everyone: `/@everyone/g` → validate `message.mentions.everyone` is true
    - For each match:
      - **Security Layer 1**: Lookup real display name (NEVER trust embedded name)
      - **Security Layer 2**: Verify mention exists in `message.mentions` arrays
      - If both validations pass: Create pill span with same pattern as `insertPill()` in MessageComposer
      - Set data attributes (type, address/channelId/roleTag, displayName, enhanced flag)
      - Apply CSS classes (`message-mentions-*` + `message-composer-pill`)
      - If validation fails: Leave as plain text (don't create pill)
    - Return DocumentFragment with pills and text nodes
  - Location: New function in MessageEditTextarea.tsx (or extract to shared util)
  - Reference: Similar to `insertPill()` in [MessageComposer.tsx:250-274](src/components/message/MessageComposer.tsx#L250-L274)
  - Reference: MessageMarkdownRenderer.tsx lines 628-677 for validation pattern
  - **Critical**: Must handle all mention formats from existing messages
  - **Critical**: Must validate ALL mentions against `message.mentions` object (security requirement)

  **🔒 CRITICAL SECURITY WARNING - Double Validation Required**:

  Phase 2 edit mode parses EXISTING message text that may contain manually-typed mention syntax (not created via autocomplete).

  **TWO validation layers required** (same as MessageMarkdownRenderer.tsx):

  **1. Display Name Validation**: NEVER trust embedded display names - lookup real names
  **2. Mention Existence Validation**: ONLY create pills for mentions in `message.mentions` object

  **Why both layers are needed**:
  - **Layer 1** prevents name-spoofing: Attacker types `@[Admin]<attackers_address>` → lookup shows real name, not "Admin"
  - **Layer 2** prevents fake mentions: Attacker types `@[User]<address>` manually without triggering autocomplete → verify it exists in `message.mentions`

  **Required Validation for ALL Mention Types**:

  **User Mentions** - Enhanced format `@[Name]<address>`:
  ```typescript
  const enhancedUserMatch = /@\[([^\]]+)\]<([^>]+)>/g;
  let match;
  while ((match = enhancedUserMatch.exec(text)) !== null) {
    const embeddedName = match[1];  // IGNORE THIS! Could be spoofed
    const address = match[2];        // Use for validation

    // Layer 1: Lookup real display name (don't trust embedded name)
    const realUser = mapSenderToUser(address);
    const displayName = realUser?.displayName || 'Unknown User';

    // Layer 2: Verify mention exists in message.mentions
    if (!message.mentions?.memberIds?.includes(address)) {
      // Skip pill creation - this is plain text, not a real mention
      continue;
    }

    // Both validations passed - create pill with validated data
    createPillElement({
      type: 'user',
      displayName,  // Use looked-up name, NOT embeddedName
      address,
      enhanced: true
    });
  }
  ```

  **User Mentions** - Legacy format `@<address>`:
  ```typescript
  const legacyUserMatch = /@<([^>]+)>/g;
  while ((match = legacyUserMatch.exec(text)) !== null) {
    const address = match[1];

    // Layer 1: Lookup real display name
    const realUser = mapSenderToUser(address);
    const displayName = realUser?.displayName || 'Unknown User';

    // Layer 2: Verify mention exists
    if (!message.mentions?.memberIds?.includes(address)) {
      continue; // Not a real mention
    }

    createPillElement({ type: 'user', displayName, address, enhanced: false });
  }
  ```

  **Channel Mentions** - Enhanced format `#[Name]<id>`:
  ```typescript
  const enhancedChannelMatch = /#\[([^\]]+)\]<([^>]+)>/g;
  while ((match = enhancedChannelMatch.exec(text)) !== null) {
    const embeddedName = match[1];  // IGNORE - could be spoofed
    const channelId = match[2];

    // Layer 1: Lookup real channel name from spaceChannels array
    const realChannel = spaceChannels.find(c => c.channelId === channelId);
    const channelName = realChannel?.channelName || 'Unknown Channel';

    // Layer 2: Verify mention exists
    if (!message.mentions?.channelIds?.includes(channelId)) {
      continue; // Not a real mention
    }

    createPillElement({ type: 'channel', displayName: channelName, channelId, enhanced: true });
  }
  ```

  **Channel Mentions** - Legacy format `#<id>`:
  ```typescript
  const legacyChannelMatch = /#<([^>]+)>/g;
  while ((match = legacyChannelMatch.exec(text)) !== null) {
    const channelId = match[1];

    // Layer 1: Lookup real channel name
    const realChannel = spaceChannels.find(c => c.channelId === channelId);
    const channelName = realChannel?.channelName || 'Unknown Channel';

    // Layer 2: Verify mention exists
    if (!message.mentions?.channelIds?.includes(channelId)) {
      continue;
    }

    createPillElement({ type: 'channel', displayName: channelName, channelId, enhanced: false });
  }
  ```

  **Role Mentions** - Format `@roleTag`:
  ```typescript
  const roleMatch = /@([a-zA-Z0-9_-]+)/g;
  while ((match = roleMatch.exec(text)) !== null) {
    const roleTag = match[1];

    // Layer 1: Lookup real role from spaceRoles array
    const realRole = spaceRoles.find(r => r.roleTag === roleTag);
    if (!realRole) {
      continue; // Not a valid role
    }

    // Layer 2: Verify mention exists
    if (!message.mentions?.roleIds?.includes(realRole.roleId)) {
      continue; // Not a real mention
    }

    createPillElement({ type: 'role', displayName: realRole.displayName, roleTag });
  }
  ```

  **@everyone Mentions** - Format `@everyone`:
  ```typescript
  const everyoneMatch = /@everyone/g;
  if (everyoneMatch.test(text)) {
    // Layer 2: Verify @everyone exists in message.mentions
    if (message.mentions?.everyone) {
      createPillElement({ type: 'everyone', displayName: '@everyone' });
    }
    // If not in message.mentions, leave as plain text
  }
  ```

  **Reference Implementation**: MessageMarkdownRenderer.tsx lines 628-677 (uses same double-validation pattern)

  **Why Phase 1 (MessageComposer) is Safe**:
  - Pills only created from autocomplete via `insertPill()` function
  - Display names come from trusted `option` object from dropdown
  - User cannot manually type mention syntax to create pills
  - All pills automatically validated through autocomplete selection

  **Why Phase 2 (MessageEditTextarea) Needs Double Validation**:
  - Parses existing stored text that may contain manually-typed mentions (bypassing autocomplete)
  - Attacker could have manually typed `@[Admin]<attackers_address>` in text
  - Must validate BOTH display names AND mention existence
  - Same security requirements as MessageMarkdownRenderer for rendering messages

- [ ] **Initialize contentEditable with pills on edit load**
  - Done when: Opening edit mode shows pills instead of raw IDs
  - Implementation:
    - In component mount/edit mode entry:
      ```typescript
      useEffect(() => {
        if (ENABLE_MENTION_PILLS && editorRef.current) {
          const fragment = parseMentionsAndCreatePills(initialText);
          editorRef.current.innerHTML = '';
          editorRef.current.appendChild(fragment);
          // Focus at end
          editorRef.current.focus();
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, [initialText]);
      ```
  - Verify: User clicks edit → sees `@John Doe` pills, not `@[John Doe]<QmAbc123>`

  **Edge Case Handling in `parseMentionsAndCreatePills()`**:

  1. **Malformed enhanced syntax**: `@[Unclosed`, `@[Name]<>`, `#[Channel]<>`
     - Detection: Regex match fails or captures empty address/channelId
     - Behavior: Leave as plain text (don't create pill)

  2. **Invalid addresses/IDs**: `@[Name]<not-an-address>`, `#[Chan]<invalid-id>`
     - Detection: Lookup returns null/undefined
     - Behavior: Create pill with "Unknown User"/"Unknown Channel" display (same as MessageMarkdownRenderer)

  3. **Mentions not in message.mentions**: Manually typed mention syntax
     - Detection: address/roleTag/channelId not in `message.mentions` arrays
     - Behavior: Leave as plain text (don't create pill) - prevents fake mentions

  4. **Empty or whitespace-only text**:
     - Behavior: Return empty DocumentFragment

  5. **Mixed enhanced/legacy formats**: `@[New]<addr> and @<addr2>`
     - Behavior: Parse both formats, create appropriate pills for each

  6. **Deleted users/roles/channels**: Mentioned entity no longer exists
     - Detection: Lookup returns null/undefined but mention exists in `message.mentions`
     - Behavior: Create pill with fallback text ("Unknown User", "Former Member", "Unknown Channel")

  **Display Name Resolution Strategy**:

  **Decision**: Show CURRENT display names (same as Message.tsx rendering)

  **Rationale**:
  - Consistency with how mentions render in displayed messages
  - Users expect to see current names, not historical snapshots
  - Enhanced format stores both name and address, but address is source of truth

  **Implementation**:
  - Enhanced format `@[Historical Name]<address>`: Parse address, lookup CURRENT name, create pill with current name
  - Legacy format `@<address>`: Parse address, lookup CURRENT name, create pill
  - If user no longer exists: Show "Unknown User" / "Former Member"

  **Note**: The stored message text preserves historical names in enhanced format, but the edit UI shows current names (live lookup)

- [ ] **Reuse pill editing logic from MessageComposer**
  - Done when: Backspace deletes pills, click removes pills, cursor navigation works
  - Implementation:
    - Reuse `handleEditorKeyDown()` backspace logic from MessageComposer
    - Reuse pill click handler pattern (delete on click)
    - Reuse cursor position tracking
  - Location: Copy from [MessageComposer.tsx:524-570](src/components/message/MessageComposer.tsx#L524-L570)
  - No new logic needed - direct reuse of proven patterns

- [ ] **Convert pills to storage format on save**
  - Done when: Saving edited message preserves mention format correctly
  - Implementation:
    - In `handleSaveEdit()`, use `extractTextFromEditor()` instead of plain `editText`
    - Consider extracting `extractTextFromEditor()` to shared util for reuse
    - Pattern:
      ```typescript
      const handleSaveEdit = async () => {
        const editedTextString = ENABLE_MENTION_PILLS && editorRef.current
          ? extractTextFromEditor() // Convert pills → storage format
          : editText; // Original textarea value

        const editedTextArray = editedTextString.split('\n');
        const editedText = editedTextArray.length === 1 ? editedTextArray[0] : editedTextArray;
        // ... rest of save logic unchanged
      };
      ```
  - Verify: Pills convert to correct storage format (`@[Name]<address>`, `@roleTag`, etc.)
  - Location: [MessageEditTextarea.tsx:106-335](src/components/message/MessageEditTextarea.tsx#L106-335)

- [ ] **Handle markdown toolbar with contentEditable in edit mode**
  - Done when: Markdown toolbar works with pills in edit mode
  - Status: Already implemented! [MessageEditTextarea.tsx:62-104](src/components/message/MessageEditTextarea.tsx#L62-L104)
  - Implementation:
    - Replace `handleTextareaMouseUp` with `handleEditorMouseUp` pattern from MessageComposer
    - Use Selection API for contentEditable (already pattern exists in MessageComposer)
    - Formatting will convert pills to text (same simplification as MessageComposer)
  - Location: [MessageEditTextarea.tsx:62-88](src/components/message/MessageEditTextarea.tsx#L62-L88)
  - Reference: Copy from [MessageComposer.tsx:667-722](src/components/message/MessageComposer.tsx#L667-L722)

- [ ] **Test message editing with pills**
  - Done when: All edit scenarios work correctly
  - Test cases:
    - Edit message with single user mention → see pill → edit → save
    - Edit message with multiple mentions (user, role, channel, @everyone) → all show as pills
    - Edit message with enhanced format `@[Name]<address>` → pill appears correctly
    - Edit message with legacy format `@<address>` → pill appears with looked-up display name
    - Edit message with no mentions → works normally
    - Backspace deletes pills atomically
    - Markdown toolbar works in edit mode
    - Save preserves mention format correctly
    - **Deleted mention targets**:
      - Edit message where mentioned user has left space → pill shows "Unknown User"
      - Edit message where mentioned role has been deleted → pill shows "Unknown Role" or doesn't create pill
      - Edit message where mentioned channel has been deleted → pill shows "Unknown Channel"
      - Edit message with mix of valid and deleted mentions → valid pills render, deleted show fallback
      - Verify all deleted-mention scenarios save correctly without errors
    - **Malformed mention syntax**:
      - Edit message with malformed syntax `@[Unclosed` → appears as plain text, no pill
      - Edit message with empty address `@[Name]<>` → appears as plain text, no pill
      - Edit message with invalid address → pill with "Unknown User" (if in message.mentions)
    - **Renamed entities**:
      - Edit message where mentioned user has been renamed → pill shows CURRENT name, not historical
      - Edit message where mentioned channel has been renamed → pill shows CURRENT name
      - Verify enhanced format preserves historical name in storage, but UI shows current
    - **Fake mentions** (manually typed, not in message.mentions):
      - Edit message with manually-typed `@[Admin]<attackers_address>` not in message.mentions → appears as plain text (no pill created)
      - Verify security: Pills only created for mentions validated in `message.mentions` arrays
  - Verification: Edit history shows correct mention storage format

**Code Reuse Strategy**:

**⚠️ Feature-Analyzer Review**: Premature abstraction warning

1. **Option A: Extract to shared utilities** (Original recommendation - RECONSIDERED)
   ```typescript
   // src/utils/mentionPillUtils.ts
   export function extractTextFromEditor(editorElement: HTMLElement): string { ... }
   export function createPillElement(option: MentionOption): HTMLSpanElement { ... }
   export function parseMentionsAndCreatePills(text: string, message: MessageType, spaceRoles?: Role[], spaceChannels?: Channel[], mapSenderToUser?: Function): DocumentFragment { ... }
   ```
   - Pro: Single source of truth, easier to maintain
   - Pro: Consistent behavior between composer and editor
   - Con: **Premature abstraction** - violates "Rule of Three" (only 2 components, need 3+ to validate pattern)
   - Con: Functions in MessageComposer are tightly coupled to component state/refs/callbacks
   - Con: **Risk**: Wrong abstraction harder to fix than duplication

2. **Option B: Keep duplicated for now, refactor later** (REVISED RECOMMENDATION)
   - Pro: Faster implementation, no architectural changes
   - Pro: Avoids premature abstraction before patterns are proven
   - Pro: "Duplication is far cheaper than the wrong abstraction" - Sandi Metz
   - Pro: Can extract utilities AFTER third use case validates the pattern
   - Con: Code duplication between MessageComposer and MessageEditTextarea (acceptable short-term)
   - Con: Bug fixes need to be applied twice (acceptable until third use case)

**Recommended**: Option B - Duplicate now, refactor when pattern validated by third use case

**When to Extract**: When implementing Phase 3 (mobile) or other pill use cases, THEN extract common patterns to shared utilities

**User Data Handling**:
For parsing mentions back to pills, we MUST validate display names via lookup (security requirement):

**Required Props for MessageEditTextarea** (extend existing interface):

```typescript
interface MessageEditTextareaProps {
  message: MessageType;
  initialText: string;
  onCancel: () => void;
  submitMessage: (message: any) => Promise<void>;
  mapSenderToUser: (senderId: string) => any;
  dmContext?: DmContext;

  // NEW: Required for mention pill parsing and validation
  spaceRoles?: Role[];      // For role mention validation
  spaceChannels?: Channel[]; // For channel mention validation
  // Note: mapSenderToUser already provides user lookup, no separate users array needed
}
```

**Source in Message.tsx**:
- `spaceRoles` - Already available in Message.tsx, passed to MessageMarkdownRenderer
- `spaceChannels` - Already available in Message.tsx, passed to MessageMarkdownRenderer
- Simply pass these same props to MessageEditTextarea when rendering edit mode

**Validation Requirements**:
- MessageEditTextarea already receives `mapSenderToUser` prop ✅
- **MUST ADD**: Pass `spaceRoles`, `spaceChannels` props (same as MessageMarkdownRenderer) for validation
- **NEVER**: Parse enhanced format `@[Name]<address>` and trust embedded name (name-spoofing vulnerability!)
- **Required**: All display names MUST be looked up from `spaceRoles`, `spaceChannels` arrays or via `mapSenderToUser()`
- **Fallback**: Show "Unknown User" / "Former Member" / "Unknown Channel" when lookup fails (never show spoofed names)

**Verification Checklist**:

- [ ] Edit message with mentions → pills appear
- [ ] Edit pills → typing works naturally
- [ ] Save edited message → storage format preserved
- [ ] Markdown toolbar works in edit mode with pills
- [ ] Backspace deletes entire pills
- [ ] Click pills to remove them
- [ ] Feature flag disabled → textarea fallback works
- [ ] Edit history preserved correctly
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari)

### Phase 2 Definition of Done (When Implemented)

- [ ] contentEditable support added to MessageEditTextarea
- [ ] Mention parser created for edit mode
- [ ] Pills appear when editing messages with mentions
- [ ] Save preserves correct storage format
- [ ] Markdown toolbar works with contentEditable
- [ ] All test cases pass
- [ ] Feature flag fallback works
- [ ] Cross-browser compatibility verified

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

## Task Summary

**Current Progress**:
- ✅ Research & validation complete (see [Research Report](../reports/mention-pills-research.md))
- ✅ Phase 1 implementation complete (MessageComposer web pills)
- ⏳ Phase 1 testing pending
- ⏳ Phase 2 planned (MessageEditTextarea pills)
- ⏳ Phase 3 deferred (Mobile implementation)

**Key Achievements**:
- Zero breaking changes to existing mention system
- Feature flag for safe rollout (`ENABLE_MENTION_PILLS`)
- Reused existing CSS classes for consistency
- Direct DOM manipulation (no component over-abstraction)
- All 4 mention types supported (users, roles, channels, @everyone)
- Enhanced and legacy format support

**Files Modified**:
- [MessageComposer.tsx](src/components/message/MessageComposer.tsx) - 192 lines added (contentEditable logic)
- [MessageComposer.scss](src/components/message/MessageComposer.scss) - 8 lines added (pill styling)
- [features.ts](src/config/features.ts) - 8 lines added (feature flag)

**Ready for**:
- Testing and verification
- Commit to repository
- User feedback

## Success Metrics

### Phase 1 - MessageComposer Web Success Metrics

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

### Phase 2 - MessageEditTextarea Success Metrics (When Implemented)

**User Experience**:
- Consistent pill experience between composing and editing
- No confusion when editing messages with mentions
- Pills parse correctly from stored format

**Technical**:
- Same storage format compatibility as Phase 1
- Reuse of Phase 1 utilities (extraction, parsing, pill creation)
- Feature flag fallback works

### Phase 3 - Mobile Success Metrics (Deferred)

**See Research Report**: [mention-pills-research.md](../reports/mention-pills-research.md)

**When mobile implemented**:
- Touch interactions work naturally
- Virtual keyboard doesn't break layout
- 60fps performance on iOS and Android
- Accessibility (TalkBack, VoiceOver) works correctly

---
