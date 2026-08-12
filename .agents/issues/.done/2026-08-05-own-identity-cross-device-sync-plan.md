---
type: task
title: "Implementation plan — your own identity, Phase 1 (desktop only)"
status: done
priority: high
created: 2026-08-05
updated: 2026-08-05
area: identity resolution / space member roster / config sync
repos: quorum-desktop only
related:
  - ".agents/issues/.done/2026-08-05-own-identity-cross-device-sync-design.md (the spec — read it first)"
  - ".agents/issues/.open/2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md (the bug, with the measurement)"
---

# Own identity, Phase 1 — implementation plan

## Status

**2026-08-05 — shipped in PR #313** (`fix(identity): your own name and avatar are
correct everywhere, and follow a rename made on another device`).

All nine tasks landed, plus five that the plan did not anticipate:

- three blockers from an independent branch review (the tag rebroadcast was a
  second ungated broadcast site; the migration's `await` guaranteed nothing
  because `enqueueOutbound` is fire-and-forget; the legacy `sync-members` path had
  no self-exclusion),
- the reconciliation had to **subscribe** to the config rather than read it once on
  mount, or a rename only landed at next launch,
- and three fields — name, avatar, bio — needed the global slot promoted to a real
  resolver tier. That last one was found **on a device, by the reporter**, minutes
  after the clear landed: emptying the override slot turned a defect documented as
  "latent, not live" into a live one.

1004 tests, typecheck and lint clean. Two tests were made to fail on purpose to
confirm they could.

Wave A's four tasks were dispatched to parallel subagents as designed; they do not
share files. They were told not to run git, since a shared index would have raced.

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the current user's own name and avatar are the same on every surface of
the desktop app, follow a rename made on another device, and stop being frozen by a
stale per-space override that the app itself keeps refreshing.

**Architecture:** three independent defects, one symptom. (1) Several surfaces read a
device-local `localStorage` passkey record that nothing on the receive side ever
writes — fixed by reconciling that record from the synced config blob, which repairs
every reader at once because they all read the same in-memory object. (2) Four code
paths stamp the user's own roster **override** slot with their global name, and the
override outranks everything forever — fixed by writing the **global** slot instead,
plus a one-time clear of existing stamps. (3) The clear cannot travel on the wire
because the announce payload builder collapses `''` and absent to the same output —
fixed by giving it presence semantics and broadcasting the clear explicitly.

**Tech stack:** TypeScript, React, IndexedDB (`quorum_db`), React Query, Vitest.
Desktop repo only. **No wire-format change. No `quorum-shared` change. No mobile
dependency.**

**Run tests with:** `yarn test:run <path>` (Vitest). Typecheck with
`npx tsc --noEmit --jsx react-jsx --skipLibCheck`.

---

## Dispatch waves

| Wave | Tasks | Parallel? | Why |
|---|---|---|---|
| **A** | 1, 2, 3, 4 | ✅ yes — no shared files | four separate files, no ordering between them |
| **B** | 5, 6, 7 | ❌ no — 5 and 6 share `MessageService.ts` | run in order; 7 is separate files but belongs to the same behaviour |
| **C** | 8 | ❌ after Task 1 | the clear cannot be broadcast until the payload builder can express it |
| **D** | 9 | last | docs describe the shipped behaviour |

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/utils/spaceProfilePayload.ts` | build the `update-profile` wire payload; must distinguish "no override" from "cleared override" | 1 |
| `src/utils/resolveGlobalSender.ts` | notification-panel sender lookup; must implement override → global | 2 |
| `src/db/messages.ts` | `saveSpaceMember` gains a tripwire that records unexpected self-override writes | 3 |
| `src/utils/selfOverrideTripwire.ts` (new) | the tripwire's bounded ring buffer, pure and testable | 3 |
| `src/hooks/business/user/useReconcileSelfIdentity.ts` (new) | copy the synced config name/avatar into the passkey record | 4 |
| `src/components/Layout.tsx` | mount the reconciliation hook | 4 |
| `src/services/MessageService.ts` | sync-delta self-exclusion; join filed under the global slot | 5, 6 |
| `src/services/InvitationService.ts` | our own join row writes the global slot | 7 |
| `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` | `addOwnerToMembers` writes the global slot | 7 |
| `src/hooks/business/user/useClearLegacySpaceOverrides.ts` (new) | one-time clear: local write + broadcast + log | 8 |

---

# WAVE A — four independent tasks, dispatch in parallel

## Task 1: let the announce express a cleared override

**User-visible outcome:** when you clear your per-space name, everyone else stops
seeing the old one. Today the clear never leaves your device.

**Files:**
- Modify: `src/utils/spaceProfilePayload.ts:80-85`
- Test: `src/dev/tests/utils/spaceProfilePayload.test.ts`

**Background the implementer needs:** the two-slot wire model says **omitted = no
change, `''` = deliberate clear, value = set override**. `buildSpaceProfileWirePayload`
currently uses `||`, which collapses `''` and `undefined` to the same omitted field,
so it can only ever say "no change". The Space Settings editor
(`src/hooks/business/spaces/useSpaceProfile.ts:279-323`) already does this correctly
with `!== undefined` — you are bringing this builder into line with it.

- [ ] **Step 1: Update the existing test that pins the WRONG behaviour**

`src/dev/tests/utils/spaceProfilePayload.test.ts` currently contains a passing test
asserting that `display_name: ''` omits the field. That test pins the bug. Replace it:

```ts
  it('OMITS the override field when there is no override at all', () => {
    const p = buildSpaceProfileWirePayload(
      SELF,
      { display_name: undefined, user_icon: undefined, bio: undefined },
      GLOBAL
    );
    expect('displayName' in p).toBe(false);
    expect('userIcon' in p).toBe(false);
    expect('bio' in p).toBe(false);
  });

  it('SENDS an empty string when the override was deliberately cleared', () => {
    // '' is the wire's "deliberate clear". Collapsing it to an omission means a
    // clear can never leave this device, so spacemates keep the stale name.
    const p = buildSpaceProfileWirePayload(
      SELF,
      { display_name: '', user_icon: '', bio: '' },
      GLOBAL
    );
    expect(p.displayName).toBe('');
    expect(p.userIcon).toBe('');
    expect(p.bio).toBe('');
  });
```

- [ ] **Step 2: Run it and confirm the new test FAILS**

