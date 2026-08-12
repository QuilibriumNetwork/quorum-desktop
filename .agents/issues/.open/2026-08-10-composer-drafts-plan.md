---
type: task
title: "Implementation plan: composer drafts that survive navigation and restart"
status: open
priority: medium
created: 2026-08-10
updated: 2026-08-10
area: message composer / local storage / cross-client
repos: quorum-shared, quorum-desktop, quorum-mobile
source: writing-plans, from the design at 2026-08-10-composer-drafts-design.md
related:
  - ".agents/issues/.open/2026-08-10-composer-drafts-design.md (THE DESIGN — read first)"
  - "A .secret issue filed 2026-08-10 covers local message-store protection; ask the operator before Task 3."
---

# Composer Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** You start writing a message, navigate away, come back, and your words are still there — per conversation, across app restarts.

**Architecture:** `quorum-shared` gains a `DraftStore`: an in-memory map hydrated once at boot, read **synchronously**, written back debounced with a flush on page-hide. Drafts are keyed on `(selfAddress, TypingScope)` — reusing the scope union that already exists — and persisted through a `DraftPersistence` interface each client implements over **the same database its messages live in**. `useMessageComposer` gains a *required* `draftScope`, so a composer cannot be built that silently loses drafts.

**Tech Stack:** TypeScript, React 18, `@tanstack/react-query`, IndexedDB (desktop), vitest + @testing-library/react, yarn (never npm).

**Read the design first.** In particular §3 (why there is no setting) and §4 (the storage invariant). Do not substitute a key-value store for the message database — that is the one decision the whole design rests on.

## Global Constraints

- **Yarn only.** Never `npm install`. If `package-lock.json` appears, delete it.
- **Never run `npm publish`.** Mobile (Task 9) is blocked on the lead dev publishing shared.
- **A draft is stored in the same database as messages** — desktop `quorum_db`, mobile the SQL database. Never `localStorage`, never MMKV. (Design §4.)
- **Hydration sets React state; it never dispatches synthetic input events.** Dispatching them would broadcast a typing indicator to the channel on open. (Design §3.)
- **Reuse `TypingScope`** from `@quilibrium/quorum-shared`. Do not define a parallel scope union.
- **Placeholder addresses in tests** follow the repo family: `QmMeMeMe…`, `QmThemThem…`. Never a real address.
- After editing `quorum-shared/src`, run `yarn build` there or desktop's `tsc` will not see the change (it reads `dist/*.d.ts`).

---

## File Structure

**quorum-shared** (at `/e/GitHub/Quilibrium/quorum-shared`)

| File | Responsibility |
|---|---|
| `src/utils/drafts.ts` | CREATE — `DraftRecord`, `DraftPersistence`, `draftKey()`. Pure. |
| `src/utils/drafts.test.ts` | CREATE — key truth table. |
| `src/utils/DraftStore.ts` | CREATE — the map + debounce + flush. Platform-agnostic. |
| `src/utils/DraftStore.test.ts` | CREATE — timing behaviour under fake timers. |
| `src/utils/index.ts` | MODIFY — barrel exports. |

**quorum-desktop**

| File | Responsibility |
|---|---|
| `src/db/dbVersion.ts` | MODIFY — `QUORUM_DB_VERSION` 16 → 17. |
| `src/db/messages.ts` | MODIFY — `drafts` object store + three CRUD methods. |
| `src/drafts/indexedDbDraftPersistence.ts` | CREATE — `DraftPersistence` over `MessageDB`. |
| `src/drafts/DraftsProvider.tsx` | CREATE — owns the store, hydrates, flushes on hide. |
| `src/drafts/useDraftStore.ts` | CREATE — the context hook. |
| `src/drafts/index.ts` | CREATE — public entry point. |
| `src/hooks/business/messages/useMessageComposer.ts` | MODIFY — required `draftScope`, read/write-through. |
| `src/components/space/Channel.tsx` | MODIFY — pass `draftScope`. |
| `src/components/direct/DirectMessage.tsx` | MODIFY — pass `draftScope`. |
| `src/components/thread/ThreadPanel.tsx` | MODIFY — pass `draftScope`. |
| `web/main.tsx` | MODIFY — mount `<DraftsProvider>`. |
| `.agents/docs/quorum-db-schema.md` | MODIFY — document the new store. |

---

## Phase A — the shared rule (MAIN THREAD, serial)

Do not delegate. Every later task depends on these semantics.

### Task 1: `draftKey`, `DraftRecord`, `DraftPersistence`

**Files:**
- Create: `/e/GitHub/Quilibrium/quorum-shared/src/utils/drafts.ts`
- Test: `/e/GitHub/Quilibrium/quorum-shared/src/utils/drafts.test.ts`
- Modify: `/e/GitHub/Quilibrium/quorum-shared/src/utils/index.ts`

**Interfaces:**
- Consumes: `TypingScope`, `scopeKey` from `../types/typing` (already exist).
- Produces: `draftKey(selfAddress: string, scope: TypingScope): string`; `interface DraftRecord`; `interface DraftPersistence`.

- [ ] **Step 1: Branch in shared**

```bash
cd /e/GitHub/Quilibrium/quorum-shared
git checkout master && git pull
git checkout -b feat/composer-drafts
```

- [ ] **Step 2: Write the failing test**

Create `src/utils/drafts.test.ts`:

```ts
/**
 * The draft key's whole job is to keep two things apart that must never merge:
 * two conversations, and two accounts on one device.
 *
 * The account case is not hypothetical — quorum_db is shared across accounts on
 * a device, so a key without the self address lets account B open a channel and
 * read account A's unsent message.
 */
import { describe, it, expect } from 'vitest';
import { draftKey } from './drafts';
import type { TypingScope } from '../types/typing';

const SELF = 'QmMeMeMeEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const OTHER = 'QmThemThemEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzz';

const channel: TypingScope = { kind: 'space-channel', spaceId: 's1', channelId: 'c1' };
const sibling: TypingScope = { kind: 'space-channel', spaceId: 's1', channelId: 'c2' };
const thread: TypingScope = { kind: 'thread', spaceId: 's1', channelId: 'c1', threadId: 't1' };
const dm: TypingScope = { kind: 'dm', address: OTHER };

describe('draftKey', () => {
  it('is stable for the same account and scope', () => {
    expect(draftKey(SELF, channel)).toBe(draftKey(SELF, { ...channel }));
  });

  it('separates two channels in the same space', () => {
    expect(draftKey(SELF, channel)).not.toBe(draftKey(SELF, sibling));
  });

  it('separates a thread from the channel that contains it', () => {
    // A thread panel and its channel composer are open at the same time.
    expect(draftKey(SELF, thread)).not.toBe(draftKey(SELF, channel));
  });

  it('separates a DM from a channel', () => {
    expect(draftKey(SELF, dm)).not.toBe(draftKey(SELF, channel));
  });

  it('separates two accounts on the same device, same scope', () => {
    // The cross-account read. Without the self address these collide.
    expect(draftKey(SELF, channel)).not.toBe(draftKey(OTHER, channel));
  });

  it('starts with the self address, so a prefix scan finds one account', () => {
    expect(draftKey(SELF, channel).startsWith(`${SELF}|`)).toBe(true);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd /e/GitHub/Quilibrium/quorum-shared && npx vitest --run src/utils/drafts.test.ts`
Expected: FAIL — cannot resolve `./drafts`.

- [ ] **Step 4: Implement**

Create `src/utils/drafts.ts`:

