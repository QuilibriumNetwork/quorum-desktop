---
type: task
title: Mention Pills Code Abstraction & Refactoring
related_feature: mention-pills-in-message-textarea
priority: high
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T08:30:00.000Z
---

# Mention Pills Code Abstraction & Refactoring

> **Implementation Status**: Planning Complete, Code Pending
> **Purpose**: Extract duplicated mention pill logic from MessageComposer and MessageEditTextarea into shared utilities and hooks for better maintainability.
> **Related Task**: [mention-pills-in-message-textarea.md](./mention-pills-in-message-textarea.md)

## Context & Motivation

### Current State

After implementing mention pills in both MessageComposer (Phase 1) and MessageEditTextarea (Phase 2), we have:

**✅ Working Implementation**:
- Pills work correctly in both components
- All 4 mention types supported (users, roles, channels, @everyone)
- Feature flag enabled for safe rollout
- Zero breaking changes to existing system

**⚠️ Code Duplication Problem**:
- **~270 lines of identical code** across 2 files
- Duplicated functions:
  - `extractTextFromEditor()` - ~30 lines (converts pills → storage format)
  - `insertPill()` - ~190 lines (complex DOM walking algorithm)
  - `getCursorPosition()` - ~13 lines (cursor position in contentEditable)
  - `extractVisualText()` - ~4 lines (visual text for mention detection)
  - Pill creation logic - ~50 lines (DOM element creation with CSS classes)

**🔮 Future Requirements**:
- **Phase 3**: Mobile implementation (React Native) - Will require separate implementation
  - Web and native have fundamentally different text input models
  - Web: `contentEditable` with DOM manipulation
  - Native: `TextInput` with different pill rendering approach
- **Bug fixes**: Currently must fix bugs in 2 places
- **Maintainability**: Duplicated logic harder to maintain

### Why Abstraction Now?

1. **Rule of Three Met**: 2 implementations exist with identical code
2. **High Duplication**: ~270 lines of identical logic across 2 files
3. **Stable Code**: Implementation working and tested in production
4. **Web Code Reuse**: Share utilities across all web components
5. **Maintainability**: Single source of truth for bug fixes

## Issues Found in Current Implementation

### Issue 1: Event Listener Memory Leak Risk ⚠️ HIGH PRIORITY

**Location**: Both MessageComposer and MessageEditTextarea in `insertPill()` function

**Current Pattern**:
```typescript
pillSpan.addEventListener('click', () => {
  pillSpan.remove();
  // Update text...
});
```

**Issue**: Each pill gets individual event listener. In long-running Electron app:
- User might compose hundreds of messages per session
- Each pill adds event listener that may not be garbage collected
- Browser auto-cleanup not guaranteed for Electron/Chromium

**Impact**: Potential memory leak over time in desktop application.

**Fix**: Use event delegation on parent `contentEditable` element instead:
```typescript
// In hook useEffect
useEffect(() => {
  const handlePillClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.dataset?.mentionType) {
      target.remove();
      const newText = extractStorageText();
      onTextChange(newText);
    }
  };

  editorRef.current?.addEventListener('click', handlePillClick);
  return () => editorRef.current?.removeEventListener('click', handlePillClick);
}, [extractStorageText, onTextChange]);
```

**Benefits**:
- One listener instead of N listeners (N = number of pills)
- Automatic cleanup via useEffect return
- Better performance for many pills

---

### Issue 2: Data Persistence & Security ⚠️ HIGH PRIORITY

**Concern**: Need to verify mention pills and their metadata are handled securely.

**Verification Required**:
1. Pills never serialized to localStorage/IndexedDB (should only exist in DOM during editing)
2. `extractStorageText()` properly sanitizes output before storage
3. Clipboard operations don't leak pill metadata (addresses, display names)

**Action**: Add security verification to acceptance checklist (see below).

---

### Issue 3: Duplicate CSS Class Mapping

**Location**: Both files have identical `mentionClasses` object

```typescript
const mentionClasses = {
  user: 'message-mentions-user',
  role: 'message-mentions-role',
  channel: 'message-mentions-channel',
  everyone: 'message-mentions-everyone',
};
```

**Fix**: Extract to shared constant.

---

## Abstraction Strategy

### Phase 1: Pure Utility Functions (Zero React Dependencies)

