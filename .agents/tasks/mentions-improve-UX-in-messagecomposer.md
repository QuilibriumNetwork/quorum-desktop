# Enhanced Mention Format with CSS Highlighting for Message Composer

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: Medium
**Priority**: High (Complete UX solution)
**Created**: 2025-11-18
**Updated**: 2025-11-18
**Estimated Time**: 4-5 days

## What & Why

**Current State**: Users see cryptic IDs (`@<QmAbc123>`, `#<ch-def456>`) in the textarea with no visual feedback, causing confusion about what they're typing.

**Desired State**:
1. **Enhanced mention formats** with readable display names (`@[Alice Johnson]<QmAbc123>`, `#[general-chat]<ch-def456>`)
2. **Visual highlighting** that distinguishes mentions from regular text while typing
3. **Full backward compatibility** with existing mention formats

**Value**:
- **Complete UX Solution**: Readable names + visual highlighting eliminates confusion
- **Rename-Safe Design**: Address/ID remains source of truth, display names for readability
- **Progressive Enhancement**: Old messages work unchanged, new messages more readable
- **Medium Risk Implementation**: CSS overlay + format enhancement, no breaking changes to storage
- **90% of mention pills UX benefit** for **20% of the implementation effort**

## Context & Constraints

**Enhanced Mention Format Requirements**:
- **Backward compatibility**: Support both `@<address>` (old) and `@[Display Name]<address>` (new)
- **Rename-safe storage**: Address/channelID remains the identifier, display name for readability
- **Autocomplete enhancement**: Dropdown selection inserts new readable format
- **Progressive adoption**: Old messages unchanged, new messages more readable

**Visual Highlighting Requirements**:
- **All mentions** (people, roles, channels, @everyone) → **Same highlight style** (consistent with message mention styling)
- Must work with existing `MessageComposer.tsx` without breaking changes
- Cross-platform compatible (web + mobile browsers)
- Use existing `.message-name-mentions-you` styling as reference

**Integration Points**:
- ⚠️ **MINOR CHANGES** to `useMentionInput.ts` (autocomplete insertion format)
- ⚠️ **MINOR CHANGES** to `mentionUtils.ts` (regex patterns for both formats)
- ⚠️ **MINOR CHANGES** to `MessageMarkdownRenderer.tsx` (rendering both formats)
- ✅ **NO CHANGES** to message storage format (still stores addresses only)
- ✅ Works with existing notification system and validation

## Prerequisites

- [ ] Review existing MessageComposer implementation
- [ ] Check color variables in `src/styles/_variables.scss` for consistent theming
- [ ] Branch created from `develop`
- [ ] No conflicting PRs affecting MessageComposer

## Implementation Plan

### Phase 1: Enhanced Mention Format Support (2 days) 🔤

- [ ] **Update mention extraction to support both formats** (`src/utils/mentionUtils.ts`)
  - Done when: `extractMentionsFromText()` handles both old and new mention formats
  - Verify: Both `@<address>` and `@[Display Name]<address>` extract same address
  - Reference: Update regex patterns while preserving existing extraction logic
  - New patterns:
    ```typescript
    // User mentions: @<address> OR @[Display Name]<address>
    /@(?:\[([^\]]+)\])?<([^>]+)>/g

    // Channel mentions: #<channelId> OR #[Channel Name]<channelId>
    /#(?:\[([^\]]+)\])?<([^>]+)>/g
    ```

- [ ] **Update autocomplete insertion format** (`src/hooks/business/mentions/useMentionInput.ts:148`)
  - Done when: Selecting from dropdown inserts new readable format
  - Verify: User selection → `@[John Doe]<QmAbc123>`, Channel selection → `#[general]<ch-def456>`
  - Reference: Modify `onMentionSelect` to include display names
  - Handle edge cases: Escape brackets in display names, fallback for missing names

- [ ] **Update message rendering for both formats** (`src/components/message/MessageMarkdownRenderer.tsx`)
  - Done when: Both old and new mention formats render correctly
  - Verify: `@<address>` shows lookup name, `@[Inline Name]<address>` shows inline name
  - Reference: Update regex patterns and add fallback logic for display names
  - Backward compatibility: Prefer inline display name, fallback to `mapSenderToUser`

### Phase 2: Visual Highlighting System (1.5 days) 🎨

- [ ] **Create mention highlighting overlay component** (`src/components/message/MentionHighlights/`)
  - Done when: `MentionHighlights.tsx` renders highlighted text behind textarea
  - Verify: Text positioning matches textarea exactly (font, padding, line-height)
  - Reference: Use existing `MessageComposer.scss` styling as base
  - Files: `MentionHighlights.tsx`, `MentionHighlights.scss`

