---
type: task
title: Implement Per-Space Display Names and Avatars with Account Section
status: done
complexity: high
ai_generated: true
created: 2025-10-06T00:00:00.000Z
updated: '2026-01-09'
---

# Implement Per-Space Display Names and Avatars with Account Section

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/components/modals/SpaceSettingsModal/Account.tsx` (new)
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx:34-534`
- `src/components/modals/SpaceSettingsModal/Navigation.tsx:14-21`
- `src/hooks/business/spaces/useSpaceProfile.ts` (new)
- `src/hooks/business/channels/useSpacePermissions.ts:13-23`
- `src/components/space/ChannelList.tsx:50-55`
- `src/db/messages.ts:542-610`
- `src/services/MessageService.ts:285-305`

## What & Why

Users currently cannot customize their display name or avatar per Space, and regular members must click a "leave" icon to exit spaces. This implements a comprehensive solution:

1. **Per-space profiles**: Members can set custom display name and avatar for each Space
2. **Unified account section**: New "Account" tab in SpaceSettingsModal for profile management
3. **Improved UX**: Remove separate "leave" icon, consolidate all Space actions in settings
4. **Permission-based UI**: Show only "Account" tab to regular members, all tabs to owners

The backend already supports per-space profiles through `space_members` table and `update-profile` messages. This adds the UI layer.

## Context

- **Existing patterns**:
  - User profile UI: `UserSettingsModal/General.tsx:1-132` (avatar upload + display name)
  - Leave space: `useSpacePermissions.ts:17` opens `LeaveSpaceModal`
  - Space header: `ChannelList.tsx:50-55` context menu icon (settings/leave)
- **Data model**: `space_members` table stores `display_name` and `user_icon` per `[spaceId, user_address]`
- **Message type**: `update-profile` handler already updates member records (`MessageService.ts:291-294`)
- **Constraints**: Must work cross-platform (web + mobile), avatar as base64 in messages

---

## Prerequisites

- [ ] Development environment running (`yarn dev`)
- [ ] No conflicting PRs modifying `SpaceSettingsModal.tsx` or `useSpacePermissions.ts`

---

## Implementation

### Phase 1: Account Component & Leave Space Integration
- [ ] **Create Account.tsx component** (`src/components/modals/SpaceSettingsModal/Account.tsx`)
  - Done when: Component renders with profile section + danger zone
  - Verify: Component imports and displays in SpaceSettingsModal
  - Reference: Follow layout from `UserSettingsModal/General.tsx:46-129` for profile UI and `Danger.tsx:22-78` for danger zone structure

- [ ] **Add profile editing UI** (`src/components/modals/SpaceSettingsModal/Account.tsx`)
  - Done when: Avatar upload + display name input render correctly
  - Verify: Mirror exact UI/validation from `UserSettingsModal/General.tsx:46-129`
  - Reference: Reuse same avatar validation (file size, type) and display name validation (cannot be empty)

- [ ] **Add leave space to danger zone** (`src/components/modals/SpaceSettingsModal/Account.tsx`)
  - Done when: "Leave Space" button conditionally renders (hidden for owners)
  - Verify: Clicking button opens `LeaveSpaceModal` (same behavior as current icon)
  - Reference: Use `useSpaceOwner({ spaceId })` to conditionally render button, follow confirmation pattern from `Danger.tsx:49-71`

- [ ] **Add visual separator and helper text** (`src/components/modals/SpaceSettingsModal/Account.tsx`)
  - Done when: Profile section shows "These settings only apply to this Space" helper text
  - Verify: Clear visual separation between profile section and danger zone
  - Reference: Use `Spacer` component with `borderTop={true}` between sections

- [ ] **Update Navigation component** (`src/components/modals/SpaceSettingsModal/Navigation.tsx:14`)
  - Done when: "Account" tab appears first with 'user' icon, before 'general'
  - Verify: Tabs render in correct order on both desktop and mobile layouts
  - Reference: Add to categories array at index 0: `{ id: 'account', icon: 'user', label: t\`Account\`, className: '' }`