**File**: `src/utils/mentionPillDom.ts`

**Platform Scope**: Web-only (uses DOM APIs)

**Why Separate from Hooks?**
- Pure functions easier to test (no React dependencies)
- Better tree-shaking (smaller bundle)
- Clear separation of concerns
- **Note**: These utilities are web-specific (use `HTMLElement`, `document.createElement`). Mobile will need separate implementation.

**Functions to Extract**:

1. **`MENTION_PILL_CLASSES`** (constant)
   - CSS class mapping for pill types
   - Matches Message.tsx rendering
   - Source: Both files ~lines 250-255

2. **`createPillElement(pillData, onClick?)`**
   - Create pill DOM element
   - Parameters: `{ type, displayName, address }`, optional click handler
   - Returns: `HTMLSpanElement`
   - Source: Both files ~lines 242-266 (MessageComposer), 317-341 (MessageEditTextarea)

3. **`extractPillDataFromOption(option)`**
   - Convert MentionOption to PillData
   - Handles all 4 mention types
   - Source: Both files ~lines 219-244 (MessageComposer), 294-315 (MessageEditTextarea)

4. **`extractStorageTextFromEditor(editorElement)`**
   - Walk DOM tree and convert pills to storage format
   - Returns: `string` (e.g., `@<address>`, `#<channelId>`)
   - Source: Both files `extractTextFromEditor()` function

5. **`getCursorPositionInElement(editorElement)`**
   - Get cursor position (character offset) in contentEditable
   - Returns: `number`
   - Source: Both files `getCursorPosition()` function

**Type Definitions**:
```typescript
export type MentionPillType = 'user' | 'role' | 'channel' | 'everyone';

export interface PillData {
  type: MentionPillType;
  displayName: string;
  address: string;
}
```

---

### Phase 2: React Hook for Business Logic

**File**: `src/hooks/business/mentions/useMentionPillEditor.ts`

**Platform Scope**: Web-only (uses DOM APIs and `contentEditable`)

**Why a Hook?**
- Encapsulates stateful logic (refs, callbacks)
- Can be reused across all web components (MessageComposer, MessageEditTextarea, future components)
- Clean separation from UI rendering
- **Mobile Note**: React Native will need separate `useMentionPillEditorNative.ts` due to different text input model (`TextInput` vs `contentEditable`)

**Hook Interface**:
```typescript
export interface UseMentionPillEditorOptions {
  /** Callback when text changes (receives storage format text) */
  onTextChange: (text: string) => void;
}

export interface UseMentionPillEditorReturn {
  /** Ref to attach to contentEditable div */
  editorRef: React.RefObject<HTMLDivElement>;

  /** Extract visual text (what user sees) for mention detection */
  extractVisualText: () => string;

  /** Extract storage format text (with IDs) */
  extractStorageText: () => string;

  /** Get current cursor position */
  getCursorPosition: () => number;

  /** Insert a mention pill at specified position */
  insertPill: (option: MentionOption, mentionStart: number, mentionEnd: number) => void;
}
```

**Hook Functions**:

1. **`extractVisualText()`**
   - Returns `editorRef.current.textContent` (visual text without IDs)
   - Source: Both files ~lines 168-172 (MessageComposer), 122-125 (MessageEditTextarea)

2. **`extractStorageText()`**
   - Wrapper around `extractStorageTextFromEditor()` utility
   - Source: Both files ~lines 175-206 (MessageComposer), 128-159 (MessageEditTextarea)

3. **`getCursorPosition()`**
   - Wrapper around `getCursorPositionInElement()` utility
   - Source: Both files ~lines 464-476 (MessageComposer), 107-119 (MessageEditTextarea)

4. **`insertPill(option, mentionStart, mentionEnd)`**
   - **Most complex function** (~190 lines)
   - DOM walking algorithm preserves existing pills
   - Two-phase approach: clone before → insert pill → clone after
   - Source: Both files ~lines 209-396 (MessageComposer), 284-481 (MessageEditTextarea)

**Key Implementation Details**:
- Use `useRef` for editorRef
- Use `useCallback` for all functions (performance)
- Reuse utility functions from Phase 1
- Preserve DOM walking algorithm exactly (battle-tested)

---

### Phase 3: Component Refactoring

