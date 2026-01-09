---
type: task
title: 'Task: Improve User Mention System'
status: done
created: 2025-01-22T00:00:00.000Z
updated: '2026-01-09'
---

# Task: Improve User Mention System


**Priority**: High
**Category**: Feature Enhancement


## Overview

Improve the user mention system in MessageComposer to allow users to type `@displayname` instead of full user addresses. When typing `@`, a dropdown should appear showing filtered users (Avatar + DisplayName / truncated address). The system must handle duplicate displayNames by showing all matching users.

## Current State Analysis

### Current Implementation
- **Format**: Messages use `@<Qm...>` format (full user address)
- **User Experience**: Users must manually type or copy full addresses
- **Message Rendering**: Shows raw addresses in mentions
- **User Data Structure**:
  ```typescript
  {
    address: string,
    displayName?: string,
    userIcon?: string
  }
  ```
- **Key Challenge**: DisplayNames are not unique

### Files Involved
- `src/components/message/Message.tsx` - Message rendering with mentions
- `src/components/message/MessageComposer.tsx` - Message input component
- `src/hooks/business/messages/useMessageFormatting.ts` - Mention parsing (line 124)
- `src/components/message/MessageMarkdownRenderer.tsx` - Markdown message rendering
- `src/hooks/business/channels/useChannelData.ts` - User data access

## Proposed Solution

### 1. Mention Format Strategy

**Storage Format**: Always use standard `@<userAddress>` format
- Keep the existing format throughout the entire flow
- No conversion needed before sending
- Simpler implementation, less error-prone

**Visual Display Only**: Show displayName in UI
- When user selects from dropdown: insert `@<userAddress>` but visually show as styled mention
- During rendering: Parse `@<userAddress>` and display as displayName
- Fallback to truncated address if user not found

**User Experience**:
- Type `@` + start of displayName → dropdown appears
- Select user → inserts `@<userAddress>` in textarea
- Visual overlay or styling shows it as `@DisplayName` for better UX

### 2. Component Architecture

#### New Hook: `useMentionInput`
Location: `src/hooks/business/mentions/useMentionInput.ts`

```typescript
interface UseMentionInputOptions {
  textValue: string;
  cursorPosition: number;
  users: Array<{ address: string; displayName?: string; userIcon?: string }>;
  onMentionSelect: (user: User, mentionStart: number, mentionEnd: number) => void;
}

interface UseMentionInputReturn {
  showDropdown: boolean;
  dropdownPosition: { x: number; y: number };
  filteredUsers: User[];
  selectedIndex: number;
  mentionQuery: string;
  handleKeyDown: (e: KeyboardEvent) => void;
  selectUser: (user: User) => void;
}
```

Features:
- Detect `@` trigger followed by text
- Track cursor position for dropdown placement
- Filter and rank users by query match
- Handle keyboard navigation (↑↓ Enter Esc)
- Insert mention at correct position

#### Enhanced MessageComposer
Modifications to `src/components/message/MessageComposer.tsx`:

1. **State Management**:
   ```typescript
   const mentionInput = useMentionInput({
     textValue: value,
     cursorPosition: textareaRef.current?.selectionStart || 0,
     users: Object.values(members),
     onMentionSelect: handleMentionSelect
   });
   ```

2. **Mention Dropdown Integration**:
   - Use `Select` primitive with custom render for user list
   - Position above textarea
   - Custom option rendering with avatar + name + address (follow layout used in SpaceEditor line 1001)

3. **Text Processing**:
   - Store mentions as standard `@<address>` in textarea
   - Optionally: Add visual hint (e.g., highlight color) to distinguish mentions
   - Handle edge cases (multiple mentions, editing, deletion)

### 3. UI Implementation Using Primitives

#### Select Component Configuration
```typescript
<Select
  visible={mentionInput.showDropdown}
  options={mentionInput.filteredUsers.map(user => ({
    value: user.address,
    label: user.displayName || 'Unknown User',
    avatar: user.userIcon,
    subtitle: truncateAddress(user.address)
  }))}
  value={mentionInput.filteredUsers[mentionInput.selectedIndex]?.address}
  onChange={(address) => mentionInput.selectUser(getUserByAddress(address))}
  maxHeight={240}
  dropdownPlacement="bottom"
  renderSelectedValue={() => null} // Don't show selected value
  className="mention-dropdown"
/>
```

