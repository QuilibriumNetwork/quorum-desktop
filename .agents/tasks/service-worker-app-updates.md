---
type: task
title: Service Worker for App Update Detection
status: open
complexity: low
ai_generated: true
created: 2025-12-14T00:00:00.000Z
updated: '2026-01-09'
related_issues:
  - '#26'
---

# Service Worker for App Update Detection

https://github.com/QuilibriumNetwork/quorum-desktop/issues/26

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent


**Platform**: Web only (Electron uses electron-updater)

---

## What & Why

**Current state**: Web users must manually hard-refresh (Ctrl+Shift+R) to get new app versions. There's no notification when updates are available.

**Desired state**: The app automatically detects when a new version is deployed and shows a user-friendly prompt (like Telegram) to reload with new assets.

**Value**:
- Better UX - users know when updates are available
- Reduced support issues from stale cached versions
- Seamless updates without interrupting user workflow

---

## Context

- **Platform scope**: Web version only. Electron desktop app already has `electron-updater` for native updates
- **Similar UX**: Telegram Web - shows "Update available" button, user clicks, app refreshes
- **Existing patterns**: No service worker currently in codebase

### Approach Decision: Manual Service Worker (Not vite-plugin-pwa)

**Why NOT use vite-plugin-pwa:**
- **Over-engineered**: Adds ~500KB+ dependency for a feature that needs ~70 lines of code
- **Feature creep**: Includes offline caching, PWA manifest, Workbox - none of which are needed
- **Project philosophy**: Conflicts with pragmatic "right tool for the job" approach
- **Maintenance burden**: Plugin updates, Workbox API changes, PWA spec evolution

**Manual approach benefits:**
- Zero dependencies
- Full control over update logic
- Easier to debug and maintain
- ~70 lines total

---

## Prerequisites

- [ ] Confirm web deployment serves files over HTTPS
- [ ] Review current CSP configuration (needs hardening - see Security section)

---

## Implementation

### Phase 1: Create Service Worker Script

**File**: `public/sw.js`

```javascript
// Service Worker for update detection only (no caching)
// Version is injected at build time via Vite

const VERSION = '__BUILD_HASH__'; // Replaced by build script

self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', VERSION);
  // Activate immediately - don't wait for old SW to be released
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated version:', VERSION);
  event.waitUntil(
    // Take control of all clients immediately
    self.clients.claim().then(() => {
      // Notify all clients about the new version
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'VERSION_UPDATE',
            version: VERSION
          });
        });
      });
    })
  );
});

// No fetch handler - we don't want to cache anything
// This SW is purely for update detection
```

### Phase 2: Build Script Integration

**File**: `scripts/inject-sw-version.js` (create)

```javascript
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

// Generate hash from build output
const buildHash = createHash('md5')
  .update(Date.now().toString())
  .digest('hex')
  .slice(0, 8);

// Inject into service worker
const swPath = 'dist/web/sw.js';
let swContent = readFileSync(swPath, 'utf-8');
swContent = swContent.replace('__BUILD_HASH__', buildHash);
writeFileSync(swPath, swContent);

console.log(`Injected build hash: ${buildHash}`);
```

**File**: `package.json` (update build script)

```json
{
  "scripts": {
    "build:web": "vite build --config web/vite.config.ts && node scripts/inject-sw-version.js"
  }
}
```

### Phase 3: Service Worker Registration

**File**: `src/lib/serviceWorker.ts`

```typescript
/**
 * Service Worker registration for web update detection.
 *
 * SECURITY NOTES:
 * - Only registers over HTTPS (browser enforces this)
 * - Does NOT register in Electron (uses native updater)
 * - No caching - purely for update detection
 */

type UpdateCallback = () => void;

let updateCallback: UpdateCallback | null = null;

export function initServiceWorker() {
  // SECURITY: Only register over HTTPS
  if (location.protocol !== 'https:' && !location.hostname.includes('localhost')) {
    console.warn('[SW] Service workers require HTTPS. Skipping registration.');
    return;
  }

  // Don't register in Electron - it has its own update mechanism
  if (window.electron) {
    return;
  }

  // Only register in production
  if (!import.meta.env.PROD) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers not supported');
    return;
  }

  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('[SW] Registered');

      // Check for updates on visibility change (when user returns to tab)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });

      // Also check periodically (4-6 hours with jitter for privacy)
      const baseInterval = 4 * 60 * 60 * 1000; // 4 hours
      const jitter = Math.random() * 2 * 60 * 60 * 1000; // 0-2 hours random
      setInterval(() => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      }, baseInterval + jitter);
    })
    .catch(error => {
      // SECURITY: Don't log detailed errors in production
      console.error('[SW] Registration failed');
    });

  // Listen for update messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'VERSION_UPDATE') {
      console.log('[SW] New version available:', event.data.version);
      updateCallback?.();
    }
  });
}

export function onUpdateAvailable(callback: UpdateCallback) {
  updateCallback = callback;
}

/**
 * Emergency kill-switch for service worker.
 * Exposed in dev tools for debugging.
 */
export async function killServiceWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
  console.log('[SW] Unregistered all service workers');
}

// Expose kill-switch in dev tools
if (import.meta.env.DEV) {
  (window as any).__killServiceWorker = killServiceWorker;
}
```