**Files to Modify**:
1. `src/components/message/MessageComposer.tsx`
2. `src/components/message/MessageEditTextarea.tsx`

**Refactor Pattern**:

**Before** (MessageComposer):
```typescript
const editorRef = useRef<HTMLDivElement>(null);

const extractVisualText = useCallback(() => { /* ... */ }, []);
const extractTextFromEditor = useCallback(() => { /* ... */ }, []);
const getCursorPosition = useCallback(() => { /* ... */ }, []);
const insertPill = useCallback((option, start, end) => { /* ... */ }, []);
```

**After**:
```typescript
const pillEditor = useMentionPillEditor({
  onTextChange: onChange,
});

const { editorRef, extractVisualText, extractStorageText, getCursorPosition, insertPill } = pillEditor;
```

**Changes Required**:
- Replace local `editorRef` with `pillEditor.editorRef`
- Replace `extractTextFromEditor()` with `extractStorageText()`
- Remove duplicate function definitions
- Update function calls to use destructured functions

**Lines Removed**:
- MessageComposer: ~270 lines → ~10 lines (hook usage)
- MessageEditTextarea: ~270 lines → ~10 lines (hook usage)
- **Net Savings**: ~540 lines reduced to ~250 lines (utilities + hook) + ~20 lines (component usage) = **~270 lines saved**

---

## Implementation Plan

### Step 1: Create Pure Utility Functions ⏳

**File**: `src/utils/mentionPillDom.ts`

**Tasks**:
- [ ] Create file structure
- [ ] Define TypeScript types (`MentionPillType`, `PillData`)
- [ ] Extract `MENTION_PILL_CLASSES` constant
- [ ] Implement `createPillElement()`
- [ ] Implement `extractPillDataFromOption()`
- [ ] Implement `extractStorageTextFromEditor()`
- [ ] Implement `getCursorPositionInElement()`
- [ ] Add JSDoc comments for each function
- [ ] Export all functions and types

**Testing**: Manual testing only (code is being moved, not changed)

---

### Step 2: Create React Hook ⏳

**File**: `src/hooks/business/mentions/useMentionPillEditor.ts`

