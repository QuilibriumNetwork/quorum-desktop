---
type: task
title: Mention Notification Settings - Phase 4
status: done
complexity: medium
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Mention Notification Settings - Phase 4


**Priority**: High

**Estimated Effort**: 1 day (6-8 hours)
**Phase**: 4 of 4 (Mention Notification System)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Context & Background](#context--background)
3. [Requirements](#requirements)
4. [Technical Design](#technical-design)
5. [Implementation Plan](#implementation-plan)
6. [Testing Strategy](#testing-strategy)
7. [Success Criteria](#success-criteria)
8. [References](#references)

---

## Executive Summary

Phase 4 adds user-configurable notification preferences for the mention notification system. This allows users to control which types of mentions trigger notifications and customize their notification experience.

### What This Phase Adds

- **Notifications section** in Space Settings Modal (Account tab)
- **Single multiselect dropdown** using Select primitive with:
  - "All / Clear" buttons (built-in Select feature)
  - Checkboxes for: `@you`, `@everyone`, `@roles` (prepared for Phase 2b)
- **Integration** with existing mention count system
- **Per-space settings** (each space can have different preferences)
- **Settings saved** when user clicks Save button in modal

### Why Phase 4 Before Phase 3

1. **Foundation for Phase 3**: Notification dropdown (Phase 3) will respect these settings
2. **Immediate user value**: Control notification noise right away
3. **Lower complexity**: Settings UI is simpler than dropdown implementation
4. **Better testing**: Can test Phase 3 with various setting configurations

---

## Context & Background

### Current State

**Phase 1** ✅ Complete:
- Notification bubbles show unread mention counts
- Messages highlight when scrolled into view
- Database-tracked read states

**Phase 2** ✅ Complete:
- `@everyone` mentions with permission system
- Cross-platform support (web + mobile)

**Phase 3** 📋 Planned:
- Notification dropdown/inbox UI
- Central location to view all mentions

**Phase 4** ← **We are here**:
- User settings to control notification behavior

### Related Systems

**Existing Notification Settings** (`src/hooks/business/user/useNotificationSettings.ts`):
- Currently handles **browser desktop notifications** (Web Notification API)
- Shows notifications when app is in background
- This is **separate** from mention notification preferences

**New Mention Settings** (this phase):
- Controls **which mentions create notification bubbles**
- Integrated with existing mention counting system
- Per-space configuration

### Architecture Context

From `.agents/docs/features/mention-notification-system.md`:
- Mention counts calculated in `useChannelMentionCounts`
- Read tracking in `Channel.tsx` via `useUpdateReadTime`
- Highlight system in `useViewportMentionHighlight`

---

## Requirements

### Functional Requirements

**FR1: Settings UI Location**
- Add "Notifications" section in `SpaceSettingsModal/Account.tsx`
- Place **before** the "Leave Space" section
- Use consistent modal styling (Spacer, section headers, etc.)
- Subtitle "Select for which mentions you will receive notifications" (correct grammar if necessary)

**FR2: Setting Controls**
- Use **Select primitive** for all controls
- Placeholder "Select"
- Options "All / Clear" (the primitive shodul support this laready)
- Options to check/unckeck:
  - @you
  - @everyone
  - @roles
- All settings checked by default when joining a Space


**FR3: Settings Options**

| Setting | Default | Description |
|---------|---------|-------------|
| **All / Clear** | `true` | Options to check/uncheck all options |
| **@you** | `true` | Show notifications for `@<address>` mentions |
| **@everyone** | `true` | Show notifications for `@everyone` mentions |
| **@roles** | `true` | Show notifications for `@<roleTag>` mentions (Phase 2b) |


**FR4: Settings Behavior**
- Settings apply **per space** (stored with `spaceId`)
- Settings take effect when saving via the Save button in the Modal
- React Query invalidates mention counts when settings change

**FR5: Cross-Platform Support**
- Settings UI built with primitives (works on web + mobile)
- Settings stored in IndexedDB (syncs across devices)

### Non-Functional Requirements

**NFR2: Data Persistence**
- Settings survive app restarts
- Settings sync across devices (via existing sync infrastructure)

**NFR3: Mobile Compatibility**
- Select primitive renders correctly on mobile
- Touch-friendly UI (adequate tap targets)

---

## Technical Design

### Data Model

#### Settings Storage

```typescript
// New type definition in src/api/quorumApi.ts or src/types/notifications.ts
export interface MentionNotificationSettings {
  spaceId: string;
  enabledMentionTypes: string[]; // Array of enabled types: ['you', 'everyone', 'roles']
  // Extensible for Phase 3 features
  highlightDuration?: number; // Optional: custom highlight duration (ms)
}

// Default settings function
export const getDefaultMentionSettings = (spaceId: string): MentionNotificationSettings => ({
  spaceId,
  enabledMentionTypes: ['you', 'everyone', 'roles'], // All enabled by default
});
```

#### Storage Location

**IndexedDB** (as specified in requirements)
```typescript
// Add to user_config object store with spaceId as key
// Structure:
{
  address: string;
  spaceIds: string[];
  mentionSettings: {
    [spaceId: string]: MentionNotificationSettings;
  };
  // ... other user config fields
}
```

**Rationale**:
- Better for cross-device sync via SyncService (FR5 requirement)
- Consistent with existing user configuration storage
- Already integrated with app's data sync infrastructure

### Component Architecture

```
SpaceSettingsModal
└─ Tabs (Overview, Account, Roles, ...)
   └─ Account.tsx
      ├─ Avatar Upload Section (existing)
      ├─ Display Name Input (existing)
      ├─ Your Roles Section (existing)
      ├─ [NEW] Notifications Section ← Add here
      │  ├─ Section Header ("Notifications")
      │  ├─ Description ("Select for which mentions you will receive notifications")
      │  └─ Single Multiselect Dropdown
      │     ├─ "All / Clear" buttons (Select primitive feature)
      │     ├─ Checkbox: @you
      │     ├─ Checkbox: @everyone
      │     └─ Checkbox: @roles (grayed out - Phase 2b)
      └─ Leave Space Section (existing)
```

### Hook Design

#### New Hook: `useMentionNotificationSettings`

**Location**: `src/hooks/business/mentions/useMentionNotificationSettings.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { MentionNotificationSettings } from '../../../types/notifications';
import { getDefaultMentionSettings } from '../../../utils/notificationSettingsUtils';

interface UseMentionNotificationSettingsProps {
  spaceId: string;
}

interface UseMentionNotificationSettingsReturn {
  settings: MentionNotificationSettings;
  selectedTypes: string[]; // For Select multiselect value
  setSelectedTypes: (types: string[]) => void;
  isLoading: boolean;
  saveSettings: () => Promise<void>;
  isSaving: boolean;
}

export function useMentionNotificationSettings({
  spaceId,
}: UseMentionNotificationSettingsProps): UseMentionNotificationSettingsReturn {
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;

  const [settings, setSettings] = useState<MentionNotificationSettings>(() =>
    getDefaultMentionSettings(spaceId)
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!userAddress) return;

      try {
        setIsLoading(true);
        const { config } = await messageDB.getUserConfig({ address: userAddress });

        if (config?.mentionSettings?.[spaceId]) {
          const loadedSettings = config.mentionSettings[spaceId];
          setSettings(loadedSettings);
          setSelectedTypes(loadedSettings.enabledMentionTypes);
        } else {
          // Use defaults for new space
          const defaults = getDefaultMentionSettings(spaceId);
          setSettings(defaults);
          setSelectedTypes(defaults.enabledMentionTypes);
        }
      } catch (error) {
        console.error('[MentionSettings] Error loading settings:', error);
        // Use defaults on error
        const defaults = getDefaultMentionSettings(spaceId);
        setSettings(defaults);
        setSelectedTypes(defaults.enabledMentionTypes);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [spaceId, userAddress, messageDB]);

  // Save settings to IndexedDB (called by Save button in modal)
  const saveSettings = useCallback(async () => {
    if (!userAddress) return;

    try {
      setIsSaving(true);

      // Get current config
      const { config } = await messageDB.getUserConfig({ address: userAddress });

      // Update mention settings for this space
      const updatedConfig = {
        ...config,
        mentionSettings: {
          ...(config?.mentionSettings || {}),
          [spaceId]: {
            spaceId,
            enabledMentionTypes: selectedTypes,
          },
        },
      };

      // Save back to IndexedDB
      await messageDB.saveUserConfig(updatedConfig);

      // Update local state
      setSettings({
        spaceId,
        enabledMentionTypes: selectedTypes,
      });

      // ✅ IMPORTANT: Invalidate mention count queries so bubbles recalculate
      // This should be done in the modal's onSave handler after calling saveSettings()
    } catch (error) {
      console.error('[MentionSettings] Error saving settings:', error);
      throw error; // Re-throw so modal can show error
    } finally {
      setIsSaving(false);
    }
  }, [spaceId, userAddress, selectedTypes, messageDB]);

  return {
    settings,
    selectedTypes,
    setSelectedTypes,
    isLoading,
    saveSettings,
    isSaving,
  };
}
```

### Integration with Mention Count System

#### Update `useChannelMentionCounts`

**File**: `src/hooks/business/mentions/useChannelMentionCounts.ts`

**Changes**:

```typescript
// Add at top of file
import { getMentionNotificationSettings } from '../../../utils/notificationSettingsUtils';

// Inside queryFn (around line 40-45)
queryFn: async () => {
  if (!userAddress) return {};

  // ✅ NEW: Load settings for this space from user config
  const { config } = await messageDB.getUserConfig({ address: userAddress });
  const settings = config?.mentionSettings?.[spaceId];

  // ✅ NEW: If no settings, use defaults (all enabled)
  const enabledTypes = settings?.enabledMentionTypes || ['you', 'everyone', 'roles'];

  // ✅ NEW: If no types enabled, return empty counts
  if (enabledTypes.length === 0) {
    return {};
  }

  const counts: Record<string, number> = {};

  try {
    for (const channelId of channelIds) {
      const conversationId = `${spaceId}/${channelId}`;

      // ... existing code to get lastReadTimestamp and messages ...

      // ✅ MODIFIED: Filter with enabled types
      const unreadMentions = messages.filter((message: Message) => {
        if (message.createdDate <= lastReadTimestamp) return false;

        // Check if message mentions user based on enabled types
        return isMentionedWithSettings(message, {
          userAddress,
          enabledTypes,
        });
      });

      if (unreadMentions.length > 0) {
        counts[channelId] = unreadMentions.length;
      }
    }
  } catch (error) {
    console.error('[MentionCounts] Error:', error);
    return {};
  }

  return counts;
},
```

#### New Utility Function

**File**: `src/utils/mentionUtils.ts`

**Add**:

```typescript
/**
 * Check if message mentions user, respecting notification settings
 */
export function isMentionedWithSettings(
  message: Message,
  options: {
    userAddress: string;
    enabledTypes: string[]; // Array like ['you', 'everyone', 'roles']
  }
): boolean {
  const { userAddress, enabledTypes } = options;
  const mentions = message.mentions;

  if (!mentions) return false;

  // Check personal mentions (@you)
  if (enabledTypes.includes('you')) {
    if (mentions.memberIds?.includes(userAddress)) {
      return true;
    }
  }

  // Check @everyone mentions
  if (enabledTypes.includes('everyone')) {
    if (mentions.everyone === true) {
      return true;
    }
  }

  // Check role mentions (Phase 2b - not yet implemented)
  if (enabledTypes.includes('roles') && mentions.roleIds) {
    // TODO: Check if user has any of the mentioned roles
    // Will be implemented in Phase 2b
  }

  return false;
}
```

### UI Design

#### Notifications Section Layout

```tsx
// In Account.tsx, before "Leave Space" section

<>
  {userRoles.length > 0 && (
    // ... existing Your Roles section ...
  )}

  {/* ✅ NEW: Notifications Section */}
  <Spacer size="xl" direction="vertical" />
  <div className="modal-text-label">
    <Trans>Notifications</Trans>
  </div>
  <div className="modal-text-small text-main pt-1">
    <Trans>Select for which mentions you will receive notifications</Trans>
  </div>
  <div className="pt-4">
    <Select
      value={selectedTypes}
      onChange={(value) => setSelectedTypes(value as string[])}
      multiple={true}
      placeholder={t`Select`}
      showSelectAllOption={true}
      selectAllLabel={t`All`}
      clearAllLabel={t`Clear`}
      options={[
        {
          value: 'you',
          label: t`@you`,
          subtitle: t`When someone mentions you directly`,
        },
        {
          value: 'everyone',
          label: t`@everyone`,
          subtitle: t`When someone mentions @everyone`,
        },
        {
          value: 'roles',
          label: t`@roles`,
          subtitle: t`When someone mentions a role you have (Coming Soon)`,
          disabled: true, // Phase 2b - not yet implemented
        },
      ]}
      size="medium"
      fullWidth={true}
    />
  </div>

  {!isSpaceOwner && (
    <>
      <Spacer size="xl" direction="vertical" />
      {/* ... existing Leave Space section ... */}
    </>
  )}
</>
```

**Key UI Features**:
- **Single multiselect dropdown** using Select primitive's `multiple={true}`
- **"All / Clear" buttons** automatically displayed by `showSelectAllOption={true}`
- **Checkboxes** automatically rendered for each option in multiselect mode
- **Subtitles** explain each mention type
- **@roles disabled** with "(Coming Soon)" in subtitle until Phase 2b
- **Full width** dropdown for better mobile experience

---

## Implementation Plan

### Phase 1: Setup & Types (1-2 hours)

**Tasks**:
1. Create type definitions for `MentionNotificationSettings`
2. Create utility functions:
   - `getDefaultMentionSettings(spaceId)`
   - `getMentionNotificationSettings(spaceId)`
   - `saveMentionNotificationSettings(settings)`
3. Add `isMentionedWithSettings()` to `mentionUtils.ts`

**Files to Create**:
- `src/types/notifications.ts` (or add to existing types file)
- `src/utils/notificationSettingsUtils.ts`

**Files to Modify**:
- `src/utils/mentionUtils.ts`

**Testing**:
- ✅ TypeScript compilation passes
- ✅ Utility functions work with localStorage
- ✅ Default settings structure is correct

**Commit**: `"Add mention notification settings types and utilities"`

---

### Phase 2: Settings Hook (1-2 hours)

**Tasks**:
1. Create `useMentionNotificationSettings` hook
2. Implement IndexedDB load logic (getUserConfig)
3. Implement IndexedDB save logic (saveUserConfig)
4. Add `isSaving` state for Save button feedback
5. Handle errors gracefully

**Files to Create**:
- `src/hooks/business/mentions/useMentionNotificationSettings.ts`

**Files to Modify**:
- `src/hooks/business/mentions/index.ts` (export new hook)
- `src/api/quorumApi.ts` (add `mentionSettings` to UserConfig type if not exists)

**Testing**:
- ✅ Hook loads settings from IndexedDB
- ✅ Hook saves settings to IndexedDB when `saveSettings()` called
- ✅ Settings persist across app restarts
- ✅ Default settings (all enabled) for new spaces

**Commit**: `"Add useMentionNotificationSettings hook with IndexedDB storage"`

---

### Phase 3: Integrate with Mention Count System (2-3 hours)

**Tasks**:
1. Update `useChannelMentionCounts` to respect settings
2. Add settings check at query function start
3. Use `isMentionedWithSettings` instead of `isMentioned`
4. Test mention counting with various setting combinations

**Files to Modify**:
- `src/hooks/business/mentions/useChannelMentionCounts.ts`

**Testing Scenarios**:
- ✅ No types selected → no bubbles appear
- ✅ Only "you" enabled → only `@user` triggers bubbles
- ✅ Only "everyone" enabled → only `@everyone` triggers bubbles
- ✅ Settings saved → mention counts recalculate after save
- ✅ Default settings (all enabled) → all mention types trigger bubbles

**Commit**: `"Integrate mention settings with mention count system"`

---

### Phase 4: UI Implementation (2-3 hours)

**Tasks**:
1. Add Notifications section to `Account.tsx`
2. Use `useMentionNotificationSettings` hook
3. Implement multiselect Select control with "All/Clear"
4. Add proper spacing with Spacer primitive
5. Integrate with existing Save button:
   - Call `saveSettings()` in onSave handler
   - After save completes, invalidate React Query cache: `queryClient.invalidateQueries(['mention-counts', 'channel', spaceId])`
6. Add internationalization (Trans, t macro)
7. Handle loading state (show skeleton/disabled while loading)

**Files to Modify**:
- `src/components/modals/SpaceSettingsModal/Account.tsx`
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` (integrate saveSettings into onSave)

**UI Testing**:
- ✅ Section appears before "Leave Space"
- ✅ Multiselect dropdown renders correctly
- ✅ "All / Clear" buttons work
- ✅ Settings only save when Save button clicked
- ✅ Loading state shows while fetching settings
- ✅ Save button disabled while saving
- ✅ Internationalization works (check different locales)

**Commit**: `"Add mention notification settings UI to Space Settings"`

---

### Phase 5: Testing & Refinement (1 hour)

**Tasks**:
1. Test complete user flow
2. Test cross-device sync (if using IndexedDB)
3. Test mobile responsiveness
4. Add any missing edge case handling
5. Update documentation

**Test Cases**:
- [ ] Open settings → deselect all → Save → no bubbles appear
- [ ] Select only "you" → Save → send @mention → bubble appears
- [ ] Select only "everyone" → Save → send @everyone → bubble appears
- [ ] Multiple spaces → each has independent settings
- [ ] Close modal without saving → settings unchanged
- [ ] Close/reopen app → settings persist
- [ ] Settings UI responsive on mobile

**Files to Update**:
- `.agents/docs/features/mention-notification-system.md` (add Phase 4 completion)

**Commit**: `"Test and refine mention notification settings"`

---

## Testing Strategy

### Unit Testing (Optional)

**useMentionNotificationSettings**:
```typescript
describe('useMentionNotificationSettings', () => {
  it('loads default settings for new space', () => {
    // Test default settings are returned
  });

  it('saves settings to localStorage', () => {
    // Test settings persist
  });

  it('invalidates queries on setting change', () => {
    // Test React Query invalidation
  });

  it('disables sub-settings when master is off', () => {
    // Test master toggle behavior
  });
});
```

**isMentionedWithSettings**:
```typescript
describe('isMentionedWithSettings', () => {
  it('respects personalMentionsEnabled setting', () => {
    // Test personal mention filtering
  });

  it('respects everyoneMentionsEnabled setting', () => {
    // Test @everyone filtering
  });

  it('returns false when all notifications disabled', () => {
    // Test master toggle
  });
});
```

### Integration Testing

**Mention Count System**:
1. Setup: Create space with multiple channels
2. Action: Send mentions of different types
3. Verify: Bubbles appear for enabled types only
4. Action: Toggle settings
5. Verify: Bubbles update correctly

**Settings Persistence**:
1. Setup: Open space settings
2. Action: Change notification preferences
3. Action: Close modal
4. Action: Refresh page
5. Verify: Settings persist

**Cross-Space Independence**:
1. Setup: Join two spaces
2. Action: Set different preferences in each
3. Verify: Each space respects its own settings

### Manual Testing Checklist

**UI Testing**:
- [ ] Notifications section renders correctly
- [ ] Select dropdowns work smoothly
- [ ] Master toggle disables sub-settings
- [ ] Mobile layout looks good
- [ ] Internationalization displays correctly

**Functionality Testing**:
- [ ] Deselecting all types → Save → no bubbles appear
- [ ] Selecting only "you" → Save → only `@user` triggers bubbles
- [ ] Selecting only "everyone" → Save → only `@everyone` triggers bubbles
- [ ] Settings apply after clicking Save button
- [ ] Settings persist across app restarts
- [ ] "All" button selects all types
- [ ] "Clear" button deselects all types

**Edge Cases**:
- [ ] What happens if IndexedDB is unavailable?
- [ ] What happens if user config is corrupted?
- [ ] Settings in multiple tabs/windows (IndexedDB sync)

---

## Success Criteria

### Must Have (P0)

- ✅ Notifications section added to Space Settings (Account tab)
- ✅ Single multiselect dropdown with 3 options (@you, @everyone, @roles)
- ✅ "All / Clear" buttons in dropdown
- ✅ Settings persist in IndexedDB (user_config)
- ✅ Settings integrate with `useChannelMentionCounts`
- ✅ Settings save when Save button clicked
- ✅ Mobile-compatible UI (uses primitives)
- ✅ TypeScript compilation passes
- ✅ No console errors or warnings

### Should Have (P1)

- ✅ Smooth UX (no lag when interacting with dropdown)
- ✅ Clear labels and subtitles for each option
- ✅ Internationalization support (Trans, t macro)
- ✅ Settings sync across devices (via IndexedDB + SyncService)
- ✅ Documentation updated
- ✅ Loading state while fetching settings

### Nice to Have (P2)

- ✅ Unit tests for hooks
- ✅ Reset to defaults button
- ✅ Visual feedback when settings change (toast notification)
- ✅ Analytics tracking for setting changes

---

## Out of Scope

### Not Included in Phase 4

❌ Role mention filtering (Phase 2b dependency)
❌ Notification dropdown UI (Phase 3)
❌ Sound/vibration preferences
❌ Notification scheduling (quiet hours)
❌ Per-channel notification overrides
❌ Notification preview/test feature
❌ Migration tool from old notification system

---

## Risks & Mitigations

### Risk 1: Settings Don't Sync Across Devices

**Risk Level**: Medium
**Impact**: User confusion (different settings on different devices)
**Mitigation**:
- Use IndexedDB instead of localStorage (syncs via SyncService)
- OR: Accept localStorage limitation for Phase 4, migrate to IndexedDB in Phase 5

### Risk 2: Settings Change Causes Performance Issues

**Risk Level**: Low
**Impact**: Lag when toggling settings
**Mitigation**:
- Settings changes are lightweight (just localStorage write + query invalidation)
- Query invalidation uses stale-while-revalidate pattern
- Test with large channels (1000+ messages)

### Risk 3: Multiselect UX Confusion

**Risk Level**: Very Low
**Impact**: User doesn't understand multiselect or "All/Clear" buttons
**Mitigation**:
- Clear section subtitle explaining purpose
- Each option has subtitle explaining what it does
- "All / Clear" buttons are self-explanatory
- Checkbox UI makes selection clear

### Risk 4: TypeScript Type Mismatches

**Risk Level**: Very Low
**Impact**: Compilation errors
**Mitigation**:
- Define types early (Phase 1)
- Use strict TypeScript settings
- Run type checking after each phase

---

## Future Enhancements

### Phase 5: Advanced Settings (Post-MVP)

- Per-channel notification overrides
- Notification sound selection
- Notification scheduling (quiet hours)
- Notification preview/test button

### Phase 6: Analytics & Insights (Future)

- Track which settings are most popular
- A/B test default settings
- User feedback on notification UX

---

## References

### Related Documentation

- **[Mention Notification System](.agents/docs/features/mention-notification-system.md)** - System architecture
- **[Primitives: When to Use](.agents/docs/features/primitives/03-when-to-use-primitives.md)** - Primitive usage guide
- **[Cross-Platform Architecture](../cross-platform-repository-implementation.md)** - Mobile compatibility

### Related Files

**Hooks**:
- `src/hooks/business/user/useNotificationSettings.ts` - Existing desktop notification hook
- `src/hooks/business/mentions/useChannelMentionCounts.ts` - Mention count calculation
- `src/hooks/business/mentions/useViewportMentionHighlight.ts` - Highlight system

**Components**:
- `src/components/modals/SpaceSettingsModal/Account.tsx` - Settings modal Account tab
- `src/components/modals/UserSettingsModal/Notifications.tsx` - Existing notification UI pattern
- `src/components/primitives/Select/Select.web.tsx` - Select primitive

**Utils**:
- `src/utils/mentionUtils.ts` - Mention detection and filtering

### Key Patterns to Follow

**Modal Section Pattern** (from Account.tsx):
```tsx
<Spacer size="xl" direction="vertical" />
<div className="modal-text-label">
  <Trans>Section Title</Trans>
</div>
<div className="modal-text-small text-main pt-1">
  <Trans>Section description...</Trans>
</div>
<div className="pt-4">
  {/* Section content */}
</div>
```

**Select Usage Pattern** (from existing code):
```tsx
<Select
  value={selectedValue}
  onChange={(value) => handleChange(value)}
  options={[
    { value: 'option1', label: t`Option 1` },
    { value: 'option2', label: t`Option 2` },
  ]}
  size="small"
  width="120px"
/>
```

---

## Appendix: IndexedDB Integration

### Why IndexedDB for Phase 4

**Decision**: Use **IndexedDB** (`user_config` object store) as specified in requirements (FR5)

**Advantages**:
- ✅ Cross-device sync via SyncService (FR5 requirement)
- ✅ Consistent with existing user configuration architecture
- ✅ Already integrated with app's data sync infrastructure
- ✅ Survives app updates and reinstalls
- ✅ Larger storage capacity (~50MB+)

**Integration Points**:
- Settings stored in `user_config.mentionSettings[spaceId]`
- Loaded via `messageDB.getUserConfig({ address })`
- Saved via `messageDB.saveUserConfig(updatedConfig)`
- Syncs automatically when using existing SyncService

**Storage Structure**:
```typescript
{
  address: "user-address",
  spaceIds: [...],
  mentionSettings: {
    "space-id-1": {
      spaceId: "space-id-1",
      enabledMentionTypes: ["you", "everyone"]
    },
    "space-id-2": {
      spaceId: "space-id-2",
      enabledMentionTypes: ["you", "everyone", "roles"]
    }
  },
  // ... other user config fields
}
```

---

## Changelog

### 2025-10-10 - Task Created
- Initial task definition for Phase 4
- Technical design and implementation plan
- Testing strategy and success criteria

---

**Document maintained by**: Development Team
**For questions**: See mention notification system documentation
**Next phase**: Phase 3 (Notification Dropdown)

---

*Last updated: 2025-10-10*