### Phase 2: Permission-Based Modal Access (requires Phase 1)
- [ ] **Update SpaceSettingsModal routing** (`src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx:148`)
  - Done when: Switch case routes 'account' to Account component
  - Verify: Clicking Account tab displays profile UI
  - Reference: Add `case 'account': return <Account ... />;` following existing pattern

- [ ] **Set default tab by ownership** (`src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`)
  - Done when: Members open to 'account' tab, owners open to 'general' tab
  - Verify: Check initial `selectedCategory` state based on `useSpaceOwner({ spaceId })`
  - Reference: `const [selectedCategory, setSelectedCategory] = useState(isSpaceOwner ? 'general' : 'account');`

- [ ] **Filter navigation tabs by ownership** (`src/components/modals/SpaceSettingsModal/Navigation.tsx`)
  - Done when: Regular users see only Account tab, owners see all tabs
  - Verify: Use `useSpaceOwner({ spaceId })` and filter categories array
  - Reference: Use conditional spread: `[accountTab, ...(isSpaceOwner ? [generalTab, rolesTab, ...] : [])]`

- [ ] **Update useSpacePermissions** (`src/hooks/business/channels/useSpacePermissions.ts:13-18`)
  - Done when: All users trigger `openSpaceEditor`, remove `openLeaveSpace` branch
  - Verify: Both owners and members open SpaceSettingsModal when clicking header icon
  - Reference: Remove conditional, always call `openSpaceEditor(spaceId)`

- [ ] **Update ChannelList header icon** (`src/components/space/ChannelList.tsx:54`)
  - Done when: Icon always shows 'sliders' for all users with "Space Settings" tooltip
  - Verify: Header icon matches new unified behavior
  - Reference: Update `getContextIcon` to return `'sliders'` unconditionally, add generic tooltip

### Phase 3: Profile Management Hook (requires Phase 2)
- [ ] **Create useSpaceProfile hook** (`src/hooks/business/spaces/useSpaceProfile.ts`)
  - Done when: Hook manages display name, avatar upload, current member data
  - Verify: Hook returns state that integrates with Account component
  - Reference: Follow patterns from `useUserSettings.ts` and `useProfileImage.ts`

- [ ] **Implement display name validation** (`src/hooks/business/spaces/useSpaceProfile.ts`)
  - Done when: Validation mirrors `UserSettingsModal/General.tsx` (required field)
  - Verify: Empty display name shows error, prevents save
  - Reference: Reuse exact validation logic from UserSettings

- [ ] **Implement avatar validation** (`src/hooks/business/spaces/useSpaceProfile.ts`)
  - Done when: Avatar validation mirrors `UserSettingsModal/General.tsx` (file size, type)
  - Verify: Large files (>2MB) rejected with clear error message
  - Reference: Reuse exact validation logic from UserSettings

- [ ] **Implement save logic** (`src/hooks/business/spaces/useSpaceProfile.ts`)
  - Done when: Save sends `update-profile` message with new profile data
  - Verify: Message broadcasts to space, updates visible immediately
  - Reference: Follow message sending from `MessageService.ts:103-304`

- [ ] **Update member cache** (`src/hooks/business/spaces/useSpaceProfile.ts`)
  - Done when: `queryClient.invalidateQueries({ queryKey: buildSpaceMembersKey({ spaceId }) })` called after save
  - Verify: Member list UI updates without page refresh
  - Reference: Use cache invalidation pattern from `SpaceSettingsModal.tsx:99`

- [ ] **Add inbox address validation** (`src/hooks/business/spaces/useSpaceProfile.ts`)
  - Done when: Save checks member has valid `inbox_address` before sending message
  - Verify: Missing inbox shows clear error, prevents save
  - Reference: Check `await messageDB.getSpaceMember(spaceId, userAddress)` has `inbox_address`

---

## Verification

✓ **Account tab appears for all users**
  - Test: Open Space Settings as owner → See all tabs including Account
  - Test: Open Space Settings as member → See only Account tab

✓ **Default tab selection works**
  - Test: Open Space Settings as owner → Opens to 'general' tab
  - Test: Open Space Settings as member → Opens to 'account' tab

✓ **Profile editing works per-space**
  - Test: Change display name in Account tab → Save → Check member list
  - Verify: Name updates in member sidebar and on messages in that space only

