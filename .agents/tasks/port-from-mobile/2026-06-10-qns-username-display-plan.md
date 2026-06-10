# QNS Usernames on Desktop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let desktop users be found/DMed by their QNS `@username`, see verified QNS names (`name.q`) in profiles and mentions, and prevent custom names from spoofing the `.q` trust marker — all without changing any `quorum-mobile` behavior.

**Architecture:** A single pure name-resolution helper in `@quilibrium/quorum-shared` is the spine (per-space override → QNS username → display name → address). A minimal QNS resolver (one endpoint, `GET /resolve/:name`, plus ed448-pubkey→address derivation) also lives in shared. Desktop consumes both; mobile keeps its own QNS client and is insulated by its published-version pin. The `.q` suffix is render-time only; dot-validation in the shared display-name validator makes it unspoofable.

**Tech Stack:** TypeScript, React, vitest (shared tests), React Query, `@quilibrium/quorum-shared` (consumed via `link:` on desktop, published version on mobile), `@noble/hashes` (sha256), `multihashes` + `bs58` (address derivation, already mobile deps).

---

## Hard constraint (read before every shared task)

**`quorum-mobile` must behave identically after this lands.** Enforce on every shared change:
- **Additive only** — new files; never edit/rename/move existing shared modules mobile imports, never change existing export signatures.
- **Optional-only type fields** — any field added to a shared type is `?:`-optional.
- **Don't reroute mobile** — mobile keeps its own QNS client + name ordering; the new helper is desktop-consumed only.
- **Mobile is insulated**: `quorum-mobile/package.json` pins `"@quilibrium/quorum-shared": "2.1.0-20"` (published, not `link:`), so shared working-tree changes can't reach mobile until it bumps. Build/typecheck mobile against the new shared version before any future bump.

## File structure

**Created in `quorum-shared`:**
- `src/qns/resolver.ts` — minimal QNS resolver (`resolveName`, `QNS_BASE_URL`).
- `src/qns/deriveAddress.ts` — ed448 pubkey hex → `Qm…` address (ported from mobile).
- `src/qns/deriveAddress.test.ts`, `src/qns/resolver.test.ts`
- `src/qns/index.ts` — barrel for the qns module.
- `src/utils/resolveDisplayName.ts` — the resolution-rule helper (the spine).
- `src/utils/resolveDisplayName.test.ts`

**Modified in `quorum-shared`:**
- `src/utils/validation.ts` — add `'qns-suffix'` reserved type + dot rule to `validateDisplayName` / `getReservedNameType`.
- `src/utils/validation.test.ts` (or new sibling) — dot-rule tests.
- `src/utils/index.ts` — export `resolveDisplayName`.
- `src/index.ts` (package root) — export the `qns` module (verify barrel path).

**Created in `quorum-desktop`:**
- `src/hooks/business/qns/useResolveQnsName.ts` — React Query wrapper around the shared resolver + `deriveAddress`.
- `src/hooks/business/qns/index.ts`

**Modified in `quorum-desktop`:**
- `src/hooks/business/conversations/useDirectMessageCreation.ts` — `@`-prefix detection → QNS resolution → resolved address.
- `src/components/modals/NewDirectMessageModal.tsx` — input affordance + resolution status.
- `src/services/PublicProfileService.ts` — publish v2 with `primary_username`; read it back.
- `src/api/baseTypes.ts` — confirm `primary_username` already present (it is).
- Profile-rendering surface(s) that show member identity — render `name.q` via the helper.
- `src/utils/mentionPillDom.ts` + `src/hooks/business/mentions/useMentionInput.ts` — pill render + autocomplete candidate names via the helper.