```ts
/**
 * Composer drafts — types and key derivation.
 *
 * See .agents/issues/.open/2026-08-10-composer-drafts-design.md in
 * quorum-desktop. The load-bearing rule from that design: a draft is stored in
 * the same database as messages on each platform, so it is never more exposed
 * than the conversation it belongs to.
 */
import type { TypingScope } from '../types/typing';
import { scopeKey } from '../types/typing';

/**
 * One conversation's unsent message.
 *
 * `updatedAt` is not read by anything shipping today. It exists so expiry, a
 * "most recent draft" ordering, or cross-device sync can be added later without
 * a schema migration.
 */
export interface DraftRecord {
  /** `${selfAddress}|${scopeKey(scope)}`. Primary key. */
  key: string;
  /** Denormalised so persistence can query one account without parsing `key`. */
  selfAddress: string;
  text: string;
  replyToMessageId: string | null;
  updatedAt: number;
}

/**
 * Platform storage. Desktop implements this over IndexedDB, mobile over its SQL
 * database. Deliberately tiny — the caching and debouncing live in DraftStore,
 * so a client only has to get durable reads and writes right.
 */
export interface DraftPersistence {
  /** Every draft belonging to one account. */
  loadAll(selfAddress: string): Promise<DraftRecord[]>;
  put(record: DraftRecord): Promise<void>;
  deleteKeys(keys: string[]): Promise<void>;
}

/**
 * The account+conversation identity of a draft.
 *
 * `selfAddress` is first and separated by `|` so persistence can find one
 * account's drafts with a prefix scan. `|` cannot occur in an address or in a
 * `scopeKey` output, so the two halves are unambiguous.
 */
export function draftKey(selfAddress: string, scope: TypingScope): string {
  return `${selfAddress}|${scopeKey(scope)}`;
}
```

- [ ] **Step 5: Export from the barrel**

In `src/utils/index.ts`, add alongside the other exports:

```ts
export * from './drafts';
```

- [ ] **Step 6: Run the test — expect PASS**

Run: `npx vitest --run src/utils/drafts.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/utils/drafts.ts src/utils/drafts.test.ts src/utils/index.ts
git commit -m "feat(drafts): draft key over the existing TypingScope

Reuses TypingScope rather than inventing a parallel union — it already
has exactly the three surfaces a composer can be, and a stable scopeKey.
The self address is in the key so two accounts on one device cannot read
each other's unsent messages."
```

---

### Task 2: `DraftStore`

**Files:**
- Create: `/e/GitHub/Quilibrium/quorum-shared/src/utils/DraftStore.ts`
- Test: `/e/GitHub/Quilibrium/quorum-shared/src/utils/DraftStore.test.ts`
- Modify: `/e/GitHub/Quilibrium/quorum-shared/src/utils/index.ts`

**Interfaces:**
- Consumes: `DraftRecord`, `DraftPersistence` from `./drafts`.
- Produces: `class DraftStore` with `hydrate(selfAddress: string): Promise<void>`, `get(key: string): DraftRecord | null`, `set(key: string, text: string, replyToMessageId: string | null): void`, `clear(key: string): void`, `clearWhere(predicate: (key: string) => boolean): void`, `flush(): Promise<void>`, `readonly isHydrated: boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/DraftStore.test.ts`:

```ts
/**
 * The store's contract is about TIMING, which is why every test here uses fake
 * timers.
 *
 * Two properties matter more than the rest:
 *  - `get` is synchronous, so a composer mounting mid-navigation reads its draft
 *    on the first render and there is no window where a fast typist's keystrokes
 *    race an arriving hydration.
 *  - `flush()` writes immediately, because the debounce alone loses the last
 *    500ms when a tab closes mid-sentence — which is exactly when a draft
 *    matters most.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DraftStore } from './DraftStore';
import type { DraftPersistence, DraftRecord } from './drafts';

const SELF = 'QmMeMeMeEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const KEY = `${SELF}|sc:s1:c1`;

function fakePersistence() {
  const rows = new Map<string, DraftRecord>();
  const calls = { loadAll: 0, put: 0, deleteKeys: 0 };
  const persistence: DraftPersistence = {
    async loadAll(selfAddress) {
      calls.loadAll++;
      return [...rows.values()].filter((r) => r.selfAddress === selfAddress);
    },
    async put(record) {
      calls.put++;
      rows.set(record.key, record);
    },
    async deleteKeys(keys) {
      calls.deleteKeys++;
      keys.forEach((k) => rows.delete(k));
    },
  };
  return { persistence, rows, calls };
}

let clock = 1_000;
const now = () => clock;

beforeEach(() => {
  vi.useFakeTimers();
  clock = 1_000;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DraftStore — reads', () => {
  it('returns null for an unknown key', () => {
    const { persistence } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    expect(store.get(KEY)).toBeNull();
  });

  it('makes a written value readable SYNCHRONOUSLY, before any timer runs', () => {
    const { persistence } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    store.set(KEY, 'half a thought', null);
    // No timer advance, no await. This is the property that removes the race.
    expect(store.get(KEY)?.text).toBe('half a thought');
  });

  it('hydrates from persistence', async () => {
    const { persistence, rows } = fakePersistence();
    rows.set(KEY, {
      key: KEY,
      selfAddress: SELF,
      text: 'from disk',
      replyToMessageId: null,
      updatedAt: 1,
    });
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    expect(store.isHydrated).toBe(false);
    await store.hydrate(SELF);
    expect(store.isHydrated).toBe(true);
    expect(store.get(KEY)?.text).toBe('from disk');
  });
});

describe('DraftStore — write debouncing', () => {
  it('does not write before the debounce elapses', async () => {
    const { persistence, calls } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(KEY, 'typing', null);
    await vi.advanceTimersByTimeAsync(499);
    expect(calls.put).toBe(0);
  });

  it('coalesces a burst into ONE write carrying the latest text', async () => {
    const { persistence, rows, calls } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(KEY, 'a', null);
    store.set(KEY, 'ab', null);
    store.set(KEY, 'abc', null);
    await vi.advanceTimersByTimeAsync(500);
    expect(calls.put).toBe(1);
    expect(rows.get(KEY)?.text).toBe('abc');
  });

  it('flush() writes immediately and cancels the pending timer', async () => {
    const { persistence, rows, calls } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(KEY, 'closing the tab now', null);
    await store.flush();
    expect(rows.get(KEY)?.text).toBe('closing the tab now');
    // The timer must not fire a second, redundant write afterwards.
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.put).toBe(1);
  });

  it('stamps updatedAt from the injected clock', async () => {
    const { persistence, rows } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    clock = 4242;
    store.set(KEY, 'stamped', null);
    await store.flush();
    expect(rows.get(KEY)?.updatedAt).toBe(4242);
  });
});

describe('DraftStore — emptiness is deletion', () => {
  it('DELETES rather than storing an empty draft', async () => {
    const { persistence, rows } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(KEY, 'something', null);
    await store.flush();
    expect(rows.has(KEY)).toBe(true);

    store.set(KEY, '', null);
    await store.flush();
    expect(rows.has(KEY)).toBe(false);
    expect(store.get(KEY)).toBeNull();
  });

  it('treats whitespace-only text as empty', async () => {
    const { persistence, rows } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(KEY, '   \n  ', null);
    await store.flush();
    expect(rows.has(KEY)).toBe(false);
  });
});

describe('DraftStore — clearing', () => {
  it('clear() persists the deletion immediately, without waiting for the debounce', async () => {
    // A message is sent, then the app is killed. If the delete were debounced
    // the draft would come back and read as an unsent message that was in fact
    // sent.
    const { persistence, rows } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(KEY, 'about to send', null);
    await store.flush();

    store.clear(KEY);
    await Promise.resolve();
    await Promise.resolve();
    expect(rows.has(KEY)).toBe(false);
  });

  it('clearWhere() removes every matching key and leaves the rest', async () => {
    const { persistence, rows } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(`${SELF}|sc:s1:c1`, 'in space 1', null);
    store.set(`${SELF}|th:s1:c1:t1`, 'in a thread of space 1', null);
    store.set(`${SELF}|sc:s2:c9`, 'in space 2', null);
    await store.flush();

    store.clearWhere((k) => k.includes(':s1:'));
    await store.flush();

    expect(rows.has(`${SELF}|sc:s1:c1`)).toBe(false);
    expect(rows.has(`${SELF}|th:s1:c1:t1`)).toBe(false);
    expect(rows.has(`${SELF}|sc:s2:c9`)).toBe(true);
  });
});

describe('DraftStore — re-hydrating for a different account', () => {
  it('drops the previous account’s drafts from memory', async () => {
    const OTHER = 'QmThemThemEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzz';
    const { persistence } = fakePersistence();
    const store = new DraftStore(persistence, { debounceMs: 500, now });
    await store.hydrate(SELF);
    store.set(KEY, 'account A private thought', null);
    await store.flush();

    await store.hydrate(OTHER);
    expect(store.get(KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest --run src/utils/DraftStore.test.ts`
