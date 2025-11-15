# DirectMessage Navigation State Persistence

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Fix the DirectMessage navigation issue where users always land on `EmptyDirectMessage.tsx` when returning from Space navigation, instead of their last selected conversation.

## Problem Description

**Current Behavior**:
1. User selects a DM conversation (navigates to `/messages/:address`)
2. User navigates to a Space via NavMenu (Channel.tsx)
3. User returns to DirectMessage via NavMenu
4. User always lands on `/messages` (EmptyDirectMessage) instead of `/messages/:address`

**Expected Behavior**:
User should return to their last selected DM conversation, similar to how hotkey navigation works.

## Root Cause Analysis

### Technical Issue
- **NavMenu.tsx (line 80)**: Hardcodes navigation to `/messages` instead of checking for last conversation
- **Missing Persistence**: No mechanism to store/retrieve last selected DM address
- **UserConfig Gap**: Unlike Spaces (which have `spaceIds` array), DMs lack persistence in UserConfig

### Architecture Comparison
**Spaces Navigation** ✅:
- Uses `/spaces/:spaceId/:channelId` with persistence
- Has `defaultChannelId` fallback mechanism
- UserConfig stores `spaceIds` array

**DMs Navigation** ❌:
- Uses `/messages` (empty) vs `/messages/:address` (conversation)
- No persistence mechanism
- Always defaults to empty state

## Solution Architecture

### 1. Add Persistence to UserConfig
```typescript
// src/db/messages.ts
interface UserConfig {
  // ... existing fields
  lastDirectMessageAddress?: string; // NEW
}
```

### 2. Create Navigation Helper Hook
```typescript
// src/hooks/business/directMessages/useDirectMessageNavigation.ts (NEW)
export const useDirectMessageNavigation = () => {
  // Logic to determine target DM route:
  // 1. Check lastDirectMessageAddress from config
  // 2. Fallback to first conversation in list
  // 3. Fallback to empty state if no conversations
}
```

### 3. Update Components
- **DirectMessage.tsx**: Save current address to config when viewing
- **NavMenu.tsx**: Use navigation helper instead of hardcoded `/messages`

## Implementation Plan

### Phase 1: Infrastructure
1. **Update UserConfig type** in `src/db/messages.ts`
   - Add `lastDirectMessageAddress?: string` field
2. **Update default config** in `src/utils.ts`
   - Include new field in `getDefaultUserConfig()`

### Phase 2: Navigation Helper
3. **Create navigation hook** `src/hooks/business/directMessages/useDirectMessageNavigation.ts`
   - Implement route determination logic
   - Handle edge cases (deleted conversation, no conversations)
   - Follow patterns from existing space navigation

### Phase 3: Component Updates
4. **Update DirectMessage.tsx**
   - Save current conversation address to config on mount/view
   - Use existing `saveConfig` service for persistence
5. **Update NavMenu.tsx**
   - Replace hardcoded `/messages` with navigation helper
   - Navigate to determined route (last conversation or fallback)

### Phase 4: Edge Cases
6. **Handle scenarios**:
   - Conversation was deleted → fallback to first available
   - No conversations exist → show empty state
   - Manual navigation to `/messages` → respect user intent

## Technical Patterns to Follow

### Existing Patterns
- **Config Persistence**: Follow `saveConfig`/`getConfig` patterns from existing code
- **Hook Architecture**: Follow patterns from `useSpaceOrdering` and similar hooks
- **Navigation Logic**: Follow patterns from `useNavigationHotkeys.ts` (lines 154-164)

### Cross-Platform Compatibility
- Use existing config service (already cross-platform)
- No platform-specific code required
- Follow React Native compatibility patterns

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/db/messages.ts` | Extend interface | Add `lastDirectMessageAddress` to `UserConfig` |
| `src/utils.ts` | Update function | Include new field in `getDefaultUserConfig()` |
| `src/components/navbar/NavMenu.tsx` | Update logic | Use navigation helper instead of hardcoded route |
| `src/components/direct/DirectMessage.tsx` | Add persistence | Save current conversation to config |
| `src/hooks/business/directMessages/useDirectMessageNavigation.ts` | New file | Create navigation helper hook |

## Testing Scenarios

### Manual Testing
1. **Happy Path**: Select DM → Navigate to Space → Return to DM → Should land on same conversation
2. **No Conversations**: Start with no DMs → Navigate to Space → Return → Should show empty state
3. **Deleted Conversation**: Select DM → Delete it elsewhere → Return → Should fallback gracefully
4. **Manual Empty Navigation**: Manually navigate to `/messages` → Should respect user intent

### Integration Points
- Verify config persistence works across app restarts
- Test navigation from multiple entry points (NavMenu, hotkeys, direct URL)
- Ensure no conflicts with existing space navigation

## Related Documentation

- [Navigation Hotkeys Implementation](../AGENTS.md#navigation) - Existing DM navigation patterns
- [User Config Architecture](docs/data-management-architecture-guide.md) - Config persistence patterns
- [Space Navigation](src/hooks/business/spaces/) - Similar navigation implementation
- [Cross-Platform Components Guide](docs/cross-platform-components-guide.md) - Architecture patterns

## Success Criteria

- [ ] Users return to last selected DM conversation when navigating back from Spaces
- [ ] Empty state only shows when appropriate (no conversations or manual navigation)
- [ ] Edge cases handle gracefully (deleted conversations, etc.)
- [ ] No regression in existing navigation functionality
- [ ] Cross-platform compatibility maintained

---

_Created: 2025-11-15_