- [ ] **Implement mention detection and highlighting** (`src/utils/mentionHighlighting.ts`)
  - Done when: `highlightMentions(text)` function returns HTML with highlight spans for both formats
  - Verify: Correctly highlights all mention types (old and new formats) with appropriate colors
  - Reference: Reuse updated regex patterns from `mentionUtils.ts`
  - Detection patterns:
    ```typescript
    // User mentions (both formats): @<address> and @[Name]<address>
    /@(?:\[([^\]]+)\])?<([^>]+)>/g
    // Role mentions: @roleTag
    /@([a-zA-Z0-9_-]+)(?!\w)/g
    // Everyone mentions: @everyone
    /@everyone\b/gi
    // Channel mentions (both formats): #<id> and #[Name]<id>
    /#(?:\[([^\]]+)\])?<([^>]+)>/g
    // All use same highlight style
    ```

- [ ] **Create CSS overlay styling** (`src/components/message/MentionHighlights/MentionHighlights.scss`)
  - Done when: Overlay perfectly aligns with textarea, highlights work for both mention formats
  - Verify: Highlighting doesn't interfere with typing, cursor, or text selection
  - Reference: Use existing `.message-name-mentions-you` styling as base
  - Styles needed:
    ```scss
    .mention-highlight {
      // Use same styling approach as .message-name-mentions-you
      // Apply as background highlight with low opacity for readability
      background: /* derive from existing mention styling */;
    }
    ```

### Phase 3: Integration & Testing (1.5 days) 🔧

- [ ] **Integrate with MessageComposer** (`src/components/message/MessageComposer.tsx:284`)
  - Done when: MessageComposer shows highlights behind existing TextArea with both mention formats
  - Verify: All existing functionality preserved (auto-resize, onKeyDown, file upload, etc.)
  - Reference: Wrap TextArea with highlight overlay using relative positioning
  - Integration approach:
    ```tsx
    <div className="message-composer-with-highlights">
      <MentionHighlights text={value} />
      <TextArea
        value={value}
        // all existing props preserved
        className="message-composer-textarea-transparent"
      />
    </div>
    ```

- [ ] **Handle scrolling and text area resizing** (responsive behavior)
  - Done when: Highlights stay in sync when textarea grows/shrinks or scrolls
  - Verify: Highlighting overlay matches textarea position during auto-resize
  - Reference: Use ResizeObserver or onResize callbacks to keep overlays aligned

- [ ] **Test comprehensive mention format compatibility**
  - Done when: All mention format combinations work correctly
  - Verify:
    - Old messages: `@<address>` renders correctly and highlights
    - New messages: `@[Display Name]<address>` renders inline name and highlights
    - Mixed messages: Both formats in same message work together
    - Autocomplete: Dropdown inserts new readable format
  - Reference: Test edge cases like bracket escaping and missing display names

- [ ] **Test cross-platform compatibility** (web + mobile browsers)
  - Done when: Both mention formats and highlighting work on Chrome, Firefox, Safari (desktop + mobile)
  - Verify: Font rendering matches exactly, no positioning drift, readable format displays correctly
  - Reference: Test on iOS Safari, Android Chrome for mobile compatibility

### Phase 4: Polish & Edge Cases (0.5-1 day) ✨

- [ ] **Handle edge cases and text processing**
  - Done when: Highlighting works correctly in all text scenarios
  - Verify: No highlights inside code blocks, escaped characters handled correctly
  - Reference: Follow same exclusion logic as `extractMentionsFromText()`
  - Edge cases:
    - Code blocks: ` ```@user``` ` → no highlighting
    - Escaped text: `\@user` → no highlighting (if applicable)
    - Overlapping patterns: Handle priority correctly

- [ ] **Add smooth transitions** (optional polish)
  - Done when: Highlights appear/disappear with subtle animation
  - Verify: Smooth user experience, no jarring flashes
  - Reference: Use CSS transitions for background color changes

- [ ] **Performance optimization** (for long messages)
  - Done when: No typing lag with hundreds of characters and multiple mentions
  - Verify: Debounce highlighting updates if needed, efficient regex processing
  - Reference: Profile with React DevTools, target <16ms update time

## Verification

