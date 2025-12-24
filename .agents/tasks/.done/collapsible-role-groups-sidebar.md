# Implement Collapsible Role Groups in Channel Members Sidebar

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: Medium
**Created**: 2025-12-24
**Files**:
- `src/components/space/Channel.tsx:1133-1225` (desktop sidebar)
- `src/components/space/Channel.tsx:1350-1394` (mobile drawer - Virtuoso)
- `src/components/space/Channel.scss`
- `src/hooks/business/channels/useChannelData.ts:181-231`

## What & Why

The channel members sidebar displays users grouped by roles (e.g., "ADMIN - 3", "MEMBER - 10"). Currently these groups are static and cannot be collapsed. Adding collapsible role group headers will improve UX for channels with many members by allowing users to hide/show role groups, reducing visual clutter and making navigation easier.

**Key decisions:**
- Collapsed state persists per-space (since members list is space-scoped)
- All groups start expanded by default
- Icons: `chevron-down` (expanded) → `chevron-right` (collapsed) with 90° rotation transition
- Search behavior: Expand groups containing matches when searching
- Both desktop and mobile use Virtuoso (collapse = filtering items from list)

## Context

- **Existing pattern**: `src/components/navbar/FolderContainer.tsx` and `Folder.scss` implement collapse/expand
- **State management pattern**: `src/hooks/business/folders/useFolderStates.ts` for localStorage persistence
- **Icon component**: `src/components/primitives/Icon/` with `chevron-down` and `chevron-right` icons
- **Desktop uses Virtuoso**: Flat list rendering, collapse handled by filtering items
- **Mobile uses Virtuoso in drawer**: Same flat list approach (lines 1350-1394)

## Implementation

### Phase 1: State Management in Channel.tsx

- [ ] **Add collapsed roles state** (`src/components/space/Channel.tsx`)
  - Add `collapsedRoles: Set<string>` state with localStorage persistence
  - Key format: `space-role-groups-collapsed-${spaceId}`
  - Add `toggleRoleCollapse(roleTitle: string)` function
  - Done when: State persists across page refreshes for same space
  - Reference: Follow `useFolderStates.ts` pattern

### Phase 2: Update Data Hook (requires Phase 1)

- [ ] **Modify generateVirtualizedUserList** (`src/hooks/business/channels/useChannelData.ts:181`)
  - Add `collapsedRoles: Set<string>` parameter (default: empty Set)
  - Skip pushing member items when section title is in collapsedRoles
  - Keep header items always visible
  - When search is active (3+ chars), ignore collapsed state (show all matches)
  - Done when: Collapsed sections show header only, expanded show header + members
  - Verify: Empty Set returns full list unchanged; collapsed Set filters correctly

### Phase 3: Desktop Sidebar UI (requires Phase 2)

- [ ] **Update desktop header rendering** (`src/components/space/Channel.tsx:1181-1188`)
  - Make header clickable with `cursor-pointer`
  - Add Icon component with conditional `chevron-down`/`chevron-right`
  - Add 90° rotation transition for chevron (match folder pattern)
  - Add hover state styling via group class
  - Pass `collapsedRoles` to `generateVirtualizedUserList`
  - Done when: Clicking header toggles role group visibility
  - Verify: Click role header, members collapse/expand, icon rotates

### Phase 4: Mobile Drawer UI (requires Phase 2)

- [ ] **Update mobile drawer rendering** (`src/components/space/Channel.tsx:1357-1362`)
  - Pass `collapsedRoles` to `generateVirtualizedUserList` call (same as desktop)
  - Update header rendering to match desktop (clickable with Icon)
  - Ensure header has `min-height: 44px` for touch accessibility
  - Done when: Mobile drawer has same collapse functionality as desktop
  - Verify: Test in mobile view, clicking role header toggles members

### Phase 5: CSS Styles

- [ ] **Add collapsible styles** (`src/components/space/Channel.scss`)
  - Add `.role-group-header` with flex, gap, cursor-pointer, hover state
  - Add chevron rotation: `transition: transform $duration-150 $ease-in-out`
  - Add collapsed state: `.role-group-header--collapsed .icon { transform: rotate(-90deg); }`
  - Ensure 44px min-height for mobile touch targets
  - Done when: Chevron rotates smoothly on collapse/expand
  - Verify: Animation matches FolderContainer behavior

## Verification

✅ **Desktop collapse works**
   - Click role header → members hide instantly (Virtuoso filtering)
   - Click again → members reappear
   - Chevron icon rotates 90°

✅ **Mobile collapse works**
   - Same behavior in mobile drawer
   - Touch-friendly tap targets (44px min-height)

✅ **State persists per-space**
   - Collapse a role, navigate away, return → still collapsed
   - Switch to different space → independent collapsed state

✅ **Search interaction**
   - When searching (3+ chars), all groups expand to show matches
   - Clear search → collapsed state restored

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **No console errors**
   - Test in browser dev tools

## Edge Cases

- **Role rename**: If role is renamed, orphaned collapsed state is harmless (role appears expanded)
- **Empty roles**: Already filtered out by `useChannelData.ts:143`
- **Rapid clicking**: React state batching handles naturally

## Definition of Done

- [ ] All phases complete
- [ ] Desktop and mobile both functional
- [ ] State persists per-space in localStorage
- [ ] Chevron rotates smoothly (90° transition)
- [ ] Search expands groups with matches
- [ ] TypeScript passes
- [ ] No console errors
- [ ] Manual testing on desktop and mobile views

## Related

- State pattern: `src/hooks/business/folders/useFolderStates.ts`
- CSS pattern: `src/components/navbar/Folder.scss`
- Icon component: `src/components/primitives/Icon/`

---

_Created: 2025-12-24_
_Updated: 2025-12-24 (feature-analyzer review)_
