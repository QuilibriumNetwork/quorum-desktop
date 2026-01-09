---
type: task
title: Refactor Modal Placement in Layout.tsx
status: done
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Refactor Modal Placement in Layout.tsx

> **⚠️ OBSOLETE - DO NOT IMPLEMENT**
>
> **Status**: This task is obsolete and should NOT be implemented.
>
> **Reason**: The modals mentioned (NewDirectMessageModal, KickUserModal) are now correctly placed in **ModalProvider** (not Layout.tsx) to solve z-index stacking issues. Moving them "closer to usage" would reintroduce CSS stacking context problems that the current architecture explicitly solves.
>
> **Context**: See `.agents/docs/features/modals.md` for the three-system modal architecture. Component-level modal rendering is deprecated due to z-index issues. ModalProvider rendering at Router level ensures perfect z-index stacking (rendered above all UI elements).
>
> **Verified**: 2025-10-05

## Problem

Currently, Layout.tsx contains 3 modals at the root level:

- CreateSpaceModal
- NewDirectMessageModal
- KickUserModal

Initial analysis suggests that NewDirectMessageModal and KickUserModal don't need to be at the global Layout level since they have specific trigger locations.

## Task

1. **Reanalyze modal usage patterns** to confirm current trigger locations:
   - Map out exactly where each modal is triggered from
   - Identify if there are multiple trigger points that justify global placement
   - Check if any modals are triggered from components that aren't direct children

2. **Move modals closer to their usage** if analysis confirms they don't need global access:
   - **NewDirectMessageModal**: Likely move to DirectMessage.tsx or DirectMessageContactsList.tsx
   - **KickUserModal**: Likely move to Channel.tsx
   - **CreateSpaceModal**: Keep in Layout.tsx (triggered from NavMenu)

3. **Update prop drilling** and state management:
   - Remove unnecessary props from Layout.tsx
   - Update parent-child component relationships
   - Ensure modal state is properly managed at the right level

4. **Test functionality** to ensure modals still work correctly after refactoring

## Benefits

- Cleaner Layout.tsx with only truly global modals
- Better component isolation and responsibility
- Reduced prop drilling through the component tree
- More maintainable code structure

## Files to Review

- `src/components/Layout.tsx` (lines 23-44)
- `src/components/direct/DirectMessageContactsList.tsx`
- `src/components/space/Channel.tsx`
- `src/App.tsx` (kickUserAddress state management)
- `src/components/context/ModalProvider.tsx`

---