Run: `yarn test:run src/dev/tests/utils/spaceProfilePayload.test.ts`
Expected: the "SENDS an empty string" test FAILS — `p.displayName` is `undefined`.
**If it passes, stop.** The fix is already present and something is wrong with your
assumptions.

- [ ] **Step 3: Make the builder presence-checked**

In `src/utils/spaceProfilePayload.ts`, replace lines 80-85:

```ts
  const nameOverride = ownMember?.display_name || undefined;
  // The member avatar lives on `user_icon` (the typed UserProfile field), but
  // some rows also carry `profile_image` from other write paths, so read both.
  const iconOverride =
    ownMember?.user_icon || ownMember?.profile_image || undefined;
  const bioOverride = ownMember?.bio || undefined;
```

with:

```ts
  // `??`, not `||`: '' is the wire's deliberate clear and MUST survive to the
  // payload. With `||` a clear and a never-set field produced the same omitted
  // field, so clearing a per-space name never left this device.
  const nameOverride = ownMember?.display_name;
  // The member avatar lives on `user_icon` (the typed UserProfile field), but
  // some rows also carry `profile_image` from other write paths, so read both.
  const iconOverride = ownMember?.user_icon ?? ownMember?.profile_image;
  const bioOverride = ownMember?.bio;
```

Leave the spread below unchanged — it already uses `!== undefined`.

- [ ] **Step 4: Run the test again**

Run: `yarn test:run src/dev/tests/utils/spaceProfilePayload.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Do NOT change `hasAnnounceableIdentity`**

It uses truthiness, so a payload whose only override field is `''` does not count as
announceable. That is correct and deliberate: Task 8 broadcasts the clear explicitly
rather than relying on the announce. Leave it alone and do not "fix" it.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
git add src/utils/spaceProfilePayload.ts src/dev/tests/utils/spaceProfilePayload.test.ts
git commit -m "fix(identity): a cleared per-space name can now travel on the wire

buildSpaceProfileWirePayload used || so '' and undefined collapsed to the same
omitted field. The wire model defines '' as a deliberate clear, so clearing a
per-space name never reached anyone else. The Space Settings editor already used
presence semantics; this brings the announce builder into line."
```

---

## Task 2: the notification panel must read the global identity slot

**User-visible outcome:** people show their name in the notifications drawer instead
of a truncated address. Without this, Task 6 makes the drawer worse for every member
who joins from then on.

**Files:**
- Modify: `src/utils/resolveGlobalSender.ts:29-48`
- Test: create `src/dev/tests/utils/resolveGlobalSender.globalSlot.test.ts`

**Background:** `buildGlobalSenderMap` reads `row.display_name` / `row.user_icon`
only. It declares a `globalDisplayName` field it never populates. It has worked by
accident because every incoming join stamped `display_name` — which Task 6 stops
doing. `src/hooks/business/channels/useChannelData.ts:65-108` and
`src/dev/identity-coverage/identityCoverageCore.ts:164-172` both already implement
the ladder correctly; follow them.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildGlobalSenderMap } from '@/utils/resolveGlobalSender';

const SPACE = 'QmSpace0000000000000000000000000000000000';
const ADDR = 'QmMember00000000000000000000000000000000';

describe('buildGlobalSenderMap — the global identity slot', () => {
  it('falls back to the global slot when there is no per-space override', () => {
    // The post-follow-global normal state: override empty, identity in the
    // global slot. Every other render path handles this; this one did not.
    const resolve = buildGlobalSenderMap({
      [SPACE]: [
        {
          user_address: ADDR,
          display_name: '',
          user_icon: '',
          global_display_name: 'Ada',
          global_user_icon: 'data:image/png;base64,AAA',
        },
      ] as never,
    });
    const sender = resolve(SPACE, ADDR);
    expect(sender.displayName).toBe('Ada');
    expect(sender.userIcon).toBe('data:image/png;base64,AAA');
    expect(sender.globalDisplayName).toBe('Ada');
  });

  it('a deliberate per-space override still outranks the global slot', () => {
    const resolve = buildGlobalSenderMap({
      [SPACE]: [
        {
          user_address: ADDR,
          display_name: 'Ada in this space',
          global_display_name: 'Ada',
        },
      ] as never,
    });
    const sender = resolve(SPACE, ADDR);
    expect(sender.displayName).toBe('Ada in this space');
    expect(sender.globalDisplayName).toBe('Ada');
  });

  it('unknown sender still returns an address-only record', () => {
    const resolve = buildGlobalSenderMap({});
    expect(resolve(SPACE, ADDR)).toEqual({ address: ADDR });
  });
});
```

- [ ] **Step 2: Run it and confirm the first test FAILS**

Run: `yarn test:run src/dev/tests/utils/resolveGlobalSender.globalSlot.test.ts`
Expected: FAIL — `sender.displayName` is `''`, `globalDisplayName` is `undefined`.

- [ ] **Step 3: Implement the ladder**

In `src/utils/resolveGlobalSender.ts`, widen the local row type and populate the
merged fields. Replace the `type SpaceMemberRow` alias and the `for (const row of rows)`
body:

```ts
type SpaceMemberRow = channel.UserProfile & {
  isKicked?: boolean;
  /** Roster GLOBAL slots (two-slot model) — the tier between the per-space
   *  override and the public profile. */
  global_display_name?: string;
  global_user_icon?: string;
};
```

```ts
    for (const row of rows) {
      // Same precedence as useMembersWithPublicProfileFallback: override wins
      // when non-empty, else the global slot. `globalDisplayName` is kept
      // SEPARATE so resolveSpaceMemberName can compare the two.
      const global = row.global_display_name || undefined;
      map.set(row.user_address, {
        address: row.user_address,
        displayName: row.display_name || global,
        userIcon: row.user_icon || row.global_user_icon || undefined,
        globalDisplayName: global,
      });
    }
```

- [ ] **Step 4: Run the test again**

Run: `yarn test:run src/dev/tests/utils/resolveGlobalSender.globalSlot.test.ts`
Expected: PASS, all three.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
git add src/utils/resolveGlobalSender.ts src/dev/tests/utils/resolveGlobalSender.globalSlot.test.ts
git commit -m "fix(identity): the notifications drawer reads the global identity slot

buildGlobalSenderMap read the per-space override slot only, and declared a
globalDisplayName field it never populated. It worked by accident because every
incoming join stamped the override slot. It now implements the same
override-then-global ladder every other render path uses."
```

