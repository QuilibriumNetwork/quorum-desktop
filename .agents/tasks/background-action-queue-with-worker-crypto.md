# Background Action Queue with Web Worker Crypto

https://github.com/QuilibriumNetwork/quorum-desktop/issues/110

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer, security-analyst, and Explore agents (2025-12-13)

**Status**: Pending
**Complexity**: Critical
**Created**: 2025-12-13
**Updated**: 2025-12-13 (timing data corrected after measurement)
**Branch**: `cross-platform_web-worker`

**Estimated Effort**: 15-20 hours (incremental milestones)

---

## 📊 Key Finding: Timing Analysis (2025-12-13)

Performance testing revealed the **actual bottlenecks** are different from initial assumptions:

| Component | Time | Impact | Can This Task Fix? |
|-----------|------|--------|-------------------|
| API call (`postUserSettings`) | 5,500ms | 80% | ⚠️ Partially - makes it non-blocking |
| Ed448 WASM signing | 1,000ms | 14% | ✅ Yes - offload to background |
| DB queries | 40ms | 0.6% | ❌ Already fast enough |
| AES/SHA crypto | <1ms | 0.01% | ❌ Already fast enough |

**This task is still valid** because:
1. **Debouncing** reduces number of 7-second saves
2. **Background processing** makes the entire operation non-blocking (user doesn't wait)
3. **Persistent queue** prevents data loss during the long API calls
4. **Offline support** queues operations when network is slow/unavailable

> 💡 The original "Web Worker for AES crypto" rationale was incorrect (AES is 0.2ms).
> The real value is making the **entire save flow non-blocking**, including the 5.5s API call.

---

## Objective

**Build a background action queue system that:**
1. **Eliminates UI freezing** - User actions return instantly, heavy work happens in background
2. **Prevents data loss** - Operations persist to IndexedDB, survive crashes/refreshes
3. **Handles offline gracefully** - Queue accumulates, processes when back online
4. **Provides user feedback** - Toasts, banners, and status indicators

This is a **unified task** combining reliability (action queue) and performance (Web Worker) into one cohesive system.

---

## How To Use This Task

### Incremental Implementation

This task is designed to be implemented **incrementally**. Each milestone:
- ✅ Leaves the app in a **working state**
- ✅ Can be **verified independently**
- ✅ Provides **immediate value**
- ✅ Can be **stopped and resumed** at any point

### Risk Levels

Items are marked with risk levels:
- 🟢 **LOW RISK** - Uses proven patterns, high confidence
- 🟡 **MEDIUM RISK** - Some unknowns, but manageable
- 🔴 **HIGH RISK / EXPERIMENTAL** - Unknown compatibility, requires PoC first

### Recommended Order (Updated 2025-12-13)

| Order | Milestone | Value | Notes |
|-------|-----------|-------|-------|
| 1 | **Debouncing** | ⭐⭐⭐ HIGH | 5-10x improvement for rapid operations |
| 2 | **Web Worker PoC** | ⭐ LOW | Validates approach, but AES is only 0.2ms |
| 3 | **Web Worker Integration** | ⭐ LOW | Infrastructure for non-blocking saves |
| 4 | **Persistent Queue** | ⭐⭐ MEDIUM | Enables reliability features |
| 5 | **Queue Processing** | ⭐⭐⭐ HIGH | Makes saves truly non-blocking (user doesn't wait 7s) |
| 6 | **UI Feedback** | ⭐⭐ MEDIUM | User knows what's happening |
| 7 | **Full Integration** | ⭐⭐⭐ HIGH | Complete solution |

> 💡 **Key insight**: Milestones 2-3 (Web Worker) have LOW value for crypto offloading (AES is 0.2ms).
> Their real value is establishing infrastructure for Milestone 5 where the **entire save runs in background**.

---

## Current Problems (Why We Need This)

### Problem 1: UI Freezing During Config Saves
**Symptom**: App freezes for ~7 seconds when:
- Saving user settings (avatar, display name)
- Dragging folders
- Creating/deleting folders

**Actual Timing** (measured 2025-12-13 with debug instrumentation):
```
SHA-512 digest:       0.3ms   (0.004%)
AES key import:       0.3ms   (0.004%)
DB queries:          40.0ms   (0.6%)    ← NOT the bottleneck
JSON stringify:       0.1ms   (0.001%)
AES-GCM encrypt:      0.2ms   (0.003%)
Ed448 sign (WASM):  1000.0ms  (14%)     ← MAIN THREAD BLOCKER
API call:           5500.0ms  (80%)     ← THE REAL BOTTLENECK
-------------------------------------------------
Total:              ~7000ms per save
```

**Root Causes** (in priority order):
1. **API latency (80%)** - `postUserSettings` takes 5.5 seconds - needs backend investigation
2. **Ed448 WASM signing (14%)** - 1 second on main thread causes UI freeze
3. **Everything else (<1%)** - Negligible impact

> ⚠️ **NOTE**: Original estimates in this task were incorrect. AES/SHA operations are sub-millisecond.
> The Web Worker benefit is primarily for **Ed448 signing** (if we move WASM there), not AES.

### Problem 2: Data Loss on Failure
**Symptom**: Messages/config lost when:
- App crashes mid-send
- Network fails during operation
- User closes browser before completion

**Root Cause**: Current queue is in-memory only (`WebsocketProvider.tsx`).

### Problem 3: No Offline Support
**Symptom**: Operations fail silently when offline.

**Root Cause**: No persistence layer to hold operations until online.

### Problem 4: API Latency (NEW - Discovered 2025-12-13)
**Symptom**: Config saves take 5.5 seconds even with fast local operations.

**Root Cause**: `postUserSettings` API endpoint is slow. This is **80% of total save time**.

**This task can't fix it** - requires backend investigation. But the action queue helps by:
- Making the save **non-blocking** (user doesn't wait)
- Allowing **retry on failure**
- Enabling **offline queuing**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER ACTION                              │
│              (Send message, save config, etc.)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               MAIN THREAD (Stays Responsive)                 │
│  1. Validate input                                           │
│  2. Update UI immediately (optimistic)                       │
│  3. Queue action to IndexedDB                                │
│  4. Return to user (instant!)                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              PERSISTENT QUEUE (IndexedDB)                    │
│  - Encrypted task storage                                    │
│  - Survives crashes/refreshes                                │
│  - Status tracking (pending/processing/failed/completed)     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKGROUND PROCESSOR                            │
│  1. Acquire distributed lock (multi-tab safety)              │
│  2. Get next batch of pending tasks                          │
│  3. For crypto-heavy tasks:                                  │
│     → Send to Web Worker (AES encryption - minimal benefit)  │
│     → Ed448 signing on main thread (1s blocker - see note)   │
│  4. Execute task (API calls, WebSocket sends)                │
│  5. Update status, handle retries                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              WEB WORKER (Off Main Thread)                    │
│  - AES-GCM encryption (minimal benefit: 0.2ms)               │
│  - SHA-512 hashing (minimal benefit: 0.3ms)                  │
│  - JSON serialization                                        │
│  - NEVER receives private keys                               │
│                                                              │
│  NOTE: Web Worker provides minimal crypto speedup since      │
│  AES/SHA are already sub-millisecond. The REAL value is:     │
│  - Making the entire save operation NON-BLOCKING             │
│  - User doesn't wait for 5.5s API call                       │
│  - Ed448 signing (1s) could move here in future              │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ Critical Insight: Ed448 Signing Is The Real Opportunity

The current plan keeps Ed448 signing on the main thread "for security." However:

- **Ed448 takes 1,000ms** (14% of total time) - the ONLY main thread blocker
- **AES takes 0.2ms** (0.003%) - moving this to worker provides negligible benefit

**Future consideration**: If we want to eliminate UI freezing, we should investigate moving Ed448 WASM to the Web Worker. This requires:
1. Loading WASM in worker context (proven possible, already in task)
2. Sending the private key to worker (requires security analysis)
3. OR: Making the background processor truly asynchronous (queue + poll for result)

For now, this task focuses on making the **entire save non-blocking** via the action queue, which solves the UX problem even without moving Ed448.

---

## Milestone 1: Config Save Debouncing 🟢 LOW RISK

**Goal**: Batch rapid config changes into single saves.
**Value**: Immediate UX improvement for drag-and-drop.
**Risk**: Low - simple timer-based debouncing.
**Effort**: 1-2 hours

### What This Solves
- 10 folder drags → 10 saves → 10 × 7s freezes = **70 seconds** (CURRENT)
- 10 folder drags → 1-2 saves → 1-2 × 7s freezes = **7-14 seconds** (AFTER)

> 💡 **HIGH VALUE**: Each save takes ~7 seconds. Debouncing reduces the NUMBER of saves,
> providing 5-10x improvement for rapid operations like drag-and-drop.

### Implementation

#### Step 1.1: Add Debouncing to ConfigService

**File**: `src/services/ConfigService.ts`

```typescript
// Add these properties to ConfigService class
private pendingConfig: UserConfig | null = null;
private pendingSavePromise: Promise<void> | null = null;
private saveTimer: ReturnType<typeof setTimeout> | null = null;
private isSaving = false;
private readonly debounceMs = 500;

/**
 * Queue a config save with debouncing.
 * Multiple rapid calls will be batched into a single save.
 */
async queueConfigSave({ config, keyset }: SaveConfigParams): Promise<void> {
  // Store latest config
  this.pendingConfig = config;

  // Clear existing timer
  if (this.saveTimer) {
    clearTimeout(this.saveTimer);
  }

  // Return existing promise if save is in progress
  if (this.pendingSavePromise) {
    return this.pendingSavePromise;
  }

  // Create new debounced save
  this.pendingSavePromise = new Promise((resolve, reject) => {
    this.saveTimer = setTimeout(async () => {
      try {
        await this.flushPendingSave(keyset);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        this.pendingSavePromise = null;
      }
    }, this.debounceMs);
  });

  return this.pendingSavePromise;
}

private async flushPendingSave(keyset: any): Promise<void> {
  if (!this.pendingConfig || this.isSaving) return;

  this.isSaving = true;
  const configToSave = this.pendingConfig;
  this.pendingConfig = null;

  try {
    await this.saveConfig({ config: configToSave, keyset });
  } finally {
    this.isSaving = false;

    // Check if more changes came in while saving
    if (this.pendingConfig) {
      await this.flushPendingSave(keyset);
    }
  }
}
```

#### Step 1.2: Update High-Frequency Call Sites

**File**: `src/hooks/business/folders/useFolderDragAndDrop.ts` (line ~588)
```typescript
// BEFORE:
await saveConfig({ config: newConfig, keyset });

// AFTER:
configService.queueConfigSave({ config: newConfig, keyset });
// Note: Don't await - let it batch in background
```

**File**: `src/hooks/business/spaces/useSpaceDragAndDrop.ts` (line ~62)
```typescript
// Same pattern - use queueConfigSave instead of saveConfig
```

**Keep direct saveConfig() for**:
- `useUserSettings.ts` - User expects immediate confirmation
- `useDeleteFolder.ts` - Important action, shouldn't batch

### Verification (Milestone 1)

- [ ] Drag 10 folders rapidly → only 1-2 console logs for saves
- [ ] Config is correctly saved after debounce period
- [ ] No data loss when making rapid changes
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] App works normally in all other scenarios

### Rollback Plan
If issues arise, simply revert the call site changes. The `queueConfigSave` method can coexist with `saveConfig`.

---

## Milestone 2: Web Worker Proof of Concept 🟡 MEDIUM RISK

**Goal**: Validate that Web Workers work in our Electron/Vite environment.
**Value**: De-risks the entire Web Worker approach before investing more time.
**Risk**: MEDIUM - SDK analysis completed, approach validated.
**Effort**: 1-2 hours

### SDK Compatibility Analysis (Completed 2025-12-13)

An analysis of the Quilibrium JS SDK (`quilibrium-js-sdk-channels`) was performed to assess Web Worker compatibility.

#### Key Findings

| Component | Web Worker Compatible? | Notes |
|-----------|------------------------|-------|
| **WASM crypto** (`channelwasm_bg.wasm`) | ✅ Yes | Already used in main thread via `channel_raw.initSync()` |
| **Web Crypto API** (AES-GCM, SHA-512) | ✅ Yes | Use `self.crypto` instead of `window.crypto` |
| **PassKeys module** | ❌ No | Uses `localStorage`, `navigator.credentials`, `window` |
| **React components** | ❌ No | DOM-dependent, but not needed in worker |

#### WASM Risk Clarification

> ⚠️ **Important**: The app **already uses WASM** in `src/App.tsx:77-79`:
> ```typescript
> fetch('/channelwasm_bg.wasm').then(async (r) => {
>   channel_raw.initSync(await r.arrayBuffer());
> });
> ```
>
> **This means**: Moving crypto to a Web Worker does **NOT** introduce new WASM risk. The lockdown concern (computers blocking WASM execution) is a **pre-existing** issue that affects the app today.
>
> If WASM is blocked by corporate policies, the app already doesn't work. The Web Worker approach doesn't make this worse.

#### Recommended Approach: Direct WASM Import in Worker

The safest approach is to import **only the WASM crypto functions** directly in the worker, bypassing the SDK's main entry point (which has `window.Buffer` and other incompatibilities):

```typescript
// In worker file:
import init, * as wasm from '@quilibrium/quilibrium-js-sdk-channels/dist/channel/channelwasm';

// Initialize WASM with explicit path
await init('/channelwasm_bg.wasm');

// Use crypto functions directly
const encrypted = wasm.js_encrypt_inbox_message(...);
```

**Alternative**: Use Web Crypto API directly for AES-GCM (as shown in Step 2.1 below), which is our primary use case and doesn't require WASM at all.

### Remaining Risks

1. **Vite Worker Setup**: May need configuration we haven't done
2. **Electron Context**: Workers behave differently in Electron
3. **WASM Path Resolution**: May need adjustment for worker context (if using WASM in worker)

### Implementation

#### Step 2.1: Create Test Worker

**File**: `src/dev/workers/test-crypto.worker.ts`

> **Note**: Worker files go in `src/dev/workers/` for development/testing purposes. Production workers will go in `src/workers/` (to be created in Milestone 3).

```typescript
// Minimal test worker to validate our environment

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case 'TEST_PING':
      self.postMessage({ type: 'PONG', success: true });
      break;

    case 'TEST_WEB_CRYPTO':
      try {
        // Test if Web Crypto API is available
        const testData = new TextEncoder().encode('test');
        const hash = await crypto.subtle.digest('SHA-256', testData);
        self.postMessage({
          type: 'WEB_CRYPTO_RESULT',
          success: true,
          hashLength: hash.byteLength
        });
      } catch (error) {
        self.postMessage({
          type: 'WEB_CRYPTO_RESULT',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;

    case 'TEST_AES_GCM':
      try {
        // Test AES-GCM encryption (what we need for config)
        const key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const plaintext = new TextEncoder().encode(data || 'test data');

        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          plaintext
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          encrypted
        );

        const decryptedText = new TextDecoder().decode(decrypted);

        self.postMessage({
          type: 'AES_GCM_RESULT',
          success: decryptedText === (data || 'test data'),
          originalLength: plaintext.byteLength,
          encryptedLength: encrypted.byteLength
        });
      } catch (error) {
        self.postMessage({
          type: 'AES_GCM_RESULT',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;

    case 'TEST_SDK_IMPORT':
      // OPTIONAL: Only if we want to try Ed448 in worker later
      try {
        // This will likely fail - that's OK!
        // We're testing if WASM loads in worker context
        const { channel_raw } = await import('@quilibrium/quilibrium-js-sdk-channels');
        self.postMessage({
          type: 'SDK_IMPORT_RESULT',
          success: true,
          hasSignMethod: typeof channel_raw?.js_sign_ed448 === 'function'
        });
      } catch (error) {
        self.postMessage({
          type: 'SDK_IMPORT_RESULT',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      break;
  }
};
```

#### Step 2.2: Create Test Hook

**File**: `src/dev/hooks/useWorkerTest.ts`

> **Note**: Dev-only hooks go in `src/dev/hooks/`. This follows the project convention where all development/testing code lives under `src/dev/`.

```typescript
import { useState, useCallback } from 'react';

interface TestResults {
  ping: boolean | null;
  webCrypto: boolean | null;
  aesGcm: boolean | null;
  sdkImport: boolean | null;
  errors: string[];
}

export function useWorkerTest() {
  const [results, setResults] = useState<TestResults>({
    ping: null,
    webCrypto: null,
    aesGcm: null,
    sdkImport: null,
    errors: []
  });
  const [isRunning, setIsRunning] = useState(false);

  const runTests = useCallback(async () => {
    setIsRunning(true);
    const errors: string[] = [];

    try {
      const worker = new Worker(
        new URL('../workers/test-crypto.worker.ts', import.meta.url),
        { type: 'module' }
      );

      const testWithTimeout = (type: string, data?: any): Promise<any> => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`${type} timed out after 5 seconds`));
          }, 5000);

          const handler = (e: MessageEvent) => {
            if (e.data.type === type.replace('TEST_', '') + '_RESULT' ||
                e.data.type === 'PONG') {
              clearTimeout(timeout);
              worker.removeEventListener('message', handler);
              resolve(e.data);
            }
          };

          worker.addEventListener('message', handler);
          worker.postMessage({ type, data });
        });
      };

      // Test 1: Basic ping
      try {
        const pingResult = await testWithTimeout('TEST_PING');
        setResults(r => ({ ...r, ping: pingResult.success }));
      } catch (e) {
        errors.push(`Ping: ${e}`);
        setResults(r => ({ ...r, ping: false }));
      }

      // Test 2: Web Crypto API
      try {
        const cryptoResult = await testWithTimeout('TEST_WEB_CRYPTO');
        setResults(r => ({ ...r, webCrypto: cryptoResult.success }));
        if (!cryptoResult.success) {
          errors.push(`Web Crypto: ${cryptoResult.error}`);
        }
      } catch (e) {
        errors.push(`Web Crypto: ${e}`);
        setResults(r => ({ ...r, webCrypto: false }));
      }

      // Test 3: AES-GCM (the critical one for our use case)
      try {
        const aesResult = await testWithTimeout('TEST_AES_GCM', 'Hello, World!');
        setResults(r => ({ ...r, aesGcm: aesResult.success }));
        if (!aesResult.success) {
          errors.push(`AES-GCM: ${aesResult.error}`);
        }
      } catch (e) {
        errors.push(`AES-GCM: ${e}`);
        setResults(r => ({ ...r, aesGcm: false }));
      }

      // Test 4: SDK Import (expected to fail - informational only)
      try {
        const sdkResult = await testWithTimeout('TEST_SDK_IMPORT');
        setResults(r => ({ ...r, sdkImport: sdkResult.success }));
        if (!sdkResult.success) {
          // This is expected - not an error for our purposes
          console.log('SDK import in worker failed (expected):', sdkResult.error);
        }
      } catch (e) {
        setResults(r => ({ ...r, sdkImport: false }));
      }

      worker.terminate();
      setResults(r => ({ ...r, errors }));

    } catch (error) {
      errors.push(`Worker creation failed: ${error}`);
      setResults(r => ({ ...r, errors }));
    }

    setIsRunning(false);
  }, []);

  return { results, isRunning, runTests };
}
```

#### Step 2.3: Add Test Button to Dev Panel (Optional)

Add a button to the Dev Panel (`src/dev/DevMainPage.tsx`) to trigger the test. Example integration:

```typescript
// In src/dev/DevMainPage.tsx, add:
import { useWorkerTest } from './hooks/useWorkerTest';

// In the component:
const { results, isRunning, runTests } = useWorkerTest();

// Add a button in the JSX:
<button onClick={runTests} disabled={isRunning}>
  {isRunning ? 'Testing...' : 'Test Web Worker'}
</button>
<pre>{JSON.stringify(results, null, 2)}</pre>
```

Or run from browser console for quick testing:
```typescript
// In browser console (while on /dev route):
const worker = new Worker(new URL('./src/dev/workers/test-crypto.worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = (e) => console.log('Worker result:', e.data);
worker.postMessage({ type: 'TEST_WEB_CRYPTO' });
```

### Verification (Milestone 2)

**MUST PASS to continue:**
- [ ] Worker loads without errors
- [ ] `TEST_PING` returns success
- [ ] `TEST_WEB_CRYPTO` returns success
- [ ] `TEST_AES_GCM` returns success (encrypt/decrypt round-trip)

**INFORMATIONAL (OK if fails):**
- [ ] `TEST_SDK_IMPORT` - If fails, Ed448 stays on main thread (our plan anyway)

### Decision Point

| Result | Action |
|--------|--------|
| All pass | Proceed to Milestone 3 |
| AES fails | STOP - Investigate alternatives |
| SDK fails | Continue - Ed448 stays on main thread (expected) |
| Worker won't load | STOP - Check Vite config |

### Rollback Plan
Delete the test files. No production code touched.

---

## Milestone 3: Web Worker Integration 🟡 MEDIUM RISK

**Goal**: Move AES encryption to Web Worker for config saves.
**Value**: ⚠️ **MINIMAL** - AES takes only 0.2ms. Real value is infrastructure for non-blocking saves.
**Risk**: Medium - PoC validated approach, but production integration has unknowns.
**Effort**: 2-3 hours

> ⚠️ **UPDATED 2025-12-13**: Original claim of "~60% reduction" was incorrect.
> AES encryption takes 0.2ms (0.003% of total save time). Moving it to worker provides
> negligible performance benefit. However, this milestone establishes the worker
> infrastructure needed for Milestone 5 (queue processing in background).

**⚠️ PREREQUISITE**: Milestone 2 must pass first!

### Implementation

#### Step 3.1: Create Production Crypto Worker

**File**: `src/workers/configCrypto.worker.ts`

> **Note**: Create the `src/workers/` directory for production workers. This separates production code from dev-only code in `src/dev/workers/`.

```typescript
/**
 * Web Worker for AES-GCM encryption of config data.
 *
 * SECURITY NOTES:
 * - This worker NEVER receives private keys
 * - Only receives derived AES keys (from SHA-512 of private key)
 * - Keys are zeroed immediately after use
 * - Ed448 signing stays on main thread
 */

interface EncryptRequest {
  type: 'ENCRYPT_CONFIG';
  requestId: string;
  configJson: string;
  derivedKeyBytes: ArrayBuffer;  // Transferred - not copied
}

interface EncryptResponse {
  type: 'ENCRYPT_SUCCESS' | 'ENCRYPT_ERROR';
  requestId: string;
  encrypted?: Uint8Array;
  iv?: Uint8Array;
  error?: string;
}

self.onmessage = async (e: MessageEvent<EncryptRequest>) => {
  const { type, requestId, configJson, derivedKeyBytes } = e.data;

  if (type !== 'ENCRYPT_CONFIG') {
    self.postMessage({
      type: 'ENCRYPT_ERROR',
      requestId,
      error: `Unknown message type: ${type}`
    } as EncryptResponse);
    return;
  }

  let keyData: Uint8Array | null = null;

  try {
    // Convert transferred buffer to Uint8Array
    keyData = new Uint8Array(derivedKeyBytes);

    // Import as AES-GCM key (only first 32 bytes of SHA-512 hash)
    const subtleKey = await crypto.subtle.importKey(
      'raw',
      keyData.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,  // not extractable
      ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      subtleKey,
      new TextEncoder().encode(configJson)
    );

    self.postMessage({
      type: 'ENCRYPT_SUCCESS',
      requestId,
      encrypted: new Uint8Array(encrypted),
      iv
    } as EncryptResponse);

  } catch (error) {
    self.postMessage({
      type: 'ENCRYPT_ERROR',
      requestId,
      error: error instanceof Error ? error.message : 'Encryption failed'
    } as EncryptResponse);

  } finally {
    // SECURITY: Zero key material immediately
    if (keyData) {
      keyData.fill(0);
      keyData = null;
    }
  }
};
```

#### Step 3.2: Create Worker Service

**File**: `src/services/CryptoWorkerService.ts`

```typescript
/**
 * Service for communicating with the crypto Web Worker.
 * Provides a simple async API and handles timeouts/errors.
 */

interface PendingRequest {
  resolve: (value: { encrypted: Uint8Array; iv: Uint8Array }) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class CryptoWorkerService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly workerTimeout = 10000; // 10 seconds

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/configCrypto.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    }
    return this.worker;
  }

  async encryptConfig(
    configJson: string,
    derivedKeyBytes: ArrayBuffer
  ): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
    const requestId = crypto.randomUUID();
    const worker = this.getWorker();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Worker timeout'));
      }, this.workerTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Transfer the key buffer (zeroes it in main thread automatically)
      worker.postMessage(
        {
          type: 'ENCRYPT_CONFIG',
          requestId,
          configJson,
          derivedKeyBytes
        },
        [derivedKeyBytes]  // Transferable
      );
    });
  }

  private handleMessage(e: MessageEvent) {
    const { type, requestId, encrypted, iv, error } = e.data;
    const pending = this.pendingRequests.get(requestId);

    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    if (type === 'ENCRYPT_SUCCESS' && encrypted && iv) {
      pending.resolve({ encrypted, iv });
    } else {
      pending.reject(new Error(error || 'Worker encryption failed'));
    }
  }

  private handleError(e: ErrorEvent) {
    console.error('Crypto worker error:', e.message);

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker crashed'));
    }
    this.pendingRequests.clear();

    // Terminate and recreate on next use
    this.worker?.terminate();
    this.worker = null;
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.pendingRequests.clear();
  }
}

// Singleton instance
let cryptoWorkerInstance: CryptoWorkerService | null = null;

export function getCryptoWorker(): CryptoWorkerService {
  if (!cryptoWorkerInstance) {
    cryptoWorkerInstance = new CryptoWorkerService();
  }
  return cryptoWorkerInstance;
}
```

#### Step 3.3: Update ConfigService to Use Worker

**File**: `src/services/ConfigService.ts`

Add worker integration with fallback:

```typescript
import { getCryptoWorker } from './CryptoWorkerService';

// In saveConfig method, replace the AES encryption section:

async saveConfig({ config, keyset }: SaveConfigParams) {
  const ts = Date.now();
  config.timestamp = ts;

  if (config.allowSync) {
    const userKey = keyset.userKeyset;

    // Step 1: Derive AES key on MAIN THREAD (private key stays here)
    const derived = await crypto.subtle.digest(
      'SHA-512',
      Buffer.from(new Uint8Array(userKey.user_key.private_key))
    );

    // ... existing space key gathering logic ...
    const configJson = JSON.stringify(configToSync);

    // Step 2: AES encryption - try worker, fallback to main thread
    let encrypted: Uint8Array;
    let iv: Uint8Array;

    try {
      // Clone derived key buffer - it will be transferred to worker
      const result = await getCryptoWorker().encryptConfig(
        configJson,
        derived.slice(0)  // slice() creates a copy
      );
      encrypted = result.encrypted;
      iv = result.iv;
    } catch (workerError) {
      console.warn('Worker encryption failed, using main thread:', workerError);
      const fallbackResult = await this.encryptOnMainThread(configJson, derived);
      encrypted = fallbackResult.encrypted;
      iv = fallbackResult.iv;
    }

    const ciphertext = Buffer.from(encrypted).toString('hex') +
                       Buffer.from(iv).toString('hex');

    // Step 3: Ed448 signing on MAIN THREAD (security requirement)
    // ... existing Ed448 signing code (unchanged) ...

    // Step 4: API POST
    // ... existing API call (unchanged) ...
  }

  await this.messageDB.saveUserConfig(config);
}

// Add fallback method:
private async encryptOnMainThread(
  configJson: string,
  derived: ArrayBuffer
): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const subtleKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(derived).slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    subtleKey,
    new TextEncoder().encode(configJson)
  );

  return { encrypted: new Uint8Array(encrypted), iv };
}
```

### Verification (Milestone 3)

- [ ] Config saves work correctly (encrypt → decrypt round-trip)
- [ ] Worker is used (check console for absence of "using main thread")
- [ ] Fallback works (kill worker in dev tools, verify save still works)
- [ ] No private keys in worker messages (inspect Network/Sources)
- [ ] Performance improved (measure with Performance API)
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Cross-platform: Works in Electron AND web browser

### Rollback Plan
Remove worker calls from ConfigService, keep using direct crypto. Worker files can stay (unused).

---

## Milestone 4: Persistent Queue Foundation 🟡 MEDIUM RISK

**Goal**: Create IndexedDB storage for action queue.
**Value**: Enable persistence for reliability features.
**Risk**: Medium - IndexedDB schema changes require careful migration.
**Effort**: 2-3 hours

### Implementation

#### Step 4.1: Update IndexedDB Schema

**File**: `src/db/messages.ts`

Add new object store for action queue:

```typescript
// In the database upgrade handler, add:

// Bump version number
const DB_VERSION = 5;  // or next version

// In onupgradeneeded:
if (!db.objectStoreNames.contains('action_queue')) {
  const queueStore = db.createObjectStore('action_queue', {
    keyPath: 'id',
    autoIncrement: true
  });

  // Indexes for efficient querying
  queueStore.createIndex('status', 'status', { unique: false });
  queueStore.createIndex('taskType', 'taskType', { unique: false });
  queueStore.createIndex('key', 'key', { unique: false });
  queueStore.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
}
```

#### Step 4.2: Define Queue Types

**File**: `src/types/actionQueue.ts`

```typescript
export type ActionType = 'send-message' | 'save-user-config' | 'kick-user';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueTask {
  id?: number;  // Auto-generated
  taskType: ActionType;

  // Encrypted payload (NEVER store plaintext sensitive data)
  encryptedContext: ArrayBuffer;
  contextIV: Uint8Array;

  // Grouping key for serial processing within group
  key: string;  // e.g., "spaceId/channelId" for messages

  // Status tracking
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;

  // Timestamps
  createdAt: number;
  processedAt?: number;

  // Error info
  error?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  total: number;
}
```

#### Step 4.3: Add Queue CRUD Methods to MessageDB

**File**: `src/db/messages.ts`

```typescript
// Add these methods to MessageDB class:

async addQueueTask(task: Omit<QueueTask, 'id'>): Promise<number> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readwrite');
    const store = tx.objectStore('action_queue');
    const request = store.add(task);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

async getQueueTasksByStatus(status: TaskStatus, limit = 50): Promise<QueueTask[]> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readonly');
    const store = tx.objectStore('action_queue');
    const index = store.index('status');
    const request = index.getAll(status, limit);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async updateQueueTask(task: QueueTask): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readwrite');
    const store = tx.objectStore('action_queue');
    const request = store.put(task);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async deleteQueueTask(id: number): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readwrite');
    const store = tx.objectStore('action_queue');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async getQueueStats(): Promise<QueueStats> {
  await this.init();
  const all = await this.getAllQueueTasks();

  return {
    pending: all.filter(t => t.status === 'pending').length,
    processing: all.filter(t => t.status === 'processing').length,
    failed: all.filter(t => t.status === 'failed').length,
    completed: all.filter(t => t.status === 'completed').length,
    total: all.length
  };
}

async pruneCompletedTasks(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  await this.init();
  const cutoff = Date.now() - olderThanMs;
  const completed = await this.getQueueTasksByStatus('completed', 1000);

  let deleted = 0;
  for (const task of completed) {
    if (task.processedAt && task.processedAt < cutoff) {
      await this.deleteQueueTask(task.id!);
      deleted++;
    }
  }

  return deleted;
}

private async getAllQueueTasks(): Promise<QueueTask[]> {
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readonly');
    const store = tx.objectStore('action_queue');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
```

### Verification (Milestone 4)

- [ ] Database migration runs without errors
- [ ] Can add tasks to queue
- [ ] Can query tasks by status
- [ ] Can update task status
- [ ] Can delete tasks
- [ ] Can get queue stats
- [ ] Pruning works correctly
- [ ] TypeScript compiles
- [ ] Existing app functionality unaffected

### Rollback Plan
The new object store doesn't affect existing functionality. Can be ignored if not used.

---

## Milestone 5: Queue Processing Engine 🟡 MEDIUM RISK

**Goal**: Background processor that executes queued tasks.
**Value**: Enables async processing, retry logic, offline support.
**Risk**: Medium - Core functionality, needs careful error handling.
**Effort**: 3-4 hours

### Implementation

#### Step 5.1: Create ActionQueueService

**File**: `src/services/ActionQueueService.ts`

```typescript
import { MessageDB } from '../db/messages';
import { QueueTask, ActionType, QueueStats } from '../types/actionQueue';
import { getCryptoWorker } from './CryptoWorkerService';

interface TaskHandler {
  execute: (context: any) => Promise<void>;
  isPermanentError: (error: Error) => boolean;
}

export class ActionQueueService {
  private messageDB: MessageDB;
  private handlers = new Map<ActionType, TaskHandler>();
  private isProcessing = false;
  private processInterval: ReturnType<typeof setInterval> | null = null;

  // Config
  private readonly maxRetries = 3;
  private readonly baseRetryDelayMs = 2000;
  private readonly maxRetryDelayMs = 5 * 60 * 1000; // 5 minutes
  private readonly processIntervalMs = 1000;
  private readonly batchSize = 10;

  constructor(messageDB: MessageDB) {
    this.messageDB = messageDB;
  }

  /**
   * Register a handler for a task type.
   */
  registerHandler(type: ActionType, handler: TaskHandler) {
    this.handlers.set(type, handler);
  }

  /**
   * Add a task to the queue.
   */
  async enqueue(
    type: ActionType,
    context: any,
    key: string
  ): Promise<number> {
    // Encrypt context before storing
    const { encrypted, iv } = await this.encryptContext(context);

    const task: Omit<QueueTask, 'id'> = {
      taskType: type,
      encryptedContext: encrypted,
      contextIV: iv,
      key,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.maxRetries,
      nextRetryAt: Date.now(),
      createdAt: Date.now()
    };

    const id = await this.messageDB.addQueueTask(task);

    // Trigger processing
    this.processQueue();

    return id;
  }

  /**
   * Start background processing.
   */
  start() {
    if (this.processInterval) return;

    this.processInterval = setInterval(() => {
      this.processQueue();
    }, this.processIntervalMs);

    // Process immediately
    this.processQueue();
  }

  /**
   * Stop background processing.
   */
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Process pending tasks.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!navigator.onLine) return;  // Don't process offline

    this.isProcessing = true;

    try {
      // Get tasks ready to process
      const now = Date.now();
      const pending = await this.messageDB.getQueueTasksByStatus('pending', this.batchSize);
      const ready = pending.filter(t => t.nextRetryAt <= now);

      if (ready.length === 0) {
        this.isProcessing = false;
        return;
      }

      // Group by key for serial processing within group
      const grouped = this.groupByKey(ready);

      // Process groups in parallel, tasks within group serially
      await Promise.allSettled(
        Array.from(grouped.values()).map(tasks => this.processGroup(tasks))
      );

    } finally {
      this.isProcessing = false;
    }
  }

  private groupByKey(tasks: QueueTask[]): Map<string, QueueTask[]> {
    const groups = new Map<string, QueueTask[]>();
    for (const task of tasks) {
      const existing = groups.get(task.key) || [];
      existing.push(task);
      groups.set(task.key, existing);
    }
    return groups;
  }

  private async processGroup(tasks: QueueTask[]): Promise<void> {
    // Process tasks serially within group (maintains order)
    for (const task of tasks) {
      await this.processTask(task);
    }
  }

  private async processTask(task: QueueTask): Promise<void> {
    const handler = this.handlers.get(task.taskType);
    if (!handler) {
      console.error(`No handler for task type: ${task.taskType}`);
      task.status = 'failed';
      task.error = 'No handler registered';
      await this.messageDB.updateQueueTask(task);
      return;
    }

    // Mark as processing
    task.status = 'processing';
    await this.messageDB.updateQueueTask(task);

    try {
      // Decrypt context
      const context = await this.decryptContext(
        task.encryptedContext,
        task.contextIV
      );

      // Execute handler
      await handler.execute(context);

      // Success
      task.status = 'completed';
      task.processedAt = Date.now();
      await this.messageDB.updateQueueTask(task);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if permanent error
      if (handler.isPermanentError(err)) {
        task.status = 'failed';
        task.error = err.message;
        await this.messageDB.updateQueueTask(task);
        return;
      }

      // Transient error - retry with backoff
      task.retryCount++;

      if (task.retryCount >= task.maxRetries) {
        task.status = 'failed';
        task.error = `Max retries exceeded: ${err.message}`;
      } else {
        task.status = 'pending';
        task.nextRetryAt = Date.now() + this.calculateBackoff(task.retryCount);
        task.error = err.message;
      }

      await this.messageDB.updateQueueTask(task);
    }
  }

  private calculateBackoff(retryCount: number): number {
    const delay = this.baseRetryDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, this.maxRetryDelayMs);
  }

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<QueueStats> {
    return this.messageDB.getQueueStats();
  }

  /**
   * Prune old completed tasks.
   */
  async pruneCompleted(): Promise<number> {
    return this.messageDB.pruneCompletedTasks();
  }

  // Encryption helpers (simplified - in production, use proper key management)
  private async encryptContext(context: any): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
    // For now, use a simple encryption approach
    // In production, derive key from user credentials
    const json = JSON.stringify(context);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    // Generate key and IV
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // TODO: In production, store key reference, not just IV
    // This is simplified for the milestone

    return { encrypted, iv };
  }

  private async decryptContext(encrypted: ArrayBuffer, iv: Uint8Array): Promise<any> {
    // TODO: Implement proper decryption with key retrieval
    // This is a placeholder - real implementation needs key management
    throw new Error('Decryption not implemented - needs key management');
  }
}
```

### Verification (Milestone 5)

- [ ] Tasks can be enqueued
- [ ] Background processor runs
- [ ] Tasks are processed in order within groups
- [ ] Retry logic works with exponential backoff
- [ ] Failed tasks are marked correctly
- [ ] Completed tasks can be pruned
- [ ] Offline detection stops processing
- [ ] TypeScript compiles

### Note on Encryption

The encryption in this milestone is **simplified**. Full encryption-at-rest with proper key management should be completed before using for sensitive data. This milestone focuses on the queue mechanics.

### Rollback Plan
Service can be disabled by not calling `start()`. Queue data in IndexedDB can be ignored.

---

## Milestone 6: UI Feedback 🟢 LOW RISK

**Goal**: Notify users about queue status.
**Value**: Better UX - users know what's happening.
**Risk**: Low - UI-only changes.
**Effort**: 2-3 hours

### Implementation

#### Step 6.1: Create Queue Context

**File**: `src/components/context/ActionQueueContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { QueueStats } from '../../types/actionQueue';
import { useMessageDB } from './MessageDB';

interface ActionQueueContextValue {
  stats: QueueStats;
  isOnline: boolean;
  refreshStats: () => Promise<void>;
}

const ActionQueueContext = createContext<ActionQueueContextValue | null>(null);

export function ActionQueueProvider({ children }: { children: React.ReactNode }) {
  const { actionQueueService } = useMessageDB();
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    failed: 0,
    completed: 0,
    total: 0
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const refreshStats = useCallback(async () => {
    if (actionQueueService) {
      const newStats = await actionQueueService.getStats();
      setStats(newStats);
    }
  }, [actionQueueService]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic stats refresh
  useEffect(() => {
    const interval = setInterval(refreshStats, 2000);
    refreshStats(); // Initial
    return () => clearInterval(interval);
  }, [refreshStats]);

  return (
    <ActionQueueContext.Provider value={{ stats, isOnline, refreshStats }}>
      {children}
    </ActionQueueContext.Provider>
  );
}

export function useActionQueue() {
  const context = useContext(ActionQueueContext);
  if (!context) {
    throw new Error('useActionQueue must be used within ActionQueueProvider');
  }
  return context;
}
```

#### Step 6.2: Add Offline Banner

**File**: `src/components/ui/OfflineBanner.tsx`

```typescript
import React from 'react';
import { useActionQueue } from '../context/ActionQueueContext';
import { t } from '@lingui/core/macro';

export function OfflineBanner() {
  const { isOnline, stats } = useActionQueue();

  if (isOnline && stats.pending === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className="offline-banner offline-banner--offline">
        <span className="offline-banner__icon">⚠️</span>
        <span className="offline-banner__text">
          {t`You're offline`}
          {stats.pending > 0 && ` - ${stats.pending} ${t`actions queued`}`}
        </span>
      </div>
    );
  }

  // Online but has pending
  if (stats.pending > 0) {
    return (
      <div className="offline-banner offline-banner--syncing">
        <span className="offline-banner__spinner" />
        <span className="offline-banner__text">
          {t`Syncing`} ({stats.pending} {t`pending`})
        </span>
      </div>
    );
  }

  return null;
}
```

#### Step 6.3: Add to Layout

**File**: `src/components/Layout.tsx`

```typescript
import { OfflineBanner } from './ui/OfflineBanner';

