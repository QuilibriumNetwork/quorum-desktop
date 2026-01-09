---
type: doc
title: Mention Pills UI System
status: done
ai_generated: true
reviewed_by: null
created: 2026-01-09T09:00:00.000Z
updated: 2026-01-09T09:00:00.000Z
related_docs: ["mention-notification-system.md"]
related_tasks: [".done/mention-pills-in-message-textarea.md", ".done/mention-pills-abstraction-refactor.md"]
---

# Mention Pills UI System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The Mention Pills UI system provides a Discord/Slack-style visual experience during message composition, showing readable mention pills (like `@John Doe`, `#general-discussion`) instead of raw IDs (`@<QmAbc123...>`, `#<ch-def456>`) in the composer. This enhances the user experience while maintaining the robust ID-based storage system underneath.

**Key Benefits**:
- **Visual Clarity**: Users see readable names while typing, eliminating confusion with cryptic IDs
- **Technical Robustness**: Maintains rename-safe ID storage with zero breaking changes
- **Lightweight**: Custom solution (~2KB) vs heavy rich text editors (~75-100KB)
- **Memory Safe**: Event delegation pattern prevents memory leaks in long-running Electron app

**Feature Flag**: `ENABLE_MENTION_PILLS` in `src/config/features.ts`
- When enabled: Uses contentEditable with visual pills
- When disabled: Falls back to standard textarea with text-based mentions

## Architecture

**Dual-Mode System**:
```
ENABLE_MENTION_PILLS = true:
    User types "@joh"
        ↓
    Autocomplete shows options
        ↓
    User selects "@John Doe"
        ↓
    Pill inserted in contentEditable: <span data-mention-type="user">@John Doe</span>
        ↓
    On save: extractStorageText() → "@<QmAbc123...>"
        ↓
    Stored in message with IDs

ENABLE_MENTION_PILLS = false:
    Standard textarea with text-based mentions (original behavior)
```

**Key Components**:
- `src/utils/mentionPillDom.ts` - Pure utility functions (184 lines)
- `src/hooks/business/mentions/useMentionPillEditor.ts` - React hook (305 lines)
- `src/components/message/MessageComposer.tsx` - New message composition
- `src/components/message/MessageEditTextarea.tsx` - Message editing

## Core Utilities (`mentionPillDom.ts`)

Pure utility functions with zero React dependencies for DOM manipulation:

**Constants**:
```typescript
export const MENTION_PILL_CLASSES = {
  user: 'message-mentions-user',
  role: 'message-mentions-role',
  channel: 'message-mentions-channel',
  everyone: 'message-mentions-everyone',
} as const;
```

**Key Functions**:

1. **`extractPillDataFromOption(option: MentionOption): PillData`**
   - Converts autocomplete option to pill data
   - Handles all 4 mention types (users, roles, channels, @everyone)

2. **`createPillElement(pillData: PillData, onClick?: () => void): HTMLSpanElement`**
   - Creates pill DOM element with proper CSS classes
   - Sets data attributes: `data-mention-type`, `data-mention-address`, `data-mention-display-name`
   - Marks as non-editable: `contentEditable="false"`
   - Optional click handler for removal (used with event delegation)

3. **`extractStorageTextFromEditor(editorElement: HTMLElement): string`**
   - Walks DOM tree and converts pills to storage format
   - Users: `@<address>`
   - Roles: `@roleTag` (no brackets)
   - Channels: `#<channelId>`
   - Everyone: `@everyone`

4. **`getCursorPositionInElement(editorElement: HTMLElement): number`**
   - Gets cursor position (character offset) in contentEditable
   - Uses Selection API and Range API

**Type Definitions**:
```typescript
export type MentionPillType = 'user' | 'role' | 'channel' | 'everyone';

export interface PillData {
  type: MentionPillType;
  displayName: string;
  address: string; // user address, roleTag, channelId, or 'everyone'
}
```

## React Hook (`useMentionPillEditor`)

Encapsulates all pill management logic for contentEditable editors.

**Hook Interface**:
```typescript
interface UseMentionPillEditorOptions {
  onTextChange: (text: string) => void; // Receives storage format text
}

interface UseMentionPillEditorReturn {
  editorRef: React.RefObject<HTMLDivElement>;
  extractVisualText: () => string;      // What user sees (for mention detection)
  extractStorageText: () => string;     // Storage format with IDs
  getCursorPosition: () => number;      // Character offset from start
  insertPill: (option: MentionOption, mentionStart: number, mentionEnd: number) => void;
}
```

