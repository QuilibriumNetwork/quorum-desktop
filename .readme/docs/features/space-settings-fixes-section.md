# Space Settings Modal - Fixes Section

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The **Fixes** section in the Space Settings Modal provides automated repair tools for space-related data inconsistencies and legacy issues. This section appears at the bottom of the General tab, after the Privacy Settings section.

## Location

**Path:** Space Settings Modal → General Tab → Fixes Section (bottom)

**Component:** `src/components/modals/SpaceSettingsModal/General.tsx` (lines 231-256)

## Architecture

### Conditional Display

The Fixes section is only visible when there are active fixes available:

```tsx
{fixes && fixes.length > 0 && (
  // Fixes section rendered here
)}
```

### Fix Structure

Each fix in the array follows this interface:

```typescript
{
  id: string;              // Unique identifier for the fix
  message: string;         // Description of what the fix does
  actionLabel: string;     // Button text (e.g., "Fix", "Sync Kick Status")
  onFix: () => void;      // Function to execute the fix
  loading?: boolean;       // Loading state while fix is running
}
```

## Available Fixes

### 1. Owner Membership Fix

**ID:** `owner-membership`

**When it appears:** Only when the space owner is not properly listed in the Space Members database.

**What it does:**
- Checks if the current user (space owner) exists in the `space_members` table
- Verifies the owner has an `inbox_address` set
- If missing or incomplete, adds/updates the owner's record with:
  - User address
  - Display name
  - Profile picture URL
  - Inbox address

**Why it exists:**
- Fixes legacy data where owners were not automatically added to members
- Ensures owner appears in member lists and has proper permissions
- Required for certain space operations that check member status

**Code location:** `SpaceSettingsModal.tsx:86-123`

**Behavior:**
- ✅ **Conditional** - Only shows when the check detects missing/incomplete owner record
- ✅ **One-time** - Disappears after successful fix (until the condition occurs again)
- ✅ **Database-driven** - Rechecks on every modal open

---

### 2. Sync Kick Status Fix

**ID:** `sync-kicked`

**When it appears:** Always available for every space.

**What it does:**
1. Scans all space messages for `kick` and `join` events
2. Chronologically sorts them by creation date
3. Tracks the last event (kick or join) for each user
4. Identifies users whose last event was a `kick`
5. Broadcasts a `verify-kicked` control message to all space members
6. Members receive the message and update their local database to mark users as `isKicked: true`

**Why it exists:**
- **Offline members problem:** When a user is kicked, only online members receive the kick message
- **Sync inconsistency:** Offline members never learn about the kick, causing their local database to be out of sync
- **Verification tool:** Allows space owners to re-broadcast kick status to all members
- **Harmless operation:** Safe to run multiple times, doesn't create visible messages in channels

**Technical flow:**

```
Owner clicks "Sync Kick Status"
  ↓
SyncService.sendVerifyKickedStatuses(spaceId)
  ↓
Scans message history for kicks/joins
  ↓
Identifies currently kicked users (last event = kick)
  ↓
Sends control message: { type: 'verify-kicked', addresses: [...] }
  ↓
All space members receive the message
  ↓
Members update their local DB: isKicked = true for each address
  ↓
Success toast: "Updated records for X users that have been kicked"
  ↓
Toast auto-closes after 5 seconds
```

**Code locations:**
- Handler: `SpaceSettingsModal.tsx:41-63`
- Service: `src/services/SyncService.ts:417-455`
- Receiver: `src/services/MessageService.ts:1865-1892`

**Behavior:**
- ✅ **Always visible** - Available as an on-demand utility tool
- ✅ **Repeatable** - Can be run multiple times (useful when new kicks happen)
- ✅ **No persistence** - Does not track whether it's been run before
- ✅ **Silent operation** - Does not post visible messages in channels
- ✅ **Returns count** - Shows how many kicked users were found

---

## UI/UX Details

### Visual Design

```
┌──────────────────────────────────────────────────────────────┐
│ Fixes                                                         │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐   │
│ │ You're not listed in this Space's members.            │ Fix│
│ │ Correcting this will add you to the Space Members...  │   │
│ └────────────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Sync kick status for previously kicked users.         │Sync│
│ │ This verifies kicks without posting visible messages. │Kick│
│ └────────────────────────────────────────────────────────┘Status│
└──────────────────────────────────────────────────────────────┘
```

### Styling Classes

- Container: `flex flex-col gap-2`
- Fix item: `flex items-start justify-between gap-3 p-3 rounded-md border`
- Message: `text-sm` with `lineHeight: 1.3`
- Button: `type="secondary" size="small" className="whitespace-nowrap"`

### Loading States

When a fix is running:
- Button becomes disabled
- Button text changes to "Fixing..." (or fix-specific loading text)
- `loading` prop controls this state

