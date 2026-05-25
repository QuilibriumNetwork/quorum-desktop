---
type: bug
title: "Mention Dropdown Not Showing When Typing Just @ or #"
status: done
priority: medium
ai_generated: true
reviewed_by: null
created: 2026-01-11
updated: 2026-01-11
---

# Bug: Mention Dropdown Not Showing When Typing Just `@` or `#`

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

The mention dropdown does not appear when typing just `@` or `#` (empty query), even though the hook correctly returns `showDropdown: true` with valid options.

**Expected behavior**: Dropdown should appear immediately when typing `@` showing alphabetical users (Tier 1).

**Actual behavior**: Dropdown does not appear. However, if you type `@a` (dropdown shows), then delete `a`, the dropdown remains visible for just `@`.

## Root Cause

The issue was related to a race condition between state updates in the filtering logic. When typing just `@`:
1. The `showDropdown` state was being set correctly
2. But `filteredOptions` wasn't being populated synchronously for empty queries
3. The return statement `showDropdown && filteredOptions.length > 0` would return `false` on first render

The key insight was that the filtering for empty queries needed to happen immediately, not through the debounced path.

## Solution

Fixed by implementing tiered filtering in `useMentionInput.ts` that handles empty queries synchronously:

1. **Added `sortByRelevance` helper** - Centralized sorting logic for consistent behavior
2. **Added `filterUsersForTier2` and `filterRolesForTier2`** - Bypass `minQueryLength` for short queries
3. **Updated `filterMentions` with explicit tier logic**:
   - Tier 1 (empty query): Immediately returns alphabetical users (first 10)
   - Tier 2 (1-2 chars): Shows @everyone + matching roles + matching users
   - Tier 3 (3+ chars): Existing full search behavior

Key change in `useMentionInput.ts`:
```typescript
const filterMentions = useCallback((query: string, mentionType: '@' | '#' = '@') => {
  if (mentionType === '#') {
    options = filterChannelGroups(query);
  } else {
    if (!query || query.length === 0) {
      // TIER 1: Empty query - show alphabetical users (first 10)
      const alphabeticalUsers = sortByRelevance(users, '', u => u.displayName || '');
      options = alphabeticalUsers
        .slice(0, 10)
        .map(u => ({ type: 'user' as const, data: u }));
    } else if (query.length < minQueryLength) {
      // TIER 2: 1-2 chars
      // ...
    } else {
      // TIER 3: 3+ chars
      // ...
    }
  }
  setFilteredOptions(options);
  // ...
}, [/* dependencies */]);
```

## Prevention

- When implementing dropdown/autocomplete features, ensure that the filtering logic handles empty queries explicitly
- Avoid relying on debounced updates for immediate visual feedback
- Test the "just typed trigger character" case (`@`, `#`, `/`) separately from "typed trigger + characters"

---

## Debug Findings (Historical)

### Hook State was Correct

Console logs added to `useMentionInput.ts` showed:

```
[useMentionInput] useEffect triggered { textValue: '@', cursorPosition: 1, usersCount: 4 }
[useMentionInput] Detection result { mentionPosition: 0, mentionChar: '@' }
[useMentionInput] Valid mention detected { query: '', mentionChar: '@' }
[useMentionInput] Empty query - calling filterMentions immediately
[useMentionInput] filterMentions called { query: '', mentionType: '@', usersCount: 4 }
[useMentionInput] Setting filteredOptions { optionsCount: 4, options: [...] }
[useMentionInput] Return values { showDropdown: true, filteredOptionsLength: 4, finalShowDropdown: true }
```

### Key Observation

> "if I type @a, then the dropdown shows, if I go back and delete 'a' and leave only @, the dropdown still shows"

This confirmed:
- The dropdown CAN render for empty query (just `@`)
- Something about the INITIAL `@` keystroke was different from the delete-to-`@` case
- The fix needed to ensure filtering happens synchronously on the initial keystroke

---

## Updates

**2026-01-11 - Claude**: Initial bug report created after failed fix attempt.
**2026-01-11 - Claude**: Bug resolved by implementing tiered filtering in `useMentionInput.ts`. Moved to .solved folder.