**Usage Example**:
```typescript
const pillEditor = useMentionPillEditor({
  onTextChange: onChange,
});

const { editorRef, insertPill, extractVisualText, getCursorPosition } = pillEditor;

// In JSX:
<div
  ref={editorRef}
  contentEditable
  onInput={() => {
    const text = pillEditor.extractStorageText();
    onTextChange(text);
  }}
/>
```

**Key Features**:

1. **Event Delegation for Memory Safety**:
   - Single click listener on parent contentEditable element
   - Prevents memory leaks from per-pill listeners
   - Critical for long-running Electron app where users may compose hundreds of messages per session
   ```typescript
   useEffect(() => {
     const handlePillClick = (e: MouseEvent) => {
       const target = e.target as HTMLElement;
       if (target.dataset?.mentionType) {
         target.remove();
         const newText = extractStorageTextFromEditor(editorRef.current!);
         onTextChange(newText);
       }
     };

     editor.addEventListener('click', handlePillClick);
     return () => editor.removeEventListener('click', handlePillClick);
   }, [onTextChange]);
   ```

2. **Complex DOM Walking Algorithm** (battle-tested, ~190 lines):
   - Preserves existing pills while inserting new ones
   - Two-phase approach: clone content before mention → insert pill → clone content after mention
   - Handles text nodes and element nodes separately
   - Character-based position tracking to maintain cursor accuracy

3. **Automatic Cleanup**:
   - useEffect return function removes event listeners
   - Prevents memory leaks when component unmounts

## Integration in MessageComposer

**Before Refactoring** (~270 lines of duplicated code):
```typescript
const editorRef = useRef<HTMLDivElement>(null);
const extractVisualText = useCallback(() => { /* ... */ }, []);
const extractTextFromEditor = useCallback(() => { /* ... */ }, []);
const getCursorPosition = useCallback(() => { /* ... */ }, []);
const insertPill = useCallback((option, start, end) => { /* ... */ }, []);
```

**After Refactoring** (~10 lines):
```typescript
const pillEditor = useMentionPillEditor({
  onTextChange: onChange,
});

const { editorRef, extractVisualText, extractStorageText, getCursorPosition, insertPill } = pillEditor;
```

**Integration with Mention Autocomplete**:
```typescript
const handleMentionSelect = useCallback(
  (option: MentionOption, mentionStart: number, mentionEnd: number) => {
    if (ENABLE_MENTION_PILLS) {
      insertPill(option, mentionStart, mentionEnd); // Uses hook's insertPill
    } else {
      // Original text-based insertion for textarea
    }
  },
  [insertPill]
);
```

**Text Extraction**:
```typescript
const handleEditorInput = useCallback(() => {
  const newText = extractStorageText(); // Converts pills to IDs
  onChange(newText); // Parent receives storage format
  setCursorPosition(getCursorPosition()); // For autocomplete
}, [extractStorageText, onChange, getCursorPosition]);
```

## Integration in MessageEditTextarea

Similar integration to MessageComposer, with one key difference:

**Edit-Specific: Double Validation**:
- Keeps `parseMentionsAndCreatePills()` function (edit-specific with double validation)
- Layer 1: Lookup real display name from users/roles/channels
- Layer 2: Verify mention exists in `message.mentions` (prevents spoofing)
- Only creates pills if both validations pass

**Pill Creation on Edit**:
```typescript
useEffect(() => {
  if (ENABLE_MENTION_PILLS && editorRef.current && !initialized) {
    // Parse stored text and create pills with double validation
    const fragment = parseMentionsAndCreatePills(editText);
    editorRef.current.innerHTML = '';
    editorRef.current.appendChild(fragment);
    setInitialized(true);
  }
}, [editText, initialized, parseMentionsAndCreatePills]);
```

## Storage Format Conversion

Pills are converted to legacy storage format (ID-based) to maintain compatibility:

**User Mentions**:
- Visual: `@John Doe` (pill with `data-mention-address="QmAbc123..."`)
- Storage: `@<QmAbc123...>`

**Role Mentions**:
- Visual: `@moderators` (pill with `data-mention-address="moderators"`)
- Storage: `@moderators` (no brackets)

**Channel Mentions**:
- Visual: `#general-discussion` (pill with `data-mention-address="ch-def456"`)
- Storage: `#<ch-def456>`

**@everyone Mentions**:
- Visual: `@everyone` (pill with `data-mention-address="everyone"`)
- Storage: `@everyone`