✓ **Avatar upload works per-space**
  - Test: Upload image → Save → Check messages
  - Verify: Avatar appears in member list and messages in that space only

✓ **Display name validation works**
  - Test: Clear display name field → Try to save → Error appears
  - Verify: Same validation behavior as UserSettingsModal

✓ **Avatar validation works**
  - Test: Upload >2MB image → Error appears
  - Verify: Same validation behavior as UserSettingsModal

✓ **Leave space from Account tab (members only)**
  - Test: Open as member → See "Leave Space" button in danger zone
  - Test: Open as owner → "Leave Space" button hidden
  - Test: Click "Leave Space" as member → Confirmation modal appears

✓ **Header icon unified for all users**
  - Test: Check space header icon as owner → Shows 'sliders' with "Space Settings" tooltip
  - Test: Check space header icon as member → Shows 'sliders' with "Space Settings" tooltip

✓ **Changes sync to other users**
  - Test: Two browser windows → Change profile in one
  - Verify: Other window sees update within 5 seconds

✓ **TypeScript compiles**
  - Run: `cmd.exe /c "cd /d D:\\GitHub\\Quilibrium\\quorum-desktop && npx tsc --noEmit"`
  - Expect: Zero errors

✓ **Mobile compatible**
  - Test: Open Space Settings on mobile → 2-column navigation works
  - Test: Upload avatar → Touch interactions work correctly

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| No avatar uploaded | Use global avatar or default | ✅ Already works | P0 | Low |
| Owner views Account tab | Can edit profile same as members | 🔧 Needs implementation | P0 | Low |
| Display name empty | Cannot be empty, mirror UserSettingsModal validation (field required) | 🔧 Needs validation | P0 | Medium |
| Avatar upload fails | Show error, retain previous avatar | 🔧 Needs handling | P1 | Medium |
| Large avatar (>2MB) | Mirror same validation logic of UserSettingsModal/General.tsx | 🔧 Needs validation | P1 | Medium |
| Leave space as owner | HIDE "Leave Space" button completely for owners | 🔧 Needs implementation | P0 | High |
| Offline save | Queue message, sync on reconnect | ✅ Existing queue | P0 | Low |
| Invalid inbox address | Show error if member missing inbox_address, prevent save | 🔧 Needs validation | P1 | Medium |
| Display name with special chars | Mirror UserSettingsModal validation (handle emoji, trim, length limits) | 🔧 Needs validation | P2 | Low |

---

## Risks & Rollback

**If permission filtering breaks modal for owners:**
- Verify `useSpaceOwner` hook returns correct boolean
- Check navigation filter logic doesn't exclude all tabs
- Add console logging to debug ownership check
- Ensure suspense boundaries handle loading state correctly

**If leave space functionality breaks:**
- Ensure `openLeaveSpace` is called from Account component
- Verify `LeaveSpaceModal` still receives correct spaceId
- Check `useModalContext` hook is properly imported
- Confirm button only renders for non-owners

**If default tab selection fails:**
- Verify `selectedCategory` state initialization uses `isSpaceOwner`
- Check that 'account' tab exists in filtered navigation for members
- Ensure owners don't default to hidden tab

**If profile updates don't sync:**
- Verify `update-profile` message is sent to hub
- Check encryption state is current for space
- Ensure member has valid `inbox_address` in database
- Confirm cache invalidation uses correct queryKey format

**If validation doesn't work:**
- Verify validation logic matches UserSettingsModal exactly
- Check error messages display correctly
- Ensure save button disabled when validation fails

---

## Definition of Done

- [ ] All Phase 1-3 checkboxes complete
- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] All verification tests pass (11 tests)
- [ ] All P0 edge cases handled
- [ ] No console errors or warnings in development
- [ ] Code follows existing patterns in SpaceSettingsModal
- [ ] Validation mirrors UserSettingsModal exactly
- [ ] Mobile tested successfully
- [ ] Task document updated with implementation notes

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2025-10-06 - Claude Code**: Initial task creation based on codebase analysis
**2025-10-06 - Claude Code**: Updated with Account section approach and permission-based UI filtering
**2025-10-06 - Claude Code**: Updated per feature-analyzer recommendations (validation, default tabs, tooltips, cache syntax)

---
