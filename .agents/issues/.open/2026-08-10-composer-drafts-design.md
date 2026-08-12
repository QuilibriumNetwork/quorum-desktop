---
type: task
title: "Composer drafts: an unsent message survives navigation and restart, and is never less protected than a sent one"
status: open
priority: medium
created: 2026-08-10
updated: 2026-08-10
area: message composer / local storage / cross-client
repos: quorum-shared, quorum-desktop, quorum-mobile
related:
  - ".agents/issues/.open/2026-08-10-privacy-level-presets-design.md (§2 membership rule — applied and failed here, deliberately)"
  - ".agents/docs/quorum-db-schema.md (store addition procedure)"
  - "A .secret issue filed 2026-08-10 covers local message-store protection; ask the operator."
---

# Composer drafts

**Goal:** you start writing, navigate away, come back, and your words are still
there. Per conversation, across app restarts, on both clients.

## 1. What ships

Type in a channel, switch channels, come back — the text is there, with the
reply-to bar intact. Reload the page or restart the app — still there. Send it,
or clear it, and it's gone.

Applies to all three composer surfaces on desktop (channel, DM, thread) and their
mobile equivalents. **Always on. No setting** — §3 explains why a toggle would be
protecting nothing.

## 2. Why the composer loses it today (READ 2026-08-10)

Not a leak to plug. Both conversation containers force a **full remount** on every
switch, deliberately:

```tsx
<Channel key={`${params.spaceId}-${params.channelId}`} … />   // Space.tsx:22
<DirectMessage key={'messages-' + address} />                 // DirectMessages.tsx:17
```

