---
type: task
title: "Implementation plan: an identity API that cannot express a partial identity"
status: in-progress
priority: high
created: 2026-08-10
updated: 2026-08-13
area: identity resolution / QNS / cross-client architecture
repos: quorum-shared, quorum-desktop, quorum-mobile
source: writing-plans, from the design at 2026-08-10-identity-resolution-architecture-design.md
related:
  - ".agents/issues/2026-08-10-identity-resolution-architecture-design.md (THE DESIGN — read first)"
  - ".agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md (the 18 surfaces; regression checklist)"
---

## Status

**2026-08-11 — desktop shipped in PR #327** (`refactor(identity): member names resolve from an address, through one API`)

What landed: phases A-E complete. `resolveIdentity` over a complete `MemberIdentity` in
quorum-shared (PR #80, merged to `master` as `2efd307`, not published), one desktop identity
provider, `<MemberName>` / `useResolvedName` / `useNameResolver` as the only public API, every call
site migrated, the old resolvers deleted and the lint ratchet emptied. 1385 tests, tsc and lint
clean. The "What actually happened" section below is the record, including where this plan was
wrong.

Still open:

- **Phase F (mobile)** has not started. It is unblocked — shared is merged and awaiting the lead
  dev's publish — and the handoff notes are in the same section below.
- **Task 8's controlled sweep was never run.** Live operator testing substituted for it and found
  eight bugs the suite could not see, but the controlled pass — all 18 surfaces with one address
  pinned to a known non-QNS name as the control arm — has not been done.
- The member sidebar still shows no `.q` for members who have never posted. That is the accepted
  limitation from design decision 3 and only the batch profile endpoint fixes it.

# Identity Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a partial member identity impossible to express, so a name surface cannot silently render the wrong name.

**Architecture:** `quorum-shared` gains `resolveIdentity(identity, {scope})` over a `MemberIdentity` whose fields are all **required and explicitly nullable** — a missing field becomes a compile error instead of a silent ladder inversion. Desktop gains one identity provider keyed on `(address, spaceId?)` and a single `<MemberName>` / `useResolvedName` API; all ~24 call sites migrate to it and an eslint ratchet prevents new direct resolver imports.

**Tech Stack:** TypeScript, React 18, `@tanstack/react-query`, vitest + @testing-library/react, eslint flat config, yarn (never npm).

**Read the design first.** This plan assumes it. In particular do not re-derive constraint 2 (detached surfaces keep their per-space name) — it is a rejected-then-corrected decision.

---

## File Structure

**quorum-shared** (at `E:/GitHub/Quilibrium/quorum-shared`)

| File | Responsibility |
|---|---|
| `src/utils/resolveDisplayName.ts` | MODIFY — becomes `resolveIdentity` over `MemberIdentity`. Keeps `presentUnreserved` (the forgery guard) untouched. |
| `src/utils/resolveIdentity.test.ts` | CREATE — the ladder's full truth table. |

**quorum-desktop**

| File | Responsibility |
|---|---|
| `src/utils/resolveMemberName.ts` | MODIFY (Phase A), DELETE (Phase E). The single shared-importing file; the migration seam. |
| `src/identity/identityProvider.tsx` | CREATE — `(address, spaceId?) → MemberIdentity`. Absorbs `resolveGlobalSender` + `useMembersWithPublicProfileFallback`. |
| `src/identity/useResolvedName.ts` | CREATE — the string API. |
| `src/identity/MemberName.tsx` | CREATE — the JSX API; owns the `.q` AND the avatar initials. |
| `src/identity/index.ts` | CREATE — the only public entry point. |
| `eslint.config.js` | MODIFY — the ratchet allowlist. |

Everything under `src/identity/` is the ONLY place allowed to import the shared resolver. That is what the ratchet enforces.

---

## Phase A — shared rule (MAIN THREAD, serial)

Do not delegate. This is the design-bearing change and everything depends on its semantics.

### Task 1: `MemberIdentity` + `resolveIdentity` in shared

**Files:**
- Modify: `E:/GitHub/Quilibrium/quorum-shared/src/utils/resolveDisplayName.ts`
- Test: `E:/GitHub/Quilibrium/quorum-shared/src/utils/resolveIdentity.test.ts`

- [ ] **Step 1: Branch in shared**

```bash
cd /e/GitHub/Quilibrium/quorum-shared
git checkout master && git pull
git checkout -b feat/resolve-identity
```

- [ ] **Step 2: Write the failing test**

Create `src/utils/resolveIdentity.test.ts`:

```ts
/**
 * The name ladder, as a truth table.
 *
 * Every tier must pass through the forged-suffix guard: `.q` is the only signal
 * a viewer gets that a name is verified, so a stored name ending in `.q` is
 * dropped rather than rendered. See `presentUnreserved` in resolveDisplayName.ts.
 */
import { describe, it, expect } from 'vitest';
import { resolveIdentity, type MemberIdentity } from './resolveDisplayName';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const id = (over: Partial<MemberIdentity> = {}): MemberIdentity => ({
  address: ADDR,
  spaceName: null,
  qnsName: null,
  globalName: null,
  ...over,
});

describe('resolveIdentity — space scope', () => {
  it('ranks a deliberate per-space name above the QNS name', () => {
    const r = resolveIdentity(
      id({ spaceName: 'Mod Alice', globalName: 'Alice Smith', qnsName: 'alice' }),
      { scope: 'space' },
    );
    expect(r).toEqual({ name: 'Mod Alice', isQnsVerified: false });
  });

  it('treats a per-space name EQUAL to the global name as the join echo', () => {
    const r = resolveIdentity(
      id({ spaceName: 'Alice Smith', globalName: 'Alice Smith', qnsName: 'alice' }),
      { scope: 'space' },
    );
    expect(r).toEqual({ name: 'alice', isQnsVerified: true });
  });

  it('keeps a per-space name when the global name is unknown', () => {
    const r = resolveIdentity(id({ spaceName: 'Alice Smith' }), { scope: 'space' });
    expect(r).toEqual({ name: 'Alice Smith', isQnsVerified: false });
  });

  it('falls to the global name when no QNS name is elected', () => {
    const r = resolveIdentity(id({ globalName: 'Alice Smith' }), { scope: 'space' });
    expect(r).toEqual({ name: 'Alice Smith', isQnsVerified: false });
  });

  it('falls to a truncated address when every tier is null', () => {
    const r = resolveIdentity(id(), { scope: 'space' });
    expect(r.isQnsVerified).toBe(false);
    expect(r.name).toContain('…');
  });
});

describe('resolveIdentity — global scope', () => {
  it('ignores the per-space name entirely', () => {
    const r = resolveIdentity(
      id({ spaceName: 'Mod Alice', globalName: 'Alice Smith', qnsName: 'alice' }),
      { scope: 'global' },
    );
    expect(r).toEqual({ name: 'alice', isQnsVerified: true });
  });

  it('ranks the QNS name above the global name', () => {
    const r = resolveIdentity(id({ globalName: 'Alice Smith', qnsName: 'alice' }), {
      scope: 'global',
    });
    expect(r).toEqual({ name: 'alice', isQnsVerified: true });
  });
});

describe('resolveIdentity — the forged-suffix guard applies to every tier', () => {
  it('drops a per-space name ending in .q', () => {
    const r = resolveIdentity(id({ spaceName: 'alice.q', globalName: 'Mallory' }), {
      scope: 'space',
    });
    expect(r).toEqual({ name: 'Mallory', isQnsVerified: false });
  });

  it('drops a forged name BEFORE the echo comparison', () => {
    // Compared raw, 'alice.q' !== 'Mallory' reads as a deliberate per-space
    // name and would be returned outright.
    const r = resolveIdentity(
      id({ spaceName: 'alice.q', globalName: 'Mallory', qnsName: 'mallory' }),
      { scope: 'space' },
    );
    expect(r).toEqual({ name: 'mallory', isQnsVerified: true });
  });

  it('drops a global name ending in .q', () => {
    const r = resolveIdentity(id({ globalName: 'alice.q' }), { scope: 'global' });
    expect(r.name).not.toBe('alice.q');
  });

  it('drops a qnsName that already carries the suffix', () => {
    const r = resolveIdentity(id({ qnsName: 'alice.q', globalName: 'Mallory' }), {
      scope: 'global',
    });
    expect(r).toEqual({ name: 'Mallory', isQnsVerified: false });
  });

  it('folds confusable Unicode dots', () => {
    const r = resolveIdentity(id({ spaceName: 'alice．q', globalName: 'Mallory' }), {
      scope: 'space',
    });
    expect(r).toEqual({ name: 'Mallory', isQnsVerified: false });
  });

  it('leaves a mid-name dot alone', () => {
    const r = resolveIdentity(id({ globalName: 'jane.doe' }), { scope: 'global' });
    expect(r.name).toBe('jane.doe');
  });
});

describe('resolveIdentity — whitespace is absence', () => {
  it('treats a whitespace-only tier as null', () => {
    const r = resolveIdentity(id({ globalName: '   ', qnsName: 'alice' }), {
      scope: 'global',
    });
    expect(r).toEqual({ name: 'alice', isQnsVerified: true });
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd /e/GitHub/Quilibrium/quorum-shared && npx vitest --run src/utils/resolveIdentity.test.ts`
Expected: FAIL — `resolveIdentity` is not exported.

- [ ] **Step 4: Implement**

In `src/utils/resolveDisplayName.ts`, **keep `present`, `presentUnreserved`, `truncate` and `ResolvedName` exactly as they are** (the guard docstring is load-bearing; do not touch it). Replace the exported `resolveDisplayName` function and the `Resolvable` type with:

```ts
/**
 * A member's identity, complete by construction.
 *
 * Every field is REQUIRED and explicitly nullable. `null` means "known to be
 * absent"; there is no `undefined`, so a caller that has not looked up a tier
 * cannot silently omit it — omission is a compile error.
 *
 * That is the whole point. The previous shape took three optional fields, and
 * omitting `globalName` did not merely degrade the answer, it INVERTED it: the
 * space ladder compares the per-space name against the global name to tell a
 * deliberate nickname from the name echoed at join, so a missing global name
 * made every roster name look deliberate and buried the QNS name beneath it.
 * That defect was found in ~18 render surfaces across two clients in one day.
 */
export interface MemberIdentity {
  address: string;
  /** Per-space nickname. `null` = none set, or no space context. */
  spaceName: string | null;
  /** QNS primary username, stored BARE (no ".q"). `null` = none elected. */
  qnsName: string | null;
  /** Global display name. `null` = none set. */
  globalName: string | null;
}

/**
 * Which ladder applies.
 *
 * - `space`  — inside a Space: a deliberate nickname outranks the QNS name.
 * - `global` — a DM, or any surface with no Space context: there is no
 *   per-space tier, so the QNS name outranks the display name. `spaceName` is
 *   ignored rather than trusted.
 */
export type IdentityScope = 'space' | 'global';

/**
 * The single name-resolution rule for both clients.
 *
 *   space:  per-space nickname → QNS name → global name → truncated address
 *   global:                      QNS name → global name → truncated address
 *
 * Pure and platform-agnostic. The ".q" suffix is applied by the rendering layer
 * from `isQnsVerified`, never baked into `name`.
 */
export function resolveIdentity(
  identity: MemberIdentity,
  { scope }: { scope: IdentityScope },
): ResolvedName {
  // Every tier goes through `presentUnreserved`, not `present`: a name that
  // would forge the `.q` marker is dropped wherever it is stored.
  const qns = presentUnreserved(identity.qnsName);
  const global = presentUnreserved(identity.globalName);

  if (scope === 'space') {
    const space = presentUnreserved(identity.spaceName);
    // A per-space name EQUAL to the global name is the copy made at join, not a
    // deliberate choice, so it must not outrank the QNS name. The guard runs
    // BEFORE this comparison: compared raw, a forged name differs from the
    // global one and would read as deliberate.
    if (space && space !== global) return { name: space, isQnsVerified: false };
  }

  if (qns) return { name: qns, isQnsVerified: true };
  if (global) return { name: global, isQnsVerified: false };
  return { name: truncate(identity.address), isQnsVerified: false };
}
```

Then delete the old `resolveDisplayName` export and the `Resolvable` type, and update `src/utils/index.ts` (or wherever they are re-exported) so `MemberIdentity`, `IdentityScope` and `resolveIdentity` are exported and `resolveDisplayName` / `Resolvable` are not.

- [ ] **Step 5: Run the test — expect PASS**

Run: `npx vitest --run src/utils/resolveIdentity.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 6: Run the whole shared suite**

Run: `npx vitest --run`
Expected: failures ONLY in files referencing the deleted `resolveDisplayName`. Update those call sites/tests to `resolveIdentity`; delete `resolveDisplayName`'s own old test file if it exists.

- [ ] **Step 7: Build, so desktop's tsc sees the new types**

Run: `yarn build`
Expected: exits 0. (tsc in desktop reads `dist/*.d.ts`, not `src/`.)

- [ ] **Step 8: Commit**

```bash
git add src/utils/resolveDisplayName.ts src/utils/resolveIdentity.test.ts src/utils/index.ts
git commit -m "feat: resolveIdentity over a complete MemberIdentity

Replaces resolveDisplayName. Every identity field is now required and
explicitly nullable, so a caller cannot omit one — omitting globalName
did not degrade the answer, it inverted the ladder, which is how ~18
render surfaces across two clients came to show the wrong name.

Scope is explicit rather than encoded in which function you call."
```

---

### Task 2: Fix desktop's single shared-importing file

**Files:**
- Modify: `src/utils/resolveMemberName.ts`

Only ONE desktop file imports the shared resolver (MEASURED by grep, 2026-08-10). The other ~24 go through this module, which is the migration seam: it keeps its current exports so nothing else moves yet.

- [ ] **Step 1: Branch in desktop**

```bash
cd /e/GitHub/Quilibrium/quorum-desktop
git checkout main && git pull
git checkout -b feat/identity-provider
```

- [ ] **Step 2: Confirm desktop is broken by the shared change**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errors in `src/utils/resolveMemberName.ts` only. If any OTHER file errors, stop — the "one importer" premise is wrong and the plan needs revisiting.

- [ ] **Step 3: Rewrite the module over the new API**

Replace the whole body of `src/utils/resolveMemberName.ts` with:

```ts
import {
  resolveIdentity,
  type MemberIdentity,
  type IdentityScope,
} from '@quilibrium/quorum-shared';

export interface ResolvedMemberName {
  /** The readable name to display. Never empty (falls back to the address). */
  name: string;
  /** True only when `name` is the QNS username — render with the ".q" suffix. */
  isQnsVerified: boolean;
}