### Phase 4: Update Prompt Component

**File**: `src/components/ui/AppUpdatePrompt.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from '../primitives/Button';
import { onUpdateAvailable } from '../../lib/serviceWorker';

export function AppUpdatePrompt() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    onUpdateAvailable(() => setHasUpdate(true));
  }, []);

  if (!hasUpdate) return null;

  const handleUpdate = () => {
    window.location.reload();
  };

  return (
    <div className="app-update-prompt">
      <span className="app-update-prompt__text">
        <Trans>A new version is available</Trans>
      </span>
      <Button
        type="primary"
        size="small"
        onClick={handleUpdate}
      >
        <Trans>Update</Trans>
      </Button>
    </div>
  );
}
```

**File**: `src/styles/components/_app-update-prompt.scss`

```scss
.app-update-prompt {
  position: fixed;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  z-index: var(--z-index-toast);

  display: flex;
  align-items: center;
  gap: var(--spacing-md);

  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);

  &__text {
    color: var(--color-text);
    font-size: var(--font-size-sm);
  }
}
```

### Phase 5: Integrate into App

**File**: `src/App.tsx` (add near other global components)

```typescript
import { AppUpdatePrompt } from './components/ui/AppUpdatePrompt';
import { initServiceWorker } from './lib/serviceWorker';

// Call in app initialization
useEffect(() => {
  initServiceWorker();
}, []);

// Add component inside app
<AppUpdatePrompt />
```

**File**: `src/styles/main.scss` (add import)

```scss
@import 'components/app-update-prompt';
```

---

## Security Considerations

### Critical: CSP Hardening Required

**Current CSP** in `web/index.html` is too permissive (`default-src *`). Before deploying service worker:

```html
<!-- BEFORE (insecure) -->
<meta http-equiv="Content-Security-Policy"
  content="default-src *; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval';" />

<!-- AFTER (secure) -->
<meta http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' 'wasm-unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    connect-src 'self' wss: https://quilibrium.one https://*.quilibrium.one;
    worker-src 'self';
    frame-ancestors 'none';
  " />
```

### Why No Caching

This service worker intentionally does NOT cache anything:
- Caching creates attack surface (cache poisoning)
- Sensitive data could be inadvertently cached
- Simple update detection doesn't require caching
- Easier to reason about security

### Privacy: Update Check Timing

- Uses visibility-based checks (only when tab is active)
- Adds randomized jitter (4-6 hours) to prevent timing correlation
- Doesn't reveal user online status when tab is backgrounded

### Kill-Switch

Emergency unregister function available:
- In dev: `window.__killServiceWorker()`
- Can be exposed to users in settings if needed

---

## Verification

✅ **Service worker registers correctly**
   - Open DevTools → Application → Service Workers
   - Verify SW is registered and active (web only)

✅ **Update detection works**
   - Build and deploy v1
   - Open app in browser
   - Build and deploy v2 (change BUILD_HASH)
   - Return to tab or wait for check
   - Verify "Update available" prompt appears

✅ **Electron is unaffected**
   - Desktop app does NOT register service worker
   - Check console for absence of SW logs in Electron

✅ **CSP is enforced**
   - DevTools → Console → No CSP violation errors
   - Verify `worker-src 'self'` is in CSP

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **Cross-platform styling**
   - Update prompt looks correct on all themes
   - Responsive on mobile web

---

## Testing Locally

```bash
# 1. Build initial version
yarn build:web

# 2. Serve from dist
npx serve dist/web

# 3. Open http://localhost:3000 in browser

# 4. Verify SW registered in DevTools → Application → Service Workers

# 5. Make a visible change to code

# 6. Rebuild (generates new hash)
yarn build:web

# 7. Refresh in browser or wait for visibility check

# 8. Verify update prompt appears

# 9. Click "Update" → page reloads with new code
```

---

## Files to Create/Modify

### New Files
- `public/sw.js` - Service worker script
- `scripts/inject-sw-version.js` - Build hash injection
- `src/lib/serviceWorker.ts` - Registration logic
- `src/components/ui/AppUpdatePrompt.tsx` - Update prompt UI
- `src/styles/components/_app-update-prompt.scss` - Styles

### Modified Files
- `package.json` - Update build script
- `web/index.html` - Harden CSP
- `src/App.tsx` - Add AppUpdatePrompt and init call
- `src/styles/main.scss` - Import new styles

---

## Definition of Done

- [ ] Service worker script created (no caching)
- [ ] Build hash injection working
- [ ] Registration only on web (not Electron)
- [ ] Update prompt component with i18n
- [ ] CSP hardened with `worker-src 'self'`
- [ ] Visibility-based update checks implemented
- [ ] Kill-switch available for emergencies
- [ ] TypeScript compiles without errors
- [ ] Tested on web deployment
- [ ] No impact on Electron app

---

## Related

- **GitHub Issue**: https://github.com/QuilibriumNetwork/quorum-desktop/issues/26
- **Service Worker API**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

---


_Reviewed: 2025-12-14 by feature-analyzer and security-analyst agents_
_Updated: 2026-02-10 — Removed Text and View primitives from AppUpdatePrompt (web-only component uses plain HTML)_
