---
type: task
title: Fix Lingui "Uncompiled Message Detected" Warning
status: in-progress
complexity: low
ai_generated: true
created: 2026-01-04T00:00:00.000Z
updated: '2026-01-09'
related_issues:
  - '#2104'
  - '#834'
  - '#839'
---

# Fix Lingui "Uncompiled Message Detected" Warning

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `web/main.tsx:28-34`
- `src/i18n/index.js`

## What & Why

Console shows "Uncompiled message detected! Message: New" warning during app startup. This occurs because `dynamicActivate()` is called inside `useEffect`, which runs **after** the first render. Components like `NewMessagesSeparator` that use `i18n._(t\`New\`)` render before translations are loaded, triggering the warning.

The warning is cosmetic (translations work after the first render cycle), but indicates a race condition that should be fixed for clean console output and proper initialization order.

## Context

- **Root cause**: React's `useEffect` runs after the first render, but `dynamicActivate()` loads translation catalogs asynchronously
- **Existing pattern**: `src/i18n/index.js` already loads 'en' locale synchronously before export
- **Constraints**: Must not break existing locale switching functionality

### Research Sources

- [Lingui Dynamic Loading Guide](https://lingui.dev/guides/dynamic-loading-catalogs) - Official docs showing `useEffect` pattern
- [GitHub Issue #2104](https://github.com/lingui/js-lingui/issues/2104) - "Uncompiled message detected" warning discussion
- [GitHub Issue #834](https://github.com/lingui/js-lingui/issues/834) - Edge case with I18nProvider timing, confirms race condition exists

### Key Findings

1. The warning appears when a component tries to translate before catalogs are loaded
2. Lingui v5 added this warning to help developers identify initialization issues
3. The `I18nProvider` has a built-in fix (PR #839) that forces re-render once translations load, so visuals work correctly
4. The solution is to ensure catalogs are loaded **before** the first render that needs them

---

## Implementation Options

### Option 2: Add Loading State (Recommended - Best Practice)

Update `web/main.tsx` to wait for translations before rendering:

```typescript
// Current (web/main.tsx:28-34):
const Root = () => {
  React.useEffect(() => {
    const savedLocale = getUserLocale() || 'en';
    dynamicActivate(savedLocale);
  }, []);

  return (
    <BrowserRouter>
      ...
    </BrowserRouter>
  );
};

// Change to:
const Root = () => {
  const [isI18nReady, setIsI18nReady] = React.useState(false);

  React.useEffect(() => {
    const savedLocale = getUserLocale() || 'en';
    dynamicActivate(savedLocale).then(() => setIsI18nReady(true));
  }, []);

  if (!isI18nReady) return null; // or a loading spinner

  return (
    <BrowserRouter>
      ...
    </BrowserRouter>
  );
};
```

**Pros**:
- Follows official Lingui documentation pattern
- Minimal changes, guarantees no render before translations ready
- Single code path for all locales
- No flash of wrong language for non-English users

**Cons**: Adds a brief blank screen on initial load (acceptable since app likely has auth/connection loading anyway)

---

### Option 3: Pre-load Before React (Alternative)

Initialize i18n before calling `createRoot()` by using the existing synchronous loader:

```typescript
// Current (web/main.tsx:12-14):
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { dynamicActivate, getUserLocale } from '../src/i18n/i18n';

// Change to:
import { i18n } from '../src/i18n'; // Already loads 'en' synchronously
import { I18nProvider } from '@lingui/react';
import { dynamicActivate, getUserLocale } from '../src/i18n/i18n';
```

Then update the Root component to only call `dynamicActivate` if user wants a different locale:

```typescript
const Root = () => {
  React.useEffect(() => {
    const savedLocale = getUserLocale();
    // Only dynamically load if user has a non-English locale saved
    if (savedLocale && savedLocale !== 'en') {
      dynamicActivate(savedLocale);
    }
  }, []);

  return (
    <BrowserRouter>
      ...
    </BrowserRouter>
  );
};
```

**Pros**:
- English users get instant load (no async wait)
- No blank screen
- Uses existing synchronous loader pattern
- Non-English users still get their locale via `dynamicActivate`

**Cons**:
- Non-English users may briefly see English before their locale loads
- Slight refactor to understand two loading paths

---

## Verification

✅ **Warning disappears**
   - Test: Build app (`yarn build`) and open in browser
   - Verify: No "Uncompiled message detected" in console

✅ **English locale works**
   - Test: Fresh load with no saved locale
   - Verify: All translations display correctly

✅ **Locale switching works**
   - Test: Change language in settings
   - Verify: UI updates to new language

✅ **Non-English saved locale works**
   - Test: Set French, refresh page
   - Verify: App loads in French

---

## Definition of Done

- [ ] No "Uncompiled message detected" warning in console
- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] English locale works on fresh load
- [ ] Saved non-English locale works after refresh
- [ ] Language switching in settings still works
- [ ] No console errors or warnings

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2026-01-04 - Claude**: Initial task creation based on research into Lingui initialization timing
