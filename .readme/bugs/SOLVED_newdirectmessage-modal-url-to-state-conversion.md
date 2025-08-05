# NewDirectMessage Modal: URL-to-State Conversion

[← Back to INDEX](/.readme/INDEX.md)

**Date**: 2025-01-19  
**Issue**: Modal reopening/flickering when closing from existing conversations  
**Solution**: Converted from URL-based to state-based modal management  
**Status**: Resolved - Additional React hooks issue fixed  
**Last Updated**: 2025-01-20

## Resolution Summary

The modal had two separate issues that were both resolved:

1. **Original Issue (URL-based modal flickering)**: Successfully fixed by converting from URL-based (`/messages/new` route) to state-based modal management using React Context.

2. **Secondary Issue (React hooks violation)**: After the URL-to-state conversion, another developer introduced a bug by incorrectly using the `useRegistration` hook inside a regular function (`lookupUser`), violating React's Rules of Hooks. This was fixed by converting the hook call to a raw API call.

**Final Status**: Both issues are now resolved. The modal uses state-based management (no URL changes) and properly handles user registration lookups without hook violations.

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

---

## UPDATE after human review

The dev who worked on this modal and fixed the issue: fixed version src\components\modals\NewDirectMessageModal.tsx

_Dev comment: you can't use hooks in functions in a component, I had to convert the registration hook to the underlying raw api call._

I did some testing though and looks like the version right after their first edit (and before mine) was already showing the issue:

This is what I see:

- current version: working
- before my edits to the modal and after the dev edits: NOT working
- before all edits: working

Please compare all the version to see what chnages and identify the real issue:

VERSION 3: current src\components\modals\NewDirectMessageModal.tsx (working)

VERSION 2: before my edits to the modal and after the dev edits (NOT working)

```tsx
import * as React from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';
import { base58btc } from 'multiformats/bases/base58';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConversations, useRegistration } from '../../hooks';
import { useNavigate } from 'react-router';

type NewDirectMessageModalProps = {
  visible: boolean;
  onClose: () => void;
};

const NewDirectMessageModal: React.FunctionComponent<
  NewDirectMessageModalProps
> = (props) => {
  let [address, setAddress] = React.useState<string>('');
  let [error, setError] = React.useState<string | null>(null);
  let [buttonText, setButtonText] = React.useState<string>(t`Send`);
  let navigate = useNavigate();

  const { data: conversations } = useConversations({ type: 'direct' });
  const conversationsList = [
    ...conversations.pages.flatMap((c: any) => c.conversations),
  ];
  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address;

  const lookupUser = async (): Promise<boolean> => {
    setButtonText(t`Looking up user...`);
    try {
      const { data: registration } = await useRegistration({ address });
      return registration.registered;
    } catch {
      setError(t`User does not exist.`);
      return false;
    } finally {
      setButtonText(t`Send`);
    }
  };

  const resetState = () => {
    setError(null);
    setButtonText(t`Send`);
  };

  React.useEffect(() => {
    resetState();

    if (!address) return;

    // check if address is the same as own address
    if (address === ownAddress) {
      setError(t`You cannot send a direct message to yourself.`);
      return;
    }

    // check if address is exactly 46 characters long
    if (address.length !== 46) {
      setError(t`Addresses must be exactly 46 characters long.`);
      return;
    }

    // check if address starts with Qm
    if (!address.startsWith('Qm')) {
      setError(t`Addresses start with "Qm".`);
      return;
    }

    // check if conversation already exists
    if (conversationsList.find((c: any) => c.address === address)) {
      setButtonText(t`Go to conversation`);
      return;
    }

    lookupUser().then((isRegistered: boolean) => {
      setError(isRegistered ? null : t`User does not exist.`);
    });

    try {
      base58btc.baseDecode(address);
    } catch {
      setError(
        t`Invalid address format. Addresses must use valid alphanumeric characters.`
      );
      return;
    }
  }, [address, ownAddress]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`New Direct Message`}
    >
      <div className="modal-new-direct-message w-full max-w-[500px] mx-auto">
        <div className="mb-4 text-sm text-subtle text-left max-sm:text-center">
          {t`Enter a user's address to start messaging them.`}
        </div>
        <div>
          <Input
            className={`w-full !text-xs sm:!text-sm ${error ? 'error' : ''}`}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder={t`User address here`}
          />
        </div>
        {error && <div className="modal-new-direct-message-error">{error}</div>}
        <React.Suspense
          fallback={
            <div className="modal-new-direct-message-actions">
              <Button
                className="w-full sm:max-w-32 sm:inline-block"
                type="primary"
                disabled={!address}
                onClick={() => {}}
              >
                {buttonText}
              </Button>
            </div>
          }
        >
          <div className="modal-new-direct-message-actions">
            <Button
              className="w-full sm:inline-block"
              type="primary"
              disabled={!address || !!error}
              onClick={() => {
                if (!!address) {
                  navigate('/messages/' + address);
                }
              }}
            >
              {buttonText}
            </Button>
          </div>
        </React.Suspense>
      </div>
    </Modal>
  );
};