/**
 * TEMPORARY desktop adapter over the shared rule.
 *
 * Exists only so the ~24 existing call sites keep compiling while they migrate
 * to `src/identity`. Deleted in Phase E — do NOT add new callers, the eslint
 * ratchet will reject them.
 */
const nullable = (v?: string | null): string | null => {
  const t = (v ?? '').trim();
  return t.length ? t : null;
};

const toIdentity = (m: {
  address: string;
  displayName?: string | null;
  primaryUsername?: string | null;
  globalDisplayName?: string | null;
  spaceOverrideName?: string | null;
}): MemberIdentity => ({
  address: m.address,
  spaceName: nullable(m.spaceOverrideName ?? m.displayName),
  qnsName: nullable(m.primaryUsername),
  globalName: nullable(m.globalDisplayName),
});

const run = (identity: MemberIdentity, scope: IdentityScope): ResolvedMemberName =>
  resolveIdentity(identity, { scope });

export function resolveMemberName(
  member: { displayName?: string | null; primaryUsername?: string | null; address: string },
  opts: { spaceOverrideName?: string | null } = {},
): ResolvedMemberName {
  // `spaceOverrideName` is dead — MEASURED by grep 2026-08-10, no caller passes
  // it. Mapped to the SPACE tier anyway rather than folded into globalName,
  // because folding it would invert the ladder for any caller that started
  // using it: an override is the most-specific tier, and the global name is the
  // comparator it is checked against. Getting that backwards is the exact
  // defect this whole change exists to make impossible.
  const override = nullable(opts.spaceOverrideName);
  if (override) {
    return run(
      {
        address: member.address,
        spaceName: override,
        qnsName: nullable(member.primaryUsername),
        globalName: nullable(member.displayName),
      },
      'space',
    );
  }

  return run(
    {
      address: member.address,
      // Global scope has no per-space tier; the caller's displayName IS the
      // global name here.
      spaceName: null,
      qnsName: nullable(member.primaryUsername),
      globalName: nullable(member.displayName),
    },
    'global',
  );
}

