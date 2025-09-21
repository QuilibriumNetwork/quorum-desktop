# Message Signing System

**Last Updated:** September 21, 2025

## Overview

The message signing system provides **4-level hierarchical control** over cryptographic message signing (non-repudiation) across different contexts in the application. This ensures messages can be cryptographically verified while allowing granular user control.

## Architecture

### Hierarchy Levels (Most Specific Wins)

1. **Per-message Toggle** - Individual message override
2. **Conversation-level Settings** - Direct message conversation defaults
3. **Space-level Settings** - Entire space requirements
4. **Global User Settings** - Application-wide default

### Terminology

⚠️ **Important:** The codebase uses confusing terminology:

- `nonRepudiable: true` = Messages **ARE** signed (cannot be denied)
- `isRepudiable: true` = Messages **CAN BE** unsigned (allows choice)
- `skipSigning: true` = This specific message will **NOT** be signed

## Components and Implementation

### 1. Global User Settings

**File:** `src/components/modals/UserSettingsModal.tsx`
**Hook:** `src/hooks/business/user/useUserSettings.ts`

```typescript
// User configuration
type UserConfig = {
  nonRepudiable?: boolean; // Default: true (always sign)
}

// UI: Privacy/Security tab
<Switch
  value={nonRepudiable}
  onChange={setNonRepudiable}
  label="Always sign Direct Messages"
/>
```

**Purpose:** Sets the default signing behavior for all new conversations and spaces.

**Default:** `true` (all messages are signed by default)

### 2. Space-level Settings

**File:** `src/components/space/SpaceEditor.tsx`

```typescript
// Space configuration
type Space = {
  isRepudiable: boolean; // When true, allows per-message choice
}

// UI: General tab
<Switch
  value={!isRepudiable} // Inverted logic!
  onChange={(val) => setIsRepudiable(!val)}
  label="Require Message Signing"
/>
```

**Purpose:** Controls whether an entire space requires signing or allows per-message choice.

**Logic:**
- `isRepudiable: false` → All space messages MUST be signed
- `isRepudiable: true` → Users can choose per message

### 3. Conversation-level Settings

**File:** `src/components/modals/ConversationSettingsModal.tsx`

```typescript
// Conversation configuration
type Conversation = {
  isRepudiable?: boolean; // When set, overrides user default
}

// Priority resolution
if (typeof convIsRepudiable !== 'undefined') {
  setNonRepudiable(!convIsRepudiable); // Use conversation setting
} else {
  setNonRepudiable(userConfig.nonRepudiable ?? true); // Use user default
}
```

**Purpose:** Allows per-conversation override of user's global signing preference.

**Scope:** Direct messages only (not applicable to spaces)

### 4. Per-message Toggle

**File:** `src/components/message/MessageComposer.tsx`

```typescript
// Lock/unlock toggle
<Button
  iconName={skipSigning ? 'unlock' : 'lock'}
  onClick={onSigningToggle}
  className={skipSigning ? 'text-warning' : 'text-main'}
/>

// Toggle visibility
showSigningToggle={
  // In spaces: only if space allows choice
  space?.isRepudiable ||
  // In DMs: only if conversation allows choice
  !nonRepudiable
}
```

**Purpose:** Allows users to override signing on individual messages when permitted.

**Visual States:**
- 🔒 **Lock** (locked): Message will be signed
- 🔓 **Unlock** (unlocked): Message will NOT be signed (shows warning color)

## Context-Specific Logic

### Direct Messages (DirectMessage.tsx)

```typescript
// Complex priority resolution
React.useEffect(() => {
  const convIsRepudiable = conversation?.conversation?.isRepudiable;
  const userNonRepudiable = userConfig?.nonRepudiable ?? true;

  if (typeof convIsRepudiable !== 'undefined') {
    // 1. Conversation setting exists - use it
    const convNonRepudiable = !convIsRepudiable;
    setNonRepudiable(convNonRepudiable);
    setSkipSigning(convNonRepudiable ? false : !userNonRepudiable);
  } else {
    // 2. Fall back to user global setting
    setNonRepudiable(userNonRepudiable);
    setSkipSigning(userNonRepudiable ? false : true);
  }
}, [conversation, userConfig]);

// Final message signing decision
const effectiveSkip = nonRepudiable ? false : skipSigning;
```

**Hierarchy:**
1. Conversation setting (if exists)
2. User global setting
3. Default `true` (always sign)

### Spaces (Channel.tsx)

