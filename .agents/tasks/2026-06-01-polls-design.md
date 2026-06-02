---
type: task
title: "Polls in Spaces — Design Spec (v1 + roadmap to final)"
status: design
created: 2026-06-01
updated: 2026-06-01
---

# Polls in Spaces — Design Spec

> **Status:** Design locked across the 2026-06-01 brainstorm. Ready for an implementation plan (`writing-plans`).
>
> **Scope:** v1 ships a tight slice of Telegram/Discord-style polls inside Spaces. The data model is forward-compatible with multi-choice, locked-vote, time-limit, quorum-close, and anonymous modes — those land in a "final version" follow-up PR. No throwaway code in v1.

---

## Table of contents

1. [Why](#why)
2. [Architecture fit](#architecture-fit)
3. [Data model](#data-model)
4. [Authoring flow](#authoring-flow)
5. [Rendering & UI states](#rendering--ui-states)
6. [Space-level `allowPolls` toggle](#space-level-allowpolls-toggle)
7. [Sync, persistence, and offline](#sync-persistence-and-offline)
8. [File layout & build sequence](#file-layout--build-sequence)
9. [v1 scope (locked)](#v1-scope-locked)
10. [Deferred to final version](#deferred-to-final-version)
11. [Open questions](#open-questions)

---

## Why

Spaces today have no native survey/voting primitive. Reactions cover lightweight "thumbs up" but not "pick one of N labeled options with results." Communities currently improvise with reaction-based polls (post a message, react with emoji per option) — works for trivia, fails for real decisions.

Telegram and Discord both ship native polls. Adding them to Quorum brings table-stakes engagement parity and gives community moderators a deliberation tool that fits the existing message-event architecture.

---

## Architecture fit

Polls ride entirely on the existing message bus. **No new sync protocol, no new IndexedDB store, no new crypto.** Every poll-related action is a signed `Message` whose `content.type` is one of four new discriminants. Aggregation into a unified `PollState` is a pure function over the event set, recomputed at read time.

This mirrors how `ReactionMessage` already works — separate events fold into a `reactions[]` array on the parent message. Polls extend the same pattern.

**Key consequences of this architectural fit:**

- `SyncService` and the hash-based delta protocol are feature-agnostic — they see new `Message` types and handle them with zero protocol changes.
- The `messages` IndexedDB store (desktop) and MMKV-backed `StorageAdapter` (mobile) accept arbitrary `MessageContent` — no schema bump.
- E2E encryption via per-Space `space_keys` already covers poll payloads. No key-management work.
- `ActionQueueService` already handles offline persistence + retry — poll creation and voting inherit it for free.
- Receiving-side validation (the third defense-in-depth layer from `.agents/docs/features/security.md`) is the only line of defense against malicious clients, since polls cross peer boundaries before any UI gets to see them.

---

## Data model

### New message content types

Added to `quorum-shared/src/types/message.ts`:

```ts
export type PollMessage = {
  senderId: string;
  type: 'poll';
  pollId: string;                  // crypto.randomUUID()
  question: string;                // 1-300 chars, XSS-validated
  options: Array<{
    optionId: string;              // crypto.randomUUID()
    text: string;                  // 1-80 chars, XSS-validated
  }>;                              // 2-10 entries, immutable after creation
  mode: 'single';                  // forward-compat enum; only 'single' in v1
  closedAt?: number;               // set when poll closes; absent = open
  closedBy?: string;               // address that closed it (author in v1)
  repliesToMessageId?: string;     // polls can be replies, like posts
};

export type VoteMessage = {
  senderId: string;
  type: 'vote';
  pollMessageId: string;           // messageId of the parent PollMessage
  optionId: string | null;         // null = retract vote
  votedAt: number;                 // sender clock; used for "changed vote" detection
};

export type ClosePollMessage = {
  senderId: string;
  type: 'close-poll';
  pollMessageId: string;
};

export type EditPollMessage = {
  senderId: string;
  type: 'edit-poll';
  pollMessageId: string;
  editedQuestion: string;          // options are NOT editable
  editedAt: number;
  editNonce: string;
  editSignature?: string;
};
```

The `MessageContent` union gains four members: `| PollMessage | VoteMessage | ClosePollMessage | EditPollMessage`.

### Aggregate `PollState` (computed, not stored)

```ts
// Attached to the parent PollMessage by the read-path materializer
pollState?: {
  votes: Array<{
    optionId: string;
    voterAddress: string;
    votedAt: number;
    isChanged?: boolean;           // true if voter cast at least one earlier (different) vote
  }>;
  isClosed: boolean;
  closedAt?: number;
  closedBy?: string;
  questionEdited?: boolean;
};
```

### Aggregation rules

Implemented as a pure function `aggregatePollState(pollMessage, voteMessages, closeMessages, editMessages): PollState` in `quorum-shared/src/utils/pollAggregation.ts`. Deterministic across peers without distributed coordination.

1. **Latest vote per voter wins** — for each `(voterAddress, pollMessageId)`, keep the `VoteMessage` with the greatest `votedAt`; tiebreak on `messageId`.
2. **`optionId === null` retracts** — voter's entry is removed from `votes`.
3. **`isChanged` detection** — if a voter cast at least two distinct vote events (including null retractions) over the poll's lifetime, mark the surviving entry `isChanged: true`.
4. **Post-close votes dropped** — after observing `ClosePollMessage`, drop any `VoteMessage` with `votedAt > closedAt`.
5. **Pre-first-vote edit gating** — apply `EditPollMessage` only if its `editedAt` precedes the earliest non-retracted vote. Late edits dropped.

### `Space` type addition

`quorum-shared/src/types/space.ts` gains:

```ts
allowPolls?: boolean;              // defaults to true when absent (back-compat)
```

Existing spaces in storage and on peers don't have the field; the optional shape with default-true means no migration write is needed and the "ON by default" decision lands without rebroadcasting every space manifest.

### What does NOT change

- No IndexedDB schema version bump (`MessageDB` stays at v12).
- No new object stores. Polls + votes + closes + edits live in the existing `messages` store.
- No `SyncService` / `SyncManifest` / `SyncDeltaPayload` changes — these operate on `Message` shape, which still validates.
- No crypto changes.

---

## Authoring flow

### Entry point: composer `+` menu via `ContextMenu`

Today: `MessageComposer.tsx:793-805` renders an `IconPaperclip` button wrapped in a react-dropzone `<div>`. Click → file picker. Drag-and-drop → file attached.

**Change:**
- Swap the button icon from `paperclip` to `plus`.
- The dropzone wrapper stays (drag-and-drop image upload still works directly on the button).
- The click handler opens a `ContextMenu` (`src/components/ui/ContextMenu.tsx`) anchored above the button with two items.
- Suppress the dropzone's default click-to-open via the `noClick: true` option; call its `open()` programmatically from the "Add an image" menu item handler.

```ts
const items: MenuItem[] = [
  {
    id: 'attach-image',
    icon: 'photo',                       // IconPhoto (already in shared map)
    label: t`Add an image`,
    onClick: openFilePicker,             // dropzone.open()
  },
  {
    id: 'create-poll',
    icon: 'chart-bar',                   // IconChartBar (NEW in shared map)
    label: t`Create poll`,
    onClick: openCreatePollModal,
    hidden: !canCreatePoll(space, address),
  },
];
```

`ContextMenu` handles viewport edge detection — pass `position` from the button's `getBoundingClientRect()` and `calculatePosition` flips it upward when needed.

**Mobile (`MessageComposer.native.tsx`)** gets the same two-item menu via the existing `MobileDrawer` bottom-sheet.

**Tooltip:** rename from `id="attach-image"` to `id="attach"`, content `t`Attach``.

### Gating helper

New in `quorum-shared/src/utils/permissions.ts`:

```ts
canCreatePoll(space: Space, _userAddress: string): boolean {
  return space.allowPolls !== false;     // default true when undefined (back-compat)
}
```

v1 ignores `userAddress`. Final version will check a `poll:create` role permission.

### Create modal (`CreatePollModal.tsx`)

```
┌──────────────────────────────────────────────┐
│  Create poll                              ×  │
├──────────────────────────────────────────────┤
│                                              │
│  Question                                    │
│  ┌────────────────────────────────────────┐  │
│  │ What should we discuss next Friday?    │  │
│  └────────────────────────────────────────┘  │
│  43 / 300                                    │
│                                              │
│  Options                                     │
│  ┌────────────────────────────────────┐ [×]  │
│  │ Option 1 text…                     │      │
│  └────────────────────────────────────┘      │
│  ┌────────────────────────────────────┐ [×]  │
│  │ Option 2 text…                     │      │
│  └────────────────────────────────────┘      │
│                                              │
│  + Add option       (2-10 options)           │
│                                              │
├──────────────────────────────────────────────┤
│                       [Cancel]  [Create]     │
└──────────────────────────────────────────────┘
```

### Validation (defense-in-depth, three layers)

In `quorum-shared/src/validation/`, following the established `errorKey` i18n pattern:

```ts
// pollQuestion.ts
export const MAX_POLL_QUESTION_LENGTH = 300;
export function validatePollQuestion(q: string):
  | { ok: true }
  | { ok: false; errorKey: string; errorVars?: Record<string, unknown> } {
  const t = q.trim();
  if (t.length === 0) return { ok: false, errorKey: 'pollQuestion.required' };
  if (t.length > MAX_POLL_QUESTION_LENGTH)
    return { ok: false, errorKey: 'pollQuestion.tooLong', errorVars: { max: MAX_POLL_QUESTION_LENGTH } };
  if (!validateNameForXSS(t)) return { ok: false, errorKey: 'pollQuestion.xss' };
  return { ok: true };
}

// pollOption.ts
export const MAX_POLL_OPTION_LENGTH = 80;
export function validatePollOption(text: string):
  | { ok: true }
  | { ok: false; errorKey: string; errorVars?: Record<string, unknown> } {
  const t = text.trim();
  if (t.length === 0) return { ok: false, errorKey: 'pollOption.required' };
  if (t.length > MAX_POLL_OPTION_LENGTH)
    return { ok: false, errorKey: 'pollOption.tooLong', errorVars: { max: MAX_POLL_OPTION_LENGTH } };
  if (!validateNameForXSS(t)) return { ok: false, errorKey: 'pollOption.xss' };
  return { ok: true };
}
```

Length limits picked to match existing precedents (`MAX_TOPIC_LENGTH = 80` for option, longer-than-topic-shorter-than-message for question; 300 also matches Telegram polls).

**Three validation layers** (matching `.agents/docs/features/security.md`'s defense-in-depth model):

| Layer | Where | What it does |
|---|---|---|
| **UI** | `CreatePollModal.tsx` | Per-keystroke validation, submit disabled while invalid, counters (`n / 300`, `n / 80`) shown like other length-limited fields. |
| **Service** | `MessageService.sendPoll` | Re-validates before signing/broadcast. Rejects invalid polls. Same posture as `@everyone` stripping. |
| **Receiving** | `MessageService.handleIncomingPoll` and `handleIncomingVote` | Validates every incoming poll/vote from the network. Drops silently on failure (per the silent-rejection rule in security.md). |

**Receiving-side checks specifically:**

- `PollMessage.question` passes `validatePollQuestion`.
- `PollMessage.options` has 2-10 entries, no case-insensitive-trim duplicates, each passes `validatePollOption`.
- `PollMessage.options[].optionId` are unique within the poll.
- `VoteMessage.optionId` is either `null` (retract) or matches an `optionId` on the referenced poll.
- `VoteMessage.pollMessageId` references a known poll message in the same channel.
- Per-sender rate limit on votes (reuse `SimpleRateLimiter`) — prevents grief-spam of vote churn.
- `allowPolls !== false` on the parent Space — receiving-side enforcement of the Space toggle.

**XSS rendering:** question + option text rendered as plain text (no markdown). React auto-escaping is the safety net. No `dangerouslySetInnerHTML`.

### Submit flow

1. Generate `pollId` and `optionId` per option (both `crypto.randomUUID()`).
2. Build `PollMessage` and pass through the existing `MessageService.sendMessage` path — same encryption, signing, ratchet advance, action-queue enqueue.
3. Optimistic UI: poll appears in the channel feed with `sendStatus: 'sending'`, then transitions to `'sent'` like any other message.
4. If `allowPolls === false`, the `+` menu item is hidden client-side (already gated by `canCreatePoll`); receiving-side check is the security boundary.

### Author actions on existing polls

- **Edit question** — visible in the author hover-action menu only if author AND `pollState.votes.length === 0`. Opens `EditPollQuestionModal` (slim, question-only). Submits an `EditPollMessage`. Aggregation rule 5 enforces first-vote-wins race correctness across peers.
- **Close poll** — visible if author AND `!pollState.isClosed`. Sends `ClosePollMessage`. Confirmation via the existing `useTwoStepConfirm` shared primitive (avoids accidental close).
- **Delete poll** — uses the existing `RemoveMessage` flow. Same standard delete confirmation. Removes poll + downstream votes from view via the existing tombstone mechanism.
- Standard message actions still apply: reply, react with emoji, pin, bookmark, copy link.

---

## Rendering & UI states

### Where polls render

The existing `Message` component's content switch (`switch (message.content.type)` that dispatches to `PostMessageRenderer`, `StickerMessageRenderer`, etc.) gains a `'poll'` case → `PollMessageRenderer`. All surrounding chrome (avatar, sender name, timestamp, reactions row, thread reply count, hover action menu, message context menu) is inherited from the standard message frame.

### Card surface — self-contained, not `panel-item-box`

The poll card uses its own scoped SCSS (`PollMessageRenderer.scss`) and follows the pattern other inline message embeds use (`EmbedMessage`, sticker messages) — they don't reuse `panel-item-box` (which is calibrated for dropdown panel surfaces like Bookmarks / Pinned / Threads, not inline message-feed embeds).

The card surface uses the same CSS variables (`--surface-2`, `--surface-5`) explicitly but doesn't inherit `panel-item-box`. If during implementation the look feels visually thin and a panel-card look is wanted, opt-in then.

### Option rows — custom, not `RadioGroup`

`RadioGroup` would lock us into single-select semantics and force a primitive swap in v2 (radio → checkbox group). Instead: a custom `PollOptionRow.tsx` component, used in both v1 and v2.

The row is keyed off the poll's `mode`:

| Mode | Click semantics | `aria` role |
|---|---|---|
| `'single'` (v1) | Click a row → replace the user's vote (latest-wins). Click the currently selected row → retract. | `role="radio"` on row, `role="radiogroup"` on container. |
| `'multi'` (v2) | Click a row → toggle that option on/off. Voter has 0..N selected. | `role="checkbox"` on row, `role="group"` on container. |

The **visual** of the selection control is identical in both modes — one of two icons:

- `IconCircle` — unselected
- `IconCircleCheck` — selected

This is a deliberate departure from the desktop form-control convention (radio = circle, checkbox = square): Telegram and most modern poll UIs use a single visual style for both modes, and there's no nearby radio/checkbox to disambiguate against. One pair of icons covers both v1 and v2 — no primitive swap, no extra icons.

Keyboard navigation (arrow keys to move focus between rows, space/enter to toggle) lives on the container component, parameterized by `mode`.

### Three card states (driven by `pollState`)

**State A — open, current user has NOT voted (tallies hidden):**

```
┌──────────────────────────────────────────────────────┐
│  📊  Poll                                            │
│                                                      │
│  What should we discuss next Friday?                 │
│                                                      │
│  ○  Option one                                       │
│  ○  Option two                                       │
│  ○  Option three                                     │
│                                                      │
│  12 votes · Open                                     │
└──────────────────────────────────────────────────────┘
```

No per-option counts/percentages. Clicking a row sends a `VoteMessage` immediately (optimistic). Single-choice + change-anytime = each click is the vote, no Submit button.

**State B — open, current user HAS voted (tallies revealed):**

```
┌──────────────────────────────────────────────────────┐
│  📊  Poll                                            │
│                                                      │
│  What should we discuss next Friday?                 │
│                                                      │
│  ◉  Option one             5 (42%) ████░░░░░░        │
│  ○  Option two             4 (33%) ███░░░░░░░        │
│  ○  Option three           3 (25%) ██░░░░░░░░        │
│                                                      │
│  12 votes · Open                                     │
│  View votes →                                        │
└──────────────────────────────────────────────────────┘
```

Selected row uses `IconCircleCheck` and a subtle row-accent. Clicking another row swaps the vote; clicking the selected row retracts (and the card snaps back to State A). The "View votes →" link opens `PollResultsModal`.

**State C — closed:**

```
┌──────────────────────────────────────────────────────┐
│  📊  Poll                                  [Closed]  │
│                                                      │
│  What should we discuss next Friday?                 │
│                                                      │
│  ◉  Option one ★           5 (42%) ████░░░░░░        │
│  ○  Option two             4 (33%) ███░░░░░░░        │
│  ○  Option three           3 (25%) ██░░░░░░░░        │
│                                                      │
│  12 votes · Closed · 2 days ago                      │
│  View votes →                                        │
└──────────────────────────────────────────────────────┘
```

Same as State B but:

- Status pill changes from "Open" → "Closed" (subtle, not danger color).
- Rows are non-interactive (no hover, no `cursor: pointer`).
- Winning option(s) get an accent star (`★`) or border — ties show all winners.
- Any `VoteMessage` with `votedAt > closedAt` is dropped on receive (aggregation rule 4).
- "View votes →" always visible (poll closed, no bandwagon risk).

### PollResultsModal — voter detail (Telegram-style)

New component: `PollResultsModal.tsx`, rendered via the existing `ModalProvider`.

```
┌─────────────────────────────────────────────────────┐
│  Poll results                                  ✕   │
│  What should we discuss next Friday?                │
│  12 votes                                           │
├─────────────────────────────────────────────────────┤
│  Option one — 42%                       5 votes     │
│  ─────────────────────────────────────────────────  │
│   👤 alice                              May 26      │
│                                         08:29       │
│   👤 bob                                May 25      │
│                                         19:23       │
│   👤 carol  ↻                           May 25      │
│                                         13:12       │
│   …                                                 │
│                                                     │
│  Option two — 33%                       4 votes     │
│  ─────────────────────────────────────────────────  │
│   …                                                 │
│                                                     │
│  Option three — 25%                     3 votes     │
│  ─────────────────────────────────────────────────  │
│   …                                                 │
└─────────────────────────────────────────────────────┘
```

**Structure:**

- Modal header: "Poll results" title, question repeated underneath (smaller, subtle), total vote count.
- **Per-option section** in authoring order (not sorted by vote count — preserves layout stability as votes change). Each section header: option text + percentage + vote count, subtle banded background.
- Voter rows: `UserAvatar` + display name + `votedAt` formatted as `MMM DD\nHH:mm` (right-aligned, two lines). Clicking opens the existing `UserProfile` popover.
- **Changed-vote glyph** (`↻`) shown right of the display name when `isChanged === true`. Tooltip: "Changed their vote". If no suitable icon exists in the shared map already, a small SVG glyph or `IconRefresh` (verify during implementation).
- Empty option (0 votes): section header still rendered with `0%   0 votes`, empty body. Predictable layout.
- Voter list within each option sorted by `votedAt` descending (most recent first), matching Telegram.

**Live updates:** modal subscribes to the same `pollState`; new votes arriving while open update the lists in place.

**Mobile:** renders via the existing `MobileDrawer` bottom-sheet, scrollable, same content structure.

### Existing-feature interactions

- **Reactions:** allowed on poll messages (they're still messages).
- **Threads:** a poll can be the root of a thread.
- **Replying TO a poll:** `repliesToMessageId` already supports pointing at any message. The reply-preview renderer gets a one-line case for `'poll'`: render `IconChartBar` + truncated question text.
- **Search:** `SearchService.getSearchableText` extended with a `'poll'` case returning `question + options.map(o => o.text).join(' ')`. Vote/close/edit events are not indexed (no user-meaningful text). Search indices are lazy + LRU-evicted today, so polls appear in the index the next time a context's index is built — no backfill.
- **Notifications:** poll messages behave like regular messages for channel unread + mentions (author can `@everyone` if they have the permission). Votes are silent (no notifications, no unread bump) — same treatment as reactions.
- **Receipts:** `PollMessage` triggers delivery/read receipts (if user privacy settings enable them). `VoteMessage`, `ClosePollMessage`, `EditPollMessage` are silent — internal bookkeeping, same as reactions today.
- **Pinning:** allowed via the existing `message:pin` permission.
- **Bookmarks:** allowed — the existing bookmark cache should store the question text as the preview.

### Optimistic UX

Vote click → `pollState` updates immediately client-side → `VoteMessage` enqueued via `ActionQueueService`. If the queue fails, the existing message-send-error indicator surfaces and the optimistic vote is rolled back. Same pattern as sending any message.

### Fallback for corrupt / out-of-order events

- `PollMessage` arrives with no valid options (somehow passes receive-validation but mutates): render `IconChartBar` + "Poll · unavailable". No crash.
- `VoteMessage` arrives before its parent `PollMessage` has synced: hold the vote in storage; the parent will arrive in a subsequent sync wave. Aggregation handles it correctly when the parent materializes.

---

## Space-level `allowPolls` toggle

### Where in data

`Space.allowPolls?: boolean` (defaults to `true` when absent — see [Data model](#data-model) for the back-compat reasoning).

### Where in UI

`SpaceSettingsModal` → **General** tab → a new "Features" section:

```
General
─────────────────────────────────────
  Name                  [____________]
  Description           [____________]
  Icon                  [picker]
  …

Features
─────────────────────────────────────
  Allow polls           [ Switch ON ]
  Members can create polls in any channel.
```

Uses the existing `Switch` primitive. Saves through the same General-tab save flow that handles name/description/icon — broadcasts via `SpaceService.updateSpace` like a normal Space update.

### Who can toggle

Space owner only in v1 (same gating as other General-tab fields). No new permission.

### Effect of toggling OFF

1. The "Create poll" item in the composer `+` menu is hidden for all members (via `canCreatePoll(space, address)`).
2. **Existing polls remain visible and votable.** Turning the feature off does not retroactively close or hide polls — less surprising, doesn't destroy votes, and owners with `message:delete` can already remove individual polls.
3. Defense-in-depth: `MessageService.handleIncomingPoll` checks `space.allowPolls !== false` and silently drops poll messages if the feature is off. Honest clients never see polls created in a feature-disabled space. Attackers only see their own poll.

### Race on toggle

If owner toggles OFF at the same moment a member sends a poll, the toggle change arrives at other members' clients after the poll. Their receiving-side check rejects the poll (their local `space.allowPolls` is now `false`). Eventually-consistent, no UI work needed — same behaviour as every other Space-setting change handling in-flight messages.

### Mobile parity

`SpaceSettingsModal` exists on mobile. The same Switch row + same `canCreatePoll` helper produces identical gating across platforms. Flagged in `mobile-tasks-pending.md`.

---

## Sync, persistence, and offline

### Sync — zero protocol changes

All four new message types are `Message`s. They participate in `SyncManifest` via `createMessageDigest` (which hashes the whole serialized message), travel through `SyncDeltaPayload`, are signed/verified via Ed448 like everything else, and are encrypted via per-Space `space_keys`. No changes to `quorum-shared/src/sync/` or `SyncService`.

### Persistence — zero schema changes

All four types ride on the existing `messages` IndexedDB object store (`MessageDB` schema v12, no bump). Mobile same on MMKV. No new object stores. No migration script.

### Aggregation — read-time, not stored

`pollState` is derived. Computed by `aggregatePollState` (shared, pure) when the parent `PollMessage` is read out of storage — in the same place reactions are aggregated today. Consequences:

- Out-of-order vote arrival → next read recomputes and shows the new vote.
- Vote tombstones → next read recomputes without them.
- The five aggregation rules are pure functions of the event set — deterministic across peers without distributed coordination.

**Cost of read-time aggregation** for a hot 500-vote poll re-rendered on every channel scroll:

1. **Memoize `pollState`** at the `PollMessageRenderer` level keyed on `(pollMessageId, lastModifiedHash, votes.length)`.
2. **Aggregate when materializing from storage**, not on each render — same hook that attaches `reactions[]`.

If 500-vote polls become common, incremental in-place updates per `VoteMessage` are a future optimization.

### Search

`SearchService.getSearchableText` extended with one case for `'poll'`. Indices are lazy + LRU-evicted today, so no backfill required.

### Offline behaviour

| Scenario | Behaviour |
|---|---|
| **Create poll while offline** | `PollMessage` enqueued via `ActionQueueService`. UI shows poll optimistically with `sendStatus: 'sending'`. Drains on reconnect. |
| **Vote while offline** | `VoteMessage` enqueued. Optimistic `pollState` update applies locally. On reconnect, the vote broadcasts. Multiple changed votes while offline → each is enqueued; aggregation rule 1 (latest-wins) handles correctness. Wire-traffic optimization (collapsing same-poll vote events in the queue) deferred. |
| **Vote on a poll that closed while offline** | When the user reconnects, the `ClosePollMessage` arrives in the same delta batch. Offline-cast `VoteMessage` with `votedAt > closedAt` is dropped by aggregation rule 4. UI hint: `Callout variant="info"` ("This poll closed before your vote was sent") via the existing offline-error toast pattern. |

`ActionQueueService` already persists across crashes (IndexedDB-backed) — no new persistence work.

### Migration

None. No IndexedDB version bump. No `Space` field default to backfill (the `?` on `allowPolls` handles it). No sync-protocol version negotiation. Old clients receiving a `PollMessage` fall through the existing renderer's unknown-content-type path (silently skipped with `logger.warn` — verify during implementation that it doesn't throw; if it does, one-line guard).

---

## File layout & build sequence

### Repo 1: `quorum-shared` PR (ships first, additive)

```
quorum-shared/src/
├── types/message.ts                     (extend MessageContent union with 4 poll types)
├── types/space.ts                       (add allowPolls?: boolean to Space)
├── utils/pollAggregation.ts             NEW — pure aggregator + PollState type
├── utils/permissions.ts                 (add canCreatePoll helper)
├── validation/pollQuestion.ts           NEW
├── validation/pollOption.ts             NEW
├── primitives/Icon/Icon.web.tsx         (register IconChartBar, IconCircle, IconCircleCheck)
├── primitives/Icon/Icon.native.tsx      (same three)
└── index.ts                             (barrel exports)
```

**Tests (in shared):** exhaustive unit tests for `pollAggregation` — five aggregation rules, ordering edge cases, retract behaviour, `isChanged` detection, post-close vote dropping, pre-first-vote edit gating. This is the highest-value test surface in the whole feature.

**Version bump:** `2.1.0-22`.

**Mobile follow-up** flagged in `mobile-tasks-pending.md`: add the three icons to the native icon map, render the poll card. Mobile doesn't need to ship simultaneously with desktop.

### Repo 2: `quorum-desktop` PR (depends on shared 2.1.0-22)

```
src/
├── components/message/
│   ├── PollMessageRenderer.tsx          NEW — card, states A/B/C
│   ├── PollMessageRenderer.scss         NEW — self-contained, no panel-item-box
│   └── PollOptionRow.tsx                NEW — circle/circle-check, %, bar, click handler
│
├── components/modals/
│   ├── CreatePollModal.tsx              NEW
│   ├── CreatePollModal.scss
│   ├── EditPollQuestionModal.tsx        NEW
│   ├── PollResultsModal.tsx             NEW — Telegram-style voter detail
│   └── PollResultsModal.scss
│
├── components/message/MessageComposer.tsx
│                                        MODIFY — paperclip → plus, attach ContextMenu
│
├── components/modals/SpaceSettingsModal/General.tsx
│                                        MODIFY — Features section + allowPolls Switch
│
├── hooks/business/polls/
│   ├── usePollVoting.ts                 NEW — castVote, retractVote, closePoll
│   └── usePollCreation.ts               NEW — submitPoll, validate, optimistic insert
│
└── services/
    ├── MessageService.ts                MODIFY — sendPoll, sendVote, sendClosePoll,
    │                                              sendEditPoll, handleIncomingPoll,
    │                                              handleIncomingVote, handleIncomingClosePoll,
    │                                              handleIncomingEditPoll
    └── SearchService.ts                 MODIFY — getSearchableText case for 'poll'
```

Message-renderer dispatch (wherever `switch (message.content.type)` lives in the renderer) gains one new `case 'poll'`.

**Tests (in desktop):**

- `PollMessageRenderer` snapshot/interaction tests for states A/B/C.
- `CreatePollModal` form validation tests.
- `usePollVoting` hook tests (castVote → enqueues correct `VoteMessage`, retract → null optionId).
- `MessageService.handleIncomingPoll` validation tests (XSS, duplicate optionIds, missing parent for vote, post-close vote drop).
- `SearchService` returns `question + options` text for poll messages.

### Build sequence within the desktop PR

Each step independently verifiable:

1. Pull shared `2.1.0-22`. Confirm types resolve.
2. Wire `aggregatePollState` into the MessageDB read path so `pollState` exists on materialized poll messages. Round-trip unit test through storage.
3. `MessageService` send methods + receive handlers. Send/receive poll, vote, close-poll, edit-poll end-to-end across two browser tabs (same Space). Verify via console + DB inspection — no UI.
4. `PollMessageRenderer` card with temporary inline vote buttons.
5. `PollOptionRow` + states A/B/C. Replace temporary buttons with real rows + bars + percentages.
6. `CreatePollModal` + composer `+` menu wiring.
7. `PollResultsModal` + "View votes →" link.
8. `EditPollQuestionModal` + author action menu items (edit, close, delete).
9. Space Settings `allowPolls` toggle. Verify gating end-to-end.
10. `SearchService` integration.
11. Validation hardening pass. XSS smoke tests per security.md test scenarios. Cross-tab manual verification.

### Estimated scope

- **Shared PR:** ~1 day. Most of the time is on aggregator tests.
- **Desktop PR:** ~3-4 days following the build sequence. Step 11 is non-trivial.
- **Mobile follow-up:** out of scope, tracked in `mobile-tasks-pending.md`.

---

## v1 scope (locked)

- Single-choice polls (`mode: 'single'`).
- Public votes (no anonymous mode).
- Change vote anytime + `↻` indicator in PollResultsModal.
- Manual close by author.
- Author can edit question text before first vote arrives.
- Author can delete poll (= delete message).
- Tallies hidden until you vote (open question on author-sees-results, see below).
- 2-10 options, no edits to options after creation.
- Question max 300 chars, option max 80 chars (validation in shared).
- Owner-controlled `allowPolls` Space toggle, default ON, existing polls survive toggle-off.
- Spaces only (no DMs).
- Votes silent (no notifications, no unread bump).
- Polls trigger normal delivery/read receipts (if enabled per user privacy); votes don't.
- Polls indexed in search.

---

## Deferred to final version

The data model already supports all of these; no v1 wire-shape lock-in:

- Multi-choice polls (`mode: 'multi'`).
- Author-locked vote mode (no change-vote).
- Time-limit auto-close.
- Close-on-quorum (close when N votes reached).
- Anonymous polls (pending separate crypto design — true cryptographic anonymity on a P2P E2E network requires non-trivial work; pragmatic UI-hidden anonymity is feasible but isn't the same thing).
- Poll closing → notify author.
- `poll:create` role permission.
- Polls in DMs.

---

## Open questions

1. **Author always sees tallies?** When the author opens their own poll, do they see results before voting themselves? Telegram says yes. Recommendation: yes — the author already knows what they wrote, the bandwagon argument doesn't apply, and they need to gauge engagement to decide when to close. Lock at "author sees results without needing to vote" unless rejected.
2. **Renderer fallback for unknown `content.type`.** Verify during implementation that the existing renderer skips silently (with `logger.warn`) and doesn't throw. If it throws, add a one-line guard.
3. **v2 multi-choice wire shape.** Single `VoteMessage` with `optionIds: string[]` vs. multiple `VoteMessage` events per voter. The `mode` field discriminates either approach. Decide at v2 time.
4. **Vote churn batching in `ActionQueueService`.** If offline voting churn becomes a real problem in production, collapse same-poll vote events in the queue before drain. Future optimization, not v1.
5. **`isChanged` glyph icon.** Use a small `↻` SVG inline, or add `IconRefresh` to the shared icon map. Verify during implementation whether something close already exists.

---

*Last updated: 2026-06-01*