export interface NameResolvableUser {
  displayName?: string;
  primaryUsername?: string;
  globalDisplayName?: string;
  address?: string;
  userIcon?: string;
}

export function resolveSpaceMemberName(member: {
  displayName?: string | null;
  primaryUsername?: string | null;
  globalDisplayName?: string | null;
  address: string;
}): ResolvedMemberName {
  return run(toIdentity(member), 'space');
}

export function resolveNameForContext(
  user: {
    displayName?: string | null;
    primaryUsername?: string | null;
    globalDisplayName?: string | null;
    address: string;
  },
  { isDm = false }: { isDm?: boolean } = {},
): ResolvedMemberName {
  return isDm ? resolveMemberName(user) : resolveSpaceMemberName(user);
}

/**
 * Flatten a resolved name to a plain string for non-JSX contexts. Appends ".q"
 * when the name is the verified QNS username.
 */
export function formatResolvedName(resolved: ResolvedMemberName): string {
  return resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name;
}
```

- [ ] **Step 4: Typecheck and run the full suite**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest --run`
Expected: tsc exits 0; **1248 tests pass**. Any failure here is a behaviour change introduced by the shared rewrite — fix it before continuing, do not adjust the test.

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolveMemberName.ts
git commit -m "refactor: point the desktop resolver at resolveIdentity

One file imports shared's resolver; this is it. Its exports are unchanged
so the ~24 call sites keep compiling until they migrate."
```

---

## Phase B — the provider and the API (MAIN THREAD, serial)

Do not delegate. Getting the provider's caching wrong poisons every downstream migration.

### Task 3: The identity provider

**Files:**
- Create: `src/identity/identityProvider.tsx`
- Test: `src/dev/tests/identity/identityProvider.test.tsx`

**Read first:** `src/utils/resolveGlobalSender.ts` (the `(spaceId, senderId) → identity` map this generalises) and `src/hooks/business/user/useMembersWithPublicProfileFallback.ts` (the merge precedence and its `useQueries` caching note).

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/identity/identityProvider.test.tsx`:

```tsx
/**
 * The provider is the ONE place that knows how a member's three name tiers are
 * assembled. These pin the merge, not the ladder (the ladder is shared's).
 *
 * Constraint 1 from the design is the load-bearing case: a virtualised list of
 * 200 rows must not register 200 query observers. `identityFromMaps` is pure so
 * that can be asserted without mounting anything.
 */
import { describe, it, expect } from 'vitest';
import { identityFromMaps } from '@/identity/identityProvider';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

describe('identityFromMaps — tier assembly', () => {
  it('takes the per-space name from the roster override slot', () => {
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
      },
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r).toEqual({
      address: ADDR,
      spaceName: 'Mod Alice',
      globalName: 'Alice',
      qnsName: null,
    });
  });

  it('prefers the roster global slot over the public profile for globalName', () => {
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: '', global_display_name: 'Roster Alice' } },
      },
      profiles: { [ADDR]: { display_name: 'Profile Alice', primary_username: 'alice' } },
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.globalName).toBe('Roster Alice');
    expect(r.qnsName).toBe('alice');
  });

  it('takes qnsName ONLY from the public profile', () => {
    // A roster row cannot carry primary_username; that is why bookmarks and
    // notifications showed a nickname but never a ".q".
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: { 'space-1': { [ADDR]: { display_name: 'Alice' } } },
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.qnsName).toBeNull();
  });

  it('returns an all-null identity for an unknown address, never undefined', () => {
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r).toEqual({ address: ADDR, spaceName: null, qnsName: null, globalName: null });
  });

  it('ignores the roster when no spaceId is given', () => {
    // A DM, or a Space you have left. A per-space nickname is meaningless here.
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
      },
      profiles: { [ADDR]: { display_name: 'Alice', primary_username: 'alice' } },
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.spaceName).toBeNull();
    expect(r.qnsName).toBe('alice');
  });
});

describe('identityFromMaps — offline (design constraint 5)', () => {
  it('still resolves a name from the roster alone, with no profile at all', () => {
    // DM and Space names render from IndexedDB with no network round-trip
    // today, and must continue to. A missing profile costs the ".q", never the
    // name — it must not degrade to an address.
    const r = identityFromMaps(ADDR, 'space-1', {
      rostersBySpace: {
        'space-1': { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
      },
      profiles: {},
      selfAddress: null,
      selfProfile: null,
    });
    expect(r.globalName).toBe('Alice');
    expect(r.qnsName).toBeNull();
  });
});

describe('identityFromMaps — the self tier', () => {
  it('reads YOUR OWN qnsName from your own public profile', () => {
    // currentPasskeyInfo carries no primary_username. Special-casing self from
    // it is what broke your own DM messages and your own profile card.
    const r = identityFromMaps(ADDR, undefined, {
      rostersBySpace: {},
      profiles: {},
      selfAddress: ADDR,
      selfProfile: { display_name: 'GattoPardo Mobile', primary_username: 'gatto' },
    });
    expect(r.qnsName).toBe('gatto');
    expect(r.globalName).toBe('GattoPardo Mobile');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest --run src/dev/tests/identity/identityProvider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure core plus the React wiring**

Create `src/identity/identityProvider.tsx`:

```tsx
import * as React from 'react';
import { useQueries } from '@tanstack/react-query';
import type { MemberIdentity } from '@quilibrium/quorum-shared';
import { QuorumApiClient, isHandledFetchError } from '../api/baseTypes';
import type { PublicProfileResponse } from '../api/baseTypes';
import { publicProfileQueryKey } from '../hooks/business/user/useUserPublicProfile';

/** The roster fields the identity needs. Mirrors SpaceMemberRow's name slots. */
export interface RosterNameRow {
  display_name?: string | null;
  global_display_name?: string | null;
}

export interface IdentitySources {
  /** spaceId -> address -> roster row. Local, from messageDB.getSpaceMembers. */
  rostersBySpace: Record<string, Record<string, RosterNameRow>>;
  /** address -> public profile. The ONLY source of primary_username. */
  profiles: Record<string, PublicProfileResponse | null>;
  selfAddress: string | null;
  selfProfile: PublicProfileResponse | null;
}

const nn = (v?: string | null): string | null => {
  const t = (v ?? '').trim();
  return t.length ? t : null;
};

/**
 * Pure tier assembly. Kept separate from React so the merge is unit-testable
 * and so a virtualised list can resolve 200 rows from maps already in memory
 * without registering 200 query observers (design constraint 1).
 */
export function identityFromMaps(
  address: string,
  spaceId: string | undefined,
  sources: IdentitySources,
): MemberIdentity {
  const row = spaceId ? sources.rostersBySpace[spaceId]?.[address] : undefined;
  const isSelf = !!sources.selfAddress && sources.selfAddress === address;
  // Self's identity comes from its own public profile. `currentPasskeyInfo` is
  // the device-local auth record and carries no QNS name.
  const profile = isSelf ? sources.selfProfile : (sources.profiles[address] ?? null);

  return {
    address,
    // Only a real space context can have a per-space nickname.
    spaceName: nn(row?.display_name),
    qnsName: nn(profile?.primary_username),
    // Prefer the live roster global slot over the published profile.
    globalName: nn(row?.global_display_name) ?? nn(profile?.display_name),
  };
}

