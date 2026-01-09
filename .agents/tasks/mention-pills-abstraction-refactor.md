---
type: task
title: Mention Pills Code Abstraction & Refactoring
related_feature: mention-pills-in-message-textarea
priority: high
status: planned
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Mention Pills Code Abstraction & Refactoring

> **Purpose**: Extract duplicated mention pill logic from MessageComposer and MessageEditTextarea into shared utilities and hooks for better maintainability and mobile implementation readiness.
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
- **Phase 3**: Mobile implementation (React Native)
  - Need to share business logic between web and native
  - Platform-specific UI rendering
- **Bug fixes**: Currently must fix bugs in 2 places (soon to be 3+)
- **Testing**: Harder to unit test duplicated logic

### Why Abstraction Now?

1. **Rule of Three Met**: 2 implementations exist, 3rd (mobile) planned
2. **High Duplication**: ~270 lines of identical logic
3. **Stable Code**: Implementation working and tested
4. **Mobile Readiness**: Hook pattern enables platform-agnostic logic
5. **Maintainability**: Single source of truth for bug fixes

## Issues Found in Current Implementation

### Issue 1: Inconsistent Return Type in `getCursorPosition` ⚠️

**Location**: MessageComposer.tsx line 464

**Current**:
```typescript
const getCursorPosition = useCallback(() => { // ❌ Missing return type
```

**Should Be**:
```typescript
const getCursorPosition = useCallback((): number => { // ✅ Explicit return type
```

**Why**: MessageEditTextarea already has explicit return type (line 107). Consistency matters.

**Fix**: Add `: number` return type annotation.

---

### Issue 2: Inconsistent Variable Declaration in `insertPill` ⚠️

**Location**: MessageComposer.tsx line 337

**Current**:
```typescript
let skipUntil = mentionEnd; // ❌ 'let' used (variable never reassigned)
```

**Should Be**:
```typescript
const skipUntil = mentionEnd; // ✅ 'const' used (ESLint fix applied in MessageEditTextarea)
```

**Why**: MessageEditTextarea fixed this per ESLint (line 411). Variable is never reassigned.

**Fix**: Change `let` to `const`.

---

### Issue 3: Click Handler Memory Leak Risk ⚠️

**Location**: Both MessageComposer and MessageEditTextarea `insertPill` functions

**Current**:
```typescript
pillSpan.addEventListener('click', () => {
  pillSpan.remove();
  // ...
});
```

**Issue**: If pill removed via other means (e.g., backspace, keyboard delete), event listener not explicitly removed.

**Risk**: Low (most browsers auto-cleanup when element removed from DOM), but not guaranteed.

**Fix Options**:
1. **Option A (Low Priority)**: Document that browser handles cleanup (current behavior acceptable)
2. **Option B (Future Enhancement)**: Use event delegation on parent contentEditable
3. **Option C (Best Practice)**: Store listener reference and remove on pill removal

**Recommendation**: Document in code comments (Option A). Address in future optimization if needed.

---

### Issue 4: Duplicate CSS Class Mapping

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

**Why Separate from Hooks?**
- Pure functions easier to test (no React dependencies)
- Can be used outside React context (e.g., Web Workers, if needed)
- Better tree-shaking (smaller bundle)
- Clear separation of concerns

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

**Why a Hook?**
- Encapsulates stateful logic (refs, callbacks)
- Can be reused across web components
- Clean separation from UI rendering
- Easy to test with React Testing Library
- **Mobile Ready**: Hook can be used with platform-specific rendering

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

### Step 1: Create Pure Utility Functions ✅

**File**: `src/utils/mentionPillDom.ts`

**Tasks**:
- [x] Create file structure
- [x] Define TypeScript types (`MentionPillType`, `PillData`)
- [x] Extract `MENTION_PILL_CLASSES` constant
- [x] Implement `createPillElement()`
- [x] Implement `extractPillDataFromOption()`
- [x] Implement `extractStorageTextFromEditor()`
- [x] Implement `getCursorPositionInElement()`
- [x] Add JSDoc comments for each function
- [x] Export all functions and types

**Testing**:
- [ ] Unit tests for each pure function
- [ ] Edge cases: empty editor, only pills, only text, mixed content

---

### Step 2: Create React Hook ✅

**File**: `src/hooks/business/mentions/useMentionPillEditor.ts`

**Tasks**:
- [x] Create file structure
- [x] Define hook options interface
- [x] Define hook return interface
- [x] Implement `useMentionPillEditor` hook
  - [x] `editorRef` with `useRef`
  - [x] `extractVisualText()` with `useCallback`
  - [x] `extractStorageText()` with `useCallback`
  - [x] `getCursorPosition()` with `useCallback`
  - [x] `insertPill()` with `useCallback` (DOM walking algorithm)
- [x] Import utility functions from Phase 1
- [x] Add JSDoc comments and usage examples

**Testing**:
- [ ] React Testing Library tests
- [ ] Test hook with mock editor ref
- [ ] Test `insertPill` with various scenarios

---

### Step 3: Refactor MessageComposer ✅

**File**: `src/components/message/MessageComposer.tsx`

**Tasks**:
- [x] Import `useMentionPillEditor` hook
- [x] Replace local `editorRef` with hook's `editorRef`
- [x] Remove duplicate functions:
  - [x] `extractVisualText()`
  - [x] `extractTextFromEditor()`
  - [x] `getCursorPosition()`
  - [x] `insertPill()`
