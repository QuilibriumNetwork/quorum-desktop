# Kick User Button Remains Enabled After User is Kicked

https://github.com/QuilibriumNetwork/quorum-desktop/issues/74

## Bug Description

After a user is successfully kicked from a space, the "Kick User" button in their UserProfile component remains enabled and functional. This creates confusion and allows admins to attempt kicking the same user multiple times.

## Expected Behavior

Once a user has been kicked:
- The "Kick User" button should be disabled
- Button text should change to "Kicked!" to indicate the user's status
- Button should remain disabled permanently (until page refresh/space re-entry)

## Current Behavior

- "Kick User" button stays enabled after successful kick
- Admin can click the button again (though subsequent kicks may fail)
- No visual indication that the user has already been kicked
- Confusing UX for space administrators

## Reproduction Steps

1. Open a space where you have kick permissions
2. Right-click on a user → View Profile
3. Click "Kick User" → "Click again to confirm"
4. Wait for kick operation to complete and modal to close
5. Right-click on the same user again → View Profile
6. **Bug**: "Kick User" button is still enabled and clickable

## Root Cause Analysis

The UserProfile component doesn't check if a user has been kicked. It only checks:
- Current permissions (`hasKickPermission`)
- Whether user can be kicked (`canKickThisUser`)
- But not whether user has **already been kicked**

## Technical Challenge: Performance at Scale

### The Problem
Checking kick status requires determining if a user is still a space member:
- `useSpaceMembers()` returns all space members (could be 1K-10K users)
- Every UserProfile component would need to search this array
- With 100 visible users → 100 × 10K = 1M operations for linear searches
- Causes performance issues and excessive re-renders

### Current Data Sources
- `useSpaceMembers({ spaceId })` - Contains current space members
- Kicked users are **absent** from this list
- Checking recent kick messages only works for recently kicked users (~30 seconds)

## Potential Solutions

### 1. Optimized Member Set Hook (Recommended)

Create a shared, memoized Set for O(1) lookups:

```tsx
// High-level hook that creates Set once and shares across components
const useSpaceMembersSet = (spaceId: string) => {
  const { data: spaceMembers } = useSpaceMembers({ spaceId });

  return useMemo(() => {
    if (!spaceMembers) return new Set();
    return new Set(spaceMembers.map(m => m.user_address));
  }, [spaceMembers]);
};

// UserProfile usage
const useIsUserKicked = (userAddress: string, spaceId: string) => {
  const memberAddressesSet = useSpaceMembersSet(spaceId);
  return !memberAddressesSet.has(userAddress); // O(1) lookup
};
```

**Pros**: Fast O(1) lookups, shared across components
**Cons**: Still creates Set per component instance

### 2. Parent Component Optimization

Pass kick status down from parent (Channel.tsx):

```tsx
// In Channel.tsx
const memberAddressesSet = useSpaceMembersSet(spaceId);

// Pass to all UserProfile instances
<UserProfile
  user={user}
  isUserKicked={!memberAddressesSet.has(user.address)}
/>
```

**Pros**: Single Set creation, maximum performance
**Cons**: Requires prop drilling, component coupling

### 3. React Query Custom Cache

Create dedicated query for member status:

```tsx
const useUserMemberStatus = (userAddress: string, spaceId: string) => {
  return useQuery({
    queryKey: ['UserMemberStatus', spaceId, userAddress],
    queryFn: async () => {
      const members = await messageDB.getSpaceMembers(spaceId);
      return members.some(m => m.user_address === userAddress);
    },
    staleTime: 30000, // Cache for 30 seconds
  });
};
```

**Pros**: Leverages React Query caching, automatic invalidation
**Cons**: Additional queries per user, cache complexity

### 4. Context Provider Solution

Create space-wide context for member status:

```tsx
const SpaceMemberContext = createContext();

// Provider at space level
<SpaceMemberProvider spaceId={spaceId}>
  <Channel /> {/* All UserProfile components can access context */}
</SpaceMemberProvider>

// Hook usage
const useIsSpaceMember = (userAddress: string) => {
  const { memberSet } = useContext(SpaceMemberContext);
  return memberSet.has(userAddress);
};
```

**Pros**: True sharing, clean separation of concerns
**Cons**: Additional context complexity, provider setup

### 5. Lazy Loading Approach

Only check kick status when UserProfile is actually opened:

```tsx
const UserProfile = ({ user, spaceId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: isKicked } = useQuery({
    queryKey: ['IsUserKicked', user.address, spaceId],
    queryFn: () => checkIfUserKicked(user.address, spaceId),
    enabled: isOpen, // Only run when modal is open
  });

  // Button state based on kick status
  const buttonText = isKicked ? 'Kicked!' : 'Kick User';
  const buttonDisabled = isKicked;
};
```

**Pros**: Minimal performance impact, only checks when needed
**Cons**: Delayed feedback, still requires efficient checking

## Recommended Implementation

**Use Solution #2 (Parent Component Optimization)** for best performance:

1. Create `useSpaceMembersSet` hook in Channel.tsx
2. Pass kick status as props to UserProfile components
3. Update UserProfile button rendering logic

This provides:
- ✅ O(1) lookup performance
- ✅ Single Set creation for all users
- ✅ Immediate visual feedback
- ✅ Minimal code complexity

## Files to Modify

- `src/components/user/UserProfile.tsx` - Add kicked state handling
- `src/components/space/Channel.tsx` - Add member set logic
- `src/hooks/queries/spaceMembers/` - Add optimized member set hook
- Create `useIsUserKicked` utility hook

## Priority: Medium

- Functional but confusing user experience
- Important for admin workflows
- Performance considerations prevent simple solution
- Affects spaces with many members most severely

---

**Created**: 2025-09-16
**Status**: Bug documented, solution designed
**Affects**: Space administrators managing large member lists