interface IdentityContextValue {
  sources: IdentitySources;
  /** Scope for call sites that do not pass a spaceId. */
  defaultSpaceId?: string;
  /** Ask for an address to be fetched if it is not already cached. */
  request: (address: string) => void;
}

const IdentityContext = React.createContext<IdentityContextValue | null>(null);

export const useIdentityContext = (): IdentityContextValue => {
  const ctx = React.useContext(IdentityContext);
  if (!ctx) {
    throw new Error(
      'useResolvedName/<MemberName> used outside <IdentityScopeProvider>. Wrap the route.',
    );
  }
  return ctx;
};

export const IdentityScopeProvider: React.FunctionComponent<{
  /** The Space this subtree lives in, if any. Absent for DMs and global views. */
  spaceId?: string;
  /** spaceId -> roster, already loaded by the caller (local IndexedDB read). */
  rostersBySpace: Record<string, Record<string, RosterNameRow>>;
  selfAddress: string | null;
  children: React.ReactNode;
}> = ({ spaceId, rostersBySpace, selfAddress, children }) => {
  // Addresses that asked for a profile and are not in a roster-only render.
  const [requested, setRequested] = React.useState<ReadonlySet<string>>(new Set());
  const request = React.useCallback((address: string) => {
    if (!address) return;
    setRequested((prev) => (prev.has(address) ? prev : new Set(prev).add(address)));
  }, []);

  const addresses = React.useMemo(() => Array.from(requested), [requested]);

  const queries = useQueries({
    queries: addresses.map((address) => ({
      queryKey: publicProfileQueryKey(address),
      queryFn: async (): Promise<PublicProfileResponse | null> => {
        try {
          const response = await new QuorumApiClient().getPublicProfile(address);
          return response.data;
        } catch (error: unknown) {
          if (isHandledFetchError(error) && error.status === 404) return null;
          throw error;
        }
      },
      staleTime: 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
    })),
  });

  // `useQueries` returns a fresh array every render, so build the map from the
  // stable per-query data refs and memo on those — a naive dep on `queries`
  // invalidates every render and cascades through every consumer.
  const dataKey = queries.map((q) => q?.data ?? null);
  const profiles = React.useMemo(() => {
    const map: Record<string, PublicProfileResponse | null> = {};
    addresses.forEach((a, i) => {
      map[a] = dataKey[i] ?? null;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, dataKey.map((d) => (d ? 'y' : 'n')).join('')]);

  const selfProfile = selfAddress ? (profiles[selfAddress] ?? null) : null;

  React.useEffect(() => {
    if (selfAddress) request(selfAddress);
  }, [selfAddress, request]);

  const value = React.useMemo<IdentityContextValue>(
    () => ({
      sources: { rostersBySpace, profiles, selfAddress, selfProfile },
      defaultSpaceId: spaceId,
      request,
    }),
    [rostersBySpace, profiles, selfAddress, selfProfile, spaceId, request],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
};
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest --run src/dev/tests/identity/identityProvider.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/identity/identityProvider.tsx src/dev/tests/identity/identityProvider.test.tsx
git commit -m "feat(identity): one provider keyed on (address, spaceId?)

Generalises resolveGlobalSender. The pure core is separate from the React
wiring so a virtualised list resolves from in-memory maps rather than
registering one query observer per row."
```

---

### Task 4: `useResolvedName` and `<MemberName>`

**Files:**
- Create: `src/identity/useResolvedName.ts`
- Create: `src/identity/MemberName.tsx`
- Create: `src/identity/index.ts`
- Test: `src/dev/tests/identity/MemberName.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/identity/MemberName.test.tsx`:

```tsx
/**
 * <MemberName> is the only name-rendering API. It owns the ".q" AND the avatar
 * initials, because computing them separately let a member render "gatto.q"
 * beside a circle showing "G" for GattoPardo.
 *
 * Initials must derive from the BARE name: getInitials splits on non-letters,
 * so "gatto.q" would yield two initials from one name.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import { MemberName } from '@/identity/MemberName';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const wrap = (ui: React.ReactNode, rosters = {}) =>
  render(
    <IdentityScopeProvider spaceId="space-1" rostersBySpace={rosters} selfAddress={null}>
      {ui}
    </IdentityScopeProvider>,
  );

describe('MemberName', () => {
  it('renders the per-space nickname with no .q', () => {
    wrap(<MemberName address={ADDR} />, {
      'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });
    expect(screen.getByText('Mod Alice')).toBeTruthy();
    expect(screen.queryByText(/\.q/)).toBeNull();
  });

  it('falls back to a truncated address for an unknown member', () => {
    wrap(<MemberName address={ADDR} />);
    expect(screen.getByText(/Qm/)).toBeTruthy();
  });

  it('never renders the literal "Unknown User"', () => {
    // The resolver owns the fallback; a caller-supplied literal is the defect
    // this API exists to make unexpressable.
    wrap(<MemberName address={ADDR} />);
    expect(screen.queryByText('Unknown User')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest --run src/dev/tests/identity/MemberName.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/identity/useResolvedName.ts`:

```ts
import * as React from 'react';
import { resolveIdentity, type MemberIdentity } from '@quilibrium/quorum-shared';
import { identityFromMaps, useIdentityContext } from './identityProvider';

export interface ResolvedMemberName {
  name: string;
  isQnsVerified: boolean;
}

export interface UseResolvedNameOptions {
  /** Override the surrounding scope. Detached surfaces (bookmarks, the
   *  notification panel) pass their own stored spaceId. */
  spaceId?: string;
  /** Force the global ladder even inside a Space. Rarely needed. */
  global?: boolean;
}

/** The identity behind a name, for callers that need the tiers. */
export function useMemberIdentity(
  address: string,
  { spaceId }: { spaceId?: string } = {},
): MemberIdentity {
  const { sources, defaultSpaceId, request } = useIdentityContext();
  React.useEffect(() => {
    request(address);
  }, [address, request]);
  const effectiveSpaceId = spaceId ?? defaultSpaceId;
  return React.useMemo(
    () => identityFromMaps(address, effectiveSpaceId, sources),
    [address, effectiveSpaceId, sources],
  );
}

/** The resolved name as a string, with ".q" when verified. For aria-labels,
 *  tooltips, notification bodies, modal payloads and search-match text. */
export function useResolvedName(
  address: string,
  opts: UseResolvedNameOptions = {},
): string {
  const r = useResolvedMemberName(address, opts);
  return r.isQnsVerified ? `${r.name}.q` : r.name;
}

/** The structured result, for callers that style the suffix. */
export function useResolvedMemberName(
  address: string,
  { spaceId, global = false }: UseResolvedNameOptions = {},
): ResolvedMemberName {
  const identity = useMemberIdentity(address, { spaceId });
  const { defaultSpaceId } = useIdentityContext();
  const scope = global || !(spaceId ?? defaultSpaceId) ? 'global' : 'space';
  return React.useMemo(
    () => resolveIdentity(identity, { scope }),
    [identity, scope],
  );
}
```

Create `src/identity/MemberName.tsx`:

```tsx
import * as React from 'react';
import { UserAvatar } from '../components/user/UserAvatar';
import { useResolvedMemberName, type UseResolvedNameOptions } from './useResolvedName';

interface MemberNameProps extends UseResolvedNameOptions {
  address: string;
  className?: string;
  /** Render the avatar beside the name, from the SAME resolved identity. */
  withAvatar?: boolean;
  avatarSize?: number;
  userIcon?: string;
}

/**
 * The only name-rendering API.
 *
 * Owns the ".q" suffix and, when asked, the avatar — because computing the two
 * separately is how a member came to render "gatto.q" next to a circle reading
 * "G" for GattoPardo. The operator's rule: the initials must always render
 * whatever the displayed name is at that moment.
 */
export const MemberName: React.FunctionComponent<MemberNameProps> = ({
  address,
  className,
  withAvatar = false,
  avatarSize = 30,
  userIcon,
  ...opts
}) => {
  const resolved = useResolvedMemberName(address, opts);

  const label = (
    <span className={className}>
      {resolved.name}
      {resolved.isQnsVerified && '.q'}
    </span>
  );

  if (!withAvatar) return label;

  return (
    <>
      <UserAvatar
        userIcon={userIcon}
        // BARE name: getInitials splits on non-letters, so "gatto.q" would
        // produce two initials from a single name.
        displayName={resolved.name}
        address={address}
        size={avatarSize}
      />
      {label}
    </>
  );
};
```

Create `src/identity/index.ts`:

```ts
export { IdentityScopeProvider, identityFromMaps } from './identityProvider';
export type { RosterNameRow, IdentitySources } from './identityProvider';
export { MemberName } from './MemberName';
export {
  useResolvedName,
  useResolvedMemberName,
  useMemberIdentity,
} from './useResolvedName';
export type { ResolvedMemberName, UseResolvedNameOptions } from './useResolvedName';
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest --run src/dev/tests/identity/MemberName.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/identity src/dev/tests/identity/MemberName.test.tsx
git commit -m "feat(identity): <MemberName> and useResolvedName

Call sites pass an address. You cannot forget a field you never pass.
The component owns the avatar initials too, from the same resolved name."
```

---

### Task 5: Prove it on the member sidebar, and MEASURE the cost

**Files:**
- Modify: `src/components/space/Channel.tsx` (the two sidebar rows: ~1861 and ~2111)

This is design constraint 1. Do it before anything else depends on the provider.

- [ ] **Step 1: Mount the provider around the Channel subtree**

In `src/components/space/Channel.tsx`, wrap the returned JSX in
`<IdentityScopeProvider spaceId={spaceId} rostersBySpace={{ [spaceId]: rosterRows }} selfAddress={user.currentPasskeyInfo?.address ?? null}>`,
where `rosterRows` maps each `members` entry to `{ display_name, global_display_name }`.

- [ ] **Step 2: Replace both sidebar `<ResolvedName>` blocks**

Replace each `<ResolvedName resolved={resolveSpaceMemberName({...})} />` with:

```tsx
<MemberName address={item.address} className="text-md font-bold truncate-user-name" />
```

- [ ] **Step 3: MEASURE the fetch count**

Do not eyeball this. Add a temporary counter inside the provider's `queryFn` —
guaranteed to work regardless of whether the QueryClient is exposed on `window`.

In `src/identity/identityProvider.tsx`, as the FIRST line of `queryFn`:

```ts
        (window as unknown as { __idFetches?: number }).__idFetches =
          ((window as unknown as { __idFetches?: number }).__idFetches ?? 0) + 1;
```

Then, with `yarn dev` running and a Space open whose member list has 20+ rows:

```js
// dev console, in order:
window.__idFetches = 0;
// now scroll the member sidebar from top to bottom, fast, three times
window.__idFetches;   // record this number
```

**Pass condition:** the number is **bounded by the number of distinct members
rendered**, and does NOT grow on repeat scrolls (the 1h cache means a second
pass over the same rows must add zero).

**Fail:** it grows per scroll, or exceeds the member count — the provider is
fetching per virtualisation tick. Fix before continuing.

Record the actual number in the commit message. Remove the counter line before
committing.

**If this cannot be measured in under 15 minutes, stop and report it.** An
unmeasured constraint 1 is the single thing that would make this refactor worse
than what it replaces.

- [ ] **Step 4: Full suite + typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest --run`
Expected: tsc 0, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/space/Channel.tsx
git commit -m "feat(identity): member sidebar renders via <MemberName>

The worst case first: 200+ virtualised rows resolving from in-memory maps
with no per-row query observer."
```

---

## Phase C — the ratchet (MAIN THREAD)

### Task 6: eslint rule with a shrinking allowlist

This is what gives every Phase D task a machine-checkable definition of done, which is why it comes BEFORE the bulk migration rather than after.

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Add the rule with today's importers allowlisted**

In `eslint.config.js`, inside the main `rules:` block (around line 60), add:

```js
      // Nothing outside src/identity/ may resolve a name itself. Call sites use
      // <MemberName> / useResolvedName, which take an ADDRESS — you cannot
      // forget a field you never pass.
      //
      // The list below is a RATCHET, not an exemption: it is every file still
      // to be migrated. Remove your file from it as part of migrating it, and
      // never add one.
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/utils/resolveMemberName', '**/utils/mentionPillDom',
                  '**/utils/conversationSearch', '**/utils/profileCardIdentity',
                  '**/utils/resolveGlobalSender', '**/utils/resolveSelfName'],
          message:
            'Resolve names via src/identity (<MemberName> / useResolvedName). ' +
            'See .agents/issues/2026-08-10-identity-resolution-architecture-design.md',
        }],
      }],