Expected: FAIL — cannot resolve `./DraftStore`.

- [ ] **Step 3: Implement**

Create `src/utils/DraftStore.ts`:

```ts
import type { DraftPersistence, DraftRecord } from './drafts';

export interface DraftStoreOptions {
  /** Quiet period before a burst of keystrokes is written. */
  debounceMs?: number;
  /** Injectable clock, so tests can assert `updatedAt` deterministically. */
  now?: () => number;
}

/**
 * An in-memory map of one account's drafts, written back lazily.
 *
 * Reads are SYNCHRONOUS by design. An async per-mount load leaves a window in
 * which a composer renders empty and the arriving draft either clobbers what
 * the user just typed or is clobbered by it, depending on write order. Loading
 * every draft once at boot — they are short strings — removes that window
 * instead of guarding it.
 *
 * Writes are debounced AND flushable. The debounce keeps a fast typist from
 * hitting storage on every keystroke; the flush is what makes closing a tab
 * mid-sentence safe, and is not optional.
 */
export class DraftStore {
  private readonly map = new Map<string, DraftRecord>();
  private readonly dirty = new Set<string>();
  private readonly debounceMs: number;
  private readonly now: () => number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private selfAddress: string | null = null;
  private hydrated = false;

  constructor(
    private readonly persistence: DraftPersistence,
    options: DraftStoreOptions = {}
  ) {
    this.debounceMs = options.debounceMs ?? 500;
    this.now = options.now ?? (() => Date.now());
  }

  get isHydrated(): boolean {
    return this.hydrated;
  }

  /**
   * Load one account's drafts into memory, replacing whatever was there.
   * Called again on account switch — the replace is what keeps one account's
   * unsent text from being readable under another.
   */
  async hydrate(selfAddress: string): Promise<void> {
    const records = await this.persistence.loadAll(selfAddress);
    this.cancelTimer();
    this.map.clear();
    this.dirty.clear();
    for (const record of records) this.map.set(record.key, record);
    this.selfAddress = selfAddress;
    this.hydrated = true;
  }

  get(key: string): DraftRecord | null {
    return this.map.get(key) ?? null;
  }

  set(key: string, text: string, replyToMessageId: string | null): void {
    if (!this.selfAddress) return;
    this.map.set(key, {
      key,
      selfAddress: this.selfAddress,
      text,
      replyToMessageId,
      updatedAt: this.now(),
    });
    this.dirty.add(key);
    this.schedule();
  }

  /**
   * Drop one draft. Persists immediately rather than on the debounce: this runs
   * when a message is SENT, and a killed app between the send and a debounced
   * delete would resurrect a draft the user has already dispatched.
   */
  clear(key: string): void {
    this.map.delete(key);
    this.dirty.add(key);
    void this.flush();
  }

  /** Drop every draft whose key matches — a space left, a conversation deleted. */
  clearWhere(predicate: (key: string) => boolean): void {
    for (const key of [...this.map.keys()]) {
      if (predicate(key)) {
        this.map.delete(key);
        this.dirty.add(key);
      }
    }
    this.schedule();
  }

  /** Write everything pending, now. Safe to call when nothing is pending. */
  async flush(): Promise<void> {
    this.cancelTimer();
    if (this.dirty.size === 0) return;

    const keys = [...this.dirty];
    this.dirty.clear();

    const toPut: DraftRecord[] = [];
    const toDelete: string[] = [];
    for (const key of keys) {
      const record = this.map.get(key);
      // An empty draft is an absent draft, not a stored empty string.
      if (record && record.text.trim().length > 0) toPut.push(record);
      else toDelete.push(key);
    }

    if (toDelete.length > 0) await this.persistence.deleteKeys(toDelete);
    for (const record of toPut) await this.persistence.put(record);
  }

  /** Release the pending timer. Call from the provider's unmount. */
  dispose(): void {
    this.cancelTimer();
  }

  private schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

- [ ] **Step 4: Export from the barrel**

In `src/utils/index.ts`, add:

```ts
export * from './DraftStore';
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `npx vitest --run src/utils/DraftStore.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Run the whole shared suite and build**

Run: `npx vitest --run && yarn build`
Expected: no new failures; build exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/utils/DraftStore.ts src/utils/DraftStore.test.ts src/utils/index.ts
git commit -m "feat(drafts): boot-hydrated store with debounced write-behind

Reads are synchronous so a composer mounting mid-navigation cannot race
its own hydration. Writes debounce, but flush() exists because a pure
debounce loses the last 500ms exactly when a tab closes mid-sentence."
```

---

## Phase B — desktop storage (MAIN THREAD, serial)

### Task 3: The `drafts` object store

**Files:**
- Modify: `src/db/dbVersion.ts`
- Modify: `src/db/messages.ts`
- Modify: `.agents/docs/quorum-db-schema.md`
- Test: `src/dev/tests/db/drafts.test.ts`

**Read first:** the `.secret` issue named in this plan's frontmatter — ask the operator. It explains why drafts go in `quorum_db` and not somewhere more convenient.

**Interfaces:**
- Consumes: `DraftRecord` from `@quilibrium/quorum-shared`.
- Produces: `MessageDB.getDraftsForAddress(selfAddress: string): Promise<DraftRecord[]>`, `MessageDB.saveDraft(record: DraftRecord): Promise<void>`, `MessageDB.deleteDrafts(keys: string[]): Promise<void>`.

- [ ] **Step 1: Branch in desktop**

```bash
cd /e/GitHub/Quilibrium/quorum-desktop
git checkout main && git pull
git checkout -b feat/composer-drafts
```

- [ ] **Step 2: Write the failing test**

Create `src/dev/tests/db/drafts.test.ts`:

```ts
/**
 * The drafts store lives in quorum_db, beside messages, deliberately — see the
 * design's §4 invariant. Two consequences are asserted here: an account's
 * drafts are retrievable on their own, and Reset App Data (which deletes the
 * whole database) takes drafts with it for free.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { MessageDB } from '@/db/messages';
import type { DraftRecord } from '@quilibrium/quorum-shared';

const SELF = 'QmMeMeMeEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const OTHER = 'QmThemThemEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzz';

const draft = (key: string, selfAddress: string, text: string): DraftRecord => ({
  key,
  selfAddress,
  text,
  replyToMessageId: null,
  updatedAt: 1,
});

let db: MessageDB;

beforeEach(async () => {
  indexedDB.deleteDatabase('quorum_db');
  db = new MessageDB();
  await db.init();
});

describe('MessageDB drafts', () => {
  it('round-trips a draft', async () => {
    await db.saveDraft(draft(`${SELF}|sc:s1:c1`, SELF, 'unsent'));
    const rows = await db.getDraftsForAddress(SELF);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('unsent');
  });

  it('overwrites rather than duplicating on the same key', async () => {
    await db.saveDraft(draft(`${SELF}|sc:s1:c1`, SELF, 'first'));
    await db.saveDraft(draft(`${SELF}|sc:s1:c1`, SELF, 'second'));
    const rows = await db.getDraftsForAddress(SELF);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('second');
  });

  it('never returns another account’s drafts', async () => {
    await db.saveDraft(draft(`${SELF}|sc:s1:c1`, SELF, 'mine'));
    await db.saveDraft(draft(`${OTHER}|sc:s1:c1`, OTHER, 'theirs'));
    const rows = await db.getDraftsForAddress(SELF);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('mine');
  });

  it('deletes by key, in bulk, ignoring keys that are not there', async () => {
    await db.saveDraft(draft(`${SELF}|sc:s1:c1`, SELF, 'a'));
    await db.saveDraft(draft(`${SELF}|sc:s1:c2`, SELF, 'b'));
    await db.deleteDrafts([`${SELF}|sc:s1:c1`, `${SELF}|sc:nope:nope`]);
    const rows = await db.getDraftsForAddress(SELF);
    expect(rows.map((r) => r.text)).toEqual(['b']);
  });

  it('returns an empty array for an account with no drafts', async () => {
    expect(await db.getDraftsForAddress(SELF)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest --run src/dev/tests/db/drafts.test.ts`
Expected: FAIL — `db.saveDraft is not a function`.