**Tasks**:
- [ ] Create file structure
- [ ] Define hook options interface
- [ ] Define hook return interface
- [ ] Implement `useMentionPillEditor` hook
  - [ ] `editorRef` with `useRef`
  - [ ] `extractVisualText()` with `useCallback`
  - [ ] `extractStorageText()` with `useCallback`
  - [ ] `getCursorPosition()` with `useCallback`
  - [ ] `insertPill()` with `useCallback` (DOM walking algorithm)
  - [ ] **Event delegation for pill clicks** (Issue #1 fix)
- [ ] Import utility functions from Phase 1
- [ ] Add JSDoc comments and usage examples

**Testing**: Manual testing only (code is being moved, not changed)

---

### Step 3: Refactor MessageComposer ⏳

**File**: `src/components/message/MessageComposer.tsx`

**Tasks**:
- [ ] Import `useMentionPillEditor` hook
- [ ] Replace local `editorRef` with hook's `editorRef`
- [ ] Remove duplicate functions:
  - [ ] `extractVisualText()`
  - [ ] `extractTextFromEditor()`
  - [ ] `getCursorPosition()`
  - [ ] `insertPill()` (now using hook's event delegation)
- [ ] Update all function calls to use hook functions
- [ ] Verify contentEditable ref usage

**Testing** (Manual):
- [ ] Create messages with mentions
- [ ] Verify all 4 mention types work (users, roles, channels, @everyone)
- [ ] Verify pill insertion, deletion, cursor navigation
- [ ] Verify storage format preservation

---

### Step 4: Refactor MessageEditTextarea ⏳

**File**: `src/components/message/MessageEditTextarea.tsx`

**Tasks**:
- [ ] Import `useMentionPillEditor` hook
- [ ] Replace local `editorRef` with hook's `editorRef`
- [ ] Remove duplicate functions (same as MessageComposer)
- [ ] Update all function calls to use hook functions
- [ ] Keep `parseMentionsAndCreatePills()` (edit-specific, with double validation)
- [ ] Verify initialization logic with pills on mount

**Testing** (Manual):
- [ ] Edit messages with mentions
- [ ] Verify pills appear when entering edit mode
- [ ] Verify all edit scenarios (add/remove mentions, save, cancel)
- [ ] Verify double-validation security still works

---

### Step 5: Verification & Documentation ⏳

**Tasks**:
- [ ] Run TypeScript compilation: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] Run linter: `yarn lint`
- [ ] Visual regression testing:
  - [ ] MessageComposer: Create new messages with pills
  - [ ] MessageEditTextarea: Edit existing messages with pills
  - [ ] Cross-browser: Chrome, Firefox, Safari
- [ ] Update documentation:
  - [ ] Add JSDoc to all exported functions
  - [ ] Update task file with completion status
  - [ ] Document hook usage patterns for future components

---

## Success Criteria

### Code Quality

- [ ] **Zero Duplication**: No duplicated pill logic between components
- [ ] **Type Safety**: All functions properly typed with TypeScript
- [ ] **Pure Functions**: Utilities have no side effects
- [ ] **Hook Pattern**: Follows React best practices
- [ ] **Event Delegation**: Memory leak fixed (Issue #1)

### Functionality

- [ ] **MessageComposer Works**: All pill features function identically
- [ ] **MessageEditTextarea Works**: All edit features function identically
- [ ] **Storage Format Preserved**: `@<address>`, `#<channelId>`, etc.
- [ ] **Security Maintained**: Double-validation still enforced (MessageEditTextarea)
- [ ] **Security Verified**: Pills not persisted, clipboard safe (Issue #2)

### Performance

- [ ] **Runtime Performance**: No regressions in typing latency or pill insertion
- [ ] **Memory**: No memory leaks from event handlers (event delegation implemented)

### Maintainability

- [ ] **Single Source of Truth**: One implementation of pill logic
- [ ] **Web Components Ready**: Utilities can be reused across all web components
- [ ] **Documentation**: Clear JSDoc and usage examples

---

## Risks & Mitigation

### Risk 1: Regression in Existing Functionality

**Risk**: Refactoring breaks working pill features

**Mitigation**:
1. ✅ Copy exact implementation (no logic changes)
2. ⏳ Thorough manual testing before commit
3. ✅ Feature flag allows instant rollback
4. ⏳ Test both components after each refactor step

### Risk 2: Mobile Implementation Differences

**Reality**: Mobile will need separate implementation (not a risk, just a fact)

**Approach**:
1. ✅ Web utilities are web-specific (DOM APIs)
2. ✅ Mobile will need `useMentionPillEditorNative.ts` with different approach
3. ✅ Storage format remains the same (only rendering differs)
4. ✅ This refactor prepares web side, mobile implementation is separate task

### Risk 3: Performance Regression

**Risk**: Extra function calls slow down typing

**Mitigation**:
1. ✅ All hook functions use `useCallback` (same as before)
2. ✅ No additional re-renders introduced
3. ⏳ Performance testing before/after

---

## Future Enhancements (Out of Scope)

These are **not** part of this task, but could be future improvements:

1. **Cursor Position Setter**
   - Implement `setCursorPositionInElement()` utility
   - Currently components handle this themselves

2. **Mobile Implementation** (Separate Task)
   - Create `useMentionPillEditorNative.ts` for React Native
   - Different approach: TextInput with overlay pills (not inline)
   - Reuse storage format, not DOM utilities

3. **Advanced Paste Behavior**
   - Parse mentions from pasted text (currently paste as plain text)

4. **Performance Optimization**
   - Virtualization for very long messages with many pills
   - Debouncing for cursor position updates

---

## Related Files

### Created Files
- `src/utils/mentionPillDom.ts` - Pure utility functions
- `src/hooks/business/mentions/useMentionPillEditor.ts` - React hook

### Modified Files
- `src/components/message/MessageComposer.tsx` - Use hook instead of local functions
- `src/components/message/MessageEditTextarea.tsx` - Use hook instead of local functions

### Unchanged Files (Reference)
- `src/hooks/business/mentions/useMentionInput.ts` - Autocomplete hook (no changes)
- `src/utils/mentionUtils.ts` - Mention extraction/validation (no changes)
- `src/components/message/MessageComposer.scss` - Pill styling (no changes)

---

## Acceptance Checklist

Before marking this task as complete:

**Code Quality**:
- [ ] All TypeScript compilation errors resolved (`npx tsc --noEmit --jsx react-jsx --skipLibCheck`)
- [ ] All ESLint warnings resolved (`yarn lint`)
- [ ] No console warnings in browser
- [ ] Code follows existing patterns and conventions

**Functionality**:
- [ ] MessageComposer: Create message with each mention type
- [ ] MessageComposer: Insert multiple mentions in one message
- [ ] MessageComposer: Delete pills with backspace
- [ ] MessageComposer: Click pills to remove (event delegation working)
- [ ] MessageEditTextarea: Edit message with existing mentions
- [ ] MessageEditTextarea: Add new mentions while editing
- [ ] MessageEditTextarea: Save preserves storage format
- [ ] Feature flag disabled: Textarea fallback works

**Security** (Issue #2):
- [ ] Verify pills never persisted to localStorage/IndexedDB
- [ ] Verify `extractStorageText()` output matches existing storage format
- [ ] Verify clipboard paste doesn't leak pill metadata

**Performance**:
- [ ] No memory leaks after creating/removing many pills (Issue #1 fixed)
- [ ] No regressions in typing latency
- [ ] Performance comparable to pre-refactor

**Manual Testing** (Cross-browser):
- [ ] Chrome: All functionality working
- [ ] Firefox: All functionality working
- [ ] Safari: All functionality working (if applicable)

**Documentation**:
- [ ] JSDoc comments on all exported functions
- [ ] Usage examples in hook file
- [ ] Task file updated with completion status
- [ ] Commit message describes changes clearly

---

## Implementation Notes

### Key Decisions

1. **Phased Approach**: Utilities first, then hook, then refactor
   - Rationale: Reduces risk, easier to test incrementally

2. **No Logic Changes**: Copy exact implementation
   - Rationale: Refactor is about structure, not behavior

3. **Keep `parseMentionsAndCreatePills` Local**: Only in MessageEditTextarea
   - Rationale: Edit-specific with double-validation security, not shared

4. **Pure Functions Separate**: Not in hook
   - Rationale: Testability, bundle size, platform-agnostic

### Code Preservation

**CRITICAL**: Preserve these exact implementations:

1. **DOM Walking Algorithm** in `insertPill()`:
   - Two-phase: clone before mention → insert pill → clone after mention
   - Handles text nodes and element nodes separately
   - Character counting for position tracking
   - **DO NOT MODIFY** - battle-tested and working

2. **Storage Format Conversion**:
   - Roles: `@roleTag` (no brackets)
   - Everyone: `@everyone`
   - Users: `@<address>`
   - Channels: `#<channelId>`
   - **DO NOT CHANGE** - matches existing message storage

3. **Cursor Position Algorithm**:
   - Uses Selection API and Range API
   - `preCaretRange.toString().length` for character offset
   - **DO NOT MODIFY** - works correctly

---

## Timeline Estimate

**Total Effort**: 4-6 hours

**Breakdown**:
- Step 1 (Utilities): 1-2 hours
- Step 2 (Hook with event delegation): 1-2 hours
- Step 3 (MessageComposer refactor): 0.5-1 hour
- Step 4 (MessageEditTextarea refactor): 0.5-1 hour
- Step 5 (Manual testing & verification): 1-2 hours

**Recommendation**: Complete in one sitting to minimize context switching.

---

## Testing Strategy

**Approach**: Manual testing only

**Rationale**:
- This is a **refactoring task** (moving code, not changing logic)
- Code is already battle-tested and working in production
- Feature flag (`ENABLE_MENTION_PILLS`) allows instant rollback
- Setting up JSDOM/React Testing Library for DOM manipulation is time-consuming
- Manual testing will catch any regressions immediately

**Manual Test Cases** (see Acceptance Checklist):
- Create messages with all 4 mention types
- Edit messages with existing mentions
- Verify pill click-to-remove (event delegation)
- Verify storage format preservation
- Cross-browser testing (Chrome, Firefox, Safari)
- Security verification (clipboard, storage)

**Future Testing** (if needed):
- If bugs are found after refactor, add targeted tests
- Automated tests can be added later for new features built on this foundation

---

*Last updated: 2026-01-09*
*Status: Planning complete, awaiting implementation*