```

Then add a second flat-config block AFTER it that disables the rule for the not-yet-migrated files:

```js
  {
    // RATCHET — every entry is a file still to migrate. Shrinks to zero in
    // Phase D and this whole block is deleted in Phase E. Never add an entry.
    files: [
      'src/components/message/Message.tsx',
      'src/components/message/MessageList.tsx',
      'src/components/message/MessageComposer.tsx',
      'src/components/message/MessageMarkdownRenderer.tsx',
      'src/components/message/MessagePreview.tsx',
      'src/components/message/MessageEditTextarea.tsx',
      'src/components/message/MentionDropdown.tsx',
      'src/components/message/PinnedMessagesPanel.tsx',
      'src/components/message/ReactionsList.tsx',
      'src/components/modals/ReactionsModal.tsx',
      'src/components/notifications/NotificationPanel.tsx',
      'src/components/thread/ThreadPanel.tsx',
      'src/components/thread/ThreadsListPanel.tsx',
      'src/components/user/UserProfile.tsx',
      'src/components/user/ResolvedName.tsx',
      'src/components/direct/DirectMessage.tsx',
      'src/components/direct/DirectMessageContact.tsx',
      'src/components/direct/DirectMessageContactsList.tsx',
      'src/components/direct/DMUserProfileSidebar.tsx',
      'src/components/space/Channel.tsx',
      'src/components/bookmarks/BookmarkCard.tsx',
      'src/components/bookmarks/BookmarkItem.tsx',
      'src/hooks/business/mentions/useMentionInput.ts',
      'src/hooks/business/spaces/useInviteManagement.ts',
      'src/hooks/business/user/useMembersWithPublicProfileFallback.ts',
      'src/hooks/business/channels/useChannelData.ts',
      'src/hooks/business/channels/useChannelMessages.ts',
      'src/utils/mentionPillDom.ts',
      'src/utils/conversationSearch.ts',
      'src/utils/profileCardIdentity.ts',
      'src/utils/resolveGlobalSender.ts',
      'src/utils/resolveSelfName.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
```

- [ ] **Step 2: Verify the rule bites**

Run: `yarn lint 2>&1 | grep -c "no-restricted-imports"`
Expected: `0` — every current importer is allowlisted, so the rule is silent today.

- [ ] **Step 3: Verify it is not vacuous**

Temporarily remove `'src/components/thread/ThreadsListPanel.tsx'` from the ratchet list and run `yarn lint`.
Expected: an error naming that file. **Put the entry back.** A guard never seen red is not a guard.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "chore(identity): ratchet against new direct resolver imports

Every entry in the allowlist is a file still to migrate; removing one is
part of migrating it. Verified non-vacuous by removing an entry and
watching lint fail."
```

---

## Phase D — bulk migration (SUBAGENT FAN-OUT)

**Dispatch one subagent per row of the table below.** They are independent: different files, no shared state.

**Do NOT delegate a row whose "Scope" column says `judgement`** — those change behaviour and stay on the main thread.

### The recipe every migration subagent follows

Give the subagent this recipe verbatim plus its row. It has complete instructions; it must not need to read other tasks.

- [ ] **Step 1: Read the design.** `.agents/issues/2026-08-10-identity-resolution-architecture-design.md`, in particular constraint 2. Do not resolve a detached surface with the global ladder.

- [ ] **Step 2: Write a render test pinning the CORRECT behaviour, including the `.q`.**

Create `src/dev/tests/identity/migrated/<ComponentName>.test.tsx`. Model it on
`src/dev/tests/components/ReactionsModal.test.tsx` (the repo's established
pattern for asserting a rendered name). The load-bearing case is always:

> a member with NO per-space nickname, a global name, and a QNS name must render
> `<qns>.q` — the follow-global default state.

Add a second case with a per-space nickname, which must render the nickname and
no `.q`.

- [ ] **Step 3: Run it and watch it FAIL.** `npx vitest --run <your test path>`. If it passes before the migration, the test is not pinning anything — rewrite it until it fails.

- [ ] **Step 4: Migrate the file.**
  - Replace `<ResolvedName resolved={resolveSpaceMemberName({...})} />` with `<MemberName address={...} />`.
  - Replace `formatResolvedName(resolveMemberName({...}))` with `useResolvedName(address)`.
  - Delete any caller-supplied fallback (`|| 'Unknown User'`, `?? formatAddress(...)`). The resolver owns the fallback.
  - If the surface carries its own `spaceId` (bookmarks, notifications), pass it: `<MemberName address={a} spaceId={s} />`.
  - Remove the file's entry from the ratchet list in `eslint.config.js`.

- [ ] **Step 5: Verify.** All three must pass:

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest --run
yarn lint 2>&1 | grep -E "^✖"     # must report 0 errors
```

- [ ] **Step 6: Commit.**

```bash
git add <the file> <the test> eslint.config.js
git commit -m "refactor(identity): <surface> resolves via <MemberName>"
```

### Migration table

Rows 1–2 first, and separately: they are the two surfaces confirmed still wrong
after PR #325, so they are the first evidence this design works.

| # | File | Surface | Scope | Note |
|---|---|---|---|---|
| 1 | `src/components/bookmarks/BookmarkCard.tsx`, `BookmarkItem.tsx` | bookmark sender | `spaceId={bookmark.spaceId}` | **KNOWN BROKEN.** Must show the per-space nickname AND the `.q`. Delete the frozen `cachedPreview.senderName` render path. |
| 2 | `src/components/notifications/NotificationPanel.tsx` | notification sender | `spaceId={row.spaceId}` | **KNOWN BROKEN.** Missing only the `.q`; the nickname already works via `resolveGlobalSender`. |
| 3 | `src/components/message/Message.tsx` | message header, reply-to | context | 10 call sites; the biggest single file. |
| 4 | `src/components/message/MessageMarkdownRenderer.tsx` | mention pills | context | Also drops the `onUserClick` payload fields — the card now needs only an address. |
| 5 | `src/components/message/MessageEditTextarea.tsx` | editor mention pills | context | Delete the private `createPillElement` copy; use `mentionPillDom`'s. |
| 6 | `src/components/message/MessagePreview.tsx` | preview header | context | `getDisplayName()` disappears entirely. |
| 7 | `src/components/message/PinnedMessagesPanel.tsx` | pinned sender | context | |
| 8 | `src/components/message/ReactionsList.tsx` | reactor names | context | |
| 9 | `src/components/modals/ReactionsModal.tsx` | reactor names | context | Existing test at `src/dev/tests/components/ReactionsModal.test.tsx` — extend, don't replace. |
| 10 | `src/components/message/MentionDropdown.tsx` | autocomplete rows | context | |
| 11 | `src/components/message/MessageComposer.tsx` | composer pills | context | |
| 12 | `src/components/thread/ThreadPanel.tsx` | thread participants | context | |
| 13 | `src/components/thread/ThreadsListPanel.tsx` | thread starter | context | |
| 14 | `src/components/user/UserProfile.tsx` | profile card | context | Delete `src/utils/profileCardIdentity.ts` and its test; the provider makes both redundant. |
| 15 | `src/components/direct/DirectMessage.tsx` | DM header + own messages | `global` | Delete the hand-built self entry in the members map. |
| 16 | `src/components/direct/DirectMessageContact.tsx` | DM list row | `global` | |
| 17 | `src/components/direct/DirectMessageContactsList.tsx` | DM list + search | `global` | Search matching moves to `useResolvedName`; delete `src/utils/conversationSearch.ts`. |
| 18 | `src/components/direct/DMUserProfileSidebar.tsx` | DM profile sidebar | `global` | Use `withAvatar` so initials and name agree. |
| 19 | `src/hooks/business/mentions/useMentionInput.ts` | mention candidates | context | Matching must run against the resolved name. |
| 20 | `src/hooks/business/spaces/useInviteManagement.ts` | invite picker | `global` | |
| 21 | `src/components/space/Channel.tsx` | remaining sites | context | Sidebar already done in Task 5; migrate the other 7. |
| 22 | `src/components/message/MessageList.tsx` | `resolveSender` | judgement | **MAIN THREAD.** The kicked/membership gate is a security property and stays on the raw roster; only the identity moves. |
| 23 | `src/hooks/business/user/useMembersWithPublicProfileFallback.ts` | — | judgement | **MAIN THREAD.** Absorbed by the provider; delete once nothing imports it. |
| 24 | `src/utils/resolveGlobalSender.ts` | — | judgement | **MAIN THREAD.** Absorbed by the provider; delete last. |

---

## Phase E — close it out (MAIN THREAD)

### Task 7: Delete the seam and empty the ratchet

**Files:**
- Delete: `src/utils/resolveMemberName.ts`, `src/utils/mentionPillDom.ts` (name parts), `src/utils/conversationSearch.ts`, `src/utils/profileCardIdentity.ts`, `src/utils/resolveGlobalSender.ts`, `src/utils/resolveSelfName.ts`, `src/components/user/ResolvedName.tsx`
- Modify: `eslint.config.js` (remove the ratchet block entirely)

- [ ] **Step 1: Confirm nothing imports them**

Run: `grep -rn "resolveMemberName\|resolveSpaceMemberName\|resolveNameForContext\|ResolvedName\|profileCardIdentity\|conversationSearch\|resolveGlobalSender\|resolveSelfName" src --include=*.ts --include=*.tsx | grep -v "src/identity/" | grep -v "\.test\."`
Expected: no output.

- [ ] **Step 2: Delete the files and the ratchet block, then verify**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest --run && yarn lint 2>&1 | grep -E "^✖"`
Expected: tsc 0, all tests pass, 0 lint errors.

- [ ] **Step 3: Commit**

```bash
git add -A src eslint.config.js
git commit -m "refactor(identity): delete the old resolvers and empty the ratchet

There is now exactly one way to render a member's name, and the lint rule
has no exemptions left."
```

### Task 8: The visual sweep

- [ ] **Step 1: Run the app** — `yarn dev` from `/e/GitHub/Quilibrium/quorum-desktop` (NOT the worktree at `.worktrees/secondary`, which is a different branch).

- [ ] **Step 2: Open `/dev/fake-qns`.** Enable "Give myself a .q" and "Give everyone a .q". **Pin one address to a known non-QNS name as the CONTROL ARM** — with everyone named there is nothing to compare against, and if the control row also changes, the instrument is wrong rather than the code.

- [ ] **Step 3: Sweep all 18 surfaces** from `.agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md`, plus bookmarks and notifications. Leave and re-enter a screen before believing a negative — the panel invalidates the profile cache but an open screen holds a resolved map.

- [ ] **Step 4: Report per surface, MEASURED not inferred.** Any surface that fails goes back to Phase D as its own task.

---

## Phase F — mobile (SEPARATE SESSION, blocked on A–E)

### Task 9: Mobile migration

Blocked until the lead dev publishes a shared version containing `resolveIdentity`. **We never run `npm publish`.**

- [ ] Bump mobile's `@quilibrium/quorum-shared` and migrate `utils/resolveMemberName.ts` (its ONE shared-importing file) **in the same PR** — the version bump and the migration cannot be separated, since the change is breaking by design.
- [ ] Port Phases B–E against mobile's 17 call sites.
- [ ] Verify with `yarn harness:qns` (two bots, real crypto). The receive side cannot be tested on one device: Triple Ratchet participants cannot decrypt their own echoed messages.
- [ ] Delete the parity document's shared echo-demotion item as absorbed (decision 4).

---

## Definition of done

- [ ] `resolveIdentity` in shared with every field required; 15 tests
- [ ] Provider keyed on `(address, spaceId?)`, MEASURED to add no per-row query observer
- [ ] Bookmarks and notifications show BOTH the per-space nickname and the `.q`
- [ ] `<MemberName>` renders avatar initials from the same resolved name
- [ ] All ~24 desktop call sites migrated; ratchet list empty and block deleted
- [ ] Lint rule shown red by removing an allowlist entry
- [ ] `/dev/fake-qns` sweep of all 18 surfaces with a control arm, reported per surface
- [ ] Mobile migrated and verified with `harness:qns`

---

# What actually happened — the execution record

Desktop phases A-E are **complete** (33 commits on `feat/identity-provider`, 1341 tests, tsc 0,
lint 0). `quorum-shared` PR #80 is merged to `master` as `2efd307`; no version bump was made, so
publishing is the lead dev's step and mobile is unblocked.

**This section is the handoff.** The plan above is what we intended; below is where reality
differed. If you are the mobile agent, read this before porting — four of these detours are
decisions you must make the same way, and five are bugs you will reproduce if you don't.

## Decisions that changed the design

**1. Profile fetching is OPT-IN, and list surfaces do not opt in — REVISED 2026-08-11.**
`<MemberName>` originally requested a public profile on mount. MEASURED: opening a 200-member space
fired **200 concurrent requests** where it previously fired none. The operator ruled: resolve from
in-memory roster maps by default, and pass an explicit `enrich` prop only where the surface needs
the `.q` AND renders a bounded number of people.

- `enrich`: message headers, DM headers, bookmarks, notifications, the profile card, reactor lists,
  pinned messages, moderation modals, search results, typing indicators, **the mention autocomplete,
  and the invite pickers (revised below)**.
- **no `enrich`**: the member sidebar only — the one surface whose cardinality is genuinely
  unbounded (a whole Space's membership, no cap).

**Revision, with the numbers in front of the operator:** the mention autocomplete and the invite
picker were bundled into "no `enrich`" alongside the sidebar at the time of the original decision,
and that was over-conservative — neither is actually a roster dump. `useMentionInput` caps
candidates at `maxDisplayResults = 50`, and after a character or two it shows a handful; the invite
picker is a search over the user's own DM contacts, not a Space's membership. The bundling produced
a visible inconsistency: typing `@ali`, picking `Alice` from a dropdown showing a plain roster name,
and having the posted message render `alice.q` for the same person. Both surfaces now enrich:

- **Mention autocomplete** (`MentionDropdown.tsx`): each rendered user row passes `enrich` to
  `<MemberName>`, bounded by exactly the candidates displayed — never the underlying roster
  `useMentionInput` filters from, which is roster-sized and would reproduce the 200-request storm if
  requested wholesale. `useMentionInput.ts` itself never calls `request`/`requestNames` — enrichment
  is owned by the rendering component; the hook only *reads* the ambient cache (`useNameResolver().
  resolve()`), so filtering/sorting can never disagree with what's displayed. Filtering was extended
  to match the resolved name (`.q` included), OR'd onto the existing raw-field match rather than
  replacing it, so typing the exact `.q` name a person is already shown by (elsewhere in the app, or
  from a prior dropdown open) finds them.
- **Invite picker** (`useInviteManagement.ts` / `Invites.tsx`): `getUserOptions` calls `requestNames`
  for every DM conversation address unconditionally when the tab opens — the whole (bounded, personal)
  contact list, not just what's currently filtered, same reasoning as `BookmarksPage.tsx`'s proactive
  `requestNames`. `Invites.tsx`'s `ConversationList` stays a pure reader (no request of its own).

Pinned by `src/dev/tests/identity/identitySidebarFetch.test.tsx` (UNCHANGED by this revision — the
sidebar's policy did not move): 0 fetches for a 200-row sidebar, 1 when self is in view (self only),
and bounded-by-distinct-address on an enriched surface with 0 growth on revisit. The mention
autocomplete's equivalent measurement lives in
`src/dev/tests/identity/mentionDropdownFetch.test.tsx`: opening the dropdown with N distinct
candidates issues exactly N fetches (never per keystroke, never per render), and re-opening it adds
zero further fetches (provider dedupe + the 1h per-query cache). The invite picker's is in
`src/dev/tests/identity/migrated/useInviteManagement.test.tsx` and `SpaceSettingsModalInviteWiring.
test.tsx`: opening the tab fetches every DM contact once (plus the provider's own unconditional
self-address bootstrap), and reading the options again adds zero more.

**2. `MemberIdentity` gained a fourth source: locally-known names.**
The plan's tier assembly took `globalName` from the roster's global slot or the fetched profile.
In a DM there is no roster row, so a partner who never published a public profile resolved to a
truncated address — violating design constraint 5 (DM names render from IndexedDB with no network
round-trip). `IdentitySources` now carries a locally-known-names map, used as the LAST `globalName`
source. Mobile needs this too, or DM names disappear for unpublished partners.

**3. `useNameResolver` exists, and is how you resolve N addresses.**
Mention pills are raw DOM, search filters and sort keys are strings, reactor lists are `.map()`s —
none can call a hook per address. `useNameResolver()` returns a stable `resolve(address, opts)`
plus a batched `requestNames(addresses)`. It is a passthrough to `identityFromMaps` +
`resolveIdentity`; it does not re-implement either. Call sites must use it rather than reaching for
the pure core themselves.

**4. One ROOT provider, mounted above the router.**
Providers were mounted surface by surface, and the operator hit a crash — a confirmation modal
rendered outside every provider and `useIdentityContext` threw. `App.tsx` now mounts one root
`IdentityScopeProvider` (no `spaceId`, empty rosters, `selfAddress`) above the Router, so nothing
can render outside one; nested providers still refine scope. Do this in mobile FIRST, before
migrating call sites, or you will chase the same crash.

## The plan's migration table was incomplete, and that is the main lesson

The table was derived from *"which files import a resolver"*. Surfaces that render a raw identity
field without importing anything were invisible to it — and so were invisible to the eslint rule,
which can only see imports. Found later, in three waves:

- **the app shell** — the nav rail avatar tooltip rendered the raw passkey `displayName`;
- **a second tranche found by audit** — search results, kick/block/mute modals, conversation
  settings, and the `ModalProvider` field-threading behind them;
- **message-body mentions** — confirmation modals, the pinned panel and the notification panel each
  rendered mentions through a path that never reached the resolver.

Roughly 40% more surfaces than the table listed. **For mobile: do not trust an import-derived list.
Grep for rendered fields, not for imports.** The instrument for this is checked in at
`src/dev/tests/identity/rawNameFieldAudit.test.ts` — it fails when a file starts rendering a raw
name field, with an exceptions list carrying a one-line reason each. Port it early; it is cheap and
it is the only thing that finds this class.

## Bugs found that a straight port will reproduce

1. **A member could forge a verified `.q`.** Reply-heading previews rendered mention names through a
   path with no forged-suffix guard, so a member named `eviladmin.q` was indistinguishable from a
   verified name. `.q` is the ONLY verification signal a viewer gets. Every tier must pass through
   `presentUnreserved` — and note `useMemberIdentity` returns RAW tiers and bypasses
   `resolveIdentity` entirely, so anything rendering its fields directly must guard them itself.
2. **Avatar initials from a wallet address.** The sidebar fed `UserAvatar`
   `item.displayName ?? item.address` beside a correctly resolved label, so a member with no
   per-space nickname got initials from their address. The avatar must take the BARE resolved name
   from the SAME resolution as the label.
3. **Self identity from the device auth record.** `currentPasskeyInfo` carries no QNS name. This bug
   recurred in FOUR separate places (nav rail, search, DM data hook, message actions). Self must
   resolve from the user's own public profile. Expect the same recurrence in mobile.
4. **Mentions recognised only as an exact token.** The notification renderer matched `^@<address>$`
   on space-delimited tokens; real stored messages do not always have that shape, and one rendered
   as the raw `@<Qm…>` token. shared's `processMentions` scans instead — two implementations of one
   rule, which produced three separate symptoms before it was unified.
5. **A profile card lost its bio**, and an invite picker fell back to addresses, when payloads were
   narrowed to an address. Narrowing a payload is correct, but the receiving surface must then
   resolve everything it needs from the address — check every field it renders, not just the name.

## Where the desktop work is NOT finished

- **Task 8's systematic `/dev/fake-qns` sweep with a control arm was never run.** Live operator
  testing substituted for it and found five real bugs, but the controlled pass — all 18 surfaces,
  one address pinned to a known non-QNS name as the control — does not exist. If the control row
  ever changes, the instrument is wrong rather than the code; nobody has checked that.
- **A deliberate divergence:** the notification path now resolves a mention glued to adjacent text
  with no space; the message list leaves it raw (it enforces word boundaries). Safe — the name still
  comes from the resolver — but asymmetric. Making it symmetric means changing `processMentions` in
  `quorum-shared`.
- **Known and labelled, not hidden:** `MessageComposer.native.tsx`'s reply preview has the same
  forgery exposure as finding 1 (mobile-only file, so it is squarely mobile's problem), and the
  member sidebar's SEARCH matches the raw override field rather than the resolved name shown.
- Composer pills write their text at click time, so a cold-cache mention shows a bare name in the
  draft and the `.q` once posted. Architecturally inherent to raw-DOM pills; a product call.

## Process notes, if you are running this with subagents

- A per-task reviewer caught things the implementer did not, repeatedly — including two of the five
  bugs above. It roughly doubles wall-clock. The operator switched to a lighter loop partway (no
  per-row reviewer, full suite once per batch) and that was the right trade for mechanical rows.
- Every fix was required to show a RED test first. Several "fixes" were caught this way as pinning
  nothing. One shipped assertion was vacuous and had to be rewritten.
- Label claims MEASURED / READ / INFERRED. Two of this session's confident inferences were wrong and
  were only caught by instrumenting: the fetch storm (measured), and the mention token shape (found
  by probing the operator's real IndexedDB after four wrong hypotheses).

## Part 2 — what the operator's live testing found after the branch was first called "ready"

The section above was written when two reviewers had verdicted the branch ship. The operator then
drove the real app for an afternoon and found **eight more bugs**, none of which the 1300-test suite
could see. That gap is the most important thing on this page, so it comes first.

### Why the test suite could not catch any of them

**Every component test mounts its own `IdentityScopeProvider` with its own data.** The component then
passes — correctly — because in that test the data is present. But every one of these bugs was about
*where the component sits in the real tree* and *what the provider above it actually contains at
runtime*. A test that constructs its own provider is blind to that by construction, so the suite
stayed green while the app was wrong.

Two instruments were built to close it, and **on mobile they should exist before the migration
starts, not after**:

- `src/dev/tests/identity/rawNameFieldAudit.test.ts` — fails when a file renders a raw identity field
  without going through the identity module. It carries an exceptions list with a one-line reason per
  entry. This is what finds surfaces an import-derived list cannot see.
- `src/identity/diagnostics.ts` — reports, at runtime in dev builds, any resolution that degrades to
  the truncated-address fallback: the address, the scope, and which sources were missing. A live
  counter sits on `/dev/identity-coverage`, so "0 degraded resolutions this session" is a readable
  positive signal instead of a 23-surface manual pass. Console prefix `[IdentityResolution]`.
  **Known blind spot:** in DM/global scope it cannot distinguish "nobody knows this person" from
  "this provider was never fed local names", because an absent `locallyKnownNames` prop and an empty
  one both arrive as `{}`. A sentinel for "prop never passed" would close it; it is not implemented.

### The architectural findings — these are the ones to port deliberately

**1. A nested provider must MERGE with its parent, not replace it.**
Four separate surfaces shipped mounting a provider with strictly LESS data than the root, each
silently rendering members as raw addresses, each found by hand hours apart. The fix is structural:
`IdentityScopeProvider` now merges with the enclosing scope — `rostersBySpace` two-level (per space,
then per address, so a still-loading child cannot blank out an ancestor's loaded roster),
`locallyKnownNames` and `profiles` flat, with a child's own data winning per key.

**`defaultSpaceId` is deliberately NOT merged** — it is always the provider's own prop. That is what
keeps a DM from inheriting a per-space nickname now that the root carries every space's rosters. Get
this wrong and a DM silently shows a nickname from an unrelated space; it is invisible to anyone
without a nickname set, which is most testing.

**2. The root provider must carry real data.**
It was originally mounted with empty rosters purely as a crash backstop. That is not enough: anything
rendered from an app-level host (modals, toasts, confirmations) inherits it and can resolve nothing.
It now supplies every space's rosters plus every DM partner's locally-known name, read from local
IndexedDB with the existing query keys — cached, shared, no new network traffic, gated on auth, and
deliberately non-suspending because it sits above the router's Suspense boundary.

**3. React context resolves where an element is RENDERED, not where it is created.**
`showConfirmationModal({ preview: React.createElement(MessagePreview, …) })` builds the element inside
the Channel's provider and hands it to a modal host mounted elsewhere. It renders under the host's
context, not the creator's. This produced a mention showing a raw address in the pin/delete
confirmation while the same mention rendered correctly in the pinned panel. Any eagerly-built element
handed to a host has this shape.

**4. `spaceId === channelId === peerAddress` for DMs.**
Any surface reachable from both a channel and a DM inherits this. Passing a DM's `spaceId` into an
identity scope queries a space that does not exist, gets an empty roster, and forces the space ladder
where the global one is correct. Detect with `spaceId === channelId` — an invariant already
load-bearing in ~44 places in `MessageService.ts`, not a new heuristic. It bit `MessagePreview`,
`ReactionsModal`, `BookmarkCard` (twice), `BookmarkItem` and the bookmarks search filter.

**5. Self needs a device-name last resort.**
Removing `currentPasskeyInfo` as self's name source was correct — it carries no QNS name and caused
four bugs. But desktop never publishes a display name, so a user with no published profile then had
**no name source at all** and rendered as their own address. The device display name is now the LAST
`globalName` source, below the published profile, and can never supply a `.q`.

**6. A stored name is sometimes a placeholder, and rendering it verbatim is worse than the fallback.**
A conversation's `displayName` can hold the peer's own address, its truncated form, or the literal
"Unknown User". If one reaches `locallyKnownNames`, the resolver treats it as a real name and renders
a FULL raw address — worse than the truncated address it would have produced itself. `isPlaceholderDisplayName`
must check all of those shapes; it originally checked only the literal, and the test that was supposed
to catch that asserted before an async query settled, so it passed against the bug.

### Enrichment, corrected

Decision 1 above originally excluded the mention autocomplete and the invite picker from `enrich`
alongside the sidebar. That was over-conservative and has been reversed: the autocomplete caps
candidates at 50 and typically shows a handful, so it is bounded and demand-driven. MEASURED after
the change: 12 distinct candidates → 12 fetches, further keystrokes over the same results → +0,
close and reopen → +0.

**The member sidebar remains the only surface that never enriches**, because its cardinality is
genuinely unbounded and the 200-concurrent-request measurement stands. The real fix for it is the
batch profile endpoint, which has been requested of the lead dev and not promised — worth raising
again, since no amount of policy tuning helps there.

### Three test-quality traps this branch hit, all worth watching for

1. **A vacuous assertion** — "never renders the literal 'Unknown User'" against a module with no code
   path that could produce it. It passed against any implementation.
2. **A test that races the thing it tests** — asserting after `waitFor(profile fetched)` while the
   data under test arrived from a *different*, slower query. It asserted on empty state.
3. **A test that re-proves a mechanism it already covers** — re-rendering with an identical address
   set and calling it "no fetch per keystroke", when provider-level dedup absorbs both the correct
   and the broken implementation.

The discipline that caught all three: **revert the fix, watch the test go red with real numbers, put
it back.** Every fix on this branch was required to show that transcript.

---

*Last updated: 2026-08-11*