If it instead fails on `fake-indexeddb` not resolving, check how the existing tests under `src/dev/tests/db/` obtain an IndexedDB and follow that pattern rather than adding a dependency.

- [ ] **Step 4: Bump the schema version**

In `src/db/dbVersion.ts`:

```ts
export const QUORUM_DB_VERSION = 17;
```

- [ ] **Step 5: Add the store to the upgrade chain**

In `src/db/messages.ts`, immediately after the `if (event.oldVersion < 16) { … }` block inside `onupgradeneeded`, add:

```ts
        if (event.oldVersion < 17) {
          // Composer drafts — an unsent message per conversation.
          //
          // In quorum_db, beside messages, deliberately: a draft must never be
          // more exposed than the conversation it belongs to, and putting it
          // here also means "Reset App Data" (which deletes this whole
          // database) erases drafts with no extra code.
          //
          // `key` is `${selfAddress}|${scopeKey(scope)}`; `by_self` exists so
          // one account's drafts load without parsing keys.
          const draftsStore = db.createObjectStore('drafts', {
            keyPath: 'key',
          });
          draftsStore.createIndex('by_self', 'selfAddress');
        }
```

- [ ] **Step 6: Add the three methods**

In `src/db/messages.ts`, add these to the `MessageDB` class (place them next to the other conversation-scoped helpers, e.g. after `deleteConversationUsers`):

```ts
  // ============ Drafts ============

  async getDraftsForAddress(selfAddress: string): Promise<DraftRecord[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('drafts', 'readonly');
      const index = transaction.objectStore('drafts').index('by_self');
      const request = index.getAll(IDBKeyRange.only(selfAddress));
      request.onsuccess = () => resolve((request.result ?? []) as DraftRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  async saveDraft(record: DraftRecord): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('drafts', 'readwrite');
      const request = transaction.objectStore('drafts').put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDrafts(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('drafts', 'readwrite');
      const store = transaction.objectStore('drafts');
      // `delete` on an absent key is a no-op in IndexedDB, so callers may pass
      // keys they are not sure about.
      keys.forEach((key) => store.delete(key));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
```

Add `DraftRecord` to the existing type import from `@quilibrium/quorum-shared` at the top of the file:

```ts
import type { Conversation, Message, Space, Bookmark, BroadcastSpaceTag, ChannelThread, UserNote, FarcasterLink, SpaceMemberDevice, ConversationSettingOverrides, DraftRecord } from '@quilibrium/quorum-shared';
```

- [ ] **Step 7: Run the test — expect PASS**

Run: `npx vitest --run src/dev/tests/db/drafts.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Document the store**

In `.agents/docs/quorum-db-schema.md`, update the **Current Version** row to `17` and add a `drafts` entry to the object-store table, matching the format of the neighbouring entries: keyPath `key`, index `by_self` on `selfAddress`, one row per (account, conversation) with an unsent message.

- [ ] **Step 9: Full suite + typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest --run`
Expected: tsc exits 0; no new test failures.

- [ ] **Step 10: Commit**

```bash
git add src/db/dbVersion.ts src/db/messages.ts src/dev/tests/db/drafts.test.ts .agents/docs/quorum-db-schema.md
git commit -m "feat(drafts): drafts object store in quorum_db (v17)

Beside messages, not in localStorage — a draft must never be more
exposed than the conversation it belongs to, and Reset App Data now
erases drafts for free."
```

---

### Task 4: Desktop persistence and the provider

**Files:**
- Create: `src/drafts/indexedDbDraftPersistence.ts`
- Create: `src/drafts/DraftsProvider.tsx`
- Create: `src/drafts/useDraftStore.ts`
- Create: `src/drafts/index.ts`
- Modify: `web/main.tsx`
- Test: `src/dev/tests/drafts/DraftsProvider.test.tsx`

**Interfaces:**
- Consumes: `DraftStore`, `DraftPersistence`, `DraftRecord` from `@quilibrium/quorum-shared`; `useMessageDB` from `src/components/context/useMessageDB`; `usePasskeysContext` from `@quilibrium/quilibrium-js-sdk-channels`.
- Produces: `IndexedDbDraftPersistence` (class, constructor takes a `MessageDB`); `<DraftsProvider>`; `useDraftStore(): DraftStore`.

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/drafts/DraftsProvider.test.tsx`:

```tsx
/**
 * The provider's job is to make the store READY before anything can read it.
 *
 * The app restores its last route on boot, so a channel composer can mount in
 * the very first paint. If children rendered before hydration finished, that
 * composer would read an empty draft, the user would start typing, and the
 * draft would be silently overwritten. So children are gated — with a timeout,
 * because a storage failure must degrade to "no drafts", never to a blank app.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DraftStore, type DraftPersistence, type DraftRecord } from '@quilibrium/quorum-shared';
import { DraftsGate } from '@/drafts/DraftsProvider';

const SELF = 'QmMeMeMeEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

function persistenceWith(rows: DraftRecord[], delayMs = 0): DraftPersistence {
  return {
    async loadAll() {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return rows;
    },
    async put() {},
    async deleteKeys() {},
  };
}

describe('DraftsGate', () => {
  it('renders children immediately when there is no signed-in address', async () => {
    const store = new DraftStore(persistenceWith([]));
    render(
      <DraftsGate store={store} selfAddress={null} timeoutMs={1000}>
        <div>app</div>
      </DraftsGate>
    );
    expect(screen.getByText('app')).toBeTruthy();
  });

  it('withholds children until hydration completes, then renders them', async () => {
    const row: DraftRecord = {
      key: `${SELF}|sc:s1:c1`,
      selfAddress: SELF,
      text: 'from disk',
      replyToMessageId: null,
      updatedAt: 1,
    };
    const store = new DraftStore(persistenceWith([row], 20));
    render(
      <DraftsGate store={store} selfAddress={SELF} timeoutMs={1000}>
        <div>app</div>
      </DraftsGate>
    );
    expect(screen.queryByText('app')).toBeNull();
    await waitFor(() => expect(screen.getByText('app')).toBeTruthy());
    expect(store.get(row.key)?.text).toBe('from disk');
  });

  it('renders children anyway when hydration REJECTS, so storage failure cannot brick the app', async () => {
    const store = new DraftStore({
      async loadAll() {
        throw new Error('IndexedDB unavailable');
      },
      async put() {},
      async deleteKeys() {},
    });
    render(
      <DraftsGate store={store} selfAddress={SELF} timeoutMs={1000}>
        <div>app</div>
      </DraftsGate>
    );
    await waitFor(() => expect(screen.getByText('app')).toBeTruthy());
  });

  it('renders children when hydration exceeds the timeout', async () => {
    vi.useFakeTimers();
    const store = new DraftStore(persistenceWith([], 10_000));
    render(
      <DraftsGate store={store} selfAddress={SELF} timeoutMs={50}>
        <div>app</div>
      </DraftsGate>
    );
    expect(screen.queryByText('app')).toBeNull();
    await vi.advanceTimersByTimeAsync(60);
    expect(screen.getByText('app')).toBeTruthy();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest --run src/dev/tests/drafts/DraftsProvider.test.tsx`
Expected: FAIL — cannot resolve `@/drafts/DraftsProvider`.

- [ ] **Step 3: Implement the persistence adapter**

Create `src/drafts/indexedDbDraftPersistence.ts`:

```ts
import type { DraftPersistence, DraftRecord } from '@quilibrium/quorum-shared';
import type { MessageDB } from '../db/messages';

/**
 * Desktop's DraftPersistence — a thin pass-through to MessageDB.
 *
 * Deliberately thin. All caching, debouncing and coalescing live in shared's
 * DraftStore so both clients get identical behaviour; a client only has to make
 * reads and writes durable.
 */
export class IndexedDbDraftPersistence implements DraftPersistence {
  constructor(private readonly db: MessageDB) {}

  loadAll(selfAddress: string): Promise<DraftRecord[]> {
    return this.db.getDraftsForAddress(selfAddress);
  }

  put(record: DraftRecord): Promise<void> {
    return this.db.saveDraft(record);
  }

  deleteKeys(keys: string[]): Promise<void> {
    return this.db.deleteDrafts(keys);
  }
}
```

- [ ] **Step 4: Implement the context hook**

Create `src/drafts/useDraftStore.ts`:

```ts
import * as React from 'react';
import type { DraftStore } from '@quilibrium/quorum-shared';

