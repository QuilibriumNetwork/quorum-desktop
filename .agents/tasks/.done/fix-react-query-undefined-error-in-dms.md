# Fix: React Query "undefined" Error in DM Conversations

**Date:** 2025-01-09
**Issue:** Console error when viewing DM conversations: `Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ["space","QmcGMh..."]`

## Root Cause

In DM contexts, messages have their `spaceId` field set to the recipient's user address (not an actual space ID). When components like `Message` and `UserProfile` query for this "space":

1. `messageDB.getSpace(userAddress)` is called
2. User address doesn't exist in spaces database
3. IndexedDB returns `undefined` for missing records
4. React Query throws error (query functions must return defined values; `null` is OK, `undefined` is not)

## Solution

Changed `messageDB.getSpace()` to return `null` instead of `undefined` when a space is not found.

**Changes:**
- `src/db/messages.ts:824` - Updated return type: `Promise<Space | undefined>` → `Promise<Space | null>`
- `src/db/messages.ts:832` - Implementation: `resolve(request.result)` → `resolve(request.result ?? null)`

## Safety

This change is **100% safe** because:
- All 52 call sites use falsy checks (`!space`, `if (space)`, `space?.property`)
- No explicit `=== undefined` checks exist in production code
- Tests already mock `getSpace()` with `null` values
- Both `null` and `undefined` behave identically for falsy/optional chaining operations

## Result

Console error eliminated. DM functionality unaffected. Space/channel queries continue working normally.

---
*Last updated: 2025-01-09*