// In the Layout component, add:
<OfflineBanner />
```

### Verification (Milestone 6)

- [ ] Offline banner appears when offline
- [ ] Pending count shows in banner
- [ ] Banner updates in real-time
- [ ] Banner disappears when queue empty and online
- [ ] Styles look correct on all themes
- [ ] TypeScript compiles

### Rollback Plan
Remove the banner component. Context can stay (unused).

---

## Milestone 7: Full Integration 🟡 MEDIUM RISK

**Goal**: Wire everything together for production use.
**Value**: Complete feature working end-to-end.
**Risk**: Medium - Integration complexity.
**Effort**: 3-4 hours

### Implementation

This milestone connects all the pieces:

1. **Register task handlers** for each action type
2. **Update WebsocketProvider** to use queue
3. **Add full encryption-at-rest** with proper key management
4. **Implement multi-tab coordination**

This milestone is intentionally less detailed because:
- It depends on learnings from previous milestones
- Implementation details may change based on earlier discoveries
- Should be planned after Milestones 1-6 are complete

### Verification (Milestone 7)

- [ ] Messages persist across refresh
- [ ] Config saves persist across crash
- [ ] Offline → Online syncs correctly
- [ ] Multi-tab doesn't cause duplicates
- [ ] All existing functionality works
- [ ] Performance meets targets

---

## Risk Summary

| Milestone | Risk | Can Stop After? | Rollback Difficulty |
|-----------|------|-----------------|---------------------|
| 1. Debouncing | 🟢 LOW | ✅ Yes | Easy |
| 2. Worker PoC | 🟡 MEDIUM | ✅ Yes | Trivial (test files only) |
| 3. Worker Integration | 🟡 MEDIUM | ✅ Yes | Easy (fallback built-in) |
| 4. Queue Foundation | 🟡 MEDIUM | ✅ Yes | Easy (unused if not integrated) |
| 5. Queue Engine | 🟡 MEDIUM | ✅ Yes | Medium |
| 6. UI Feedback | 🟢 LOW | ✅ Yes | Easy |
| 7. Full Integration | 🟡 MEDIUM | ✅ Yes | Medium |

---

## Files Created/Modified

### New Files

**Development/Testing (Milestone 2)**:
- `src/dev/workers/test-crypto.worker.ts` - PoC worker for validation
- `src/dev/hooks/useWorkerTest.ts` - Dev hook for testing worker

**Production Code**:
- `src/workers/configCrypto.worker.ts` (Milestone 3)
- `src/services/CryptoWorkerService.ts` (Milestone 3)
- `src/types/actionQueue.ts` (Milestone 4)
- `src/services/ActionQueueService.ts` (Milestone 5)
- `src/components/context/ActionQueueContext.tsx` (Milestone 6)
- `src/components/ui/OfflineBanner.tsx` (Milestone 6)

### Modified Files
- `src/services/ConfigService.ts` (Milestones 1, 3)
- `src/db/messages.ts` (Milestone 4)
- `src/hooks/business/folders/useFolderDragAndDrop.ts` (Milestone 1)
- `src/hooks/business/spaces/useSpaceDragAndDrop.ts` (Milestone 1)
- `src/components/Layout.tsx` (Milestone 6)
- `src/components/context/WebsocketProvider.tsx` (Milestone 7)

---

## Definition of Done

- [ ] All milestones complete
- [ ] UI doesn't freeze during config saves
- [ ] Data persists across crashes/refreshes
- [ ] Offline mode queues actions correctly
- [ ] User sees appropriate feedback
- [ ] No security regressions
- [ ] All platforms tested (Electron + Web)
- [ ] TypeScript compiles without errors
- [ ] Task updated with learnings

---

## Related Documentation

- **GitHub Issue**: [#65 - UserSettingsModal Performance Analysis](https://github.com/QuilibriumNetwork/quorum-desktop/issues/65)
- **Original Commit**: [81c2c5ca](https://github.com/QuilibriumNetwork/quorum-desktop/commit/81c2c5caaf92f7ecd5fdd157847ec773a63cd91b)
- **Previous Tasks** (merged into this):
  - `.agents/tasks/action-queue-persistent-background-operations.md`
  - `.agents/tasks/web-worker-config-crypto-prevent-ui-freeze.md`

---

_Created: 2025-12-13_
_Last Updated: 2025-12-13 (timing data corrected based on actual measurements)_
_Status: Ready for Implementation_