export const DraftStoreContext = React.createContext<DraftStore | null>(null);

/**
 * The composer's handle on drafts. Throws rather than degrading silently: a
 * composer rendered outside the provider would lose every draft, and a loud
 * failure in development is far cheaper than users quietly losing text.
 */
export function useDraftStore(): DraftStore {
  const store = React.useContext(DraftStoreContext);
  if (!store) {
    throw new Error(
      'useDraftStore used outside <DraftsProvider>. Mount it in web/main.tsx.'
    );
  }
  return store;
}
```

- [ ] **Step 5: Implement the provider**

Create `src/drafts/DraftsProvider.tsx`:

```tsx
import * as React from 'react';
import { DraftStore } from '@quilibrium/quorum-shared';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../components/context/useMessageDB';
import { IndexedDbDraftPersistence } from './indexedDbDraftPersistence';
import { DraftStoreContext } from './useDraftStore';

/**
 * Hydration gate, split out from the provider so it can be tested without a
 * MessageDB or a passkey context.
 *
 * Children are withheld until the store is readable. The app restores its last
 * route on boot, so a channel composer can be in the first paint; rendering it
 * against an unhydrated store would show an empty composer and let the user's
 * first keystrokes overwrite the draft they came back for.
 *
 * Both failure paths render children anyway. Losing drafts is a bad day; a
 * blank application is a worse one.
 */
export const DraftsGate: React.FunctionComponent<{
  store: DraftStore;
  selfAddress: string | null;
  timeoutMs?: number;
  children: React.ReactNode;
}> = ({ store, selfAddress, timeoutMs = 3000, children }) => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!selfAddress) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);

    const timer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, timeoutMs);

    store
      .hydrate(selfAddress)
      .catch(() => {
        // Storage unavailable — proceed without drafts rather than blocking.
      })
      .finally(() => {
        if (!cancelled) {
          clearTimeout(timer);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [store, selfAddress, timeoutMs]);

  if (!ready) return null;
  return (
    <DraftStoreContext.Provider value={store}>
      {children}
    </DraftStoreContext.Provider>
  );
};

export const DraftsProvider: React.FunctionComponent<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const selfAddress = currentPasskeyInfo?.address ?? null;

  const store = React.useMemo(
    () => new DraftStore(new IndexedDbDraftPersistence(messageDB)),
    [messageDB]
  );

  // The debounce means up to 500ms of typing is unwritten at any moment.
  // `pagehide` is the last event guaranteed to fire when a tab closes or is
  // put into the back/forward cache; `visibilitychange` covers a phone being
  // locked or the app being backgrounded. `beforeunload` is deliberately NOT
  // used — it is unreliable on mobile browsers.
  React.useEffect(() => {
    const flush = () => {
      void store.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
      store.dispose();
    };
  }, [store]);

  return (
    <DraftsGate store={store} selfAddress={selfAddress}>
      {children}
    </DraftsGate>
  );
};
```

- [ ] **Step 6: Add the barrel**

Create `src/drafts/index.ts`:

```ts
export { DraftsProvider, DraftsGate } from './DraftsProvider';
export { useDraftStore, DraftStoreContext } from './useDraftStore';
export { IndexedDbDraftPersistence } from './indexedDbDraftPersistence';
```

- [ ] **Step 7: Run the test — expect PASS**

Run: `npx vitest --run src/dev/tests/drafts/DraftsProvider.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 8: Mount the provider**

In `web/main.tsx`, import `DraftsProvider` from `../src/drafts` and wrap it **inside** `MessageDBProvider` (it needs `useMessageDB`) and inside `PasskeysProvider` (it needs `usePasskeysContext`), immediately around `<App />`. Preserve the existing nesting of every other provider.

- [ ] **Step 9: Full suite + typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest --run`
Expected: tsc exits 0; no new failures.

- [ ] **Step 10: Commit**

```bash
git add src/drafts web/main.tsx src/dev/tests/drafts/DraftsProvider.test.tsx
git commit -m "feat(drafts): desktop persistence and the hydration gate

Children are withheld until the store is readable, because the app can
restore straight into a channel and an unhydrated read would let the
first keystroke overwrite the draft the user came back for. Both failure
paths render anyway — losing drafts beats a blank app."
```

---

## Phase C — the seam (MAIN THREAD)

### Task 5: `useMessageComposer` persists text

This is the slice that becomes observable. After it, drafts work.

**Files:**
- Modify: `src/hooks/business/messages/useMessageComposer.ts`
- Modify: `src/components/space/Channel.tsx`
- Modify: `src/components/direct/DirectMessage.tsx`
- Modify: `src/components/thread/ThreadPanel.tsx`
- Test: `src/dev/tests/drafts/composerDrafts.test.tsx`

**Interfaces:**
- Consumes: `useDraftStore()` from `src/drafts`; `draftKey`, `scopeKey`, `TypingScope` from `@quilibrium/quorum-shared`.
- Produces: `UseMessageComposerOptions` gains a required `draftScope: TypingScope`. The returned object is otherwise unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/drafts/composerDrafts.test.tsx`:

```tsx
/**
 * The feature, plus the two failures that would be invisible in review.
 *
 * REVERT CHECK: delete the draft read from useMessageComposer's useState
 * initialiser and "restores the draft on remount" must go red. If it stays
 * green the test is asserting nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as React from 'react';
import { DraftStore, type DraftPersistence, type TypingScope } from '@quilibrium/quorum-shared';
import { DraftStoreContext } from '@/drafts/useDraftStore';
import { useMessageComposer } from '@/hooks/business/messages/useMessageComposer';

const SELF = 'QmMeMeMeEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const OTHER = 'QmThemThemEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzz';

const CHANNEL: TypingScope = { kind: 'space-channel', spaceId: 's1', channelId: 'c1' };
const SIBLING: TypingScope = { kind: 'space-channel', spaceId: 's1', channelId: 'c2' };

// The hook reads the signed-in address from the passkeys context.
vi.mock('@quilibrium/quilibrium-js-sdk-channels', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    usePasskeysContext: () => ({ currentPasskeyInfo: { address: SELF } }),
  };
});

const memoryPersistence = (): DraftPersistence => {
  const rows = new Map<string, any>();
  return {
    async loadAll(a) {
      return [...rows.values()].filter((r) => r.selfAddress === a);
    },
    async put(r) {
      rows.set(r.key, r);
    },
    async deleteKeys(keys) {
      keys.forEach((k) => rows.delete(k));
    },
  };
};

let store: DraftStore;

beforeEach(async () => {
  store = new DraftStore(memoryPersistence(), { debounceMs: 0 });
  await store.hydrate(SELF);
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DraftStoreContext.Provider value={store}>{children}</DraftStoreContext.Provider>
);

const mount = (draftScope: TypingScope) =>
  renderHook(
    () =>
      useMessageComposer({
        type: 'channel',
        draftScope,
        onSubmitMessage: async () => {},
      }),
    { wrapper }
  );

describe('composer drafts', () => {
  it('starts empty when there is no draft', () => {
    const { result } = mount(CHANNEL);
    expect(result.current.pendingMessage).toBe('');
  });

  it('restores the draft on remount — THE FEATURE', () => {
    const first = mount(CHANNEL);
    act(() => first.result.current.setPendingMessage('half a thought'));
    first.unmount();

    const second = mount(CHANNEL);
    expect(second.result.current.pendingMessage).toBe('half a thought');
  });

  it('restores it on the FIRST render, with no intermediate empty value', () => {
    const first = mount(CHANNEL);
    act(() => first.result.current.setPendingMessage('synchronous'));
    first.unmount();

    // If hydration were async this would be '' here and fill in later, which is
    // the window in which a fast typist's keystrokes get clobbered.
    const second = mount(CHANNEL);
    expect(second.result.current.pendingMessage).toBe('synchronous');
  });

  it('keeps two channels apart', () => {
    const a = mount(CHANNEL);
    act(() => a.result.current.setPendingMessage('for channel one'));
    a.unmount();

    const b = mount(SIBLING);
    expect(b.result.current.pendingMessage).toBe('');
  });

  it('clears the draft after a successful send', async () => {
    const { result, unmount } = mount(CHANNEL);
    act(() => result.current.setPendingMessage('about to send'));
    await act(async () => {
      await result.current.submitMessage();
    });
    expect(result.current.pendingMessage).toBe('');
    unmount();

    const again = mount(CHANNEL);
    expect(again.result.current.pendingMessage).toBe('');
  });

  it('emptying the composer removes the draft', () => {
    const a = mount(CHANNEL);
    act(() => a.result.current.setPendingMessage('typed then deleted'));
    act(() => a.result.current.setPendingMessage(''));
    a.unmount();

    const b = mount(CHANNEL);
    expect(b.result.current.pendingMessage).toBe('');
  });

  it('does not read another account’s draft', async () => {
    const a = mount(CHANNEL);
    act(() => a.result.current.setPendingMessage('account A private thought'));
    a.unmount();
    await store.flush();

    await store.hydrate(OTHER);
    const b = mount(CHANNEL);
    expect(b.result.current.pendingMessage).toBe('');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest --run src/dev/tests/drafts/composerDrafts.test.tsx`
