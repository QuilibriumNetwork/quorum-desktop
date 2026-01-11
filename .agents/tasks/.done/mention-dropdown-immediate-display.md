---
type: task
title: "Improve Mention Dropdown UX - Show Immediately on @ or #"
status: done
complexity: low
ai_generated: true
reviewed_by: feature-analyzer
created: 2026-01-11
updated: 2026-01-11
---

# Improve Mention Dropdown UX - Show Immediately on @ or #

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Files**:
- `src/hooks/business/mentions/useMentionInput.ts:50-312`

## What & Why

Currently, the mention dropdown requires 3+ characters after `@` before showing user suggestions, creating poor UX. Users expect immediate feedback when typing `@` (like Discord/Slack). This implements tiered display: Tier 1 (just `@`) shows alphabetical users, Tier 2 (1-2 chars) shows @everyone/roles/users that match, Tier 3 (3+ chars) remains unchanged.

## Context

- **Existing pattern**: `useMentionInput` already handles mention detection and filtering (`useMentionInput.ts:257-312`)
- **Constraints**:
  - DMs do NOT have mentions - this only applies to Space channels
  - Performance concern with large user lists (spaces can have thousands of users)
  - Must not break existing behavior for Tier 3 (3+ chars)

## Design Decisions (from feature analysis)

1. **Tiered filtering logic**: Keep `minQueryLength = 3` default but implement explicit tier handling in `filterMentions` for clarity
2. **Tier 1 suggestions**: Use alphabetical members (first 10) - simple, no message scanning overhead
3. **Type safety**: Use shared `User` interface from `useMentionInput.ts` across all files

### Future Enhancements (deferred for performance)
- **Option A**: Compute "recently active users" from messageList in a memo - recomputes on every new message
- **Option B**: Compute "recently active users" only when dropdown opens - adds slight delay but zero cost when not mentioning

---

## Implementation

### Phase 1: Update useMentionInput Logic

- [x] **Update filterMentions with explicit tier logic** (`src/hooks/business/mentions/useMentionInput.ts:229-255`)
    - Done when: Tiered filtering works as specified
    - Verify: Type `@` → Tier 1; Type `@j` → Tier 2; Type `@john` → Tier 3
    ```typescript
    // In filterMentions - explicit tier handling (keep minQueryLength = 3 default)
    if (mentionType === '@') {
      if (!query || query.length === 0) {
        // TIER 1: Empty query - show alphabetical users (first 10)
        options = [...users]
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
          .slice(0, 10)
          .map(u => ({ type: 'user' as const, data: u }));
      } else if (query.length < 3) {
        // TIER 2: 1-2 chars - show @everyone + roles + users (bypass minQueryLength)
        const everyoneMatches = checkEveryoneMatch(query);
        const filteredRoles = filterRolesForTier2(query);
        const filteredUsers = filterUsersForTier2(query);
        options = [
          ...(everyoneMatches ? [{ type: 'everyone' as const }] : []),
          ...filteredRoles.map(r => ({ type: 'role' as const, data: r })),
          ...filteredUsers.map(u => ({ type: 'user' as const, data: u })),
        ];
      } else {
        // TIER 3: 3+ chars - existing full search behavior
        const everyoneMatches = checkEveryoneMatch(query);
        const filteredRoles = filterRoles(query);
        const filteredUsers = filterUsers(query);
        options = [
          ...(everyoneMatches ? [{ type: 'everyone' as const }] : []),
          ...filteredUsers.map(u => ({ type: 'user' as const, data: u })),
          ...filteredRoles.map(r => ({ type: 'role' as const, data: r })),
        ];
      }
    }
    ```

- [x] **Add Tier 2 filter helpers** (`src/hooks/business/mentions/useMentionInput.ts:70-141`)
    - Done when: `filterUsersForTier2` and `filterRolesForTier2` work with 1+ char queries
    - Verify: Type `@j` → shows users/roles starting with "j"
    - Note: These bypass `minQueryLength` check but use same filtering/sorting logic
    ```typescript
    // Add after existing filterUsers/filterRoles:
    const filterUsersForTier2 = useCallback((query: string): User[] => {
      if (!query) return [];
      const queryLower = query.toLowerCase();
      return users
        .filter(user => {
          const name = user.displayName?.toLowerCase() || '';
          const addr = user.address.toLowerCase();
          return name.includes(queryLower) || addr.includes(queryLower);
        })
        .sort((a, b) => /* same relevance sorting */)
        .slice(0, maxDisplayResults);
    }, [users, maxDisplayResults]);

    // Same pattern for filterRolesForTier2
    ```

### Phase 2: Channel Mention Filtering

- [x] **Verify filterChannelGroups filters correctly** (`src/hooks/business/mentions/useMentionInput.ts:143-213`)
    - Done when: `#gen` only shows channels containing "gen", empty groups hidden
    - Verify: Type `#` → all channels; type `#gen` → only matching channels
    - Note: Logic already exists (line 155-159), verify groups with no matches are excluded

---

## Verification

- **Tier 1 works**: Type `@` → dropdown appears immediately with alphabetical users (max 10)

- **Tier 2 works**: Type `@e` → shows @everyone + matching roles + matching users

- **Tier 3 unchanged**: Type `@john` → same behavior as before (full search)

- **Channel filtering works**: Type `#` → all channels; type `#gen` → only matching channels

- **MessageEditTextarea works**: Edit a message → same mention behavior

- **DMs unaffected**: Open a DM conversation → type `@` → dropdown does NOT appear

- **TypeScript compiles**: Run `npx tsc --noEmit`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| Empty users list | Show empty dropdown | Already handled | P0 | Low |
| Large user list (1000+) | Performance OK due to result capping (10 for Tier 1, 50 for Tier 2/3) | Already works | P0 | Low |
| DM conversations | No mentions at all - not applicable | Already works | P0 | None |

---

## Definition of Done

- [x] All Phase 1-2 checkboxes complete
- [x] TypeScript compiles: `npx tsc --noEmit` passes
- [x] All verification tests pass
- [x] No console errors or warnings
- [x] Performance acceptable (dropdown appears < 100ms)

---

## Implementation Notes

- Added `sortByRelevance` helper to reduce code duplication
- Added `filterUsersForTier2` and `filterRolesForTier2` that bypass `minQueryLength` check
- Updated `filterMentions` with explicit tier logic:
  - Tier 1: Sorts `users` alphabetically, takes first 10
  - Tier 2: Uses new Tier2 helpers with 1+ char queries
  - Tier 3: Unchanged (existing behavior)
- Channel filtering (`#`) already worked correctly - groups with no matches are excluded
- Removed unused `useMemo` import

---

## Updates

**2026-01-11 - Claude**: Initial task creation from plan discussion
**2026-01-11 - Claude**: Updated with feature-analyzer recommendations
**2026-01-11 - Claude**: Simplified to Option C (alphabetical members for Tier 1) to avoid performance overhead of scanning messageList. Added future enhancement notes for Option A/B.
**2026-01-11 - Claude**: Implementation complete. All changes in `useMentionInput.ts`.
**2026-01-11 - Claude**: Task completed, moved to .done folder.