---

## Task 3: a tripwire for unexpected writes to our own override slot

**User-visible outcome:** none directly. This is the instrument that makes the next
regression in this area findable instead of silent. The design explicitly replaced an
unprovable "no code path writes our own override" checklist item with this.

**Files:**
- Create: `src/utils/selfOverrideTripwire.ts`
- Create: `src/dev/tests/utils/selfOverrideTripwire.test.ts`
- Modify: `src/db/messages.ts` (inside `saveSpaceMember`, and a setter on the class)
- Modify: `src/components/context/MessageDB.tsx` (feed it the self address)

**Design note:** this is a **tripwire, not a gate.** It records and warns; it never
blocks a write. Blocking would risk breaking a legitimate path we have not thought
of, and this subsystem has already produced three falsified confident readings.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordSelfOverrideWrite,
  readSelfOverrideTripwire,
  TRIPWIRE_KEY,
  MAX_TRIPWIRE_ENTRIES,
} from '@/utils/selfOverrideTripwire';

describe('selfOverrideTripwire', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('records a non-empty self override write', () => {
    recordSelfOverrideWrite({ spaceId: 'QmSpace', value: 'Stale Name' });
    const entries = readSelfOverrideTripwire();
    expect(entries).toHaveLength(1);
    expect(entries[0].spaceId).toBe('QmSpace');
    expect(entries[0].value).toBe('Stale Name');
    expect(entries[0].stack).toBeTruthy();
  });

  it('ignores a clear — writing "" is the fix, not the bug', () => {
    recordSelfOverrideWrite({ spaceId: 'QmSpace', value: '' });
    expect(readSelfOverrideTripwire()).toHaveLength(0);
  });

  it('bounds the ring so it cannot grow without limit', () => {
    for (let i = 0; i < MAX_TRIPWIRE_ENTRIES + 5; i++) {
      recordSelfOverrideWrite({ spaceId: `s${i}`, value: `v${i}` });
    }
    const entries = readSelfOverrideTripwire();
    expect(entries).toHaveLength(MAX_TRIPWIRE_ENTRIES);
    // newest kept, oldest dropped
    expect(entries[entries.length - 1].spaceId).toBe(
      `s${MAX_TRIPWIRE_ENTRIES + 4}`
    );
  });

  it('never throws when localStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordSelfOverrideWrite({ spaceId: 's', value: 'v' })).not.toThrow();
    spy.mockRestore();
  });

  it('exposes a stable key so it can be read from the console', () => {
    expect(TRIPWIRE_KEY).toBe('quorum:diag:selfOverrideWrites');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test:run src/dev/tests/utils/selfOverrideTripwire.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tripwire**

Create `src/utils/selfOverrideTripwire.ts`:

```ts
// Records any write of a NON-EMPTY per-space override onto the local user's own
// member row. After the Phase 1 fixes only the Space Settings editor should ever
// do that; anything else appearing here is a regression.
//
// A tripwire, not a gate: it never blocks a write. `console.warn`, not `logger`,
// because logger calls compile to no-ops in production builds.
//
// Read it with:  JSON.parse(localStorage.getItem('quorum:diag:selfOverrideWrites'))

export const TRIPWIRE_KEY = 'quorum:diag:selfOverrideWrites';
export const MAX_TRIPWIRE_ENTRIES = 50;

export interface SelfOverrideWrite {
  at: number;
  spaceId: string;
  value: string;
  stack: string;
}

export function recordSelfOverrideWrite(input: {
  spaceId: string;
  value: string;
}): void {
  // '' is the deliberate clear — the fix, not the bug. Only non-empty is news.
  if (!input.value) return;
  try {
    const entry: SelfOverrideWrite = {
      at: Date.now(),
      spaceId: input.spaceId,
      value: input.value,
      stack: new Error().stack ?? '(no stack)',
    };
    const existing = readSelfOverrideTripwire();
    const next = [...existing, entry].slice(-MAX_TRIPWIRE_ENTRIES);
    localStorage.setItem(TRIPWIRE_KEY, JSON.stringify(next));
    console.warn(
      `[SelfOverride] a non-empty per-space override was written onto our OWN row ` +
        `for space ${input.spaceId.slice(0, 12)}. Only Space Settings → Account ` +
        `should do this. See ${TRIPWIRE_KEY} in localStorage.`,
      entry.stack
    );
  } catch {
    // Diagnostics must never break a write.
  }
}

export function readSelfOverrideTripwire(): SelfOverrideWrite[] {
  try {
    const raw = localStorage.getItem(TRIPWIRE_KEY);
    return raw ? (JSON.parse(raw) as SelfOverrideWrite[]) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test again**

Run: `yarn test:run src/dev/tests/utils/selfOverrideTripwire.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `saveSpaceMember`**

In `src/db/messages.ts`, add an import of `recordSelfOverrideWrite` from
`../utils/selfOverrideTripwire`, add a field and setter on the `MessageDB` class:

```ts
  /** Set by MessageDBProvider once the user's address is derived. Diagnostics
   *  only — see selfOverrideTripwire. */
  private selfAddressForDiagnostics?: string;

  setSelfAddressForDiagnostics(address: string): void {
    this.selfAddressForDiagnostics = address;
  }
```

Then inside `saveSpaceMember`, immediately after `const userAddress = (userProfile as
{ user_address?: string }).user_address;`, add:

```ts
      const incomingName = (userProfile as { display_name?: string }).display_name;
      if (
        userAddress &&
        userAddress === this.selfAddressForDiagnostics &&
        incomingName
      ) {
        recordSelfOverrideWrite({ spaceId, value: incomingName });
      }
```

- [ ] **Step 6: Feed it the address**

In `src/components/context/MessageDB.tsx`, find the `useEffect` that derives
`selfAddress` (search for `setSelfAddress(base58btc.baseEncode(sh.bytes))`). Add a
line immediately after that `setSelfAddress(...)` call:

```ts
          messageDB.setSelfAddressForDiagnostics(base58btc.baseEncode(sh.bytes));
```

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn test:run src/dev/tests/utils/selfOverrideTripwire.test.ts
git add src/utils/selfOverrideTripwire.ts src/dev/tests/utils/selfOverrideTripwire.test.ts src/db/messages.ts src/components/context/MessageDB.tsx
git commit -m "feat(identity): tripwire for unexpected writes to our own override slot

'No code path writes our own per-space override except the editor' is an
exhaustive negative and cannot be proven by a fixed list of unit tests — two
extra write vectors were found while that claim was being written. This records
every non-empty self-override write with a stack trace to a bounded localStorage
ring instead. It never blocks a write."
```

---

## Task 4: the synced name reaches the device-local passkey record

**User-visible outcome:** rename yourself on your phone, and the desktop NavRail
avatar tooltip, the DM self entry and your own name in search results all follow.
Today they are frozen at whatever this device last saved.

**Files:**
- Create: `src/hooks/business/user/useReconcileSelfIdentity.ts`
- Create: `src/dev/tests/hooks/useReconcileSelfIdentity.unit.test.ts`
- Modify: `src/components/Layout.tsx:61` area (mount the hook)

**Why one hook fixes ~15 call sites:** `NavRail.tsx:94-96`, `DirectMessage.tsx:298-302`,
`useSearchResultDisplay.ts:77-86`, `useSearchResultDisplayDM.ts:57-66`,
`InvitationService.ts:769-771` and about ten others all read the **same**
`currentPasskeyInfo` object from `usePasskeysContext()`. Repairing that one record
repairs all of them, instead of editing fifteen call sites.

**🔴 The guard that must not be dropped:** never write an empty name. Because every
one of those sites reads the same object, a single empty write blanks all of them at
once. `ConfigService.getConfig` returns `getDefaultUserConfig(address)` — which has
**no** `name` — whenever there is neither a network response nor a stored config,
which is the ordinary cold-start / offline-first-run state. The existing precedent in
`useUnifiedOnboardingFlow.ts:226-247` guards with `if (validatedName)`; keep that shape.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { shouldReconcileSelfIdentity } from '@/hooks/business/user/useReconcileSelfIdentity';

describe('shouldReconcileSelfIdentity', () => {
  it('writes when the synced name differs from the stored one', () => {
    expect(
      shouldReconcileSelfIdentity(
        { name: 'Ada 8', profile_image: 'img8' },
        { displayName: 'Ada 2', pfpUrl: 'img2' }
      )
    ).toEqual({ displayName: 'Ada 8', pfpUrl: 'img8' });
  });

  it('does NOT write when they already agree', () => {
    expect(
      shouldReconcileSelfIdentity(
        { name: 'Ada', profile_image: 'img' },
        { displayName: 'Ada', pfpUrl: 'img' }
      )
    ).toBeNull();
  });

  it('NEVER blanks a good stored name from an empty config', () => {
    // Cold start / offline: getConfig returns a default config with no name.
    // ~15 sites read the same in-memory passkey object, so one empty write
    // blanks every one of them at once.
    expect(
      shouldReconcileSelfIdentity({}, { displayName: 'Ada', pfpUrl: 'img' })
    ).toBeNull();
    expect(
      shouldReconcileSelfIdentity(
        { name: '', profile_image: '' },
        { displayName: 'Ada', pfpUrl: 'img' }
      )
    ).toBeNull();
    expect(
      shouldReconcileSelfIdentity(undefined, { displayName: 'Ada', pfpUrl: 'img' })
    ).toBeNull();
  });

  it('fills a name when the device has none yet', () => {
    expect(
      shouldReconcileSelfIdentity({ name: 'Ada' }, { displayName: undefined })
    ).toEqual({ displayName: 'Ada', pfpUrl: undefined });
  });

  it('updates only the avatar when only the avatar changed', () => {
    expect(
      shouldReconcileSelfIdentity(
        { name: 'Ada', profile_image: 'newImg' },
        { displayName: 'Ada', pfpUrl: 'oldImg' }
      )
    ).toEqual({ displayName: 'Ada', pfpUrl: 'newImg' });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test:run src/dev/tests/hooks/useReconcileSelfIdentity.unit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure decision plus the hook**

Create `src/hooks/business/user/useReconcileSelfIdentity.ts`:

```ts
// The synced config blob (channel A) is the cross-device source of truth for the
// user's global name and avatar, but almost nothing reads it: NavRail, the DM self
// entry, search results and the join-time roster stamp all read the device-local
// passkey record, which only THIS device's own save ever writes. So a rename made
// on another device could never reach them.
//
// Repairing that one record repairs every reader at once, because they all read the
// same object from usePasskeysContext().
//
// See .agents/issues/.done/2026-08-05-own-identity-cross-device-sync-design.md §5-A

import { useEffect, useRef } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { logger } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface SyncedIdentity {
  name?: string;
  profile_image?: string;
}
interface StoredIdentity {
  displayName?: string;
  pfpUrl?: string;
}

/**
 * Pure decision: what, if anything, should be written back to the passkey record.
 * Returns null when nothing should be written.
 *
 * NEVER returns a write that blanks an existing name. getConfig returns a default
 * config with no `name` on a cold start with no network, and ~15 call sites read
 * the single in-memory passkey object, so one empty write blanks all of them.
 */
export function shouldReconcileSelfIdentity(
  config: SyncedIdentity | undefined,
  stored: StoredIdentity
): { displayName: string; pfpUrl?: string } | null {
  const syncedName = config?.name?.trim();
  if (!syncedName) return null;

  const syncedIcon = config?.profile_image || undefined;
  const nameChanged = syncedName !== stored.displayName;
  const iconChanged = Boolean(syncedIcon) && syncedIcon !== stored.pfpUrl;
  if (!nameChanged && !iconChanged) return null;

  return { displayName: syncedName, pfpUrl: syncedIcon ?? stored.pfpUrl };
}

export function useReconcileSelfIdentity(): void {
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentPasskeyInfo?.address) return;
    let cancelled = false;

    (async () => {
      try {
        const config = await messageDB.getUserConfig({
          address: currentPasskeyInfo.address,
        });
        if (cancelled) return;

        const write = shouldReconcileSelfIdentity(config, {
          displayName: currentPasskeyInfo.displayName,
          pfpUrl: currentPasskeyInfo.pfpUrl,
        });
        if (!write) return;

        // Guard against a render loop: updateStoredPasskey changes
        // currentPasskeyInfo, which re-runs this effect.
        const signature = `${write.displayName} ${write.pfpUrl ?? ''}`;
        if (lastAppliedRef.current === signature) return;
        lastAppliedRef.current = signature;

        updateStoredPasskey(currentPasskeyInfo.credentialId, {
          credentialId: currentPasskeyInfo.credentialId,
          address: currentPasskeyInfo.address,
          publicKey: currentPasskeyInfo.publicKey,
          displayName: write.displayName,
          pfpUrl: write.pfpUrl,
          completedOnboarding: true,
        });
        logger.log('[SelfIdentity] reconciled the passkey record from the synced config');
      } catch (error) {
        // Non-fatal: the stored value keeps rendering, which is today's behaviour.
        logger.warn('[SelfIdentity] reconcile failed', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentPasskeyInfo, updateStoredPasskey, messageDB]);
}
```

- [ ] **Step 4: Run the test again**

Run: `yarn test:run src/dev/tests/hooks/useReconcileSelfIdentity.unit.test.ts`
Expected: PASS, all five.

- [ ] **Step 5: Mount it**

In `src/components/Layout.tsx`, next to the existing `useMigrateConversationSettings();`
call on line 61, add the import and the call:

```ts
import { useReconcileSelfIdentity } from '../hooks/business/user/useReconcileSelfIdentity';
```
```ts
  useReconcileSelfIdentity();
```

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
git add src/hooks/business/user/useReconcileSelfIdentity.ts src/dev/tests/hooks/useReconcileSelfIdentity.unit.test.ts src/components/Layout.tsx
git commit -m "fix(identity): the synced name reaches the device-local passkey record

NavRail, the DM self entry, search results and the join-time roster stamp all
read a localStorage passkey record that only this device's own save ever wrote,
so a rename made on another device could never reach them. They all read the
same in-memory object, so reconciling that one record from the synced config
repairs every one of them. Never writes an empty name: getConfig returns a
nameless default on a cold start, and one empty write would blank all of them."
```

---

# WAVE B — the write side. Sequential; tasks 5 and 6 share a file.

## Task 5: a peer cannot overwrite our own per-space name

**User-visible outcome:** a per-space name you set stays set, even when another
client sends you its older copy of your own roster row during a sync.

**Files:**
- Modify: `src/services/MessageService.ts` (the `sync-delta` member apply, near line 6111-6149)
- Test: `src/dev/tests/services/syncDeltaSelfExclusion.unit.test.ts` (create)

**Background:** `computeMemberDiff` / `buildMemberDelta` in `quorum-shared` walk every
address with **no special case for our own**, so any peer whose cached hash for us
differs will send back its stored copy of our row. The receive side then applies it.

**🔴 Do NOT also tighten the "guard fails open on a row with no `profileTimestamp`".**
That fail-open is the intended bootstrap for members we have never heard of, and it is
pinned by `src/dev/tests/db/saveSpaceMemberGlobalSlot.test.ts`
("but it CAN populate a row that has no timestamp yet"). Self-exclusion covers the
case that matters. An earlier draft of the design said to tighten it and was wrong.

- [ ] **Step 1: Find the self address in scope**

Open `src/services/MessageService.ts` and locate the `sync-delta` handler containing
`if (envelope.message.memberDelta) {`. Determine what identifies the local user in
that scope — grep the enclosing method for `self_address`, `selfAddress`, or
`currentUserAddress`. If none is in scope, thread the value in from the caller rather
than reaching for a global. Record which you used; Step 3 refers to it as `SELF`.

- [ ] **Step 2: Write the failing test**

The apply logic is currently inline in a large method. Extract the per-member
decision into an exported pure function first, so it can be tested — mirroring how
`applyProfileUpdate` is already exported from this same file for the same reason.

Add to `src/services/MessageService.ts`, beside `applyProfileUpdate`:

```ts
/**
 * Which slots may a sync-delta member row write?
 *
 * The sync protocol compares digests, which carry no notion of newer or older, so a
 * peer holding a STALE identity will happily push it back. For OUR OWN row that is
 * never acceptable: a peer is not authoritative about our per-space choice. For
 * everyone else the per-slot timestamp guard applies, and a row with no stored
 * timestamp accepts unconditionally — that is the deliberate bootstrap for a member
 * we have never heard of.
 */
export function resolveSyncDeltaSlots(input: {
  isSelf: boolean;
  existingOverrideTs?: number;
  existingGlobalTs?: number;
  incomingOverrideTs: number;
  incomingGlobalTs: number;
}): { applyOverride: boolean; applyGlobal: boolean } {
  const applyOverride =
    !input.isSelf &&
    !(input.existingOverrideTs && input.existingOverrideTs >= input.incomingOverrideTs);
  const applyGlobal = !(
    input.existingGlobalTs && input.existingGlobalTs >= input.incomingGlobalTs
  );
  return { applyOverride, applyGlobal };
}
```

Create `src/dev/tests/services/syncDeltaSelfExclusion.unit.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { resolveSyncDeltaSlots } from '@/services/MessageService';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
}));

describe('resolveSyncDeltaSlots', () => {
  it('NEVER lets a peer write our own override slot, however new it claims to be', () => {
    const r = resolveSyncDeltaSlots({
      isSelf: true,
      existingOverrideTs: undefined,
      incomingOverrideTs: Number.MAX_SAFE_INTEGER,
      existingGlobalTs: undefined,
      incomingGlobalTs: 1,
    });
    expect(r.applyOverride).toBe(false);
  });

  it('still accepts our own GLOBAL slot from a peer', () => {
    const r = resolveSyncDeltaSlots({
      isSelf: true,
      incomingOverrideTs: 5,
      incomingGlobalTs: 5,
    });
    expect(r.applyGlobal).toBe(true);
  });

  it('applies another member override when we have no timestamp (bootstrap)', () => {
    const r = resolveSyncDeltaSlots({
      isSelf: false,
      existingOverrideTs: undefined,
      incomingOverrideTs: 0,
      incomingGlobalTs: 0,
    });
    expect(r.applyOverride).toBe(true);
  });

  it('rejects an older override for another member', () => {
    const r = resolveSyncDeltaSlots({
      isSelf: false,
      existingOverrideTs: 2000,
      incomingOverrideTs: 1000,
      incomingGlobalTs: 0,
    });
    expect(r.applyOverride).toBe(false);
  });
});
```

- [ ] **Step 3: Run it, confirm the self test fails, then use the function**

Run: `yarn test:run src/dev/tests/services/syncDeltaSelfExclusion.unit.test.ts`
Expected: the first test FAILS before you add `!input.isSelf` — add the function
without that clause first, watch it fail, then add the clause and watch it pass. A
test that cannot fail is worse than no test.

Then replace the inline `applyOverride` / `applyGlobal` computation in the sync-delta
handler with a call to `resolveSyncDeltaSlots({ isSelf: userAddress === SELF, ... })`,
using the identifier you established in Step 1.

- [ ] **Step 4: Handle the duplicated test**

`src/dev/tests/db/saveSpaceMemberGlobalSlot.test.ts` **hand-copies** this decision
inline (its `applyIncoming` helper) rather than importing it, so it will keep passing
against the old behaviour. Change that helper to call `resolveSyncDeltaSlots` so it
tracks the real code, and add `isSelf: false` to its fixtures. Do not simply update
the copy to match — that is how a green test stops meaning anything.

- [ ] **Step 5: Run both files, typecheck, commit**

```bash
yarn test:run src/dev/tests/services/syncDeltaSelfExclusion.unit.test.ts src/dev/tests/db/saveSpaceMemberGlobalSlot.test.ts
npx tsc --noEmit --jsx react-jsx --skipLibCheck
git add src/services/MessageService.ts src/dev/tests/services/syncDeltaSelfExclusion.unit.test.ts src/dev/tests/db/saveSpaceMemberGlobalSlot.test.ts
git commit -m "fix(identity): a peer can no longer overwrite our own per-space name

The roster diff in quorum-shared walks every address with no special case for
our own, so any peer with a differing cached hash sends its stored copy of our
row back and we applied it. A peer is never authoritative about our per-space
choice. The global slot is still accepted, and the deliberate bootstrap for
members we have never heard of is unchanged."
```

---

## Task 6: an incoming join is a global identity, not a per-space override

**User-visible outcome:** a member who joins a space today no longer gets permanently
frozen under the name they had at that moment. Their later renames reach you.

**Files:**
- Modify: `src/services/MessageService.ts:4922-4945`
- Test: `src/dev/tests/services/joinFilesGlobalSlot.unit.test.ts` (create)

**Depends on Task 2 being merged.** Without it this change makes the notifications
drawer render a truncated address for every future joiner.

- [ ] **Step 1: Write the failing test**

Extract the row-shape decision to a pure exported function beside `applyProfileUpdate`:

```ts
/**
 * A `join` control carries the joiner's GLOBAL identity, not a per-space choice.
 * Filing it in the override slot froze that member under whatever name they had at
 * join time, because the override outranks every later global update and the
 * announce keeps re-stamping it. File it in the global slot instead, stamped with
 * joinedAt so ordinary last-write-wins applies.
 */
export function buildJoinedMemberRow(participant: {
  address: string;
  inboxAddress: string;
  userIcon?: string;
  displayName?: string;
  joinedAt: number;
}): SpaceMemberRow {
  return {
    user_address: participant.address,
    inbox_address: participant.inboxAddress,
    global_user_icon: participant.userIcon,
    global_display_name: participant.displayName,
    globalProfileTimestamp: participant.joinedAt,
    isKicked: false,
    joinedAt: participant.joinedAt,
  } as SpaceMemberRow;
}
```

Create `src/dev/tests/services/joinFilesGlobalSlot.unit.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildJoinedMemberRow } from '@/services/MessageService';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
}));

const P = {
  address: 'QmJoiner0000000000000000000000000000000',
  inboxAddress: 'inbox-1',
  userIcon: 'data:image/png;base64,AAA',
  displayName: 'Ada',
  joinedAt: 1700000000000,
};

describe('buildJoinedMemberRow', () => {
  it('files the joiner identity in the GLOBAL slot, never the override slot', () => {
    const row = buildJoinedMemberRow(P) as Record<string, unknown>;
    expect(row.global_display_name).toBe('Ada');
    expect(row.global_user_icon).toBe(P.userIcon);
    // The override slot must stay untouched — a value here outranks every later
    // global update forever, which is the whole defect.
    expect(row.display_name).toBeUndefined();
    expect(row.user_icon).toBeUndefined();
  });

  it('stamps globalProfileTimestamp so later updates can win', () => {
    const row = buildJoinedMemberRow(P) as Record<string, unknown>;
    expect(row.globalProfileTimestamp).toBe(P.joinedAt);
  });

  it('preserves the authoritative inbox_address from the verified join', () => {
    const row = buildJoinedMemberRow(P) as Record<string, unknown>;
    expect(row.inbox_address).toBe('inbox-1');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test:run src/dev/tests/services/joinFilesGlobalSlot.unit.test.ts`
Expected: FAIL — `buildJoinedMemberRow` is not exported.

- [ ] **Step 3: Use it at the join receive site**

At `src/services/MessageService.ts:4922-4929`, replace the inline object passed to
`this.messageDB.saveSpaceMember(...)` with `buildJoinedMemberRow(participant)`.

- [ ] **Step 4: Fix the companion optimistic cache write**

Immediately below, `queryClient.setQueryData(buildSpaceMembersKey({...}), ...)` at
lines 4930-4945 still appends `display_name: participant.displayName`. **Change it to
match the DB write**, or the React Query cache and IndexedDB disagree about which slot
holds a new joiner's name until the next refetch:

```ts
                      {
                        user_address: participant.address,
                        global_user_icon: participant.userIcon,
                        global_display_name: participant.displayName,
                        globalProfileTimestamp: participant.joinedAt,
                        joinedAt: participant.joinedAt,
                      },
```

- [ ] **Step 5: Run the test, typecheck, commit**

```bash
yarn test:run src/dev/tests/services/joinFilesGlobalSlot.unit.test.ts
npx tsc --noEmit --jsx react-jsx --skipLibCheck
git add src/services/MessageService.ts src/dev/tests/services/joinFilesGlobalSlot.unit.test.ts
git commit -m "fix(identity): an incoming join is a global identity, not a per-space override

A join control carries the joiner's global name. Filing it in the override slot
froze that member under the name they had at join time: the override outranks
every later global update, and the on-connect announce keeps re-stamping it, so
it never decays. Filed in the global slot with a joinedAt stamp instead, so
ordinary last-write-wins applies. The companion optimistic cache write is
changed with it."
```

---

## Task 7: our own join row writes the global slot

**User-visible outcome:** joining a space no longer plants a copy of your current
name that will still be showing months later.

**Files:**
- Modify: `src/services/InvitationService.ts:768-773`
- Modify: `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx:99-104`

**Note:** the `join` broadcast at `InvitationService.ts:837` (`participant.displayName`)
is **unchanged**. It is the wire, other clients need it, and Task 6 makes receivers
file it correctly.

- [ ] **Step 1: Source the identity from the config, not the passkey record**

`InvitationService.join` already calls `this.getConfig(...)` a few lines below, at line
774. Move that call **above** the `saveSpaceMember` at 768 and reuse it. Replace
768-773 with:

```ts
      // Two-slot model: our own row gets the GLOBAL slot, never the override.
      // A value in the override slot outranks every later global update and the
      // announce re-stamps it forever, so stamping it here froze us under the
      // name we happened to have at join time.
      const joinedAt = Date.now();
      await this.messageDB.saveSpaceMember(space.spaceId, {
        user_address: currentPasskeyInfo.address,
        global_user_icon: config?.profile_image ?? currentPasskeyInfo.pfpUrl,
        global_display_name: config?.name ?? currentPasskeyInfo.displayName,
        globalProfileTimestamp: joinedAt,
        inbox_address: inboxAddress,
      } as SpaceMemberRow);
```

- [ ] **Step 2: Same treatment for the legacy-owner repair**

In `SpaceSettingsModal.tsx`, `addOwnerToMembers` (lines 99-104) writes
`display_name: user.currentPasskeyInfo.displayName`. Change it to the global slot:

```ts
      await messageDB.saveSpaceMember(spaceId, {
        user_address: user.currentPasskeyInfo.address,
        global_user_icon: user.currentPasskeyInfo.pfpUrl || '',
        global_display_name: user.currentPasskeyInfo.displayName || '',
        globalProfileTimestamp: Date.now(),
        inbox_address: inboxAddress,
      } as any);
```

- [ ] **Step 3: Verify with the tripwire from Task 3**

Run the app, join a space, then in the console:
`JSON.parse(localStorage.getItem('quorum:diag:selfOverrideWrites'))`
Expected: `null` or an empty array. **Any entry naming `InvitationService` or
`SpaceSettingsModal` means this task is not done.**

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
git add src/services/InvitationService.ts src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx
git commit -m "fix(identity): joining a space no longer stamps our own override slot

Both our own join row and the legacy-owner repair wrote the per-space override
slot with the current global name. That slot outranks every later global update
and the announce re-stamps it on every connect, so the value never decayed. Both
now write the global slot, sourced from the synced config rather than the
device-local passkey record. The join broadcast itself is unchanged."
```

---

# WAVE C — the migration. After Task 1.

## Task 8: clear the legacy per-space overrides, once, everywhere

**User-visible outcome:** the stale names disappear — on this device, on your other
devices, and for everyone who shares a space with you.

**Files:**
- Create: `src/hooks/business/user/useClearLegacySpaceOverrides.ts`
- Create: `src/dev/tests/hooks/useClearLegacySpaceOverrides.unit.test.ts`
- Modify: `src/components/Layout.tsx` (mount it)
- Modify: `src/components/context/MessageDB.tsx` (gate the first announce on it)

> ⚠️ **Do not dispatch this task to a subagent.** Steps 3 and 5 are specified as
> required behaviour plus a pattern to follow rather than literal code, because the
> hook has to reach into `submitChannelMessage` and the announce sequencing, both of
> which need reading the surrounding code first. Every other task in this plan is
> literal enough to hand off; this one is main-thread work.

**🔴 Four properties, each from a review finding. Missing any one makes this fail
silently:**

1. **Broadcast, not just local.** A local write is invisible on the wire, so
   spacemates and your other devices keep the poisoned copy — and an un-migrated
   sibling re-announces it with a *fresh* timestamp and wins.
2. **Stamp `profileTimestamp`.** `applyProfileUpdate` is deliberately fail-open on a
   row with no timestamp, so an unstamped clear is overwritten by any later announce.
3. **Log what it destroyed.** It is irreversible and runs once. Without a record,
   nobody can later tell "never had a per-space name" from "the clear ate it".
4. **Sequence before the first announce.** `announceProfileToAllSpacesOnConnect` fires
   from a startup timer *and* `setResubscribe` (`MessageDB.tsx:571-591`); the timer
   exists because that path already raced startup once.

- [ ] **Step 1: Write the failing test for the pure part**

```ts
import { describe, it, expect } from 'vitest';
import { planLegacyOverrideClear } from '@/hooks/business/user/useClearLegacySpaceOverrides';

const SELF = 'QmSelf00000000000000000000000000000000';

describe('planLegacyOverrideClear', () => {
  it('clears a non-empty override on our own row', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: SELF, display_name: 'Old Name' },
    ] as never);
    expect(plan).toHaveLength(1);
    expect(plan[0].spaceId).toBe('A');
    expect(plan[0].previousName).toBe('Old Name');
  });

  it('ignores rows that belong to other members', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: 'QmOther', display_name: 'Their Name' },
    ] as never);
    expect(plan).toHaveLength(0);
  });

  it('ignores rows that are already clear', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: SELF, display_name: '' },
      { spaceId: 'B', user_address: SELF },
    ] as never);
    expect(plan).toHaveLength(0);
  });

  it('also reports a stale override avatar', () => {
    const plan = planLegacyOverrideClear(SELF, [
      { spaceId: 'A', user_address: SELF, user_icon: 'data:image/png;base64,AAA' },
    ] as never);
    expect(plan).toHaveLength(1);
    expect(plan[0].previousIcon).toBe('data:image/png;base64,AAA');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `yarn test:run src/dev/tests/hooks/useClearLegacySpaceOverrides.unit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/hooks/business/user/useClearLegacySpaceOverrides.ts`. Follow the shape of
`useMigrateConversationSettings.ts` exactly: versioned `localStorage` flag keyed by
address, `ranRef` guard, and **do not set the flag on failure** so it retries.

```ts
// One-time clear of legacy per-space overrides on the user's OWN roster rows.
//
// Those values are copies of an old global name, stamped at join and then re-sent
// and re-stamped by the on-connect announce on every connect, so they never decay
// and are byte-for-byte indistinguishable from a name the user deliberately chose.
// Nothing can tell them apart, so they are cleared unconditionally, once.
//
// It BROADCASTS the clear (displayName: '') rather than writing locally, because a
// local write is invisible on the wire and an un-migrated sibling device would
// re-announce the old value with a fresher timestamp and win.
//
// See .agents/issues/.done/2026-08-05-own-identity-cross-device-sync-design.md §5-D

export const CLEAR_FLAG_PREFIX = 'spaceOverridesCleared:v1:';
export const CLEAR_LOG_KEY = 'quorum:diag:clearedSpaceOverrides';

export interface OverrideClearEntry {
  spaceId: string;
  previousName?: string;
  previousIcon?: string;
}

/** Pure: which of our own rows still carry a per-space override? */
export function planLegacyOverrideClear(
  selfAddress: string,
  rows: { spaceId: string; user_address: string; display_name?: string; user_icon?: string }[]
): OverrideClearEntry[] {
  return rows
    .filter((r) => r.user_address === selfAddress && (r.display_name || r.user_icon))
    .map((r) => ({
      spaceId: r.spaceId,
      previousName: r.display_name || undefined,
      previousIcon: r.user_icon || undefined,
    }));
}
```

Then the hook. For each planned space it must:

1. write `display_name: ''`, `user_icon: ''`, **and `profileTimestamp: Date.now()`**
   via `messageDB.saveSpaceMember`;
2. send an `update-profile` through the same path the Space Settings editor uses
   (`submitChannelMessage`, see `useSpaceProfile.ts:310-329`) carrying
   `displayName: ''` and `userIcon: ''`;
3. append the `OverrideClearEntry[]` to `CLEAR_LOG_KEY` in `localStorage` via
   `console.warn` + a bounded write, mirroring `selfOverrideTripwire.ts`;
4. set the flag only after all of the above resolve.

- [ ] **Step 4: Run the test again**

Run: `yarn test:run src/dev/tests/hooks/useClearLegacySpaceOverrides.unit.test.ts`
Expected: PASS, all four.

- [ ] **Step 5: Gate the first announce on the migration**

In `src/components/context/MessageDB.tsx`, find
`announceProfileToAllSpacesOnConnect` and its two triggers (the startup timer and
`setResubscribe`, around lines 571-591). Add a module-scoped promise that resolves
when the clear has run (or immediately when the flag is already set), and `await` it
at the top of the announce before it builds any payload.

Without this, the first post-upgrade connect re-announces the pre-clear value with a
fresh timestamp before the migration's IndexedDB write lands, and the row is
repoisoned by the exact mechanism the bug's §4-A-iii measured.

- [ ] **Step 6: Mount it**

In `src/components/Layout.tsx`, beside the other one-shot hooks:

```ts
  useClearLegacySpaceOverrides();
```

- [ ] **Step 7: Typecheck, run the full suite, commit**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn test:run
git add src/hooks/business/user/useClearLegacySpaceOverrides.ts src/dev/tests/hooks/useClearLegacySpaceOverrides.unit.test.ts src/components/Layout.tsx src/components/context/MessageDB.tsx
git commit -m "fix(identity): clear the legacy per-space overrides once, everywhere

These are copies of an old global name, stamped at join and then re-sent and
re-stamped by the on-connect announce on every connect, so they never decay and
cannot be told apart from a deliberately chosen name.

The clear is BROADCAST rather than written locally: a local write is invisible on
the wire, so spacemates and the user's own other devices keep the poisoned copy,
and an un-migrated sibling re-announces it with a fresher timestamp and wins. It
stamps profileTimestamp, because applyProfileUpdate is fail-open on an unstamped
row. It records what it destroyed, because it is irreversible. And it is
sequenced before the first announce, which fires from two triggers and has raced
startup before."
```

---

# WAVE D

## Task 9: correct the docs this work falsified

**Files:**
- Modify: `.agents/docs/features/identity-resolution-and-profile-sync.md`
- Modify: `.agents/docs/config-sync-system.md`

- [ ] **Step 1: Fix the "decaying" claim**

The identity doc's "Legacy stamped rosters" entry under *Known limitations* says such
rows "look like deliberate overrides until manually cleared" and treats the problem as
expiring. Two things are wrong: the join path **still stamps** (so new ones are
created), and the on-connect announce **re-stamps** them (so they never decay).
Rewrite it to say so, and note that Phase 1 fixed both.

- [ ] **Step 2: Fix the server-validation claim**

`config-sync-system.md` states the **server** validates that `spaceIds` and
`spaceKeys` are consistent and returns `400 - invalid config missing data`. The server
receives only ciphertext (`ConfigService.saveConfig` posts `user_address`,
`user_public_key`, the encrypted `user_config`, `timestamp`, `signature`), so it
cannot inspect either field. Correct it to describe the client-side guard.

- [ ] **Step 3: Add the two instruments to the file map**

`selfOverrideTripwire` (`quorum:diag:selfOverrideWrites`) and the clear's log
(`quorum:diag:clearedSpaceOverrides`), beside the existing `/dev/identity-coverage`
entry.

- [ ] **Step 4: Commit**

```bash
git add .agents/docs/
git commit -m "docs(identity): correct the decaying-stamp and server-validation claims"
```

---

---

## Deliberately NOT in this plan

**`EncryptionService.ts:174-187` (space re-key / address migration).** It deletes and
re-saves every member row with a `...member` spread, so it carries whatever
`display_name` currently holds into the new `spaceId`. Review flagged it as a
carry-forward vector.

Left alone on purpose: it is not an author, and after Task 8 our own rows hold `''`,
so there is nothing to carry. If Task 3's tripwire ever names this file, that
assumption was wrong and it needs its own fix.

Recorded here so the omission is a decision rather than an oversight.

## Definition of done for the branch

- [ ] `yarn test:run` green
- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` clean
- [ ] `yarn lint` clean
- [ ] Every new test verified to go **red** when its fix is reverted — not assumed
- [ ] `localStorage['quorum:diag:selfOverrideWrites']` empty after joining a space
- [ ] Re-run `.agents/tools/dm-debug/08-self-identity-sources.js`: source A matches
      source B, and no space reports `overrideOutranksGlobal: true`
- [ ] A member who joins **after** this ships shows a name, not an address, in the
      global notifications drawer

---

*Last updated: 2026-08-05*