Expected: FAIL — `draftScope` is not a known option, and no draft is restored.

- [ ] **Step 3: Add the required option and the read**

In `src/hooks/business/messages/useMessageComposer.ts`:

Add to the imports:

```ts
import { draftKey, type TypingScope } from '@quilibrium/quorum-shared';
import { useDraftStore } from '../../../drafts';
```

Change the options interface:

```ts
interface UseMessageComposerOptions {
  type: 'channel' | 'direct';
  /**
   * Which conversation this composer belongs to. REQUIRED — a composer without
   * a scope would silently lose drafts, and every call site already computes
   * this value for the typing indicator.
   */
  draftScope: TypingScope;
  onSubmitMessage: (
    message: string | object,
    inReplyTo?: string
  ) => Promise<void>;
  onSubmitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  hasStickers?: boolean;
}
```

Destructure it alongside the others:

```ts
  const {
    type,
    draftScope,
    onSubmitMessage,
    onSubmitSticker,
    hasStickers = false,
  } = options;
```

Then replace the `pendingMessage` state declaration (currently `const [pendingMessage, setPendingMessage] = useState('');`) with:

```ts
  const drafts = useDraftStore();
  // A plain string concat, not a useMemo: `draftKey` is two string reads and a
  // template literal, so recomputing it per render is cheaper than the memo
  // would be — and it is immune to a call site that rebuilds its scope object
  // on every render.
  const selfAddress = currentPasskeyInfo?.address ?? '';
  const key = selfAddress ? draftKey(selfAddress, draftScope) : null;

  // Synchronous, first render. `useState`'s initialiser runs once per mount,
  // which is exactly the lifetime of one conversation view — the containers
  // remount on every conversation switch (Space.tsx / DirectMessages.tsx).
  const [pendingMessage, setPendingMessageState] = useState<string>(
    () => (key ? (drafts.get(key)?.text ?? '') : '')
  );

  /**
   * Write-through. This must stay a plain state set — never a synthetic input
   * event — or restoring a draft would fire the composer's `notifyKeystroke`
   * and broadcast "user is typing" to the whole channel on open.
   */
  const setPendingMessage = useCallback(
    (next: string) => {
      setPendingMessageState(next);
      if (key) drafts.set(key, next, null);
    },
    [key, drafts]
  );
```

> `currentPasskeyInfo` is already destructured near the top of the hook for the
> config query (`useMessageComposer.ts:35`) — reuse it, do not call
> `usePasskeysContext()` twice.

- [ ] **Step 4: Clear the draft on send**

In `submitMessage`, the block that reads:

```ts
        // Clear state after successful submission
        setPendingMessage('');
        setProcessedImage(undefined);
        setInReplyTo(undefined);
```

becomes:

```ts
        // Clear state after successful submission
        setPendingMessageState('');
        if (key) drafts.clear(key);
        setProcessedImage(undefined);
        setInReplyTo(undefined);
```

Add `key` and `drafts` to `submitMessage`'s dependency array.

> Use `setPendingMessageState`, not `setPendingMessage`: the wrapper would write
> an empty draft and then `clear` would delete it — same end state, one pointless
> write. `drafts.clear` persists immediately by design (see DraftStore).

- [ ] **Step 5: Pass the scope at all three call sites**

`src/components/space/Channel.tsx` — the composer call at ~1264 becomes:

```tsx
  const composer = useMessageComposer({
    type: 'channel',
    draftScope: typingScope,
    onSubmitMessage: handleSubmitMessage,
    onSubmitSticker: handleSubmitSticker,
    hasStickers,
  });
```

`typingScope` is already defined at ~1208 as
`{ kind: 'space-channel', spaceId, channelId }` and is already memoised. If the
`useMemo` defining it sits *below* the composer call, move the `useMemo` above it —
do not duplicate the expression.

`src/components/direct/DirectMessage.tsx` — the call at ~513 becomes:

```tsx
  const composer = useMessageComposer({
    type: 'direct',
    draftScope: typingScope,
    onSubmitMessage: handleSubmitMessage,
    hasStickers: false, // DirectMessage doesn't have stickers
  });
```

`typingScope` is defined at ~114 as `{ kind: 'dm', address: address! }`.

`src/components/thread/ThreadPanel.tsx` — the call at ~60 becomes:

```tsx
  const composer = useMessageComposer({
    type: 'channel',
    draftScope: threadDraftScope,
    onSubmitMessage: handleSubmitMessage,
    onSubmitSticker: submitSticker,
    hasStickers,
  });
```

ThreadPanel's existing typing scope (at ~219) is `TypingScope | null` because
`channelProps` may be absent. A draft scope cannot be null, so add above the
composer call:

```tsx
  // The composer needs a non-null scope. Before channelProps resolve there is
  // no thread to draft into, so fall back to a scope that cannot collide with
  // any real one — its drafts are never read because the panel is closed.
  const threadDraftScope = React.useMemo<TypingScope>(
    () => ({
      kind: 'thread',
      spaceId: channelProps?.spaceId ?? 'pending',
      channelId: channelProps?.channelId ?? 'pending',
      threadId: threadId ?? 'pending',
    }),
    [channelProps?.spaceId, channelProps?.channelId, threadId]
  );
```

- [ ] **Step 6: Run the test — expect PASS**

Run: `npx vitest --run src/dev/tests/drafts/composerDrafts.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 7: Do the revert check**

Temporarily change the `useState` initialiser to `useState<string>('')`.
Run the test again. Expected: **FAIL** on "restores the draft on remount".
**Put it back.** A test that passes either way is worse than no test.

- [ ] **Step 8: Full suite + typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest --run && yarn lint`
Expected: tsc 0, all tests pass, lint clean.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/business/messages/useMessageComposer.ts src/components/space/Channel.tsx src/components/direct/DirectMessage.tsx src/components/thread/ThreadPanel.tsx src/dev/tests/drafts/composerDrafts.test.tsx
git commit -m "feat(drafts): composer text survives navigation and restart