> **Note on uncertainty:** the exact desktop profile-card component is not yet pinned (mobile's equivalent is `UserProfileModal`/`UnifiedProfileHeader`). Task 9 begins by locating it; do not assume a path.

---

## Stage 1 — Shared spine (resolver + helper + validation)

### Task 1: Port `deriveAddress` into shared

**Files:**
- Create: `quorum-shared/src/qns/deriveAddress.ts`
- Test: `quorum-shared/src/qns/deriveAddress.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// quorum-shared/src/qns/deriveAddress.test.ts
import { describe, it, expect } from 'vitest';
import { deriveAddress } from './deriveAddress';

describe('deriveAddress', () => {
  it('derives a Qm… address from a hex ed448 public key', () => {
    // 57-byte ed448 public key, hex (114 hex chars)
    const pubHex =
      'a8b3f6c2d4e5061728394a5b6c7d8e9f0011223344556677889900aabbccddeeff' +
      '00112233445566778899aabbccddee0011223344556677';
    const addr = deriveAddress(pubHex);
    expect(addr.startsWith('Qm')).toBe(true);
    expect(addr.length).toBe(46);
  });

  it('accepts a 0x-prefixed hex string', () => {
    const pubHex = '0x' + 'ab'.repeat(57);
    expect(deriveAddress(pubHex).startsWith('Qm')).toBe(true);
  });

  it('accepts a Uint8Array', () => {
    const bytes = new Uint8Array(57).fill(7);
    expect(deriveAddress(bytes).startsWith('Qm')).toBe(true);
  });

  it('is deterministic', () => {
    const bytes = new Uint8Array(57).fill(3);
    expect(deriveAddress(bytes)).toBe(deriveAddress(bytes));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quorum-shared && yarn vitest run src/qns/deriveAddress.test.ts`
Expected: FAIL — cannot resolve `./deriveAddress`.

- [ ] **Step 3: Confirm deps exist, then write the implementation**

First check `multihashes`, `bs58`, and a sha256 are available to shared:
Run: `cd quorum-shared && node -e "require('multihashes');require('bs58');console.log('ok')"` and `grep -n '@noble/hashes\|\"bs58\"\|multihashes' package.json`
- If `multihashes`/`bs58` are NOT shared deps, prefer `@noble/hashes/sha2` (sha256) + the multihash prefix bytes manually rather than adding deps. The manual multihash for sha2-256 is the 2-byte prefix `0x12 0x20` followed by the 32-byte digest, then base58btc-encode. Use shared's existing base58 if present (`grep -rn "base58\|bs58\|baseDecode" src/`). Adapt the code below to whatever shared already has — do NOT add a new dependency without flagging it.

```ts
// quorum-shared/src/qns/deriveAddress.ts
import { sha256 } from '@noble/hashes/sha2';
import bs58 from 'bs58';
import multihashes from 'multihashes';

/**
 * Derive a libp2p-style "Qm…" address from an ed448 public key.
 * SHA-256 → multihash(sha2-256) → base58btc. Mirrors quorum-mobile's
 * services/onboarding/keyService.ts deriveAddress so both apps agree.
 */
export function deriveAddress(publicKey: Uint8Array | string): string {
  const keyBytes =
    typeof publicKey === 'string'
      ? hexToBytes(publicKey.replace(/^0x/, ''))
      : publicKey;
  const hash = sha256(keyBytes);
  const multihash = multihashes.encode(hash, 'sha2-256');
  return bs58.encode(multihash);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? '0' + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quorum-shared && yarn vitest run src/qns/deriveAddress.test.ts`
Expected: PASS (4 tests). If `length` ≠ 46, the multihash/encoding path differs from mobile — reconcile against mobile's `deriveAddress` output for a known key before proceeding.

- [ ] **Step 5: Commit**

```bash
git add quorum-shared/src/qns/deriveAddress.ts quorum-shared/src/qns/deriveAddress.test.ts
git commit -m "feat(shared/qns): add ed448-pubkey to Qm-address derivation"
```

---

### Task 2: Minimal QNS resolver

**Files:**
- Create: `quorum-shared/src/qns/resolver.ts`
- Test: `quorum-shared/src/qns/resolver.test.ts`

`NameRecord` already exists in shared (`src/farcaster/types.ts`): `{ header, address, resolveKey?, metadata, … }`. Reuse it — do not redefine.

- [ ] **Step 1: Write the failing test**

```ts
// quorum-shared/src/qns/resolver.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveName, QNS_BASE_URL } from './resolver';

afterEach(() => vi.restoreAllMocks());

describe('resolveName', () => {
  it('GETs /resolve/:name and returns the record', async () => {
    const record = { header: {}, address: 'QmABC', resolveKey: 'deadbeef', metadata: null };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => record,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveName('niccolo');
    expect(fetchMock).toHaveBeenCalledWith(`${QNS_BASE_URL}/resolve/niccolo`, expect.any(Object));
    expect(result?.address).toBe('QmABC');
  });

  it('url-encodes the name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ address: 'Q' }) });
    vi.stubGlobal('fetch', fetchMock);
    await resolveName('a b');
    expect(fetchMock).toHaveBeenCalledWith(`${QNS_BASE_URL}/resolve/a%20b`, expect.any(Object));
  });

  it('returns null on 404 (name not registered)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await resolveName('nope')).toBeNull();
  });

  it('throws on non-404 errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(resolveName('x')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quorum-shared && yarn vitest run src/qns/resolver.test.ts`
Expected: FAIL — cannot resolve `./resolver`.

- [ ] **Step 3: Write the implementation**

```ts
// quorum-shared/src/qns/resolver.ts
import type { NameRecord } from '../farcaster/types';

export const QNS_BASE_URL = 'https://names.quilibrium.com';

/**
 * Resolve a single QNS name to its record. Returns null when the name is not
 * registered (404). Throws on other transport/server errors so callers can
 * distinguish "no such name" from "lookup failed". This is the ONLY QNS
 * endpoint the username feature needs — registration/marketplace are excluded.
 */
export async function resolveName(name: string): Promise<NameRecord | null> {
  const res = await fetch(`${QNS_BASE_URL}/resolve/${encodeURIComponent(name)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`QNS resolve failed: ${res.status}`);
  return (await res.json()) as NameRecord;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quorum-shared && yarn vitest run src/qns/resolver.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the qns barrel + verify package export**

```ts
// quorum-shared/src/qns/index.ts
export * from './resolver';
export * from './deriveAddress';
```

Then confirm the package root re-exports it. Run: `grep -n "export" quorum-shared/src/index.ts | head`
- If there is a per-module export pattern, add `export * from './qns';` following the existing style. If shared exports everything via `utils`, instead add the qns exports where siblings like `farcaster` are exported. Match the existing convention exactly — do not invent a new export style.

- [ ] **Step 6: Commit**

```bash
git add quorum-shared/src/qns/
git commit -m "feat(shared/qns): add minimal QNS name resolver (resolve only)"
```

---

### Task 3: The name-resolution helper (the spine)

**Files:**
- Create: `quorum-shared/src/utils/resolveDisplayName.ts`
- Test: `quorum-shared/src/utils/resolveDisplayName.test.ts`
- Modify: `quorum-shared/src/utils/index.ts` (add export)

Reuses the shared `SpaceMember`/`PublicProfile` types (`src/types/user.ts`), which already carry `display_name?`, `name?`, `address`, and `primary_username?`. The helper is pure and platform-agnostic; it returns the chosen name plus a flag — the `.q` suffix + styling are applied by the rendering layer, NOT here.

- [ ] **Step 1: Write the failing test**

```ts
// quorum-shared/src/utils/resolveDisplayName.test.ts
import { describe, it, expect } from 'vitest';
import { resolveDisplayName } from './resolveDisplayName';

const base = { address: 'QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX' };

describe('resolveDisplayName', () => {
  it('uses the per-space override when present (highest priority)', () => {
    const r = resolveDisplayName(
      { ...base, display_name: 'NicMod', primary_username: 'niccolo', name: 'Niccolo' },
      { spaceOverrideName: 'Nic (mod)' }
    );
    expect(r.name).toBe('Nic (mod)');
    expect(r.isQnsVerified).toBe(false);
  });

  it('uses the QNS username when there is no space override', () => {
    const r = resolveDisplayName(
      { ...base, primary_username: 'niccolo', display_name: 'Whatever' },
      {}
    );
    expect(r.name).toBe('niccolo');
    expect(r.isQnsVerified).toBe(true);
  });

  it('falls back to the global display name when no override and no QNS name', () => {
    const r = resolveDisplayName({ ...base, display_name: 'Niccolo A.' }, {});
    expect(r.name).toBe('Niccolo A.');
    expect(r.isQnsVerified).toBe(false);
  });

  it('falls back to `name` then truncated address when nothing else exists', () => {
    const r = resolveDisplayName({ ...base }, {});
    expect(r.isQnsVerified).toBe(false);
    expect(r.name.startsWith('Qm')).toBe(true);
    expect(r.name.length).toBeLessThan(base.address.length); // truncated
  });

  it('treats empty/whitespace names as absent', () => {
    const r = resolveDisplayName(
      { ...base, display_name: '   ', primary_username: 'niccolo' },
      { spaceOverrideName: '  ' }
    );
    expect(r.name).toBe('niccolo');
    expect(r.isQnsVerified).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quorum-shared && yarn vitest run src/utils/resolveDisplayName.test.ts`
Expected: FAIL — cannot resolve `./resolveDisplayName`.

- [ ] **Step 3: Write the implementation**

```ts
// quorum-shared/src/utils/resolveDisplayName.ts
import type { SpaceMember, PublicProfile } from '../types/user';

type Resolvable = Partial<Pick<SpaceMember & PublicProfile, 'display_name' | 'name' | 'primary_username'>> & {
  address: string;
};

export interface ResolvedName {
  /** The readable name to display. Never empty. */
  name: string;
  /** True only when `name` is the user's QNS username (render with `.q`). */
  isQnsVerified: boolean;
}

const present = (s?: string | null): string | null => {
  const t = (s ?? '').trim();
  return t.length ? t : null;
};

const truncate = (addr: string): string =>
  addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

/**
 * The single name-resolution rule for the whole app. Most-specific wins:
 *   per-space override → QNS primary_username → global display name → name → address.
 * Pure + platform-agnostic. The `.q` suffix and accent styling are applied by
 * the rendering layer based on `isQnsVerified`, not baked into `name`.
 */
export function resolveDisplayName(
  member: Resolvable,
  opts: { spaceOverrideName?: string | null } = {}
): ResolvedName {
  const override = present(opts.spaceOverrideName);
  if (override) return { name: override, isQnsVerified: false };

  const qns = present(member.primary_username);
  if (qns) return { name: qns, isQnsVerified: true };

  const display = present(member.display_name);
  if (display) return { name: display, isQnsVerified: false };

  const name = present(member.name);
  if (name) return { name, isQnsVerified: false };

  return { name: truncate(member.address), isQnsVerified: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quorum-shared && yarn vitest run src/utils/resolveDisplayName.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Export from the utils barrel**

Add to `quorum-shared/src/utils/index.ts` (alphabetically near the others):
```ts
export * from './resolveDisplayName';
```

- [ ] **Step 6: Commit**

```bash
git add quorum-shared/src/utils/resolveDisplayName.ts quorum-shared/src/utils/resolveDisplayName.test.ts quorum-shared/src/utils/index.ts
git commit -m "feat(shared): add resolveDisplayName name-resolution helper"
```

---

### Task 4: Dot/`.q` validation for custom names

**Files:**
- Modify: `quorum-shared/src/utils/validation.ts`
- Test: `quorum-shared/src/utils/validation.test.ts` (append; create if absent — match `mentions.test.ts` style)

`validation.ts` already has `normalizeHomoglyphs`, `getReservedNameType` (returns `'mention' | 'impersonation' | null`), and `validateDisplayName`. Extend the reserved-type union with `'qns-suffix'` and reject any dot in custom names after normalization.

- [ ] **Step 1: Write the failing test**

```ts
// append to quorum-shared/src/utils/validation.test.ts
import { describe, it, expect } from 'vitest';
import { getReservedNameType, validateDisplayName } from './validation';

describe('QNS .q suffix protection', () => {
  it('rejects a name ending in .q', () => {
    expect(getReservedNameType('niccolo.q')).toBe('qns-suffix');
  });
  it('rejects any dotted name (dots reserved for QNS)', () => {
    expect(getReservedNameType('foo.bar')).toBe('qns-suffix');
  });
  it('rejects lookalike/full-width dot bypasses', () => {
    expect(getReservedNameType('niccolo．q')).toBe('qns-suffix'); // U+FF0E
    expect(getReservedNameType('niccolo﹒q')).toBe('qns-suffix'); // U+FE52
  });
  it('rejects trailing-space bypass', () => {
    expect(getReservedNameType('niccolo.q ')).toBe('qns-suffix');
  });
  it('allows ordinary names without dots', () => {
    expect(getReservedNameType('Niccolo A')).toBeNull();
  });
  it('validateDisplayName surfaces an error for dotted names', () => {
    expect(validateDisplayName('niccolo.q')).not.toBeNull();
    expect(validateDisplayName('Niccolo')).toBeNull();
  });
});
```

> Adjust the expected return of `validateDisplayName` to its actual shape — read the current function first; it may return a result object rather than a string/null. Mirror its existing convention in the assertion.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quorum-shared && yarn vitest run src/utils/validation.test.ts`
Expected: FAIL — `getReservedNameType` returns `null` for dotted names.

- [ ] **Step 3: Implement**

In `validation.ts`:
1. Add a dot-normalizing + detection helper:
```ts
/**
 * QNS names are dotless and the `.q` suffix is applied only at render time,
 * so any dot in a *custom* display name is illegitimate and could spoof the
 * `.q` verified marker. Normalize confusable dots + trim before checking.
 */
const CONFUSABLE_DOTS = /[.．﹒․]/g; // . ． ﹒ ․
export const containsReservedDot = (name: string): boolean =>
  name.replace(CONFUSABLE_DOTS, '.').trim().includes('.');
```
2. Extend the reserved type union and `getReservedNameType` (check the dot rule BEFORE the others so the error is specific):
```ts
export type ReservedNameType = 'mention' | 'impersonation' | 'qns-suffix' | null;

export const getReservedNameType = (name: string): ReservedNameType => {
  if (containsReservedDot(name)) return 'qns-suffix';
  if (isMentionReserved(name)) return 'mention';
  if (isImpersonationName(name)) return 'impersonation';
  return null;
};
```
3. Ensure `validateDisplayName` consults `getReservedNameType` (it likely already does for impersonation/mention) and returns a clear error for `'qns-suffix'`, e.g. "Names can't contain a dot — the .q suffix is reserved for verified QNS names." Match the existing error-shape/return convention.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quorum-shared && yarn vitest run src/utils/validation.test.ts`
Expected: PASS. Also run the FULL validation suite to confirm no regression to existing impersonation/mention tests:
Run: `cd quorum-shared && yarn vitest run src/utils/validation.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add quorum-shared/src/utils/validation.ts quorum-shared/src/utils/validation.test.ts
git commit -m "feat(shared): reject dotted custom names to protect the .q QNS marker"
```

---

### Task 5: Stage-1 gate — build shared + verify mobile is unaffected

- [ ] **Step 1: Build shared**

Run: `cd quorum-shared && yarn build`
Expected: clean build; the new `qns` module + `resolveDisplayName` are in the output.

- [ ] **Step 2: Typecheck shared tests**

Run: `cd quorum-shared && yarn test:run`
Expected: all suites pass.

- [ ] **Step 3: Verify mobile is structurally insulated**

Run: `grep -n '@quilibrium/quorum-shared' quorum-mobile/package.json`
Expected: a pinned published version (`2.1.0-20` or similar), NOT `link:`. Confirms mobile cannot be affected until it bumps. Record the pin in the commit message. Do NOT bump mobile's dependency in this work.

- [ ] **Step 4: Commit (if any build-output/lockfile changes)**

```bash
git add -A
git commit -m "chore(shared): build QNS resolver + name helper; mobile pinned, unaffected"
```

---

## Stage 2 — DM search by `@username` (the true port)

### Task 6: Desktop QNS resolution hook

**Files:**
- Create: `quorum-desktop/src/hooks/business/qns/useResolveQnsName.ts`
- Create: `quorum-desktop/src/hooks/business/qns/index.ts`

Confirm desktop links shared locally first: `grep -n '@quilibrium/quorum-shared' quorum-desktop/package.json` (expect `link:` or a version that includes the new exports). If `link:`, the new exports are available immediately after Stage 1's build.

- [ ] **Step 1: Write the hook**

```ts
// quorum-desktop/src/hooks/business/qns/useResolveQnsName.ts
import { useQuery } from '@tanstack/react-query';
import { resolveName, deriveAddress } from '@quilibrium/quorum-shared';

export interface ResolvedQnsName {
  /** The Qm… address the name points to, or null if not publicly resolvable. */
  address: string | null;
  /** The raw record (for debugging / future use). */
  record: Awaited<ReturnType<typeof resolveName>>;
}

/**
 * Resolve a QNS @username to a Qm… address via the shared resolver.
 * `name` should already have the leading '@' stripped. Disabled for empty input.
 * 5-minute staleTime matches mobile's profile cache window.
 */
export const useResolveQnsName = (name: string, opts?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['qns', 'resolve', name],
    enabled: (opts?.enabled ?? true) && name.length >= 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ResolvedQnsName> => {
      const record = await resolveName(name);
      const address =
        record?.resolveKey ? deriveAddress(record.resolveKey) : null;
      return { address, record };
    },
  });