**Extraction Process**:
```typescript
// extractStorageTextFromEditor walks DOM tree
if (el.dataset?.mentionType && el.dataset?.mentionAddress) {
  const prefix = el.dataset.mentionType === 'channel' ? '#' : '@';

  if (el.dataset.mentionType === 'role') {
    text += `@${el.dataset.mentionAddress}`; // @roleTag
  } else if (el.dataset.mentionType === 'everyone') {
    text += '@everyone';
  } else {
    text += `${prefix}<${el.dataset.mentionAddress}>`; // @<addr> or #<id>
  }
}
```

## Pill Styling

Pills use the same CSS classes as rendered mentions in Message.tsx for consistent appearance:

**CSS Classes** (defined in `MessageComposer.scss`):
- `.message-mentions-user` - Blue background, user mentions
- `.message-mentions-role` - Purple background, role mentions
- `.message-mentions-channel` - Green background, channel mentions
- `.message-mentions-everyone` - Orange/red background, @everyone mentions
- `.message-composer-pill` - Base pill styles (non-editable, inline-block, padding, border-radius)

**Pill Structure**:
```html
<span
  class="message-mentions-user message-composer-pill"
  contenteditable="false"
  data-mention-type="user"
  data-mention-address="QmAbc123..."
  data-mention-display-name="John Doe"
>
  @John Doe
</span>
```

## Code Refactoring History

The mention pills implementation went through two phases:

**Phase 1: Initial Implementation**
- Task: [mention-pills-in-message-textarea.md](../../tasks/.done/mention-pills-in-message-textarea.md)
- Implemented pills in both MessageComposer and MessageEditTextarea
- Result: ~270 lines of duplicated code across 2 components

**Phase 2: Code Abstraction**
- Task: [mention-pills-abstraction-refactor.md](../../tasks/.done/mention-pills-abstraction-refactor.md)
- Following "Rule of Three" principle, extracted shared utilities and hooks
- Created `mentionPillDom.ts` (pure functions) and `useMentionPillEditor.ts` (React hook)
- Refactored both components to use shared hook
- Fixed memory leak with event delegation pattern
- Net savings: ~270 lines of code eliminated

**Benefits of Refactoring**:
- Single source of truth for all pill logic
- Bug fixes only need to be made once
- Better testability (pure functions separated from React)
- Memory leak prevention
- Future components can reuse the same hook

## Performance Characteristics

**Memory Usage**:
- Event delegation: 1 listener per editor (not per pill)
- Pills removed from DOM are automatically garbage collected
- No memory leaks from orphaned event listeners

**DOM Operations**:
- Pill insertion: O(n) where n = number of existing nodes (preserves all content)
- Text extraction: O(n) where n = number of DOM nodes
- Cursor position: O(n) where n = number of characters before cursor

**Bundle Size**:
- Utilities: ~2KB (pure functions)
- Hook: ~3KB (React integration)
- Total: ~5KB for complete pill system (vs ~75-100KB for rich text editors)

## Known Limitations

1. **Web-Only Implementation**: Current implementation uses DOM APIs (contentEditable, Selection API)
   - Mobile will require separate implementation using React Native TextInput
   - Storage format remains the same (cross-platform compatible)

2. **Paste Behavior**: Pasting text with mentions doesn't auto-parse into pills
   - Future enhancement: Parse mentions from pasted text
   - Current: Paste inserts plain text, user can mention manually

3. **Markdown Toolbar**: Pills are non-editable, markdown formatting doesn't apply to pill content
   - Pills remain as-is when text is bolded/italicized around them
   - This is expected behavior (pills should maintain visual consistency)

## Related Documentation

- **Mention System**: [mention-notification-system.md](./mention-notification-system.md) - Notification system, autocomplete, extraction, rendering

- **Implementation Tasks**:
  - [mention-pills-in-message-textarea.md](../../tasks/.done/mention-pills-in-message-textarea.md) - Initial implementation
  - [mention-pills-abstraction-refactor.md](../../tasks/.done/mention-pills-abstraction-refactor.md) - Code refactoring

- **Research & Design**:
  - [mention-pills-research.md](../../reports/mention-pills-research.md) - Industry research, POC validation, technical insights

- **Related Systems**:
  - Mention autocomplete: `useMentionInput.ts` (autocomplete dropdown)
  - Mention extraction: `mentionUtils.ts` (parsing and validation)
  - Mention rendering: `Message.tsx` (display in message list)