draftScope is required, so a composer that would silently lose drafts
does not compile. Every call site already computed the value for the
typing indicator. Verified by reverting the read and watching the test
go red."
```

---

## Phase D — completing the behaviour (MAIN THREAD)

### Task 6: The typing-indicator regression guard

Small, and it is the test nothing else would catch. Kept separate so it is
reviewed on its own rather than buried in Task 5's diff.

**Files:**
- Test: `src/dev/tests/drafts/draftRestoreIsSilent.test.tsx`

**Interfaces:**
- Consumes: `MessageComposer` from `src/components/message/MessageComposer`, `DraftStoreContext` from `src/drafts/useDraftStore`.
- Produces: nothing. Pure regression cover.

- [ ] **Step 1: Write the test**

Create `src/dev/tests/drafts/draftRestoreIsSilent.test.tsx`:

```tsx
/**
 * Opening a conversation that has a draft must NOT tell the channel you are
 * typing.
 *
 * This is the one genuinely new leak drafts could have introduced. It does not
 * happen today only because hydration sets React state, and `notifyKeystroke`
 * fires solely from real input handlers (MessageComposer.tsx ~334 and ~360,
 * both guarded with "prevents spurious broadcasts on focus or programmatic
 * value resets"). Anyone who later "fixes" hydration by dispatching a synthetic
 * input event breaks this, silently, for every member of the channel.
 *
 * REVERT CHECK: make the composer call `onChange` once on mount with the
 * restored value and this must go red.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import MessageComposer from '@/components/message/MessageComposer';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

describe('restoring a draft is silent', () => {
  it('does not broadcast typing when the composer mounts with restored text', () => {
    const onChange = vi.fn();

    render(
      <MessageComposer
        value="a draft restored from disk"
        onChange={onChange}
        onKeyDown={() => {}}
        placeholder="Message"
        calculateRows={() => 3}
        getRootProps={() => ({})}
        getInputProps={() => ({})}
        clearFile={() => {}}
        onSubmitMessage={() => {}}
        onShowStickers={() => {}}
        // A null scope disables typing notifications outright, so pass a REAL
        // scope — otherwise this test would pass for the wrong reason.
        typingScope={{ kind: 'space-channel', spaceId: 's1', channelId: 'c1' }}
        canSendMessage
      />
    );

    // Mounting with a value is not the user typing.
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest --run src/dev/tests/drafts/draftRestoreIsSilent.test.tsx`
Expected: PASS.

If it fails because `MessageComposer`'s required props differ from the list
above, read its `MessageComposerProps` interface (~line 43) and supply exactly
the required ones — do not weaken the assertion to make it pass.

- [ ] **Step 3: Do the revert check**

In `MessageComposer.tsx`, temporarily add an effect that calls
`onChange(value)` once on mount. Run the test. Expected: **FAIL**.
**Remove the effect.**

- [ ] **Step 4: Commit**

```bash
git add src/dev/tests/drafts/draftRestoreIsSilent.test.tsx
git commit -m "test(drafts): restoring a draft must not broadcast typing

The one new leak drafts could introduce. Verified non-vacuous by making
the composer fire onChange on mount and watching it go red."
```

---

### Task 7: Reply-to context and lifecycle deletion

**Files:**
- Modify: `src/hooks/business/messages/useMessageComposer.ts`
- Modify: `src/drafts/useDraftStore.ts`
- Create: `src/drafts/draftCleanup.ts`
- Test: `src/dev/tests/drafts/draftCleanup.test.ts`

**Interfaces:**
- Consumes: `DraftStore` from `@quilibrium/quorum-shared`.
- Produces: `clearDraftsForSpace(store: DraftStore, spaceId: string): void`; `clearDraftsForDm(store: DraftStore, address: string): void`; `clearDraftsForThread(store: DraftStore, spaceId: string, channelId: string, threadId: string): void`.

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/drafts/draftCleanup.test.ts`:

```ts
/**
 * A draft dies with whatever it belongs to. Leaving a Space must not leave your
 * unsent message for it on disk, and it must not take unrelated drafts with it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DraftStore, type DraftPersistence } from '@quilibrium/quorum-shared';
import {
  clearDraftsForSpace,
  clearDraftsForDm,
  clearDraftsForThread,
} from '@/drafts/draftCleanup';

const SELF = 'QmMeMeMeEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const PARTNER = 'QmThemThemEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzz';

const memoryPersistence = (): DraftPersistence => {
  const rows = new Map<string, any>();
  return {
    async loadAll(a) {
      return [...rows.values()].filter((r) => r.selfAddress === a);
    },
    async put(r) {
      rows.set(r.key, r);
    },
    async deleteKeys(keys) {
      keys.forEach((k) => rows.delete(k));
    },
  };
};

let store: DraftStore;

beforeEach(async () => {
  store = new DraftStore(memoryPersistence(), { debounceMs: 0 });
  await store.hydrate(SELF);
  store.set(`${SELF}|sc:s1:c1`, 'space 1 channel 1', null);
  store.set(`${SELF}|sc:s1:c2`, 'space 1 channel 2', null);
  store.set(`${SELF}|th:s1:c1:t1`, 'space 1 thread', null);
  store.set(`${SELF}|sc:s2:c1`, 'space 2', null);
  store.set(`${SELF}|dm:${PARTNER}`, 'a dm', null);
  await store.flush();
});

describe('draft cleanup', () => {
  it('leaving a space clears its channel AND thread drafts, and nothing else', () => {
    clearDraftsForSpace(store, 's1');
    expect(store.get(`${SELF}|sc:s1:c1`)).toBeNull();
    expect(store.get(`${SELF}|sc:s1:c2`)).toBeNull();
    expect(store.get(`${SELF}|th:s1:c1:t1`)).toBeNull();
    expect(store.get(`${SELF}|sc:s2:c1`)?.text).toBe('space 2');
    expect(store.get(`${SELF}|dm:${PARTNER}`)?.text).toBe('a dm');
  });

  it('deleting a DM clears only that DM', () => {
    clearDraftsForDm(store, PARTNER);
    expect(store.get(`${SELF}|dm:${PARTNER}`)).toBeNull();
    expect(store.get(`${SELF}|sc:s1:c1`)?.text).toBe('space 1 channel 1');
  });

  it('deleting a thread clears only that thread, not its parent channel', () => {
    clearDraftsForThread(store, 's1', 'c1', 't1');
    expect(store.get(`${SELF}|th:s1:c1:t1`)).toBeNull();
    expect(store.get(`${SELF}|sc:s1:c1`)?.text).toBe('space 1 channel 1');
  });

  it('a space id that is a prefix of another does not over-match', () => {
    // 's1' must not match a space called 's10'.
    store.set(`${SELF}|sc:s10:c1`, 'space ten', null);
    clearDraftsForSpace(store, 's1');
    expect(store.get(`${SELF}|sc:s10:c1`)?.text).toBe('space ten');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest --run src/dev/tests/drafts/draftCleanup.test.ts`
Expected: FAIL — cannot resolve `@/drafts/draftCleanup`.

- [ ] **Step 3: Implement**

Create `src/drafts/draftCleanup.ts`:

```ts
import type { DraftStore } from '@quilibrium/quorum-shared';

/**
 * Key-shape-aware cleanup.
 *
 * Keys are `${selfAddress}|${scopeKey(scope)}` and scopeKey emits
 * `dm:<address>`, `sc:<spaceId>:<channelId>` or
 * `th:<spaceId>:<channelId>:<threadId>` (quorum-shared/src/types/typing.ts).
 *
 * Every matcher below is anchored on the FULL segment, with its delimiters, so
 * a space called `s1` never matches one called `s10`. That over-match would
 * silently delete an unrelated conversation's unsent message.
 */

export function clearDraftsForSpace(store: DraftStore, spaceId: string): void {
  store.clearWhere(
    (key) => key.includes(`|sc:${spaceId}:`) || key.includes(`|th:${spaceId}:`)
  );
}

export function clearDraftsForDm(store: DraftStore, address: string): void {
  store.clearWhere((key) => key.endsWith(`|dm:${address}`));
}