### Success Feedback

The kick sync fix shows a success toast notification:
- **Message:** "Updated records for X users that have been kicked."
- **Variant:** `success` (green)
- **Position:** Bottom-right corner
- **Auto-close:** 5 seconds
- **Dismissible:** Yes (X button)

**Implementation:** `src/components/Layout.tsx:119-127`

---

## Adding New Fixes

To add a new fix to this section:

### 1. Create the fix logic in SpaceSettingsModal.tsx

```typescript
// State for tracking fix status (if needed)
const [fixLoading, setFixLoading] = React.useState<boolean>(false);
const [fixNeeded, setFixNeeded] = React.useState<boolean>(false);

// Check if fix is needed (in useEffect)
React.useEffect(() => {
  (async () => {
    // Check condition
    const needsFix = await checkIfFixNeeded();
    setFixNeeded(needsFix);
  })();
}, [dependencies]);

// Handler function
const handleNewFix = React.useCallback(async () => {
  setFixLoading(true);
  try {
    await performFix();
    setFixNeeded(false); // If one-time fix
    // Optionally show toast
  } finally {
    setFixLoading(false);
  }
}, [dependencies]);
```

### 2. Add to the fixes array

```typescript
fixes={(existingFixes).concat(fixNeeded ? [{
  id: 'new-fix-id',
  message: t`Description of what this fix does`,
  actionLabel: t`Fix It`,
  onFix: handleNewFix,
  loading: fixLoading,
}] : [])}
```

### 3. Choose the behavior pattern

**Pattern A: Conditional (like owner-membership)**
- Shows only when a specific condition is met
- Disappears after successful fix
- Rechecks condition on modal open

**Pattern B: Always Available (like sync-kicked)**
- Always visible as a utility tool
- Can be run multiple times
- No persistence between sessions

---

## Best Practices

### When to Add a Fix

✅ **Good use cases:**
- One-time migrations for legacy data
- Repair tools for known sync issues
- Database consistency checks that can be automated
- Operations that are safe to run multiple times

❌ **Avoid using for:**
- Regular user actions (use normal UI instead)
- Destructive operations (use confirmation modals)
- Operations that should be automatic (fix the root cause)

### Fix Design Guidelines

1. **Clear messaging:** Explain what the fix does and why it's needed
2. **Loading states:** Always show when a fix is running
3. **Feedback:** Show success/error messages after completion
4. **Idempotent:** Safe to run multiple times without side effects
5. **Fast execution:** Fixes should complete quickly (< 5 seconds)
6. **Error handling:** Gracefully handle failures, show error messages

### Toast Notifications

Use the global toast system for feedback:

```typescript
if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
  (window as any).dispatchEvent(
    new CustomEvent('quorum:toast', {
      detail: {
        message: t`Your success message here`,
        variant: 'success', // or 'info', 'warning', 'error'
      },
    })
  );
}
```

Toasts automatically:
- Auto-close after 5 seconds
- Show dismissible X button
- Display at bottom-right corner
- Use appropriate color for variant

---

## Related Documentation

- [Space Settings Modal](./modals.md) - Overall modal architecture
- [Kick User System](./kick-user-system.md) - Details on kick functionality
- [Modal System](./modals.md) - General modal patterns

---

## Testing

### Manual Testing

**Owner Membership Fix:**
1. Join a space as owner
2. Manually delete your record from `space_members` table (dev tools)
3. Open Space Settings → General
4. Verify fix appears
5. Click "Fix"
6. Verify fix disappears
7. Check database for your member record

**Sync Kick Status Fix:**
1. Create a space with multiple members
2. Kick a user
3. Open Space Settings → General
4. Verify "Sync Kick Status" fix is always visible
5. Click the fix button
6. Verify success toast shows with kicked user count
7. Verify toast auto-closes after 5 seconds
8. Close and reopen modal
9. Verify fix is still visible (always available)

---

## Troubleshooting

### Fix Not Appearing

**Owner Membership:**
- Check if `missingOwnerMembership` state is `true`
- Verify the database check in `useEffect` (line 92-104)
- Check `inbox_address` is properly set

**Sync Kick Status:**
- Should always appear - if not, check the fixes array concat logic

### Fix Not Working

1. Check browser console for errors
2. Verify network requests are succeeding
3. Check if loading state is stuck (set to `false` in finally block)
4. Verify the fix handler is being called
5. Check toast notification system is working

### Toast Not Showing

- Verify `quorum:toast` event is dispatched
- Check `Layout.tsx` is properly listening for events
- Ensure `Callout` component is imported and working
- Check z-index issues (should be `2147483647`)

---

_Created: 2025-10-05 by Claude Code_