```typescript
// Simpler space-based logic
React.useEffect(() => {
  if (space?.isRepudiable) {
    // Space allows choice - use user preference
    setNonRepudiable(userConfig?.nonRepudiable ?? true);
    setSkipSigning(!userConfig?.nonRepudiable);
  } else {
    // Space requires signing - always sign
    setNonRepudiable(true);
    setSkipSigning(false);
  }
}, [space, userConfig]);

// Final message signing decision
const effectiveSkip = space?.isRepudiable ? skipSigning : false;
```

**Hierarchy:**
1. Space setting (overrides everything)
2. User global setting (if space allows choice)
3. Default `true` (always sign)

## Data Storage

### IndexedDB Schema

```typescript
// User config table
{
  address: string;
  nonRepudiable?: boolean; // Global default
}

// Spaces table
{
  spaceId: string;
  isRepudiable: boolean; // Space-wide policy
}

// Conversations table
{
  conversationId: string;
  isRepudiable?: boolean; // Conversation override
}
```

### Critical Implementation Details

1. **Database Preservation:** The `saveMessage()` function in `src/db/messages.ts` was modified to preserve existing conversation data including `isRepudiable` when updating conversation timestamps.

2. **React Query Cache:** The `addOrUpdateConversation()` function preserves `isRepudiable` field when updating conversation lists.

3. **Invalidation Chain:** Changes trigger React Query invalidation to update all dependent components.

## User Interface

### Settings Locations

| Level | Location | Control |
|-------|----------|---------|
| Global | UserSettingsModal → Privacy/Security | "Always sign Direct Messages" |
| Space | SpaceEditor → General | "Require Message Signing" |
| Conversation | ConversationSettingsModal | "Always sign messages" |
| Message | MessageComposer | Lock/unlock icon |

### Visual Indicators

- **Lock Icon** 🔒: Message will be signed
- **Unlock Icon** 🔓: Message will NOT be signed (warning color)
- **No Toggle**: No choice available (determined by higher-level setting)

## Business Rules

### Default Behavior
- All messages are signed by default (`nonRepudiable: true`)
- Provides cryptographic non-repudiation out of the box
- Users must explicitly opt-out at appropriate levels

### Override Hierarchy
```
Most Specific → Least Specific

Per-message toggle (if visible)
    ↓
Conversation setting (Direct Messages only)
    ↓
Space setting (Spaces only)
    ↓
User global setting
    ↓
Default: true (always sign)
```

### Visibility Rules

| Context | Toggle Visible When |
|---------|-------------------|
| Direct Messages | `!nonRepudiable` (conversation allows choice) |
| Spaces | `space?.isRepudiable` (space allows choice) |

## Error Handling

- Settings default to secure state (`true` = always sign) on errors
- Database operations are wrapped in try/catch with graceful fallbacks
- React Query provides automatic retry and caching
- Console errors logged for debugging without exposing to users

## Security Implications

1. **Default Security:** Secure by default - all messages signed unless explicitly configured otherwise
2. **Granular Control:** Users can reduce security for convenience at multiple levels
3. **Non-repudiation:** Signed messages provide cryptographic proof of authorship
4. **Privacy Trade-off:** Unsigned messages provide more privacy but less accountability

## Recent Bug Fix (September 2025)

**Issue:** Conversation-level signing settings were reverting after sending messages.

**Root Cause:** The `saveMessage()` database function was overwriting conversation records without preserving the `isRepudiable` field.

**Fix:** Modified `saveMessage()` to:
1. Retrieve existing conversation data
2. Preserve all existing fields including `isRepudiable`
3. Only update necessary fields (timestamp, icon, displayName)

**Files Modified:**
- `src/db/messages.ts` - Fixed database preservation
- `src/components/context/MessageDB.tsx` - Enhanced React Query cache preservation

## Testing

To verify the feature works correctly:

1. **Global Settings:** Change in UserSettingsModal → affects new conversations
2. **Space Settings:** Toggle in SpaceEditor → affects all space messages
3. **Conversation Settings:** Change in ConversationSettingsModal → persists after sending messages
4. **Per-message Toggle:** Click lock/unlock → applies to individual message
5. **Hierarchy:** Verify more specific settings override general ones

## Developer Notes

- The inverted boolean logic (`isRepudiable` vs `nonRepudiable`) is confusing but consistent throughout the codebase
- Always preserve existing conversation data when updating database records
- React Query invalidation is critical for UI consistency across components
- Consider the security implications when modifying default behaviors