export function clearDraftsForThread(
  store: DraftStore,
  spaceId: string,
  channelId: string,
  threadId: string
): void {
  store.clearWhere((key) => key.endsWith(`|th:${spaceId}:${channelId}:${threadId}`));
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest --run src/dev/tests/drafts/draftCleanup.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Persist and restore the reply target**

In `useMessageComposer.ts`, make the write-through carry the reply id — change
the `setPendingMessage` callback body to:

```ts
  const setPendingMessage = useCallback(
    (next: string) => {
      setPendingMessageState(next);
      if (key) drafts.set(key, next, inReplyTo?.messageId ?? null);
    },
    [key, drafts, inReplyTo]
  );
```

and make choosing a reply persist too, by adding after the state declarations:

```ts
  // Selecting or dismissing a reply target is a change to the draft, not just
  // to view state — so it is written through like the text is.
  const setInReplyToAndPersist = useCallback(
    (next: MessageType | undefined) => {
      setInReplyTo(next);
      if (key && pendingMessage.trim().length > 0) {
        drafts.set(key, pendingMessage, next?.messageId ?? null);
      }
    },
    [key, drafts, pendingMessage]
  );
```

Return `setInReplyToAndPersist` as `setInReplyTo` from the hook (replace the
existing `setInReplyTo` entry in the returned object) so call sites are
unchanged.

Then restore it. Add after the state declarations:

```ts
  // The reply target restores ASYNCHRONOUSLY and best-effort: it needs a lookup,
  // and unlike the text there is no race, because nothing the user can do in
  // the first frames sets a reply. If the parent message is gone the reply is
  // dropped and the TEXT IS KEPT — losing typed words because a parent vanished
  // would be the worse failure.
  const restoredReplyId = key ? (drafts.get(key)?.replyToMessageId ?? null) : null;
  useEffect(() => {
    if (!restoredReplyId) return;
    let cancelled = false;
    (async () => {
      // DM messages are stored with spaceId === channelId === the partner
      // address (MessageService.ts ~3364).
      const ids =
        draftScope.kind === 'dm'
          ? { spaceId: draftScope.address, channelId: draftScope.address }
          : { spaceId: draftScope.spaceId, channelId: draftScope.channelId };
      try {
        const parent = await messageDB.getMessage({ ...ids, messageId: restoredReplyId });
        if (!cancelled && parent) setInReplyTo(parent);
      } catch {
        // Parent gone. Keep the text, drop the reply.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per mount — `restoredReplyId` is read from the store at mount.
  }, [restoredReplyId]);
```

Add `import { useMessageDB } from '../../../components/context/useMessageDB';`
and `const { messageDB } = useMessageDB();` near the other context reads.

- [ ] **Step 6: Wire the cleanup call sites**

Four sites, all located by grep on 2026-08-10. At each one, get the store with
`const draftStore = useDraftStore();` alongside the other hook calls, and call
the matching helper **immediately after the existing deletion resolves**, so a
failed deletion does not also destroy the draft.

**DM deleted — two sites, same shape.** In
`src/components/direct/DirectMessageContactsList.tsx:218` and
`src/components/modals/ConversationSettingsModal.tsx:192`, after the existing
`await deleteConversation(...)`:

```ts
      // conversationId is `${address}/${address}` (DirectMessage.tsx:112) but a
      // DM draft is keyed on the bare address, so take the first segment.
      clearDraftsForDm(draftStore, conversationId.split('/')[0]);
```

In `DirectMessageContactsList.tsx` the identifier in scope is
`conversation.conversationId`; use that.

**Thread removed.** In `src/components/space/Channel.tsx`, inside
`handleRemoveThread` (defined at ~779), after the existing removal resolves:

```ts
      clearDraftsForThread(draftStore, spaceId, channelId, threadId);
```

**Space left.** In `src/hooks/business/spaces/useSpaceLeaving.ts`, inside
`leaveSpace` (~17), after the existing departure work resolves:

```ts
      clearDraftsForSpace(draftStore, spaceId);
```

Import the helpers from `../../../drafts/draftCleanup` (adjust the relative
depth per file).

- [ ] **Step 7: Full suite + typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest --run && yarn lint`
Expected: tsc 0, all tests pass, lint clean.

- [ ] **Step 8: Commit**

```bash
git add src/drafts src/hooks/business/messages/useMessageComposer.ts src/dev/tests/drafts/draftCleanup.test.ts
git commit -m "feat(drafts): reply-to context, and drafts die with their conversation

Cleanup matchers are anchored on whole key segments so a space called s1
cannot delete drafts belonging to s10. Reply restore is best-effort and
never costs the typed text."
```

---

## Phase E — verification (MAIN THREAD)

### Task 8: Manual sweep and the one measurement

- [ ] **Step 1: Run the app** — `yarn dev` from `/e/GitHub/Quilibrium/quorum-desktop` (NOT a worktree on another branch).

- [ ] **Step 2: Measure the boot-load cost.** This is the plan's one INFERRED claim (design §6) and the gate on whether boot-hydration was the right choice.

In `src/drafts/DraftsProvider.tsx`, temporarily wrap the hydrate call in `DraftsGate`:

```ts
    console.time('drafts-hydrate');
    store
      .hydrate(selfAddress)
      .catch(() => {})
      .finally(() => {
        console.timeEnd('drafts-hydrate');
        if (!cancelled) {
          clearTimeout(timer);
          setReady(true);
        }
      });
```

Then: type a distinct draft into **at least 20 different channels and DMs**,
reload the page, and read `drafts-hydrate` from the console.

**Pass:** under 50ms. The gate blocks first paint, so this is time the user
waits on every launch.

**Fail:** if it is materially higher, change `loadAll` to a lazy per-key read
behind the same `DraftPersistence` interface — no other file changes, because
that interface is the seam. Do not ship a gate that costs a visible delay.

Record the number in the Step 6 commit message and **remove the two timing
lines before committing.**

- [ ] **Step 3: Sweep, recording MEASURED results per row.**

| # | Scenario | Expected |
|---|---|---|
| 1 | Type in #general, switch to #random, switch back | text restored |
| 2 | Type in #general, reload the page | text restored |
| 3 | Type in #general, type something different in #random, alternate | each keeps its own |
| 4 | Type in a DM, navigate to a Space, come back | text restored |
| 5 | Type in a thread panel AND its parent channel, close/reopen the thread | two independent drafts |
| 6 | Type, then send | composer empty; reload shows nothing |
| 7 | Type, then delete every character, then navigate away and back | composer empty |
| 8 | Type a reply to a message, navigate away and back | text AND the reply bar restored |
| 9 | Type a reply, delete the parent message, navigate away and back | text kept, reply bar gone |
| 10 | Type in a Space, leave the Space, rejoin | no draft |
| 11 | Type in a DM, delete the conversation, start it again | no draft |
| 12 | Type, close the tab mid-sentence (do NOT click away first), reopen | text restored — **this is the `pagehide` flush** |
| 13 | **CONTROL:** open a channel you have never typed in | composer empty, no stale text |

- [ ] **Step 4: Verify no typing indicator on restore.** With a second account
  watching the same channel: type in the channel from account A, navigate away
  (typing indicator stops), then navigate back. **Account B must see no typing
  indicator** when A returns to the channel with a restored draft.

- [ ] **Step 5: Report per row, MEASURED not inferred.** Any failing row goes
  back to its owning task as a fix before this task is closed.

- [ ] **Step 6: Commit the measurement**

```bash
git commit --allow-empty -m "chore(drafts): verification sweep, 13 scenarios + typing check

Hydration measured at <N>ms with 20 drafts."
```

---

## Phase F — mobile (SEPARATE SESSION, blocked on A–E)

### Task 9: Mobile migration

Blocked until the lead dev publishes a shared version containing `DraftStore`.
**We never run `npm publish`.**

- [ ] Bump mobile's `@quilibrium/quorum-shared` and implement `DraftPersistence`
      over **the SQL database messages use** — a `drafts` table beside
      `messages`, NOT MMKV. This is the design's §4 invariant and the single
      decision that must not be got wrong; read the `.secret` issue first.
- [ ] Mount the equivalent of `DraftsProvider` above the chat routes, with the
      same hydration gate. `pagehide`/`visibilitychange` become React Native's
      `AppState` `background`/`inactive` transitions.
- [ ] Confirm mobile's composer surfaces map onto the same three `TypingScope`
      kinds (design §13, open item 2) before wiring.
- [ ] Port Tasks 5–7 against mobile's composer.
- [ ] Run the Task 8 sweep on a device, plus a kill-the-app-from-the-switcher
      case, which is the mobile equivalent of row 12.

---

## Definition of done

- [ ] `draftKey` over the existing `TypingScope`; no parallel scope union added
- [ ] `DraftStore` with synchronous reads, coalesced writes and a working flush
- [ ] `drafts` store in `quorum_db` at v17, schema doc updated
- [ ] Provider gates children on hydration, and degrades to no-drafts on failure
- [ ] `draftScope` is REQUIRED on `useMessageComposer`; all three call sites pass it
- [ ] Draft restore shown not to broadcast typing, verified by making it red
- [ ] Restore-on-remount verified by reverting the read and watching it fail
- [ ] Drafts die with their space / DM / thread, with no prefix over-match
- [ ] 13-row sweep reported MEASURED, including the control row and the tab-close row
- [ ] Hydration cost measured and recorded
- [ ] Mobile migrated, drafts in the messages database

---

*Last updated: 2026-08-10*
