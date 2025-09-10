# React Hooks Violation: Conditional Return Before Hooks


**Date**: 2025-01-20  
**Issue**: React hooks called conditionally due to early return statement  
**Files Affected**: src/App.tsx, src/App-prod-new.tsx  
**Status**: Fixed in App.tsx, App-prod-new.tsx still needs fix  
**Severity**: High - Can cause React errors and unpredictable behavior

## Problem Description

React's Rules of Hooks require that hooks must be called in the exact same order on every render. The App component violated this rule by having a conditional return statement before two `useEffect` hooks, causing them to be skipped when the condition was met.

## The Violation

```tsx
const App = () => {
  // Hooks 1-5: Always called
  const { currentPasskeyInfo, passkeyRegistrationComplete } = usePasskeysContext();
  const [user, setUser] = useState(...);
  const [init, setInit] = useState(false);
  const [landing, setLanding] = useState(false);
  const [kickUserAddress, setKickUserAddress] = useState<string>();

  // PROBLEM: Early return before remaining hooks
  const isElementsPage = window.location.pathname === '/elements';
  if (isElementsPage) return <Elements />;  // ❌ Violation!

  // Hooks 6-7: Only called when NOT on /elements page
  useEffect(() => { /* WASM initialization */ }, [init]);
  useEffect(() => { /* User setup */ }, [currentPasskeyInfo, ...]);
```

## Impact

### What the Hooks Do

1. **First useEffect (WASM Initialization)**:
   - Initializes WebAssembly module for channel functionality
   - Runs once on app startup
   - Critical for core app features
   - Sets landing page state after 500ms delay

2. **Second useEffect (User Setup)**:
   - Creates user object after passkey authentication
   - Sets display name, avatar, online status
   - Runs when authentication state changes

### Consequences of the Violation

When visiting `/elements` page:

- ❌ WASM module never initializes
- ❌ User authentication state never sets up
- ❌ React's hook order tracking gets corrupted

This can cause:

- State corruption between renders
- Memory leaks
- React development mode warnings/errors
- Unpredictable behavior in production
- Potential crashes when navigating between pages

## Solution

Move all hooks before any conditional returns:

```tsx
const App = () => {
  // All hooks first
  const { currentPasskeyInfo, passkeyRegistrationComplete } = usePasskeysContext();
  const [user, setUser] = useState(...);
  const [init, setInit] = useState(false);
  const [landing, setLanding] = useState(false);
  const [kickUserAddress, setKickUserAddress] = useState<string>();

  // All useEffect hooks before conditionals
  useEffect(() => {
    if (!init) {
      setInit(true);
      setTimeout(() => setLanding(true), 500);
      fetch('/channelwasm_bg.wasm').then(async (r) => {
        channel_raw.initSync(await r.arrayBuffer());
      });
    }
  }, [init]);

  useEffect(() => {
    if (currentPasskeyInfo && currentPasskeyInfo.completedOnboarding && !user) {
      setUser({...});
    }
  }, [currentPasskeyInfo, passkeyRegistrationComplete, setUser, user]);

  // NOW it's safe to have conditional returns
  const isElementsPage = window.location.pathname === '/elements';
  if (isElementsPage) return <Elements />;

  return (...);
};
```

## Files Status

| File                 | Status       | Notes                                 |
| -------------------- | ------------ | ------------------------------------- |
| src/App.tsx          | ✅ Fixed     | Hooks moved before conditional return |
| src/App-prod.tsx     | ✅ Safe      | No violation (no Elements page check) |
| src/App-prod-new.tsx | ❌ Needs Fix | Has the same violation                |

## Prevention

To prevent this in the future:

1. Always call all hooks at the top of components
2. Never put conditional returns before hooks
3. Use ESLint rule `react-hooks/rules-of-hooks`
4. Consider using conditional rendering instead of early returns:
   ```tsx
   return isElementsPage ? <Elements /> : <MainApp />;
   ```

## Related Issues

This was discovered while investigating React hooks violations after fixing the NewDirectMessage modal hook issue (see `newdirectmessage-modal-url-to-state-conversion.md`).

---

_Last updated: 2025-01-20_