export default NewDirectMessageModal;
```

VERSION 1: before all edits: working

```tsx
import * as React from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import { useConversations } from '../../hooks';
import { AddressLookup } from '../AddressLookup';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';
import { base58btc } from 'multiformats/bases/base58';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

type NewDirectMessageModalProps = {
  visible: boolean;
  onClose: () => void;
};

const NewDirectMessageModal: React.FunctionComponent<
  NewDirectMessageModalProps
> = (props) => {
  let [address, setAddress] = React.useState<string>('');
  let [error, setError] = React.useState<string | null>(null);

  const { data: conversations } = useConversations({ type: 'direct' });

  const conversationsList = [
    ...conversations.pages.flatMap((c: any) => c.conversations),
  ];

  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address;

  const lookupUser = (value: string) => {
    setAddress(value.trim());
  };

  React.useEffect(() => {
    setError(null);

    if (!address) return;

    // check if address is the same as own address
    if (address === ownAddress) {
      setError(t`You cannot send a direct message to yourself.`);
      return;
    }

    // check if address is exactly 46 characters long
    if (address.length !== 46) {
      setError(t`Addresses must be exactly 46 characters long.`);
      return;
    }

    // check if address starts with Qm
    if (!address.startsWith('Qm')) {
      setError(t`Addresses start with "Qm".`);
      return;
    }

    // check if conversation already exists
    if (conversationsList.find((c: any) => c.address === address)) {
      setError(t`You already have a conversation with this user.`);
      return;
    }

    try {
      base58btc.baseDecode(address);
    } catch {
      setError(
        t`Invalid address format. Addresses must use valid alphanumeric characters.`
      );
      return;
    }
  }, [address, ownAddress]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`New Direct Message`}
    >
      <div className="modal-new-direct-message w-full max-w-[500px] mx-auto">
        <div className="mb-4 text-sm text-subtle text-left max-sm:text-center">
          {t`Enter a user's address to start messaging them.`}
        </div>
        <div>
          <Input
            className="w-full !text-xs sm:!text-sm"
            onChange={(e) => lookupUser(e.target.value)}
            placeholder={t`User address here`}
          />
          {error && (
            <div className="modal-new-direct-message-error">{error}</div>
          )}
        </div>
        <React.Suspense
          fallback={
            <div className="modal-new-direct-message-actions">
              <Button
                className="w-full sm:max-w-32 sm:inline-block"
                type="primary"
                disabled={!address}
                onClick={() => {}}
              >
                {t`Send`}
              </Button>
            </div>
          }
        >
          {address.length === 46 && !error && (
            <AddressLookup address={address} />
          )}
        </React.Suspense>
        {(address.length !== 46 || error) && (
          <div className="modal-new-direct-message-actions">
            <Button
              className="w-full sm:max-w-32 sm:inline-block"
              type="primary"
              disabled={true}
              onClick={() => {}}
            >
              {t`Send`}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NewDirectMessageModal;
```