- [x] Update all function calls to use hook functions
- [x] Verify contentEditable ref usage
- [x] Fix Issue #1: Add return type to `getCursorPosition`
- [x] Fix Issue #2: Change `let skipUntil` to `const`

**Testing**:
- [ ] Manual testing: Create messages with mentions
- [ ] Verify all 4 mention types work (users, roles, channels, @everyone)
- [ ] Verify pill insertion, deletion, cursor navigation
- [ ] Verify storage format preservation

---

### Step 4: Refactor MessageEditTextarea ✅

**File**: `src/components/message/MessageEditTextarea.tsx`

**Tasks**:
- [x] Import `useMentionPillEditor` hook
- [x] Replace local `editorRef` with hook's `editorRef`
- [x] Remove duplicate functions (same as MessageComposer)
- [x] Update all function calls to use hook functions
- [x] Keep `parseMentionsAndCreatePills()` (edit-specific, with double validation)
- [x] Verify initialization logic with pills on mount

**Testing**:
- [ ] Manual testing: Edit messages with mentions
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

- [x] **Zero Duplication**: No duplicated pill logic between components
- [x] **Type Safety**: All functions properly typed with TypeScript
- [x] **Pure Functions**: Utilities have no side effects (testable)
- [x] **Hook Pattern**: Follows React best practices
- [ ] **Tests**: Unit tests for utilities, integration tests for hook

### Functionality

- [ ] **MessageComposer Works**: All pill features function identically
- [ ] **MessageEditTextarea Works**: All edit features function identically
- [ ] **Storage Format Preserved**: `@<address>`, `#<channelId>`, etc.
- [ ] **Security Maintained**: Double-validation still enforced (MessageEditTextarea)

### Performance

- [ ] **Bundle Size**: Measure with webpack-bundle-analyzer
  - Target: Net reduction due to code deduplication
- [ ] **Runtime Performance**: No regressions in typing latency or pill insertion
- [ ] **Memory**: No memory leaks from event handlers

### Maintainability

- [x] **Single Source of Truth**: One implementation of pill logic
- [ ] **Easy to Test**: Utilities testable without React
- [x] **Mobile Ready**: Hook can be reused with native rendering
- [x] **Documentation**: Clear JSDoc and usage examples

---

## Risks & Mitigation

### Risk 1: Regression in Existing Functionality

**Risk**: Refactoring breaks working pill features

**Mitigation**:
1. ✅ Copy exact implementation (no logic changes)
2. ⏳ Thorough manual testing before commit
3. ✅ Feature flag allows instant rollback
4. ⏳ Test both components after each refactor step

### Risk 2: Mobile Implementation Incompatibility

**Risk**: Hook pattern doesn't work well for React Native

**Mitigation**:
1. ✅ Pure functions work on any platform
2. ✅ Hook only depends on DOM APIs (can be abstracted)
3. ✅ Mobile can use utilities directly if hook doesn't fit

### Risk 3: Performance Regression

**Risk**: Extra function calls slow down typing

**Mitigation**:
1. ✅ All hook functions use `useCallback` (same as before)
2. ✅ No additional re-renders introduced
3. ⏳ Performance testing before/after

---

## Future Enhancements (Out of Scope)

These are **not** part of this task, but could be future improvements:

1. **Event Delegation** (Issue #3 enhancement)
   - Use parent contentEditable event listener instead of per-pill listeners
   - Reduces memory overhead for many pills

2. **Cursor Position Setter**
   - Implement `setCursorPositionInElement()` utility
   - Currently components handle this themselves

3. **Mobile Hook Variant**
   - `useMentionPillEditorNative.ts` for React Native
   - Uses same utilities, platform-specific rendering

4. **Advanced Paste Behavior**
   - Parse mentions from pasted text (currently paste as plain text)

5. **Performance Optimization**
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
- [ ] All TypeScript compilation errors resolved
- [ ] All ESLint warnings resolved
- [ ] No console warnings in browser
- [ ] Code follows existing patterns and conventions

**Functionality**:
- [ ] MessageComposer: Create message with each mention type
- [ ] MessageComposer: Insert multiple mentions in one message
- [ ] MessageComposer: Delete pills with backspace
- [ ] MessageComposer: Click pills to remove
- [ ] MessageEditTextarea: Edit message with existing mentions
- [ ] MessageEditTextarea: Add new mentions while editing
- [ ] MessageEditTextarea: Save preserves storage format
- [ ] Feature flag disabled: Textarea fallback works

**Testing**:
- [ ] Manual testing on Chrome
- [ ] Manual testing on Firefox
- [ ] Manual testing on Safari
- [ ] No regressions in existing functionality
- [ ] Performance comparable to pre-refactor

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

**Total Effort**: 4-6 hours (1 day)

**Breakdown**:
- Step 1 (Utilities): 1-2 hours
- Step 2 (Hook): 1-2 hours
- Step 3 (MessageComposer refactor): 0.5-1 hour
- Step 4 (MessageEditTextarea refactor): 0.5-1 hour
- Step 5 (Verification & Testing): 1-2 hours

**Recommendation**: Complete in one sitting to minimize context switching.

---

*Last updated: 2026-01-09 (Task created - Abstraction planning complete)*