That key resets scroll, message state and composer state per conversation, which
is correct and should stay. `useMessageComposer`'s `pendingMessage`
([useMessageComposer.ts:40](../../../src/hooks/business/messages/useMessageComposer.ts#L40))
is simply destroyed along with everything else. The hook also takes **no
conversation identity** today — only `type: 'channel' | 'direct'` — so there is
currently nothing to key a draft on. That is the gap this design closes.

Three call sites, each its own composer instance:
[Channel.tsx:1264](../../../src/components/space/Channel.tsx#L1264),
[DirectMessage.tsx:513](../../../src/components/direct/DirectMessage.tsx#L513),
[ThreadPanel.tsx:60](../../../src/components/thread/ThreadPanel.tsx#L60).

## 3. The privacy question, answered

The feature was initially scoped as opt-in and off by default, on the theory that
persisting an unsent message is a privacy regression — a private thought written
and never sent, sitting in local storage. **That theory was researched against
both codebases and does not hold as stated.**

### What the research established

The two clients do not give the local message store the same at-rest treatment,
and the details are **deliberately not reproduced here** — this repository is
public, and the specifics belong in the `.secret` issue filed on 2026-08-10.
Ask the operator for it before working on §4 or §10.

The part that bears on this design, and is safe to state, is the conclusion:

> On each platform, drafts can be stored so that they receive **exactly the same
> at-rest treatment as a sent message on that platform** — and on one platform
> the naive storage choice would NOT do that. Which store you choose is
> therefore load-bearing, and is the whole content of §4.

### The rule it produces

The privacy delta is not a property of drafts. It is a property of **which store
you put them in**. Hence the invariant in §4. Under it, a draft is never more
exposed than the conversation it belongs to, on any platform, at any point in
time — so a toggle would protect nothing that keeping your message history does
not already expose.

Applying the [privacy-level design](2026-08-10-privacy-level-presets-design.md)'s
own §2 membership rule confirms drafts do not belong in that group:

| Clause | Verdict |
|---|---|
| 1. OFF is the more private position | ✅ passes |
| 2. Reversible, no durable artifact | ❌ **fails** — turning it off must delete existing drafts, which needs a confirmation; §2 says a toggle needing a confirmation is not governed |
| 3. Off costs only convenience | ✅ passes |

Secondary and stronger reason: all five governed toggles disclose something **to
another party** (Google, your counterparty, the channel), and §3 of that doc
records the level was always about *does your device reach outside the network*.
Drafts disclose to nobody. Putting them in that group would make the level's
description line false by omission.

**Residual, recorded honestly:** an abandoned draft is content you chose not to
commit, and someone with disk access learns something they otherwise would not —
what you were about to say and didn't. That is real but narrow. It is addressed
by §8 — drafts die with their conversation, and emptying the composer deletes the
stored row rather than storing an empty one — not by a switch whose protection
would be illusory.

### One place drafts *could* have leaked, and don't (READ 2026-08-10)

`notifyKeystroke()` is reached only from `handleTextareaChange`
([MessageComposer.tsx:334](../../../src/components/message/MessageComposer.tsx#L334))
and `handleEditorInput` (~360), both real user-input handlers, both already
guarded with *"prevents spurious broadcasts on focus or programmatic value
resets"*.

So restoring a draft **by setting state** does not broadcast a typing indicator.
Restoring it by dispatching synthetic input events **would** — opening a channel
would tell everyone you were typing when you were not. This is a hard constraint,
not an implementation detail, and §9 pins it with a test.

## 4. The invariant

> **A draft is stored through the same accessor, in the same database, under the
> same protection, as a sent message on that platform.**

| Platform | Drafts go in | Explicitly NOT |
|---|---|---|
| Desktop (web + Electron) | a `drafts` object store in `quorum_db`, the database messages live in | localStorage |
| Mobile | a `drafts` table in **the same database messages live in** | **MMKV**, or any other key-value store |

The mobile row is the one to get right, and "wherever messages already go" is the
whole rule — the convenient key-value store there is **not** where messages live,
and choosing it would break the invariant. See the `.secret` issue for why that
matters concretely.

Desktop requires bumping `QUORUM_DB_VERSION` 16 → 17 and updating
`.agents/docs/quorum-db-schema.md`, per the procedure documented in
[`dbVersion.ts`](../../../src/db/dbVersion.ts).

Two things fall out for free:

- **Reset App Data already wipes drafts.** It does
  `deleteDatabase('quorum_db')`, and drafts are in that database.
- **Any future change to how the message store is protected covers drafts
  automatically**, with no second decision and no separate migration.

## 5. The key

**Do not invent a new scope type — `TypingScope` already is one** (READ
2026-08-10, `quorum-shared/src/types/typing.ts:24-39`):

```ts
export type TypingScope =
  | { kind: 'dm';            address: string }
  | { kind: 'space-channel'; spaceId: string; channelId: string }
  | { kind: 'thread';        spaceId: string; channelId: string; threadId: string };

export function scopeKey(scope: TypingScope): string;   // 'dm:…' | 'sc:…' | 'th:…'
```

Exactly the three surfaces drafts need, already a discriminated union, already
carrying a stable string-key function. So:

```ts
export function draftKey(selfAddress: string, scope: TypingScope): string {
  return `${selfAddress}|${scopeKey(scope)}`;
}
```

The union is what makes the partial case unexpressable — a caller cannot build a
channel key while forgetting the `spaceId`, because it will not compile. Same
reasoning as the identity work.

**All three call sites already compute one** (READ 2026-08-10), for the typing
indicator:

| Call site | Expression |
|---|---|
| `Channel.tsx:1208` | `{ kind: 'space-channel', spaceId, channelId }` |
| `DirectMessage.tsx:114` | `{ kind: 'dm', address: address! }` |
| `ThreadPanel.tsx:219` | `{ kind: 'thread', spaceId, channelId, threadId }` |

So threading the scope into `useMessageComposer` is passing a value that already
exists at every site, not plumbing a new one. Note the DM case keys on
**`address`**, not on `DirectMessage`'s `conversationId` (`address + '/' + address`)
— §8's conversation-delete cleanup has to map between them.

**`selfAddress` is in the key deliberately.** `quorum_db` is shared across
accounts on one device (`user_config` is keyed by `address`). Without it, account
B opens a channel and reads account A's unsent message. Cheap to design out, and
§9 asserts it.

```ts
export interface DraftRecord {
  key: string;                   // primary key
  text: string;
  replyToMessageId: string | null;
  updatedAt: number;
}
```

`updatedAt` is not used by anything shipping here. It is present so expiry, or a
"most recent draft" ordering, or (if ever wanted) sync, do not require a schema
migration.

## 6. The store — boot-hydrated, write-behind

A `DraftsProvider` mounted at app root loads every draft for the current address
once into an in-memory `Map`, then:

- **`getDraft(key)` is synchronous.** No async gap, therefore no empty-then-filled
  flicker and, more importantly, no hydrate-versus-type race. An async per-mount
  load has a window where a fast typist's first keystrokes are either clobbered by
  the arriving draft or clobber it, depending on write order. That is a real bug
  class on slow devices and it is designed out rather than guarded.
- **`setDraft(...)`** updates the map immediately and schedules a debounced write
  (500 ms per key).
- **Flush on `visibilitychange` / `pagehide` and on unmount.** A pure debounce
  loses the last ≤500 ms when you close the tab mid-sentence — which is exactly
  the moment a draft matters most. This flush is not an optimisation.
- **`clearDraft(key)`** drops the map entry and deletes the row.

**Cost of boot-loading — INFERRED, not measured.** A record is a bounded string
plus an id; the composer already enforces a length limit via
`useMessageValidation`. 200 drafts should land well under 100 KB. If that is
wrong the fix is lazy loading behind the same interface, so the API does not
change. Worth a one-off measurement during implementation rather than a redesign.

## 7. The seam — a required parameter

`useMessageComposer` gains a **required** `draftScope: TypingScope` (§5 — the
existing type, reused).

- `pendingMessage` initialises from `getDraft(key)?.text ?? ''` via a lazy
  `useState` initialiser — synchronous, correct on first render.
- `inReplyTo` resolves from the stored `replyToMessageId`. **If that message is
  gone, drop the reply and keep the text.** Never lose typed words because a
  parent vanished.
- Every `setPendingMessage` writes through.
- The existing `// Clear state after successful submission` block
  ([useMessageComposer.ts:308-311](../../../src/hooks/business/messages/useMessageComposer.ts#L308))
  also calls `clearDraft`.

**Required, not optional.** A fourth composer added later cannot silently lose
drafts, because it cannot compile without a scope. Optional here would reproduce
the exact "you can forget a field" failure the identity refactor exists to
eliminate.

## 8. Lifecycle and deletion

A draft dies with whatever it belongs to:

| Event | Effect |
|---|---|
| Message sent | that key cleared |
| User clears the composer | that key cleared |
| Conversation deleted | all keys for that `conversationId` |
| Space left / `departed_spaces` | all keys for that `spaceId` |
| Thread deleted | that thread's key |
| Account switch | nothing to do — keys are self-scoped; re-hydrate the map on address change |
| Reset App Data | already covered by `deleteDatabase('quorum_db')` (§4) |

**Clearing a draft needs no new UI.** Emptying the composer *is* the clear:
an empty draft is stored as a deletion, not as an empty string, so selecting all
and deleting removes the row. That is discoverable, needs no button, and is
asserted by a test ("emptying the composer removes the draft"). A dedicated
"discard draft" control was considered and dropped — it would duplicate a
gesture users already have.

## 9. Verification

A silently-lost draft is invisible in review and only shows up as lost work, so
every row below is chosen because it could actually fail.

| Test | What it catches |
|---|---|
| Type → unmount → remount → text restored | The feature. **Revert check: remove persistence, confirm it goes red.** |
| Draft in channel A does not appear in channel B | What a naive un-keyed global map produces. |
| Mount with a draft present → `notifyKeystroke` NOT called | The §3 typing-indicator leak. Nothing else would catch it. |
| Flush on `pagehide` persists the last keystroke | The debounce hole. **A pure-debounce implementation passes every other test here.** |
| Reply parent deleted → text survives, reply dropped | Silent loss of typed content. |
| Two self addresses, same channel → separate drafts | The cross-account read in §5. |
| `draftKey` — distinct scopes never collide; same scope stable | Unit, in shared. |

## 10. Where the code lives

| Package | Owns |
|---|---|
| `quorum-shared` | `draftKey()`, `DraftRecord`, `DraftStore` (map + debounce + flush) behind a `DraftPersistence` interface (`loadAll` / `put` / `delete`). Scope type is the existing `TypingScope`. |
| `quorum-desktop` | `DraftPersistence` over `MessageDB` / IndexedDB |
| `quorum-mobile` | `DraftPersistence` over the same database messages use |

Same division as the existing `StorageAdapter`. Drafts are device-local, so
nothing *forces* the key function to match across clients — the reason to share is
that two independent implementations of a debounced write-behind cache is how one
of them ends up subtly wrong.

## 11. Slices

1. **Desktop** — channel, DM and thread composers. *Observable:* type in a
   channel, switch away, come back, the text is there; reload the page, still
   there.
2. **Mobile** — same behaviour, drafts in the messages database (§4). Blocked on a
   `quorum-shared` publish (we never run `npm publish`).

## 12. Explicitly out of scope, with reasons

- **Attachments.** A processed image is a multi-MB base64 blob; persisting it per
  navigation needs a size cap, an eviction policy and a quota-exhaustion answer.
  Navigating away drops the attachment, as it does today.
- **Cross-device sync.** Device-local only. Sync would put unsent content in sync
  storage and require last-writer-wins conflict handling that will sometimes eat
  someone's text. `updatedAt` keeps the door open (§5).
- **Draft indicator in the channel / DM list.** Needs a different query shape
  ("every conversation with a draft") plus a live subscription and design in two
  list UIs on two platforms. Worth doing as its own slice; it is not this one.
- **Expiry.** No number is justifiable from first principles, and neither Discord
  nor Telegram does it.
- **A settings toggle.** §3.

## 13. Open items

1. Measure the boot-load cost once implemented, and record the number (§6).
2. Confirm during implementation that mobile's three composer surfaces map onto
   the same three `TypingScope` kinds. Desktop's are confirmed (§5); mobile's are
   assumed.

## Status

**2026-08-10 — designed, not started.** All design forks settled in conversation:
persist to disk, text + reply-to only, device-local, no list indicator, always on
with no toggle. The privacy question was researched against both codebases rather
than assumed; §3 records the finding, which produced a separate `.secret` issue
about local message-store protection.

---

*Last updated: 2026-08-10*