✅ **Enhanced mention formats work correctly**
   - Test: Type `@j` → no highlight, select "John Doe" → `@[John Doe]<QmAbc123>` appears in textarea
   - Test: Type `#g` → no highlight, select "general" → `#[general-chat]<ch-def456>` appears in textarea
   - Test: Old format `@<QmAbc123>` still works and renders correctly
   - Test: Old format `#<ch-def456>` still works and renders correctly

✅ **Visual highlighting works correctly**
   - Test: `@[John Doe]<QmAbc123>` gets mention highlight (consistent styling)
   - Test: `@<QmAbc123>` (old format) gets mention highlight
   - Test: `#[general-chat]<ch-def456>` gets mention highlight (same style as user mentions)
   - Test: `#<ch-def456>` (old format) gets mention highlight
   - Test: `@everyone` gets mention highlight
   - Test: `@moderators` gets mention highlight

✅ **Existing functionality preserved**
   - Test: Autocomplete dropdown works exactly as before
   - Test: All keyboard shortcuts work (Enter to send, etc.)
   - Test: Auto-resize, file upload, reply-to all work
   - Test: Message storage format unchanged

✅ **Cross-platform compatibility**
   - Test: Highlighting aligns perfectly on desktop browsers
   - Test: Mobile browsers (iOS Safari, Android Chrome) show highlights correctly
   - Test: Virtual keyboard doesn't break highlighting alignment

✅ **Performance meets standards**
   - Test: No typing lag with long messages (500+ characters)
   - Test: Multiple mentions don't cause performance issues
   - Test: Highlighting updates smoothly during fast typing

✅ **Edge cases handled**
   - Test: Code blocks don't show mention highlights
   - Test: Special characters don't break highlighting
   - Test: Copy/paste works normally with highlighted text

## Highlight Design

**Unified Mention Highlighting** (same style for all):
- User mentions: `@<QmAbc123>`, `@[John Doe]<QmAbc123>`
- Role mentions: `@moderators`
- Everyone mentions: `@everyone`
- Channel mentions: `#<ch-def456>`, `#[general-chat]<ch-def456>`
- **Style**: Based on existing `.message-name-mentions-you` styling
- **Reasoning**: Consistent with current message mention appearance, unified UX

**Implementation Strategy**:
- **Phase 1**: Use existing mention styling as background highlight with low opacity
- **Future**: Can always differentiate colors later if users request it
- **Benefit**: Consistent with established design system

**Accessibility**:
- Builds on existing accessible mention styling
- Low opacity ensures text readability
- Consistent with current theme and color variables

## Success Metrics

**User Experience**:
- **Complete UX transformation**: Users see readable names during typing (no confusion about IDs)
- **Consistent visual feedback**: Clear highlighting for all mention types (unified design)
- **Progressive enhancement**: Old messages remain unchanged, new messages more readable
- **Smooth typing experience**: No lag or interference with enhanced format

**Technical**:
- **Backward compatibility**: Zero breaking changes to storage format or existing messages
- **Performance**: Impact <5ms per keystroke for both format processing and highlighting
- **Cross-platform consistency**: Both mention formats and highlighting work consistently
- **Easy rollback**: Can disable enhanced format via feature flag

**Research Value**:
- **Measure UX impact**: Track if readable format + highlighting eliminates "cryptic ID" support tickets
- **User satisfaction**: Gauge if this solution satisfies mention UX needs vs full pills
- **Adoption metrics**: Monitor usage of new readable format vs old format

## Future Considerations

**If This Solution is Sufficient**:
- **Mission accomplished**: Users get readable mentions with visual feedback
- **Stop here**: No need for complex mention pills implementation
- **Enhancement options**: Add subtle icons (👤 for users, # for channels) in highlights
- **Polish options**: Name tooltips on hover, smooth transitions

**If Users Want Full Pills**:
- **Strong foundation**: Enhanced format + highlighting provides excellent base
- **Code reuse**: Regex patterns, color schemes, and mention parsing carry over
- **Validated approach**: User research confirms investment in full contentEditable pills
- **Migration path**: Can enhance readable format to become actual pill components

**Strategic Value**:
- **Risk mitigation**: Validates user need before complex implementation
- **Technical debt reduction**: Avoids over-engineering if simple solution suffices
- **User-driven development**: Let user feedback guide next steps

## Risk Mitigation

**Low Risk Approach**:
- No changes to data layer or business logic
- Easy feature flag toggle for rollback
- Graceful degradation (falls back to current behavior)
- Minimal code surface area

**Rollback Plan**:
- Remove highlight overlay component
- TextArea works exactly as before
- Zero data loss or breaking changes

---

*Created: 2025-11-18*