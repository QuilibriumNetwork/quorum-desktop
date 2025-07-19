# NewDirectMessage Modal: URL-to-State Conversion

**Date**: 2025-01-19  
**Issue**: Modal reopening/flickering when closing from existing conversations  
**Solution**: Converted from URL-based to state-based modal management  
**Status**: Implemented, needs verification  

## Original Problem

The NewDirectMessage modal had a reopening issue when:
1. User was on an existing conversation (e.g., `/messages/QmV5xWMo5CYSxgAAy6emKFZZPCPKwCsBZKZxXD3mCUZF2n`)
2. Clicked to open modal → URL changed to `/messages/new`
3. Closed modal → `navigate(-1)` caused brief reopen before landing on original conversation

This didn't happen from EmptyDirectMessage (`/messages/`) because no route conflict occurred.

## Root Cause Analysis

The modal visibility was controlled by URL route `/messages/new`:
- Route change triggered React re-renders
- Modal's 300ms close animation conflicted with navigation timing
- `navigate(-1)` caused race conditions during route transitions

## Solution Implemented

### 1. Removed URL-Based Modal Control

**File**: `src/App.tsx`
```diff
- <Route
-   path="/messages/new"
-   element={
-     <AppWithSearch newDirectMessage ... />
-   }
- />
```

### 2. Added State-Based Modal Management

**File**: `src/components/AppWithSearch.tsx`
```diff
+ interface ModalContextType {
+   isNewDirectMessageOpen: boolean;
+   openNewDirectMessage: () => void;
+   closeNewDirectMessage: () => void;
+ }

+ const [isNewDirectMessageOpen, setIsNewDirectMessageOpen] = useState(false);

+ const modalContextValue = {
+   isNewDirectMessageOpen,
+   openNewDirectMessage: () => setIsNewDirectMessageOpen(true),
+   closeNewDirectMessage: () => setIsNewDirectMessageOpen(false),
+ };
```

### 3. Updated Modal Triggers

**File**: `src/components/direct/DirectMessageContactsList.tsx`
```diff
- <Link to="/messages/new">
-   <FontAwesomeIcon ... />
- </Link>

+ <FontAwesomeIcon
+   onClick={openNewDirectMessage}
+   ...
+ />

- <Link to="/messages/new">
-   <Button>+ Add a friend</Button>
- </Link>

+ <Button onClick={openNewDirectMessage}>
+   + Add a friend
+ </Button>
```

### 4. Updated Layout Modal Control

**File**: `src/components/Layout.tsx`
```diff
- const Layout: React.FunctionComponent<{
-   newDirectMessage?: boolean;
- }> = (props) => {
-   let navigate = useNavigate();

+ const Layout: React.FunctionComponent<{
+   // removed newDirectMessage prop
+ }> = (props) => {
+   const { isNewDirectMessageOpen, closeNewDirectMessage } = useModalContext();

- {props.newDirectMessage && (
-   <NewDirectMessageModal
-     visible={props.newDirectMessage ?? false}
-     onClose={() => navigate(-1)}
-   />
- )}

+ {isNewDirectMessageOpen && (
+   <NewDirectMessageModal
+     visible={isNewDirectMessageOpen}
+     onClose={closeNewDirectMessage}
+   />
+ )}
```

### 5. Updated Modal Navigation

**File**: `src/components/modals/NewDirectMessageModal.tsx`
```diff
+ import { useModalContext } from '../AppWithSearch';
+ const { closeNewDirectMessage } = useModalContext();

  onClick={() => {
    if (!!address) {
+     closeNewDirectMessage();
      navigate('/messages/' + address);
    }
  }}
```

## Files Modified

1. `src/App.tsx` - Removed `/messages/new` route
2. `src/components/AppWithSearch.tsx` - Added modal state to context
3. `src/components/Layout.tsx` - Updated to use context state
4. `src/components/direct/DirectMessageContactsList.tsx` - Replaced Links with buttons
5. `src/components/modals/NewDirectMessageModal.tsx` - Added context integration

## Expected Benefits

- ✅ No URL changes when opening/closing modal
- ✅ No re-render conflicts during navigation
- ✅ Smoother user experience without flicker
- ✅ Maintains all existing functionality

## Potential Issue Discovered

After implementation, testing locally shows constant "User does not exist" errors. This might be:
1. **Expected**: Local development without backend API
2. **Regression**: Previous setup allowed local testing with different browsers/profiles

## Rollback Instructions (If Needed)

### Simplest Rollback (Recommended)
Since commit `b04c61534831fe8e8a1c6a9ba74cb6208a478e73` only modified our modal files:
```bash
# Simple revert of the entire commit
git revert b04c61534831fe8e8a1c6a9ba74cb6208a478e73

# Or if you want to undo without creating a revert commit
git revert b04c61534831fe8e8a1c6a9ba74cb6208a478e73 --no-commit
git reset HEAD  # if you want to review changes first
```

### Alternative: File-Specific Rollback
```bash
git checkout HEAD~1 -- src/App.tsx src/components/AppWithSearch.tsx src/components/Layout.tsx src/components/direct/DirectMessageContactsList.tsx src/components/modals/NewDirectMessageModal.tsx
```

### Manual Rollback Steps

1. **Restore `/messages/new` route in App.tsx**:
```tsx
<Route
  path="/messages/new"
  element={
    <AppWithSearch
      newDirectMessage
      kickUserAddress={kickUserAddress}
      setKickUserAddress={setKickUserAddress}
    >
      <DirectMessages ... />
    </AppWithSearch>
  }
/>
```

2. **Remove modal state from AppWithSearch.tsx**:
   - Remove `isNewDirectMessageOpen` from interface and state
   - Remove modal methods from context
   - Restore `newDirectMessage` prop

3. **Restore Layout.tsx**:
   - Add back `newDirectMessage?: boolean` prop
   - Restore `navigate(-1)` onClose handler
   - Remove useModalContext usage

4. **Restore DirectMessageContactsList.tsx**:
   - Change buttons back to `<Link to="/messages/new">`
   - Remove useModalContext usage

5. **Restore NewDirectMessageModal.tsx**:
   - Remove useModalContext import and usage
   - Remove closeNewDirectMessage() call from submit

## Testing Verification Needed

1. **Modal behavior**: Open/close from different conversation states
2. **User lookup**: Verify API calls work same as before
3. **Local testing**: Check if different browsers/profiles still work for adding users
4. **Navigation**: Ensure back button, submit button, close button all work correctly

## Alternative Solutions (If Rollback Needed)

1. **Delay navigation**: Add setTimeout to match modal animation
2. **Prevent modal during navigation**: Add navigating state flag
3. **Custom history management**: Better handling of navigate(-1)

---

**Note**: Keep `/invite/` route URL-based as it has legitimate reasons for shareable URLs.