#### Custom Styling (Tailwind only, no SCSS)
```typescript
// Dropdown positioning
className="absolute z-[1000] shadow-lg border border-default rounded-lg bg-surface-0"

// User item styling
className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 cursor-pointer"

// Avatar styling
className="w-8 h-8 rounded-full bg-cover bg-center flex-shrink-0"

// Text styling
className="flex flex-col min-w-0"
className="text-sm font-medium text-main truncate" // displayName
className="text-xs text-subtle truncate" // address
```

### 4. Message Rendering Updates

#### Update `useMessageFormatting.ts`:
```typescript
// Enhanced mention processing
if (token.match(/^@<Qm[a-zA-Z0-9]+>$/)) {
  const userId = token.substring(2, token.length - 1);
  const user = mapSenderToUser(userId);
  return {
    type: 'mention',
    key: `${messageId}-${lineIndex}-${tokenIndex}`,
    displayName: user.displayName || truncateAddress(userId),
    address: userId,
    isCurrentUser: userId === currentUserAddress
  };
}
```

#### Update `MessageMarkdownRenderer.tsx`:
Add preprocessing to convert mentions before markdown processing:
```typescript
const preprocessMentions = (text: string): string => {
  return text.replace(/@<(Qm[a-zA-Z0-9]+)>/g, (match, address) => {
    const user = mapSenderToUser(address);
    return `@${user.displayName || truncateAddress(address)}`;
  });
};
```

### 5. Implementation Steps

1. **Create `useMentionInput` hook**
   - @ trigger detection with partial name matching
   - User filtering and ranking by displayName
   - Keyboard navigation handling
   - Insert `@<address>` on selection

2. **Update MessageComposer**
   - Integrate mention hook
   - Add Select-based dropdown
   - Handle mention selection (insert `@<address>`)
   - No format conversion needed (already in correct format)

3. **Update message rendering**
   - Modify `useMessageFormatting` for displayName resolution
   - Update `MessageMarkdownRenderer` preprocessing
   - Ensure backward compatibility

4. **Optional: Visual Enhancement in Composer**
   - Consider adding a visual hint for mentions in textarea
   - Could use a small chip/badge overlay or color highlighting
   - This is optional and can be added later

5. **Testing & Polish**
   - Test with duplicate displayNames
   - Test keyboard navigation
   - Test mobile touch interaction
   - Test with long user lists
   - Test mention editing/deletion

## Technical Considerations

### Performance
- Use React.memo for dropdown items
- Debounce user filtering (100ms)
- Limit dropdown to 10 results max
- Virtual scrolling not needed (Select handles it)

### Edge Cases
1. **Duplicate DisplayNames**: Show all matches with address differentiation
2. **Missing DisplayName**: Fall back to truncated address
3. **Multiple Mentions**: Handle multiple @mentions in same message
4. **Mention Editing**: When user edits `@<address>`, treat as regular text
5. **Cursor Position**: Maintain correct cursor position after insertion
6. **Markdown Conflicts**: Ensure mentions work with markdown formatting
7. **Partial Address Typing**: If user manually types `@<Qm...`, don't show dropdown

### Mobile Support
- Touch-friendly item heights (min 44px)
- Proper keyboard handling on mobile
- Dropdown positioning for small screens
- Use existing mobile patterns from Select primitive

## Success Criteria

1. ✅ Users can type `@` to trigger mention dropdown
2. ✅ Dropdown shows filtered users with avatar, name, and address
3. ✅ Keyboard navigation works (arrows, enter, escape)
4. ✅ Selected mentions show displayName in composer
5. ✅ Sent messages store standard `@<address>` format
6. ✅ Rendered messages show displayNames instead of addresses
7. ✅ Backward compatibility with existing mentions
8. ✅ Works with duplicate displayNames
9. ✅ Mobile/touch interaction works correctly
10. ✅ Performance remains smooth with large user lists

## Notes

- **Simplified Approach**: Keep `@<address>` format throughout, no intermediate format needed
- Using Select primitive provides built-in scrolling, positioning, and keyboard handling
- No need for custom SCSS - Tailwind classes sufficient for styling
- ScrollContainer not needed - Select has built-in scroll handling
- Virtual scrolling handled by Select for large lists
- Visual display of displayNames happens only in rendering, not in storage

## References

- Select primitive: `/src/components/primitives/Select/Select.web.tsx`
- Similar implementation: SpaceEditor conversation select (lines 894-920)
- User data hook: `/src/hooks/business/channels/useChannelData.ts`
- Current mention regex: `/src/hooks/business/messages/useMessageFormatting.ts:124`

---
*Last updated: 2025-01-22*