```

> Verify the React Query import path matches the rest of desktop (`grep -rn "@tanstack/react-query" src/hooks/business | head -1`). Use whatever the codebase already uses.

- [ ] **Step 2: Create the barrel**

```ts
// quorum-desktop/src/hooks/business/qns/index.ts
export * from './useResolveQnsName';
```

- [ ] **Step 3: Typecheck**

Run: `cd quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no new errors (if `resolveName`/`deriveAddress` are unresolved, Stage 1's shared build/link did not propagate — rebuild shared, re-link).

- [ ] **Step 4: Commit**

```bash
git add quorum-desktop/src/hooks/business/qns/
git commit -m "feat(qns): desktop hook to resolve @username to address"
```

---

### Task 7: Wire `@username` into DM creation

**Files:**
- Modify: `quorum-desktop/src/hooks/business/conversations/useDirectMessageCreation.ts`
- Modify: `quorum-desktop/src/components/modals/NewDirectMessageModal.tsx`

Today the hook validates `address` via `useAddressValidation` and navigates to `/messages/{address}`. We add: when input starts with `@`, resolve it to an address first, then feed the resolved address into the existing path.

- [ ] **Step 1: Add @-detection + resolution in the hook**

In `useDirectMessageCreation.ts`, after the existing imports add:
```ts
import { useResolveQnsName } from '../qns';
```
Then derive the lookup target:
```ts
const isUsername = address.startsWith('@');
const usernameQuery = isUsername ? address.slice(1).trim() : '';
const { data: qns, isFetching: isResolvingName } = useResolveQnsName(usernameQuery, {
  enabled: isUsername,
});
// The address actually used downstream: resolved Qm… for @names, raw input otherwise.
const effectiveAddress = isUsername ? (qns?.address ?? '') : address;
```
Replace downstream uses of `address` for validation/navigation/existing-conversation lookup with `effectiveAddress`. Specifically:
- `useAddressValidation(effectiveAddress)` instead of `useAddressValidation(address)`.
- `existingConversation` matches on `effectiveAddress`.
- `handleSubmit` navigates to `'/messages/' + effectiveAddress` and must early-return if `isUsername && !effectiveAddress`.
- Extend `buttonText`: while `isResolvingName`, return `t\`Looking up @${usernameQuery}…\``; if `isUsername && !qns?.address && !isResolvingName && usernameQuery`, the error path should read "No user found for that username."
- `isButtonDisabled` also true while `isResolvingName` or when `isUsername && !effectiveAddress`.

Keep `handleAddressChange` as-is (it already trims). Do not strip the `@` from the displayed input — only from the lookup query.

- [ ] **Step 2: Update the modal copy/affordance**

In `NewDirectMessageModal.tsx`, change the input placeholder to accept both forms, e.g. `t\`User address or @username\``, and surface the hook's resolving/not-found states through the existing error/button props (the modal already renders `displayError` + `buttonText` + `isButtonDisabled`). No structural change.

- [ ] **Step 3: Typecheck + lint**

Run: `cd quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint`
Expected: clean.

- [ ] **Step 4: Manual verification (record result)**

Run the app (`/run` or the project's dev command). In New Direct Message:
- Type a raw `Qm…` address → behaves exactly as before.
- Type `@<a-known-registered-name>` → shows "Looking up…", then resolves and lets you start the DM; the conversation targets the resolved address.
- Type `@<garbage>` → shows "No user found for that username", send disabled.
Record pass/fail in the task notes.

- [ ] **Step 5: Commit**

```bash
git add quorum-desktop/src/hooks/business/conversations/useDirectMessageCreation.ts quorum-desktop/src/components/modals/NewDirectMessageModal.tsx
git commit -m "feat(dm): start a DM by @username via QNS resolution"
```

---

## Stage 3 — Profile `.q` display + v2 publish + validation wiring

### Task 8: Publish + read `primary_username` (v2 public profile)

**Files:**
- Modify: `quorum-desktop/src/services/PublicProfileService.ts`
- Reference: `quorum-desktop/src/api/baseTypes.ts` (`primary_username?` already present — verify, don't duplicate)
- Reference (canonical form): `quorum-mobile/services/profile/publicProfile.ts:86-111`

Desktop currently hard-codes v1 and drops `primary_username`. Add v2: when the local user has a QNS primary name, sign and publish the v2 payload; always read `primary_username` back.

- [ ] **Step 1: Confirm the canonical v2 signing string**

Read `quorum-mobile/services/profile/publicProfile.ts` lines ~86-111. The v2 signed payload is:
```
public-profile-v2:${address}:${displayName}:${profileImage}:${bio}:${primaryUsername}:  + int64BE(timestamp)
```
Desktop's v1 omits `:${primaryUsername}:`. Match mobile's v2 byte-for-byte (same field order, same separators, same timestamp encoding desktop's `ConfigService`/`int64ToBytes` already uses).

- [ ] **Step 2: Write/extend a unit test for the payload builder**

If `PublicProfileService` has a pure payload-building function, test that v2 is produced when `primaryUsername` is set and v1 otherwise. If signing is inline, extract the canonical-string builder into a small pure function first, then test it:
```ts
// e.g. quorum-desktop/src/services/publicProfilePayload.test.ts
import { describe, it, expect } from 'vitest';
import { buildPublicProfileCanonical } from './publicProfilePayload';

it('builds v2 when primaryUsername is present', () => {
  const s = buildPublicProfileCanonical({
    address: 'QmA', displayName: 'Nic', profileImage: '', bio: '', primaryUsername: 'niccolo',
  });
  expect(s.startsWith('public-profile-v2:QmA:Nic::')).toBe(true);
  expect(s).toContain(':niccolo:');
});

it('builds v1 when primaryUsername is absent', () => {
  const s = buildPublicProfileCanonical({
    address: 'QmA', displayName: 'Nic', profileImage: '', bio: '',
  });
  expect(s.startsWith('public-profile-v1:')).toBe(true);
});
```
Run it (expect FAIL), implement the extraction to satisfy it, run again (expect PASS). Use the project's desktop test runner (`grep '"test"' quorum-desktop/package.json`).

- [ ] **Step 3: Implement publish v2 + read-back**

- Publish: include `primary_username` in the POST body and switch the signed payload to v2 only when a primary username exists; otherwise keep v1 unchanged (no behavior change for users without a QNS name).
- Read: ensure the fetched `PublicProfileResponse.primary_username` is surfaced wherever desktop maps a public profile into member/profile data (so the helper can read it).

- [ ] **Step 4: Typecheck + tests**

Run: `cd quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck` and the desktop test command.
Expected: clean; new payload tests pass; existing PublicProfileService tests still pass.

- [ ] **Step 5: Commit**

```bash
git add quorum-desktop/src/services/PublicProfileService.ts quorum-desktop/src/services/publicProfilePayload*.ts
git commit -m "feat(profile): publish/read v2 public profile with primary_username"
```

---

### Task 9: Render `name.q` in profile UI via the helper

**Files:**
- Locate first, then modify: the desktop profile-card component(s) that show a user's identity.
- Use: `resolveDisplayName` from `@quilibrium/quorum-shared`.

- [ ] **Step 1: Locate the profile component(s)**

Run: `grep -rln "primary_username\|display_name\|truncateAddress\|UserProfile" quorum-desktop/src/components | grep -i profile`
Identify where a tapped user's profile/identity is rendered (the desktop analog of mobile's `UserProfileModal`/`UnifiedProfileHeader`). Record the chosen file path(s) in the task notes before editing.

- [ ] **Step 2: Render the resolved name + `.q` handle**

In the chosen component, compute the name via the helper and render the QNS handle as a separate accent-colored line when verified:
```tsx
import { resolveDisplayName } from '@quilibrium/quorum-shared';
// …
const { name, isQnsVerified } = resolveDisplayName(member, { spaceOverrideName });
// primary line:
<span className="profile-name">{name}</span>
// handle line (only when the QNS name is NOT already the primary line, OR always, per design):
{member.primary_username && (
  <span className="profile-qns-handle">@{member.primary_username}<span className="qns-suffix">.q</span></span>
)}
```
Use the project's existing styling tokens for accent color (match how Farcaster handles / addresses are already styled in that component). Do NOT introduce arbitrary Tailwind values where a token exists.

> Design note: the spec specifies `.q` accent styling and "no badge". The handle is the trust signal. Keep `@name.q` consistent (the `@` prefix + `.q` suffix together; this reconciles mobile's two inconsistent treatments into one).

- [ ] **Step 3: Typecheck + lint + manual check**

Run: `cd quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint`
Manual: open the profile of a user who has published a QNS primary name → see `@name.q` in accent color; a user without one → no handle, name unchanged. Record result.

- [ ] **Step 4: Commit**

```bash
git add quorum-desktop/src/components/<profile-files>
git commit -m "feat(profile): show verified QNS @name.q handle on profile cards"
```

---

### Task 10: Hook dot-validation into the settings inputs

**Files:**
- Modify: `quorum-desktop/src/hooks/business/validation/useDisplayNameValidation.ts` (verify it already routes through shared `validateDisplayName` — it does; the dot rule lands automatically once Stage 1 Task 4 is built/linked).
- Verify consumers: `UserSettingsModal/General.tsx` (global) + `SpaceSettingsModal/Account.tsx` (per-space override) both surface the error.

- [ ] **Step 1: Confirm propagation**

`useDisplayNameValidation` calls shared `validateDisplayName`, which now rejects dotted names (Task 4). Confirm both modals feed their input through this hook (or its non-hook `validateDisplayName` sibling) and render the returned error via their existing `validationError`/`displayNameError` props.

Run: `grep -rn "useDisplayNameValidation\|validateDisplayName" quorum-desktop/src/components/modals/UserSettingsModal quorum-desktop/src/components/modals/SpaceSettingsModal quorum-desktop/src/hooks`
- If a modal validates inline instead of via the hook, route it through `useDisplayNameValidation` so the dot rule applies in both places.

- [ ] **Step 2: Manual verification**

In User Settings → display name: type `niccolo.q` → inline error appears, save disabled. Type `Niccolo` → no error. Repeat in Space Settings → per-space name. Record result.

- [ ] **Step 3: Commit (only if a modal needed rerouting)**

```bash
git add quorum-desktop/src/components/modals/<changed>
git commit -m "feat(settings): block dotted display names (protects .q marker)"
```

---

## Stage 4 — Mentions by QNS username

### Task 11: QNS name in autocomplete candidates + pill render

**Files:**
- Modify: `quorum-desktop/src/hooks/business/mentions/useMentionInput.ts` (candidate filtering/labels)
- Modify: `quorum-desktop/src/utils/mentionPillDom.ts` (pill display name)
- Use: `resolveDisplayName` from shared.

Stored mention token stays `@<address>` (unchanged wire format). Only the *displayed* name + autocomplete candidate label change, both via the helper. Space-members-only — no compose-time QNS network call.

- [ ] **Step 1: Confirm the candidate source carries `primary_username`**

`useMentionInput` receives a `users` array. Confirm those user objects include `primary_username` (they will once Task 8's read-back populates member/profile data). If the array is built from a member source that strips it, ensure `primary_username` is carried through (additive field — no signature change).

Run: `grep -rn "useMentionInput\|users=" quorum-desktop/src/components/message/MessageComposer.tsx | head`

- [ ] **Step 2: Use the helper for the candidate label + match text**

In `useMentionInput.ts`, where each candidate's display label is computed and where the filter matches the typed query, derive the name via `resolveDisplayName(user, { spaceOverrideName })` and also allow matching against `user.primary_username` so typing `@nic` matches `niccolo`. Keep matching against existing `display_name`/`name`/`address` too (additive).

- [ ] **Step 3: Use the helper for the pill display name**

In `mentionPillDom.ts`, the pill's `displayName` comes from `option.data.displayName`. Ensure the data passed in (from `useMentionInput`) is the helper-resolved name, and when `isQnsVerified`, render the `.q` marker on the pill text or via a class. Keep `dataset.mentionAddress` = the address (unchanged storage).

- [ ] **Step 4: Typecheck + lint + manual check**

Run: `cd quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint`
Manual: in a space with a member who has a QNS name, type `@` + part of their QNS name → they appear in the picker shown as `name.q`; select → pill shows the name; send → message renders the mention with the name; the stored content is still `@<address>` (verify via the existing mention regex still matching). Record result.

- [ ] **Step 5: Commit**

```bash
git add quorum-desktop/src/hooks/business/mentions/useMentionInput.ts quorum-desktop/src/utils/mentionPillDom.ts
git commit -m "feat(mentions): show + match space members by verified QNS name"
```

---

### Task 12: Final gate — full verification

- [ ] **Step 1: Shared**

Run: `cd quorum-shared && yarn test:run && yarn build`
Expected: all green, clean build.

- [ ] **Step 2: Desktop**

Run: `cd quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint && yarn build`
Expected: clean.

- [ ] **Step 3: Mobile insulation re-check**

Run: `grep -n '@quilibrium/quorum-shared' quorum-mobile/package.json`
Expected: still the pinned published version, NOT changed by this work. (Optional, if convenient: build mobile against a locally-built shared to confirm additive-only — but mobile must NOT bump its pin as part of this feature.)

- [ ] **Step 4: End-to-end smoke**

Walk all four surfaces once more in the running app: DM by `@username`; profile shows `@name.q`; mention by QNS name; dotted display name rejected in both settings modals. Record results.

- [ ] **Step 5: Final commit / PR prep**

```bash
git add -A
git commit -m "feat(qns): usernames across DM search, profiles, mentions; .q protected"
```

---

## Self-review (completed by plan author)

**Spec coverage:**
- Resolution rule → Task 3. ✓
- Minimal resolver (1 endpoint) + deriveAddress in shared → Tasks 1-2. ✓
- DM search by @username (true port) → Tasks 6-7. ✓
- Profile `.q` display + v2 publish/read → Tasks 8-9. ✓
- Mentions by username (net-new, space-members-only) → Task 11. ✓
- Dot/`.q` validation, normalized → Task 4 + Task 10. ✓
- `.q` render-time only, no badge → Task 9 (handle line) + Task 11 (pill). ✓
- Route-A sourcing (username via published profile, no reverse-lookup) → Task 8 read-back feeds the helper; no `/reverse` used. ✓
- Hard constraint "don't break mobile" → Hard-constraint block + Tasks 5 & 12 gates + additive/optional rules throughout. ✓
- Resolver/helper land first → Stage 1 precedes all consumers. ✓

**Placeholder scan:** No TBD/TODO. Two deliberate "locate first" steps (Task 9 profile component, Task 11 candidate source) include the grep to find the path and require recording it before editing — this is investigation, not a placeholder, because the desktop profile component wasn't pinned during design.

**Type consistency:** `resolveDisplayName(member, { spaceOverrideName })` → `{ name, isQnsVerified }` used identically in Tasks 3, 9, 11. `resolveName` → `NameRecord | null` (shared type) used in Tasks 2, 6. `deriveAddress(hex|bytes)` → `string` used in Tasks 1, 6. `getReservedNameType` → `'mention' | 'impersonation' | 'qns-suffix' | null` in Task 4. Consistent.

**Scope:** One feature, four surfaces, one shared spine. Staged so each stage is independently verifiable. Single plan is appropriate.

---

*Last updated: 2026-06-10*
