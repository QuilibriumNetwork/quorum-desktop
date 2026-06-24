---
type: task
title: "Polls in Spaces — Implementation Plan (v1)"
status: ready
created: 2026-06-01
updated: 2026-06-01
spec: 2026-06-01-polls-design.md
---

# Polls in Spaces — v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Telegram/Discord-style single-choice polls inside Spaces, riding entirely on the existing message-event architecture with zero sync-protocol or IndexedDB schema changes.

**Architecture:** Polls are four new `MessageContent` types (`PollMessage`, `VoteMessage`, `ClosePollMessage`, `EditPollMessage`) that ride on the existing `messages` IndexedDB store. A pure `aggregatePollState` function folds the events into a derived `PollState` at read time. UI is a self-contained card in the message feed plus a Telegram-style results modal. A Space-level `allowPolls` toggle (default ON) gates creation.

**Tech Stack:** TypeScript, React 19, Vite, IndexedDB, `@quilibrium/quorum-shared` (cross-platform shared package), Lingui (i18n), SCSS, react-dropzone, react-tooltip, TanStack Query.

**Spec:** [`2026-06-01-polls-design.md`](2026-06-01-polls-design.md)

---

## Cross-repo execution order

This plan spans two repos. Execute in this order:

1. **Phase A — `quorum-shared`** (Tasks 1-7): types, validators, aggregator, icons. Bump version to `2.1.0-22`, publish.
2. **Phase B — `quorum-desktop`** (Tasks 8-23): consume `2.1.0-22`, build the feature.
3. **Phase C — Mobile follow-up** (Task 24): drop a `mobile-tasks-pending.md` entry; mobile work is out of scope for this PR.

For the cross-repo workflow specifics (branch naming, when to open shared PR vs. desktop PR), follow [`.agents/tasks/quorum-shared-migration/cross-repo-workflow.md`](quorum-shared-migration/cross-repo-workflow.md).

---

## File structure overview

### `quorum-shared` (new + modified)

```
quorum-shared/src/
├── types/message.ts                     MODIFY — append 4 poll types + PollState to union/exports
├── types/space.ts                       MODIFY — add allowPolls?: boolean
├── utils/pollAggregation.ts             NEW — aggregatePollState + PollState type
├── utils/permissions.ts                 MODIFY — add canCreatePoll
├── validation/pollQuestion.ts           NEW
├── validation/pollOption.ts             NEW
├── primitives/Icon/Icon.web.tsx         MODIFY — register IconChartBar, IconCircle, IconCircleCheck
├── primitives/Icon/Icon.native.tsx      MODIFY — same three
├── index.ts                             MODIFY — barrel exports
└── package.json                         MODIFY — bump version to 2.1.0-22
```

### `quorum-desktop` (new + modified)

```
src/
├── components/message/
│   ├── PollMessageRenderer.tsx          NEW — card, states A/B/C
│   ├── PollMessageRenderer.scss         NEW — self-contained styles
│   ├── PollOptionRow.tsx                NEW — option row with selection icon, %, bar
│   ├── Message.tsx                      MODIFY — dispatch to PollMessageRenderer
│   └── MessageComposer.tsx              MODIFY — paperclip→plus, ContextMenu attach menu
│
├── components/modals/
│   ├── CreatePollModal.tsx              NEW
│   ├── CreatePollModal.scss             NEW
│   ├── EditPollQuestionModal.tsx        NEW
│   ├── PollResultsModal.tsx             NEW
│   └── PollResultsModal.scss            NEW
│
├── components/modals/SpaceSettingsModal/
│   └── General.tsx                      MODIFY — Features section + allowPolls Switch
│
├── hooks/business/polls/
│   ├── usePollVoting.ts                 NEW
│   └── usePollCreation.ts               NEW
│
└── services/
    ├── MessageService.ts                MODIFY — 4 send methods + 4 receive handlers
    └── SearchService.ts                 MODIFY — getSearchableText case for 'poll'
```

---

# Phase A — `quorum-shared`

> Execute in the `quorum-shared` repo (sibling directory: `../quorum-shared` from this repo's parent, or wherever it lives on the executor's machine — verify with `git remote -v` showing `QuilibriumNetwork/quorum-shared`).

---

## Task 1: Add the 4 poll message content types to shared

**Files:**
- Modify: `quorum-shared/src/types/message.ts`
- Test: `quorum-shared/src/types/message.test.ts` (extend existing file if present; else create)

- [ ] **Step 1: Write the failing type-shape test**

Append to `quorum-shared/src/types/message.test.ts`:

```typescript
import type {
  PollMessage,
  VoteMessage,
  ClosePollMessage,
  EditPollMessage,
  MessageContent,
} from './message';

describe('Poll message types', () => {
  it('PollMessage has the expected shape', () => {
    const m: PollMessage = {
      senderId: 'addr1',
      type: 'poll',
      pollId: 'p1',
      question: 'Q?',
      options: [
        { optionId: 'o1', text: 'A' },
        { optionId: 'o2', text: 'B' },
      ],
      mode: 'single',
    };
    expect(m.type).toBe('poll');
    expect(m.options.length).toBe(2);
  });

  it('VoteMessage allows null optionId for retraction', () => {
    const retract: VoteMessage = {
      senderId: 'addr1',
      type: 'vote',
      pollMessageId: 'msg1',
      optionId: null,
      votedAt: 1717200000000,
    };
    expect(retract.optionId).toBeNull();
  });

  it('MessageContent union accepts all 4 poll types', () => {
    const a: MessageContent = { senderId: 's', type: 'poll', pollId: 'p', question: 'Q', options: [], mode: 'single' };
    const b: MessageContent = { senderId: 's', type: 'vote', pollMessageId: 'm', optionId: 'o', votedAt: 0 };
    const c: MessageContent = { senderId: 's', type: 'close-poll', pollMessageId: 'm' };
    const d: MessageContent = { senderId: 's', type: 'edit-poll', pollMessageId: 'm', editedQuestion: 'Q2', editedAt: 0, editNonce: 'n' };
    expect([a, b, c, d].map(x => x.type)).toEqual(['poll', 'vote', 'close-poll', 'edit-poll']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @quilibrium/quorum-shared test src/types/message.test.ts`
Expected: type error — `PollMessage`, `VoteMessage`, `ClosePollMessage`, `EditPollMessage` are not exported.

- [ ] **Step 3: Add the four types and extend the union**

Append to `quorum-shared/src/types/message.ts` (before the `MessageContent` type alias):

```typescript
export type PollMessage = {
  senderId: string;
  type: 'poll';
  pollId: string;
  question: string;
  options: Array<{
    optionId: string;
    text: string;
  }>;
  mode: 'single';
  closedAt?: number;
  closedBy?: string;
  repliesToMessageId?: string;
};

export type VoteMessage = {
  senderId: string;
  type: 'vote';
  pollMessageId: string;
  optionId: string | null;
  votedAt: number;
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
  editedQuestion: string;
  editedAt: number;
  editNonce: string;
  editSignature?: string;
};
```

Then extend the `MessageContent` union (existing line ~206) to append the four new members at the end:

```typescript
export type MessageContent = PostMessage | EventMessage | EmbedMessage | ReactionMessage | RemoveReactionMessage | RemoveMessage | JoinMessage | LeaveMessage | KickMessage | MuteMessage | UpdateProfileMessage | StickerMessage | PinMessage | DeleteConversationMessage | EditMessage | CallOfferMessage | CallAnswerMessage | CallRejectMessage | CallHangupMessage | CallIceCandidateMessage | CallEventMessage | CallRenegotiateMessage | SpaceCallStartMessage | SpaceCallEndMessage | ThreadMessage | PollMessage | VoteMessage | ClosePollMessage | EditPollMessage;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @quilibrium/quorum-shared test src/types/message.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/message.ts src/types/message.test.ts
git commit -m "feat(types): add 4 poll message content types"
```

---

## Task 2: Add `PollState` type and `aggregatePollState` pure aggregator

**Files:**
- Create: `quorum-shared/src/utils/pollAggregation.ts`
- Create: `quorum-shared/src/utils/pollAggregation.test.ts`

- [ ] **Step 1: Write the failing tests (covers all 5 aggregation rules)**

Create `quorum-shared/src/utils/pollAggregation.test.ts`:

```typescript
import { aggregatePollState, type PollState } from './pollAggregation';
import type {
  PollMessage,
  VoteMessage,
  ClosePollMessage,
  EditPollMessage,
} from '../types/message';

const makePoll = (overrides: Partial<PollMessage> = {}): PollMessage => ({
  senderId: 'author',
  type: 'poll',
  pollId: 'p1',
  question: 'Q?',
  options: [
    { optionId: 'o1', text: 'A' },
    { optionId: 'o2', text: 'B' },
    { optionId: 'o3', text: 'C' },
  ],
  mode: 'single',
  ...overrides,
});

const makeVote = (
  voter: string,
  optionId: string | null,
  votedAt: number
): VoteMessage => ({
  senderId: voter,
  type: 'vote',
  pollMessageId: 'pollMsg1',
  optionId,
  votedAt,
});

describe('aggregatePollState', () => {
  describe('rule 1: latest vote per voter wins', () => {
    it('keeps only the latest VoteMessage per voter', () => {
      const poll = makePoll();
      const votes = [
        makeVote('alice', 'o1', 100),
        makeVote('alice', 'o2', 200),
        makeVote('bob', 'o1', 150),
      ];
      const state = aggregatePollState(poll, votes, [], []);
      expect(state.votes).toHaveLength(2);
      const alice = state.votes.find(v => v.voterAddress === 'alice');
      expect(alice?.optionId).toBe('o2');
    });

    it('tiebreaks identical votedAt by sorting last-occurring in array as winner is undefined behavior — does not crash', () => {
      const poll = makePoll();
      const votes = [
        makeVote('alice', 'o1', 100),
        makeVote('alice', 'o2', 100),
      ];
      const state = aggregatePollState(poll, votes, [], []);
      expect(state.votes).toHaveLength(1);
    });
  });

  describe('rule 2: optionId === null retracts', () => {
    it('removes voter entry when latest vote has null optionId', () => {
      const poll = makePoll();
      const votes = [
        makeVote('alice', 'o1', 100),
        makeVote('alice', null, 200),
      ];
      const state = aggregatePollState(poll, votes, [], []);
      expect(state.votes).toHaveLength(0);
    });
  });

  describe('rule 3: isChanged detection', () => {
    it('marks isChanged when voter has at least 2 distinct vote events', () => {
      const poll = makePoll();
      const votes = [
        makeVote('alice', 'o1', 100),
        makeVote('alice', 'o2', 200),
      ];
      const state = aggregatePollState(poll, votes, [], []);
      const alice = state.votes.find(v => v.voterAddress === 'alice');
      expect(alice?.isChanged).toBe(true);
    });

    it('does NOT mark isChanged when voter cast only one vote', () => {
      const poll = makePoll();
      const votes = [makeVote('alice', 'o1', 100)];
      const state = aggregatePollState(poll, votes, [], []);
      const alice = state.votes.find(v => v.voterAddress === 'alice');
      expect(alice?.isChanged).toBeFalsy();
    });

    it('marks isChanged after retract-then-revote', () => {
      const poll = makePoll();
      const votes = [
        makeVote('alice', 'o1', 100),
        makeVote('alice', null, 200),
        makeVote('alice', 'o2', 300),
      ];
      const state = aggregatePollState(poll, votes, [], []);
      const alice = state.votes.find(v => v.voterAddress === 'alice');
      expect(alice?.optionId).toBe('o2');
      expect(alice?.isChanged).toBe(true);
    });
  });

  describe('rule 4: post-close votes dropped', () => {
    it('drops votes with votedAt > closedAt', () => {
      const poll = makePoll();
      const close: ClosePollMessage = {
        senderId: 'author',
        type: 'close-poll',
        pollMessageId: 'pollMsg1',
      };
      const votes = [
        makeVote('alice', 'o1', 100),
        makeVote('bob', 'o2', 999), // after close
      ];
      const state = aggregatePollState(poll, votes, [close], [], { closedAt: 500 });
      expect(state.isClosed).toBe(true);
      expect(state.votes).toHaveLength(1);
      expect(state.votes[0].voterAddress).toBe('alice');
    });

    it('keeps votes with votedAt === closedAt', () => {
      const poll = makePoll();
      const close: ClosePollMessage = {
        senderId: 'author',
        type: 'close-poll',
        pollMessageId: 'pollMsg1',
      };
      const votes = [makeVote('alice', 'o1', 500)];
      const state = aggregatePollState(poll, votes, [close], [], { closedAt: 500 });
      expect(state.votes).toHaveLength(1);
    });
  });

  describe('rule 5: pre-first-vote edit gating', () => {
    it('applies edit when editedAt < earliest non-retracted vote', () => {
      const poll = makePoll();
      const edit: EditPollMessage = {
        senderId: 'author',
        type: 'edit-poll',
        pollMessageId: 'pollMsg1',
        editedQuestion: 'Q v2',
        editedAt: 50,
        editNonce: 'n1',
      };
      const votes = [makeVote('alice', 'o1', 100)];
      const state = aggregatePollState(poll, votes, [], [edit]);
      expect(state.questionEdited).toBe(true);
    });

    it('drops edit when editedAt >= earliest non-retracted vote', () => {
      const poll = makePoll();
      const edit: EditPollMessage = {
        senderId: 'author',
        type: 'edit-poll',
        pollMessageId: 'pollMsg1',
        editedQuestion: 'Q v2',
        editedAt: 200,
        editNonce: 'n1',
      };
      const votes = [makeVote('alice', 'o1', 100)];
      const state = aggregatePollState(poll, votes, [], [edit]);
      expect(state.questionEdited).toBeFalsy();
    });
  });

  describe('open poll (no close events)', () => {
    it('isClosed is false and closedAt is undefined', () => {
      const poll = makePoll();
      const state = aggregatePollState(poll, [makeVote('alice', 'o1', 100)], [], []);
      expect(state.isClosed).toBe(false);
      expect(state.closedAt).toBeUndefined();
    });
  });

  describe('determinism', () => {
    it('produces identical output regardless of input array order', () => {
      const poll = makePoll();
      const votes = [
        makeVote('alice', 'o1', 100),
        makeVote('bob', 'o2', 200),
        makeVote('alice', 'o2', 300),
      ];
      const a = aggregatePollState(poll, votes, [], []);
      const b = aggregatePollState(poll, [...votes].reverse(), [], []);
      const sortByVoter = (s: PollState) =>
        [...s.votes].sort((x, y) => x.voterAddress.localeCompare(y.voterAddress));
      expect(sortByVoter(a)).toEqual(sortByVoter(b));
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @quilibrium/quorum-shared test src/utils/pollAggregation.test.ts`
Expected: module not found — `pollAggregation.ts` does not exist.

- [ ] **Step 3: Implement the aggregator**

Create `quorum-shared/src/utils/pollAggregation.ts`:

```typescript
import type {
  PollMessage,
  VoteMessage,
  ClosePollMessage,
  EditPollMessage,
} from '../types/message';

export type PollVoteEntry = {
  optionId: string;
  voterAddress: string;
  votedAt: number;
  isChanged?: boolean;
};

export type PollState = {
  votes: PollVoteEntry[];
  isClosed: boolean;
  closedAt?: number;
  closedBy?: string;
  questionEdited?: boolean;
};

/**
 * Optional metadata that the storage layer can pass through.
 * `closedAt` comes from the createdDate of the ClosePollMessage when this
 * helper is called from a context that has it. When omitted, the helper
 * falls back to "first close event = closed, no temporal gating".
 */
export type AggregationContext = {
  closedAt?: number;
};

/**
 * Pure aggregator that folds the four poll event types into a derived PollState.
 *
 * Rules:
 *   1. Latest VoteMessage per (voterAddress, pollMessageId) wins.
 *   2. optionId === null on the latest vote retracts (entry removed).
 *   3. isChanged = true when the voter has >= 2 distinct vote events (any kind).
 *   4. Votes with votedAt > closedAt are dropped when a ClosePollMessage exists.
 *   5. EditPollMessage applies only if editedAt < earliest non-retracted vote.
 *
 * The function is pure — same inputs produce same output regardless of array order.
 */
export function aggregatePollState(
  poll: PollMessage,
  votes: VoteMessage[],
  closes: ClosePollMessage[],
  edits: EditPollMessage[],
  context: AggregationContext = {}
): PollState {
  const isClosed = closes.length > 0;
  const closedAt = context.closedAt;
  const closedBy = isClosed ? closes[0].senderId : undefined;

  // Apply rule 4: drop post-close votes (only if we know closedAt)
  const effectiveVotes =
    isClosed && closedAt !== undefined
      ? votes.filter(v => v.votedAt <= closedAt)
      : votes;

  // Group by voter, sort by votedAt asc, keep last
  const byVoter = new Map<string, VoteMessage[]>();
  for (const v of effectiveVotes) {
    const list = byVoter.get(v.senderId) ?? [];
    list.push(v);
    byVoter.set(v.senderId, list);
  }

  const voteEntries: PollVoteEntry[] = [];
  let earliestVoteAt: number | undefined;

  for (const [voter, list] of byVoter) {
    const sorted = [...list].sort((a, b) => a.votedAt - b.votedAt);
    const latest = sorted[sorted.length - 1];
    const isChanged = sorted.length >= 2;

    if (latest.optionId !== null) {
      voteEntries.push({
        optionId: latest.optionId,
        voterAddress: voter,
        votedAt: latest.votedAt,
        ...(isChanged ? { isChanged: true } : {}),
      });

      // Track earliest non-retracted vote (across all voters) for rule 5
      const firstNonRetracted = sorted.find(v => v.optionId !== null);
      if (firstNonRetracted) {
        if (earliestVoteAt === undefined || firstNonRetracted.votedAt < earliestVoteAt) {
          earliestVoteAt = firstNonRetracted.votedAt;
        }
      }
    }
  }

  // Apply rule 5: edit gating
  const questionEdited = edits.some(e =>
    earliestVoteAt === undefined ? true : e.editedAt < earliestVoteAt
  );

  return {
    votes: voteEntries,
    isClosed,
    ...(closedAt !== undefined ? { closedAt } : {}),
    ...(closedBy ? { closedBy } : {}),
    ...(questionEdited ? { questionEdited: true } : {}),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @quilibrium/quorum-shared test src/utils/pollAggregation.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pollAggregation.ts src/utils/pollAggregation.test.ts
git commit -m "feat(utils): add pollAggregation pure aggregator + PollState"
```

---

## Task 3: Add `allowPolls` field to `Space` + `canCreatePoll` helper

**Files:**
- Modify: `quorum-shared/src/types/space.ts`
- Modify: `quorum-shared/src/utils/permissions.ts`
- Test: `quorum-shared/src/utils/permissions.test.ts` (extend existing if present; else create)

- [ ] **Step 1: Write the failing test**

Append to `quorum-shared/src/utils/permissions.test.ts`:

```typescript
import { canCreatePoll } from './permissions';
import type { Space } from '../types/space';

const baseSpace = (overrides: Partial<Space> = {}): Space => ({
  spaceId: 's1',
  spaceName: 'Test',
  vanityUrl: '',
  inviteUrl: '',
  iconUrl: '',
  bannerUrl: '',
  defaultChannelId: 'c1',
  hubAddress: '',
  createdDate: 0,
  modifiedDate: 0,
  isRepudiable: false,
  isPublic: false,
  groups: [],
  roles: [],
  emojis: [],
  stickers: [],
  ...overrides,
} as Space);

describe('canCreatePoll', () => {
  it('returns true when allowPolls is undefined (back-compat default ON)', () => {
    expect(canCreatePoll(baseSpace(), 'addr1')).toBe(true);
  });

  it('returns true when allowPolls is true', () => {
    expect(canCreatePoll(baseSpace({ allowPolls: true } as Partial<Space>), 'addr1')).toBe(true);
  });

  it('returns false when allowPolls is explicitly false', () => {
    expect(canCreatePoll(baseSpace({ allowPolls: false } as Partial<Space>), 'addr1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @quilibrium/quorum-shared test src/utils/permissions.test.ts`
Expected: `canCreatePoll` not exported, OR `allowPolls` not on `Space` type.

- [ ] **Step 3: Add `allowPolls?: boolean` to `Space`**

In `quorum-shared/src/types/space.ts`, find the `Space` type definition and append `allowPolls?: boolean` to its body (next to other optional fields like `saveEditHistory?`):

```typescript
export type Space = {
  // ... existing fields ...
  saveEditHistory?: boolean;
  allowPolls?: boolean;
  groups: Group[];
  // ... rest ...
};
```

- [ ] **Step 4: Add `canCreatePoll` to permissions**

Append to `quorum-shared/src/utils/permissions.ts`:

```typescript
import type { Space } from '../types/space';

/**
 * Whether the current user can create polls in this Space.
 *
 * v1 gating: just the Space-level `allowPolls` toggle. Defaults to true when
 * undefined (back-compat for spaces created before the field existed).
 *
 * Final version: will also check a `poll:create` role permission.
 */
export function canCreatePoll(space: Space, _userAddress: string): boolean {
  return space.allowPolls !== false;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace @quilibrium/quorum-shared test src/utils/permissions.test.ts`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/space.ts src/utils/permissions.ts src/utils/permissions.test.ts
git commit -m "feat(types,permissions): add allowPolls to Space + canCreatePoll"
```

---

## Task 4: Add `validatePollQuestion` validator

**Files:**
- Create: `quorum-shared/src/validation/pollQuestion.ts`
- Create: `quorum-shared/src/validation/pollQuestion.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `quorum-shared/src/validation/pollQuestion.test.ts`:

```typescript
import { validatePollQuestion, MAX_POLL_QUESTION_LENGTH } from './pollQuestion';

describe('validatePollQuestion', () => {
  it('accepts a normal question', () => {
    expect(validatePollQuestion('What should we eat?')).toEqual({ ok: true });
  });

  it('rejects empty string', () => {
    const r = validatePollQuestion('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toBe('pollQuestion.required');
  });

  it('rejects whitespace-only', () => {
    const r = validatePollQuestion('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toBe('pollQuestion.required');
  });

  it(`rejects strings longer than ${MAX_POLL_QUESTION_LENGTH}`, () => {
    const r = validatePollQuestion('a'.repeat(MAX_POLL_QUESTION_LENGTH + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorKey).toBe('pollQuestion.tooLong');
      expect(r.errorVars).toEqual({ max: MAX_POLL_QUESTION_LENGTH });
    }
  });

  it('accepts exactly at the limit', () => {
    expect(validatePollQuestion('a'.repeat(MAX_POLL_QUESTION_LENGTH))).toEqual({ ok: true });
  });

  it('rejects HTML tag injection', () => {
    const r = validatePollQuestion('<script>alert(1)</script>');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toBe('pollQuestion.xss');
  });

  it('allows safe emoticons like <3 and ->', () => {
    expect(validatePollQuestion('Do you love it <3 ?')).toEqual({ ok: true });
    expect(validatePollQuestion('Pick A -> B')).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @quilibrium/quorum-shared test src/validation/pollQuestion.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement the validator**

Create `quorum-shared/src/validation/pollQuestion.ts`:

```typescript
import { validateNameForXSS } from '../utils/validation';

export const MAX_POLL_QUESTION_LENGTH = 300;

export type ValidationResult =
  | { ok: true }
  | { ok: false; errorKey: string; errorVars?: Record<string, unknown> };

export function validatePollQuestion(question: string): ValidationResult {
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return { ok: false, errorKey: 'pollQuestion.required' };
  }
  if (trimmed.length > MAX_POLL_QUESTION_LENGTH) {
    return {
      ok: false,
      errorKey: 'pollQuestion.tooLong',
      errorVars: { max: MAX_POLL_QUESTION_LENGTH },
    };
  }
  if (!validateNameForXSS(trimmed)) {
    return { ok: false, errorKey: 'pollQuestion.xss' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @quilibrium/quorum-shared test src/validation/pollQuestion.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/validation/pollQuestion.ts src/validation/pollQuestion.test.ts
git commit -m "feat(validation): add validatePollQuestion (300 chars, XSS-safe)"
```

---

## Task 5: Add `validatePollOption` validator

**Files:**
- Create: `quorum-shared/src/validation/pollOption.ts`
- Create: `quorum-shared/src/validation/pollOption.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `quorum-shared/src/validation/pollOption.test.ts`:

```typescript
import { validatePollOption, MAX_POLL_OPTION_LENGTH } from './pollOption';

describe('validatePollOption', () => {
  it('accepts a normal option', () => {
    expect(validatePollOption('Pizza')).toEqual({ ok: true });
  });

  it('rejects empty string', () => {
    const r = validatePollOption('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toBe('pollOption.required');
  });

  it('rejects whitespace-only', () => {
    const r = validatePollOption('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toBe('pollOption.required');
  });

  it(`rejects strings longer than ${MAX_POLL_OPTION_LENGTH}`, () => {
    const r = validatePollOption('a'.repeat(MAX_POLL_OPTION_LENGTH + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorKey).toBe('pollOption.tooLong');
      expect(r.errorVars).toEqual({ max: MAX_POLL_OPTION_LENGTH });
    }
  });

  it('accepts exactly at the limit', () => {
    expect(validatePollOption('a'.repeat(MAX_POLL_OPTION_LENGTH))).toEqual({ ok: true });
  });

  it('rejects HTML tag injection', () => {
    const r = validatePollOption('<img src=x onerror=1>');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toBe('pollOption.xss');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @quilibrium/quorum-shared test src/validation/pollOption.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement the validator**

Create `quorum-shared/src/validation/pollOption.ts`:

```typescript
import { validateNameForXSS } from '../utils/validation';

export const MAX_POLL_OPTION_LENGTH = 80;

export type ValidationResult =
  | { ok: true }
  | { ok: false; errorKey: string; errorVars?: Record<string, unknown> };

export function validatePollOption(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, errorKey: 'pollOption.required' };
  }
  if (trimmed.length > MAX_POLL_OPTION_LENGTH) {
    return {
      ok: false,
      errorKey: 'pollOption.tooLong',
      errorVars: { max: MAX_POLL_OPTION_LENGTH },
    };
  }
  if (!validateNameForXSS(trimmed)) {
    return { ok: false, errorKey: 'pollOption.xss' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @quilibrium/quorum-shared test src/validation/pollOption.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/validation/pollOption.ts src/validation/pollOption.test.ts
git commit -m "feat(validation): add validatePollOption (80 chars, XSS-safe)"
```

---

## Task 6: Register 3 new icons in the shared icon map (web + native)

**Files:**
- Modify: `quorum-shared/src/primitives/Icon/Icon.web.tsx`
- Modify: `quorum-shared/src/primitives/Icon/Icon.native.tsx`

> Verify file paths first — search for the existing icon-map files; the actual filenames may differ (`IconMap.ts`, `iconRegistry.ts`, etc.). Use `IconPaperclip` / `IconPhoto` / `IconPlus` as anchors since they're confirmed present.

- [ ] **Step 1: Find the icon-map files**

Run: `git grep -l "IconPaperclip" -- 'src/primitives/Icon/*'`
Expected: lists the two icon-map files (web + native).

- [ ] **Step 2: Add `chart-bar`, `circle`, `circle-check` to the web icon map**

In the web icon-map file, find where `IconPaperclip` is imported from `@tabler/icons-react` and add imports for the three new icons:

```typescript
import {
  // ... existing imports ...
  IconPaperclip,
  IconPhoto,
  IconPlus,
  IconChartBar,
  IconCircle,
  IconCircleCheck,
} from '@tabler/icons-react';
```

In the same file, find the icon-name → component map and add three entries (keep alphabetical ordering if the existing map is sorted):

```typescript
const iconMap = {
  // ... existing entries ...
  'paperclip': IconPaperclip,
  'photo': IconPhoto,
  'plus': IconPlus,
  'chart-bar': IconChartBar,
  'circle': IconCircle,
  'circle-check': IconCircleCheck,
};
```

- [ ] **Step 3: Add the same three to the native icon map**

In the native icon-map file (typically uses `@tabler/icons-react-native`), add identical imports and map entries.

- [ ] **Step 4: Update the IconName type union if present**

If there's an `IconName` type literal union (likely in the same file or in `quorum-shared/src/primitives/Icon/types.ts`), add `'chart-bar' | 'circle' | 'circle-check'` to it.

- [ ] **Step 5: Smoke-test with a tsc + build**

Run: `yarn workspace @quilibrium/quorum-shared build`
Expected: builds cleanly. If `IconName` is enforced as a union, this confirms the three new strings are valid.

- [ ] **Step 6: Commit**

```bash
git add src/primitives/Icon/
git commit -m "feat(icons): register chart-bar, circle, circle-check"
```

---

## Task 7: Export new symbols, bump version, publish

**Files:**
- Modify: `quorum-shared/src/index.ts`
- Modify: `quorum-shared/package.json`

- [ ] **Step 1: Add barrel exports**

In `quorum-shared/src/index.ts`, append (or insert into the existing organized exports):

```typescript
// Poll types
export type {
  PollMessage,
  VoteMessage,
  ClosePollMessage,
  EditPollMessage,
} from './types/message';

// Poll aggregation
export {
  aggregatePollState,
  type PollState,
  type PollVoteEntry,
  type AggregationContext,
} from './utils/pollAggregation';

// Poll permissions
export { canCreatePoll } from './utils/permissions';

// Poll validation
export {
  validatePollQuestion,
  MAX_POLL_QUESTION_LENGTH,
} from './validation/pollQuestion';
export {
  validatePollOption,
  MAX_POLL_OPTION_LENGTH,
} from './validation/pollOption';
```

- [ ] **Step 2: Bump version**

In `quorum-shared/package.json`, change the `version` field from the current value (e.g. `2.1.0-21`) to `2.1.0-22`.

- [ ] **Step 3: Run the full shared test suite + build**

Run: `yarn workspace @quilibrium/quorum-shared test && yarn workspace @quilibrium/quorum-shared build`
Expected: all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat(polls): export poll types, aggregator, validators; bump 2.1.0-22"
```

- [ ] **Step 5: Open PR + publish**

Follow [`cross-repo-workflow.md`](quorum-shared-migration/cross-repo-workflow.md) for the shared-PR publish flow. Once merged and published to npm, Phase B can consume `@quilibrium/quorum-shared@2.1.0-22`.

---

# Phase B — `quorum-desktop`

> All tasks below execute in this repo (`quorum-desktop`).

---

## Task 8: Bump shared dependency to `2.1.0-22` + verify types

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (regenerated)

- [ ] **Step 1: Bump the dependency**

In `package.json`, find `@quilibrium/quorum-shared` and bump to `2.1.0-22`:

```json
"@quilibrium/quorum-shared": "2.1.0-22",
```

- [ ] **Step 2: Install**

Run: `yarn install`
Expected: lockfile updated; no peer-dep warnings about polls.

- [ ] **Step 3: Smoke-test the new exports resolve**

Create a temporary file `src/__poll-smoke.ts`:

```typescript
import {
  aggregatePollState,
  canCreatePoll,
  validatePollQuestion,
  validatePollOption,
  MAX_POLL_QUESTION_LENGTH,
  MAX_POLL_OPTION_LENGTH,
  type PollMessage,
  type VoteMessage,
  type ClosePollMessage,
  type EditPollMessage,
  type PollState,
} from '@quilibrium/quorum-shared';

const _check: PollMessage = {
  senderId: 's',
  type: 'poll',
  pollId: 'p',
  question: 'Q',
  options: [{ optionId: 'o', text: 'A' }],
  mode: 'single',
};
void [aggregatePollState, canCreatePoll, validatePollQuestion, validatePollOption,
      MAX_POLL_QUESTION_LENGTH, MAX_POLL_OPTION_LENGTH, _check];
```

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck src/__poll-smoke.ts`
Expected: no errors.

- [ ] **Step 4: Delete the smoke file and commit**

```bash
rm src/__poll-smoke.ts
git add package.json yarn.lock
git commit -m "chore(deps): bump @quilibrium/quorum-shared to 2.1.0-22"
```

---

## Task 9: Wire `aggregatePollState` into MessageDB read path

**Files:**
- Modify: `src/db/messages.ts`
- Test: `src/db/messages.poll.test.ts` (new test file scoped to poll read materialization)

> Goal: when a `PollMessage` is read out of IndexedDB, attach `pollState` derived from sibling vote/close/edit messages. Mirror the pattern that already attaches `reactions[]`.

- [ ] **Step 1: Locate the message materializer**

Run: `git grep -nE "reactions\s*[:=]|message\.reactions" -- src/db/messages.ts`
Expected: shows where `reactions` is populated on read. The poll materialization slots into the same point.

- [ ] **Step 2: Write a failing integration test**

Create `src/db/messages.poll.test.ts`:

```typescript
import { MessageDB } from './messages';
import type { Message, PollMessage, VoteMessage } from '@quilibrium/quorum-shared';

describe('MessageDB poll state materialization', () => {
  let db: MessageDB;

  beforeEach(async () => {
    db = new MessageDB();
    await db.init();
  });

  afterEach(async () => {
    // teardown — adapt to whatever the existing tests use
  });

  it('attaches pollState to a PollMessage based on sibling VoteMessages', async () => {
    const poll: Message = {
      channelId: 'c1',
      spaceId: 's1',
      messageId: 'pollMsg1',
      digestAlgorithm: 'sha256',
      nonce: 'n',
      createdDate: 1000,
      modifiedDate: 1000,
      lastModifiedHash: 'h',
      content: {
        senderId: 'author',
        type: 'poll',
        pollId: 'p1',
        question: 'Q?',
        options: [
          { optionId: 'o1', text: 'A' },
          { optionId: 'o2', text: 'B' },
        ],
        mode: 'single',
      } as PollMessage,
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    };

    const vote: Message = {
      channelId: 'c1',
      spaceId: 's1',
      messageId: 'voteMsg1',
      digestAlgorithm: 'sha256',
      nonce: 'n',
      createdDate: 2000,
      modifiedDate: 2000,
      lastModifiedHash: 'h',
      content: {
        senderId: 'alice',
        type: 'vote',
        pollMessageId: 'pollMsg1',
        optionId: 'o1',
        votedAt: 2000,
      } as VoteMessage,
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    };

    await db.saveMessage(poll);
    await db.saveMessage(vote);

    const { messages } = await db.getMessages({ spaceId: 's1', channelId: 'c1' });
    const pollOut = messages.find(m => m.messageId === 'pollMsg1');
    expect(pollOut?.pollState).toBeDefined();
    expect(pollOut?.pollState?.votes).toHaveLength(1);
    expect(pollOut?.pollState?.votes[0].optionId).toBe('o1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test src/db/messages.poll.test.ts`
Expected: `pollState` is undefined.

- [ ] **Step 4: Add `pollState?: PollState` to the `Message` type alias**

In `src/db/messages.ts` (or wherever `Message` is locally re-exported / extended), ensure the read path can attach `pollState`. If `Message` comes from shared and shared's `Message` type doesn't yet have `pollState?`, add it to shared in a small follow-up (or use a desktop-local extension `MessageWithPollState`). Prefer adding to shared.

> **Stop and decide:** the cleanest path is to add `pollState?: PollState` to the `Message` type in `quorum-shared/src/types/message.ts` (and re-publish `2.1.0-23`). Alternative: desktop-local extension. **Recommendation:** add to shared. Open a small follow-up shared PR before continuing this task. For this plan we assume `pollState?: PollState` is on shared's `Message` type as of `2.1.0-23`. If skipping, declare a local type extension here.

- [ ] **Step 5: Implement the read-path attachment**

In `src/db/messages.ts`, find the function that reads messages out of IndexedDB and post-processes them (the same place `reactions` gets attached or finalized). Add poll-state aggregation:

```typescript
import { aggregatePollState } from '@quilibrium/quorum-shared';
import type {
  PollMessage,
  VoteMessage,
  ClosePollMessage,
  EditPollMessage,
} from '@quilibrium/quorum-shared';

// Inside the getMessages-style function, after raw rows are fetched:

function attachPollState(messages: Message[]): Message[] {
  // Group by parent pollMessageId so we don't scan O(N) per poll
  const votesByPoll = new Map<string, VoteMessage[]>();
  const closesByPoll = new Map<string, ClosePollMessage[]>();
  const editsByPoll = new Map<string, EditPollMessage[]>();
  const closeMsgDateByPoll = new Map<string, number>();

  for (const m of messages) {
    const c = m.content;
    if (c.type === 'vote') {
      const arr = votesByPoll.get(c.pollMessageId) ?? [];
      arr.push(c);
      votesByPoll.set(c.pollMessageId, arr);
    } else if (c.type === 'close-poll') {
      const arr = closesByPoll.get(c.pollMessageId) ?? [];
      arr.push(c);
      closesByPoll.set(c.pollMessageId, arr);
      // Use the close-poll Message's createdDate as closedAt
      const prev = closeMsgDateByPoll.get(c.pollMessageId);
      if (prev === undefined || m.createdDate < prev) {
        closeMsgDateByPoll.set(c.pollMessageId, m.createdDate);
      }
    } else if (c.type === 'edit-poll') {
      const arr = editsByPoll.get(c.pollMessageId) ?? [];
      arr.push(c);
      editsByPoll.set(c.pollMessageId, arr);
    }
  }

  return messages.map(m => {
    if (m.content.type !== 'poll') return m;
    const id = m.messageId;
    const pollState = aggregatePollState(
      m.content as PollMessage,
      votesByPoll.get(id) ?? [],
      closesByPoll.get(id) ?? [],
      editsByPoll.get(id) ?? [],
      { closedAt: closeMsgDateByPoll.get(id) }
    );
    return { ...m, pollState };
  });
}
```

Call `attachPollState(messages)` on the message array before returning from `getMessages`.

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn test src/db/messages.poll.test.ts`
Expected: pass.

- [ ] **Step 7: Run full test suite to catch regressions**

Run: `yarn test --run`
Expected: no new failures.

- [ ] **Step 8: Commit**

```bash
git add src/db/messages.ts src/db/messages.poll.test.ts
git commit -m "feat(db): attach pollState to poll messages on read"
```

---

## Task 10: Add send methods to `MessageService` (sendPoll, sendVote, sendClosePoll, sendEditPoll)

**Files:**
- Modify: `src/services/MessageService.ts`

> Mirror the existing reaction-send pattern. Each method builds the content, calls the existing message-send pipeline (encryption + signing + action-queue enqueue), updates optimistic local state.

- [ ] **Step 1: Locate the reaction-send method as the reference pattern**

Run: `git grep -n "sendReaction\|addReaction" -- src/services/MessageService.ts`
Expected: identifies the function that emits a `ReactionMessage` via the existing send pipeline. Read its signature and follow its pattern exactly.

- [ ] **Step 2: Add the four send methods**

Append to `MessageService.ts` (near other send methods like `sendReaction`):

```typescript
import {
  validatePollQuestion,
  validatePollOption,
  type PollMessage,
  type VoteMessage,
  type ClosePollMessage,
  type EditPollMessage,
} from '@quilibrium/quorum-shared';

async sendPoll(
  spaceId: string,
  channelId: string,
  question: string,
  options: Array<{ text: string }>,
  repliesToMessageId?: string
): Promise<{ messageId: string } | { error: string }> {
  // Service-layer validation (defense-in-depth)
  const qRes = validatePollQuestion(question);
  if (!qRes.ok) return { error: qRes.errorKey };
  if (options.length < 2 || options.length > 10) {
    return { error: 'pollOptions.countOutOfRange' };
  }
  const seen = new Set<string>();
  for (const o of options) {
    const oRes = validatePollOption(o.text);
    if (!oRes.ok) return { error: oRes.errorKey };
    const key = o.text.trim().toLowerCase();
    if (seen.has(key)) return { error: 'pollOptions.duplicate' };
    seen.add(key);
  }

  const senderAddress = this.getCurrentUserAddress();
  const content: PollMessage = {
    senderId: senderAddress,
    type: 'poll',
    pollId: crypto.randomUUID(),
    question: question.trim(),
    options: options.map(o => ({
      optionId: crypto.randomUUID(),
      text: o.text.trim(),
    })),
    mode: 'single',
    ...(repliesToMessageId ? { repliesToMessageId } : {}),
  };

  return this.sendMessageContent(spaceId, channelId, content);
},

async sendVote(
  spaceId: string,
  channelId: string,
  pollMessageId: string,
  optionId: string | null
): Promise<{ messageId: string } | { error: string }> {
  const senderAddress = this.getCurrentUserAddress();
  const content: VoteMessage = {
    senderId: senderAddress,
    type: 'vote',
    pollMessageId,
    optionId,
    votedAt: Date.now(),
  };
  return this.sendMessageContent(spaceId, channelId, content);
},

async sendClosePoll(
  spaceId: string,
  channelId: string,
  pollMessageId: string
): Promise<{ messageId: string } | { error: string }> {
  const senderAddress = this.getCurrentUserAddress();
  const content: ClosePollMessage = {
    senderId: senderAddress,
    type: 'close-poll',
    pollMessageId,
  };
  return this.sendMessageContent(spaceId, channelId, content);
},

async sendEditPoll(
  spaceId: string,
  channelId: string,
  pollMessageId: string,
  editedQuestion: string
): Promise<{ messageId: string } | { error: string }> {
  const qRes = validatePollQuestion(editedQuestion);
  if (!qRes.ok) return { error: qRes.errorKey };

  const senderAddress = this.getCurrentUserAddress();
  const content: EditPollMessage = {
    senderId: senderAddress,
    type: 'edit-poll',
    pollMessageId,
    editedQuestion: editedQuestion.trim(),
    editedAt: Date.now(),
    editNonce: crypto.randomUUID(),
  };
  return this.sendMessageContent(spaceId, channelId, content);
},
```

> If `sendMessageContent` (or whatever the internal pipeline is named) takes a different signature, adapt the calls to match. Use the reaction-send method as the source of truth for argument order and error shape.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "feat(message-service): add sendPoll, sendVote, sendClosePoll, sendEditPoll"
```

---

## Task 11: Add receive handlers to `MessageService` (4 new content types)

**Files:**
- Modify: `src/services/MessageService.ts` (two long if/else chains — see step 1)

> The existing receive-handler has TWO long `if/else if` chains for `decryptedContent.content.type`:
> - One around `MessageService.ts:739-1153` (initial-receive path).
> - One around `MessageService.ts:1270-1699` (a second processing path).
> Both need new branches.

- [ ] **Step 1: Write the failing test**

Create `src/services/MessageService.poll.test.ts`:

```typescript
import { MessageService } from './MessageService';

describe('MessageService poll receive handlers', () => {
  it('drops a PollMessage with empty question', async () => {
    const svc = new MessageService(/* mocks */);
    const incoming = {
      content: {
        senderId: 'attacker',
        type: 'poll',
        pollId: 'p',
        question: '',
        options: [
          { optionId: 'o1', text: 'A' },
          { optionId: 'o2', text: 'B' },
        ],
        mode: 'single',
      },
    };
    const result = await svc.handleIncomingPoll(incoming as any);
    expect(result).toBe('rejected');
  });

  it('drops a PollMessage with < 2 options', async () => {
    const svc = new MessageService(/* mocks */);
    const incoming = {
      content: {
        senderId: 'attacker',
        type: 'poll',
        pollId: 'p',
        question: 'Q',
        options: [{ optionId: 'o1', text: 'A' }],
        mode: 'single',
      },
    };
    expect(await svc.handleIncomingPoll(incoming as any)).toBe('rejected');
  });

  it('drops a PollMessage with duplicate option text', async () => {
    const svc = new MessageService(/* mocks */);
    const incoming = {
      content: {
        senderId: 'attacker',
        type: 'poll',
        pollId: 'p',
        question: 'Q',
        options: [
          { optionId: 'o1', text: 'Pizza' },
          { optionId: 'o2', text: 'pizza' }, // case-insensitive dup
        ],
        mode: 'single',
      },
    };
    expect(await svc.handleIncomingPoll(incoming as any)).toBe('rejected');
  });

  it('drops a VoteMessage referencing an unknown poll', async () => {
    const svc = new MessageService(/* mocks */);
    const incoming = {
      content: {
        senderId: 'alice',
        type: 'vote',
        pollMessageId: 'nonexistent',
        optionId: 'o1',
        votedAt: 1000,
      },
    };
    expect(await svc.handleIncomingVote(incoming as any)).toBe('rejected');
  });

  it('drops a poll when space.allowPolls === false', async () => {
    const svc = new MessageService(/* mocks with space.allowPolls = false */);
    const incoming = {
      content: {
        senderId: 's',
        type: 'poll',
        pollId: 'p',
        question: 'Q',
        options: [{ optionId: 'o1', text: 'A' }, { optionId: 'o2', text: 'B' }],
        mode: 'single',
      },
    };
    expect(await svc.handleIncomingPoll(incoming as any)).toBe('rejected');
  });
});
```

> The test sketches above use placeholder constructor signatures. Match them to MessageService's actual test pattern — search for `MessageService.test.ts` and follow its mock setup. If MessageService doesn't have unit tests today, defer these to integration tests in step 6.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/services/MessageService.poll.test.ts`
Expected: `handleIncomingPoll` not defined.

- [ ] **Step 3: Implement `handleIncomingPoll`**

Append to `MessageService.ts`:

```typescript
private async handleIncomingPoll(
  decryptedContent: { content: PollMessage; spaceId: string; channelId: string; /* ... */ }
): Promise<'accepted' | 'rejected'> {
  const c = decryptedContent.content;

  // Defense-in-depth validation
  const qRes = validatePollQuestion(c.question);
  if (!qRes.ok) {
    console.log(`🔒 Rejecting poll: invalid question from ${c.senderId}`);
    return 'rejected';
  }
  if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 10) {
    console.log(`🔒 Rejecting poll: option count out of range from ${c.senderId}`);
    return 'rejected';
  }
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  for (const o of c.options) {
    const oRes = validatePollOption(o.text);
    if (!oRes.ok) {
      console.log(`🔒 Rejecting poll: invalid option from ${c.senderId}`);
      return 'rejected';
    }
    const key = o.text.trim().toLowerCase();
    if (seen.has(key)) return 'rejected';
    if (seenIds.has(o.optionId)) return 'rejected';
    seen.add(key);
    seenIds.add(o.optionId);
  }

  // Space-level toggle
  const space = await this.getSpace(decryptedContent.spaceId);
  if (space && space.allowPolls === false) {
    console.log(`🔒 Rejecting poll: allowPolls=false in space ${decryptedContent.spaceId}`);
    return 'rejected';
  }

  // Save as a normal message
  await this.saveMessage(decryptedContent as any);
  return 'accepted';
}
```

- [ ] **Step 4: Implement `handleIncomingVote`, `handleIncomingClosePoll`, `handleIncomingEditPoll`**

```typescript
private async handleIncomingVote(
  decryptedContent: { content: VoteMessage; spaceId: string; channelId: string; }
): Promise<'accepted' | 'rejected'> {
  const c = decryptedContent.content;

  // Parent poll must exist (or arrive later — see step 6 for out-of-order handling)
  const parent = await this.getMessage(c.pollMessageId);
  if (parent) {
    if (parent.content.type !== 'poll') return 'rejected';
    if (c.optionId !== null) {
      const validId = parent.content.options.some(o => o.optionId === c.optionId);
      if (!validId) return 'rejected';
    }
  }
  // If parent doesn't exist yet, accept the vote — aggregation handles late arrivals

  // Per-sender rate limit (reuse existing limiter pattern)
  if (!this.voteRateLimiter.canSend(c.senderId).allowed) {
    console.log(`🔒 Rate-limiting votes from ${c.senderId}`);
    return 'rejected';
  }

  await this.saveMessage(decryptedContent as any);
  return 'accepted';
}

private async handleIncomingClosePoll(
  decryptedContent: { content: ClosePollMessage; spaceId: string; channelId: string; }
): Promise<'accepted' | 'rejected'> {
  const c = decryptedContent.content;
  const parent = await this.getMessage(c.pollMessageId);
  if (parent) {
    if (parent.content.type !== 'poll') return 'rejected';
    // Only the poll author can close in v1
    if (parent.content.senderId !== c.senderId) {
      console.log(`🔒 Rejecting close-poll: non-author ${c.senderId}`);
      return 'rejected';
    }
  }
  await this.saveMessage(decryptedContent as any);
  return 'accepted';
}

private async handleIncomingEditPoll(
  decryptedContent: { content: EditPollMessage; spaceId: string; channelId: string; }
): Promise<'accepted' | 'rejected'> {
  const c = decryptedContent.content;
  const qRes = validatePollQuestion(c.editedQuestion);
  if (!qRes.ok) return 'rejected';
  const parent = await this.getMessage(c.pollMessageId);
  if (parent) {
    if (parent.content.type !== 'poll') return 'rejected';
    if (parent.content.senderId !== c.senderId) return 'rejected';
  }
  await this.saveMessage(decryptedContent as any);
  return 'accepted';
}
```

Add `voteRateLimiter` as a class field using the same `SimpleRateLimiter` class found at `src/utils/rateLimit.ts`. Settings: 10 votes per 10 seconds per sender (matches existing message-receiving limiter).

- [ ] **Step 5: Wire the new handlers into both if/else chains**

In `MessageService.ts`, the receive-handler if/else chain around line 739 ends with:

```typescript
} else if (decryptedContent.content.type === 'update-profile') {
  // ...
}
```

Append:

```typescript
} else if (decryptedContent.content.type === 'poll') {
  await this.handleIncomingPoll(decryptedContent);
} else if (decryptedContent.content.type === 'vote') {
  await this.handleIncomingVote(decryptedContent);
} else if (decryptedContent.content.type === 'close-poll') {
  await this.handleIncomingClosePoll(decryptedContent);
} else if (decryptedContent.content.type === 'edit-poll') {
  await this.handleIncomingEditPoll(decryptedContent);
}
```

Repeat the same four branches in the second if/else chain around line 1270.

- [ ] **Step 6: Run tests**

Run: `yarn test src/services/MessageService.poll.test.ts`
Expected: all pass.
Run: `yarn test --run`
Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/services/MessageService.ts src/services/MessageService.poll.test.ts
git commit -m "feat(message-service): add receive handlers for poll/vote/close-poll/edit-poll"
```

---

## Task 12: Add `usePollVoting` and `usePollCreation` hooks

**Files:**
- Create: `src/hooks/business/polls/usePollVoting.ts`
- Create: `src/hooks/business/polls/usePollCreation.ts`
- Create: `src/hooks/business/polls/index.ts`

- [ ] **Step 1: Implement `usePollVoting`**

Create `src/hooks/business/polls/usePollVoting.ts`:

```typescript
import { useCallback } from 'react';
import { useMessageDB } from '../../../components/context/MessageDB';

export function usePollVoting(spaceId: string, channelId: string) {
  const messageDB = useMessageDB();

  const castVote = useCallback(
    async (pollMessageId: string, optionId: string) => {
      return messageDB.messageService.sendVote(
        spaceId,
        channelId,
        pollMessageId,
        optionId
      );
    },
    [messageDB, spaceId, channelId]
  );

  const retractVote = useCallback(
    async (pollMessageId: string) => {
      return messageDB.messageService.sendVote(
        spaceId,
        channelId,
        pollMessageId,
        null
      );
    },
    [messageDB, spaceId, channelId]
  );

  const closePoll = useCallback(
    async (pollMessageId: string) => {
      return messageDB.messageService.sendClosePoll(
        spaceId,
        channelId,
        pollMessageId
      );
    },
    [messageDB, spaceId, channelId]
  );

  const editPollQuestion = useCallback(
    async (pollMessageId: string, editedQuestion: string) => {
      return messageDB.messageService.sendEditPoll(
        spaceId,
        channelId,
        pollMessageId,
        editedQuestion
      );
    },
    [messageDB, spaceId, channelId]
  );

  return { castVote, retractVote, closePoll, editPollQuestion };
}
```

> Adapt the `useMessageDB` import path to match this codebase. If `messageService` is exposed differently (e.g., as the context value itself), adjust accordingly. Cross-reference an existing hook like `useReactions` in `src/hooks/business/messages/` for the exact pattern.

- [ ] **Step 2: Implement `usePollCreation`**

Create `src/hooks/business/polls/usePollCreation.ts`:

```typescript
import { useCallback, useState } from 'react';
import {
  validatePollQuestion,
  validatePollOption,
} from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/MessageDB';

export type PollDraft = {
  question: string;
  options: Array<{ text: string }>;
};

export type PollSubmitResult =
  | { ok: true; messageId: string }
  | { ok: false; errorKey: string };

export function usePollCreation(spaceId: string, channelId: string) {
  const messageDB = useMessageDB();
  const [submitting, setSubmitting] = useState(false);

  const validateDraft = useCallback((draft: PollDraft): PollSubmitResult | null => {
    const qRes = validatePollQuestion(draft.question);
    if (!qRes.ok) return { ok: false, errorKey: qRes.errorKey };

    if (draft.options.length < 2) {
      return { ok: false, errorKey: 'pollOptions.tooFew' };
    }
    if (draft.options.length > 10) {
      return { ok: false, errorKey: 'pollOptions.tooMany' };
    }

    const seen = new Set<string>();
    for (const o of draft.options) {
      const oRes = validatePollOption(o.text);
      if (!oRes.ok) return { ok: false, errorKey: oRes.errorKey };
      const key = o.text.trim().toLowerCase();
      if (seen.has(key)) return { ok: false, errorKey: 'pollOptions.duplicate' };
      seen.add(key);
    }
    return null;
  }, []);

  const submitPoll = useCallback(
    async (draft: PollDraft, repliesToMessageId?: string): Promise<PollSubmitResult> => {
      const validationFailure = validateDraft(draft);
      if (validationFailure) return validationFailure;

      setSubmitting(true);
      try {
        const result = await messageDB.messageService.sendPoll(
          spaceId,
          channelId,
          draft.question,
          draft.options,
          repliesToMessageId
        );
        if ('error' in result) return { ok: false, errorKey: result.error };
        return { ok: true, messageId: result.messageId };
      } finally {
        setSubmitting(false);
      }
    },
    [messageDB, spaceId, channelId, validateDraft]
  );

  return { submitPoll, validateDraft, submitting };
}
```

- [ ] **Step 3: Add barrel export**

Create `src/hooks/business/polls/index.ts`:

```typescript
export { usePollVoting } from './usePollVoting';
export { usePollCreation, type PollDraft, type PollSubmitResult } from './usePollCreation';
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/business/polls/
git commit -m "feat(hooks): add usePollVoting + usePollCreation"
```

---

## Task 13: Create `PollOptionRow` component

**Files:**
- Create: `src/components/message/PollOptionRow.tsx`

> Renders one option row: leading selection icon (circle / circle-check), option text, optional progress bar + percentage + count, optional winner star. Click handler is passed in by the parent.

- [ ] **Step 1: Implement the component**

Create `src/components/message/PollOptionRow.tsx`:

```typescript
import React from 'react';
import { Icon } from '../primitives';

export type PollOptionRowProps = {
  optionId: string;
  text: string;
  isSelected: boolean;
  /** When true, show bars + %, + count. Hidden until user has voted (State A). */
  showResults: boolean;
  /** When true, row is non-interactive (poll closed). */
  disabled: boolean;
  /** When true, decorate with a winner star (closed state only). */
  isWinner: boolean;
  voteCount: number;
  totalVotes: number;
  onClick: (optionId: string) => void;
};

export const PollOptionRow: React.FC<PollOptionRowProps> = ({
  optionId,
  text,
  isSelected,
  showResults,
  disabled,
  isWinner,
  voteCount,
  totalVotes,
  onClick,
}) => {
  const percentage =
    totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100);

  const handleClick = () => {
    if (!disabled) onClick(optionId);
  };

  return (
    <div
      className={`poll-option-row ${isSelected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
      role="radio"
      aria-checked={isSelected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <Icon
        name={isSelected ? 'circle-check' : 'circle'}
        size="md"
        className="poll-option-row__selector"
      />
      <span className="poll-option-row__text">{text}</span>
      {isWinner && <span className="poll-option-row__winner" aria-label="Winner">★</span>}
      {showResults && (
        <>
          <span className="poll-option-row__count">
            {voteCount} ({percentage}%)
          </span>
          <div className="poll-option-row__bar" aria-hidden="true">
            <div
              className="poll-option-row__bar-fill"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/message/PollOptionRow.tsx
git commit -m "feat(message): add PollOptionRow component"
```

---

## Task 14: Create `PollMessageRenderer` component + SCSS

**Files:**
- Create: `src/components/message/PollMessageRenderer.tsx`
- Create: `src/components/message/PollMessageRenderer.scss`

> Renders the full poll card in states A (haven't voted), B (voted, open), C (closed). Uses `PollOptionRow` per option. Includes "View votes →" link, status pill, and total-votes line.

- [ ] **Step 1: Implement the component**

Create `src/components/message/PollMessageRenderer.tsx`:

```typescript
import React, { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { Icon } from '../primitives';
import { PollOptionRow } from './PollOptionRow';
import { PollResultsModal } from '../modals/PollResultsModal';
import { usePollVoting } from '../../hooks/business/polls';
import type { Message, PollMessage } from '@quilibrium/quorum-shared';
import './PollMessageRenderer.scss';

type Props = {
  message: Message;
  currentUserAddress: string;
};

export const PollMessageRenderer: React.FC<Props> = ({ message, currentUserAddress }) => {
  const [resultsOpen, setResultsOpen] = useState(false);
  const { castVote, retractVote } = usePollVoting(message.spaceId, message.channelId);

  const content = message.content as PollMessage;
  const pollState = message.pollState;

  // Memoize tally per option
  const tally = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of content.options) map.set(o.optionId, 0);
    for (const v of pollState?.votes ?? []) {
      map.set(v.optionId, (map.get(v.optionId) ?? 0) + 1);
    }
    return map;
  }, [content.options, pollState]);

  const userVote = pollState?.votes.find(v => v.voterAddress === currentUserAddress);
  const totalVotes = pollState?.votes.length ?? 0;
  const isClosed = pollState?.isClosed ?? false;
  const isAuthor = content.senderId === currentUserAddress;
  // Author always sees results (per open-question default in spec)
  const showResults = isClosed || !!userVote || isAuthor;

  const winners = useMemo(() => {
    if (!isClosed || totalVotes === 0) return new Set<string>();
    const max = Math.max(...content.options.map(o => tally.get(o.optionId) ?? 0));
    if (max === 0) return new Set<string>();
    return new Set(content.options.filter(o => tally.get(o.optionId) === max).map(o => o.optionId));
  }, [isClosed, tally, content.options, totalVotes]);

  const handleOptionClick = (optionId: string) => {
    if (isClosed) return;
    if (userVote?.optionId === optionId) {
      retractVote(message.messageId);
    } else {
      castVote(message.messageId, optionId);
    }
  };

  return (
    <>
      <div className="poll-card" role="radiogroup" aria-label={content.question}>
        <div className="poll-card__header">
          <Icon name="chart-bar" size="sm" />
          <span className="poll-card__header-label"><Trans>Poll</Trans></span>
          {isClosed && (
            <span className="poll-card__status-pill poll-card__status-pill--closed">
              <Trans>Closed</Trans>
            </span>
          )}
        </div>

        <p className="poll-card__question">{content.question}</p>

        <div className="poll-card__options">
          {content.options.map(opt => (
            <PollOptionRow
              key={opt.optionId}
              optionId={opt.optionId}
              text={opt.text}
              isSelected={userVote?.optionId === opt.optionId}
              showResults={showResults}
              disabled={isClosed}
              isWinner={winners.has(opt.optionId)}
              voteCount={tally.get(opt.optionId) ?? 0}
              totalVotes={totalVotes}
              onClick={handleOptionClick}
            />
          ))}
        </div>

        <div className="poll-card__footer">
          <span className="poll-card__meta">
            <Trans>{totalVotes} votes</Trans>
            {' · '}
            {isClosed ? <Trans>Closed</Trans> : <Trans>Open</Trans>}
          </span>
          {showResults && totalVotes > 0 && (
            <button
              type="button"
              className="poll-card__view-votes"
              onClick={() => setResultsOpen(true)}
            >
              <Trans>View votes →</Trans>
            </button>
          )}
        </div>
      </div>

      {resultsOpen && (
        <PollResultsModal
          isOpen={resultsOpen}
          onClose={() => setResultsOpen(false)}
          pollMessage={message}
        />
      )}
    </>
  );
};
```

- [ ] **Step 2: Create the SCSS**

Create `src/components/message/PollMessageRenderer.scss`:

```scss
@import '../../styles/variables';

.poll-card {
  background-color: var(--surface-2);
  border: 1px solid var(--surface-5);
  border-radius: 12px;
  padding: 12px 14px;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-subtle);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__header-label {
    font-weight: 600;
  }

  &__status-pill {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 999px;
    background-color: var(--surface-3);
    color: var(--color-text-subtle);
    font-size: 11px;

    &--closed {
      background-color: var(--surface-4);
    }
  }

  &__question {
    font-size: 15px;
    font-weight: 500;
    margin: 0;
    color: var(--color-text-strong);
    overflow-wrap: anywhere;
  }

  &__options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 4px;
    color: var(--color-text-subtle);
    font-size: 13px;
  }

  &__view-votes {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-accent);
    font-size: 13px;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.poll-option-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  position: relative;

  &:hover:not(.is-disabled) {
    background-color: var(--surface-3);
  }

  &.is-selected {
    background-color: color-mix(in srgb, var(--color-accent) 10%, transparent);
  }

  &.is-disabled {
    cursor: default;
  }

  &__selector {
    color: var(--color-text-subtle);

    .is-selected & {
      color: var(--color-accent);
    }
  }

  &__text {
    color: var(--color-text-strong);
    overflow-wrap: anywhere;
  }

  &__winner {
    color: var(--color-accent);
    font-size: 14px;
  }

  &__count {
    color: var(--color-text-subtle);
    font-size: 12px;
    white-space: nowrap;
  }

  &__bar {
    grid-column: 1 / -1;
    height: 4px;
    background-color: var(--surface-3);
    border-radius: 2px;
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    background-color: var(--color-accent);
    transition: width 200ms ease-out;
  }
}
```

> If `color-mix` is not used elsewhere in this codebase, replace with a hardcoded accent-tint variable from `_colors.scss` (e.g. `--color-accent-tint`). Check `src/styles/_colors.scss` for the right token.

- [ ] **Step 3: TypeScript + build check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build`
Expected: no errors. SCSS compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/components/message/PollMessageRenderer.tsx src/components/message/PollMessageRenderer.scss
git commit -m "feat(message): add PollMessageRenderer card (states A/B/C)"
```

---

## Task 15: Wire `PollMessageRenderer` into `Message.tsx` dispatch

**Files:**
- Modify: `src/components/message/Message.tsx`

- [ ] **Step 1: Find the content-type dispatch**

Run: `git grep -n "content\.type" -- src/components/message/Message.tsx`
Expected: `Message.tsx:577-586` and `Message.tsx:926` regions where content type is branched. The render path that decides "what to put in the message body" is around line 586+.

- [ ] **Step 2: Add the poll branch**

In `src/components/message/Message.tsx`, find the branch that renders post / embed / sticker content (around the block that handles `!['join', 'leave', 'kick'].includes(message.content.type)`). Add a poll case:

```typescript
import { PollMessageRenderer } from './PollMessageRenderer';

// inside the body-render section:
{message.content.type === 'poll' && (
  <PollMessageRenderer
    message={message}
    currentUserAddress={currentUserAddress}
  />
)}

{/* Existing post/embed/sticker rendering — exclude when type is poll */}
{message.content.type !== 'poll' &&
 message.content.type !== 'vote' &&
 message.content.type !== 'close-poll' &&
 message.content.type !== 'edit-poll' &&
 !['join', 'leave', 'kick'].includes(message.content.type) && (
   // ... existing content rendering ...
)}
```

> `currentUserAddress` should already be available in this scope from the existing message-display logic. If not, pull it from the same hook/context the message uses for "is this message mine."

Also: `vote`, `close-poll`, and `edit-poll` are **invisible** events — they update the parent poll's `pollState` but never render themselves in the feed. Add a top-level guard near the start of the render function:

```typescript
// At the top of Message.tsx render body, before any rendering work:
if (
  message.content.type === 'vote' ||
  message.content.type === 'close-poll' ||
  message.content.type === 'edit-poll'
) {
  return null;
}
```

- [ ] **Step 3: Build and smoke-test in the dev server**

Run: `yarn build`
Expected: no errors.

Run: `yarn dev` (ask the user to start it) and verify that an existing channel still renders normally (no poll messages yet — just verifying no regression).

- [ ] **Step 4: Commit**

```bash
git add src/components/message/Message.tsx
git commit -m "feat(message): dispatch to PollMessageRenderer; hide vote/close/edit events"
```

---

## Task 16: Create `CreatePollModal`

**Files:**
- Create: `src/components/modals/CreatePollModal.tsx`
- Create: `src/components/modals/CreatePollModal.scss`

- [ ] **Step 1: Implement the modal**

Create `src/components/modals/CreatePollModal.tsx`:

```typescript
import React, { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Modal, Button, Input, Icon } from '../primitives';
import {
  MAX_POLL_QUESTION_LENGTH,
  MAX_POLL_OPTION_LENGTH,
} from '@quilibrium/quorum-shared';
import { usePollCreation, type PollDraft } from '../../hooks/business/polls';
import './CreatePollModal.scss';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
};

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export const CreatePollModal: React.FC<Props> = ({ isOpen, onClose, spaceId, channelId }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const { submitPoll, submitting } = usePollCreation(spaceId, channelId);

  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length > MIN_OPTIONS) {
      setOptions(options.filter((_, i) => i !== idx));
    }
  };

  const updateOption = (idx: number, text: string) => {
    setOptions(options.map((o, i) => (i === idx ? text : o)));
  };

  const handleSubmit = async () => {
    setErrorKey(null);
    const draft: PollDraft = {
      question,
      options: options.map(text => ({ text })),
    };
    const result = await submitPoll(draft);
    if (result.ok) {
      // Reset + close
      setQuestion('');
      setOptions(['', '']);
      onClose();
    } else {
      setErrorKey(result.errorKey);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <div className="create-poll-modal">
        <div className="create-poll-modal__header">
          <h2><Trans>Create poll</Trans></h2>
          <Button type="subtle" iconName="close" iconOnly onClick={onClose} />
        </div>

        <div className="create-poll-modal__field">
          <label><Trans>Question</Trans></label>
          <Input
            value={question}
            onChange={setQuestion}
            placeholder={t`What's your question?`}
          />
          <div className="create-poll-modal__counter">
            {question.length} / {MAX_POLL_QUESTION_LENGTH}
          </div>
        </div>

        <div className="create-poll-modal__field">
          <label><Trans>Options</Trans></label>
          {options.map((opt, idx) => (
            <div className="create-poll-modal__option-row" key={idx}>
              <Input
                value={opt}
                onChange={v => updateOption(idx, v)}
                placeholder={t`Option ${idx + 1}`}
              />
              <div className="create-poll-modal__counter create-poll-modal__counter--option">
                {opt.length} / {MAX_POLL_OPTION_LENGTH}
              </div>
              {options.length > MIN_OPTIONS && (
                <Button
                  type="subtle"
                  iconName="close"
                  iconOnly
                  onClick={() => removeOption(idx)}
                />
              )}
            </div>
          ))}

          {options.length < MAX_OPTIONS && (
            <Button
              type="subtle"
              iconName="plus"
              onClick={addOption}
            >
              <Trans>Add option</Trans>
            </Button>
          )}
          <span className="create-poll-modal__hint">
            <Trans>{MIN_OPTIONS}-{MAX_OPTIONS} options</Trans>
          </span>
        </div>

        {errorKey && (
          <div className="create-poll-modal__error" role="alert">
            {errorKey}
          </div>
        )}

        <div className="create-poll-modal__actions">
          <Button type="secondary" onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            <Trans>Create</Trans>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 2: Create the SCSS**

Create `src/components/modals/CreatePollModal.scss`:

```scss
.create-poll-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-strong);
    }
  }

  &__counter {
    font-size: 12px;
    color: var(--color-text-subtle);
    align-self: flex-end;

    &--option {
      font-size: 11px;
    }
  }

  &__option-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 6px;
  }

  &__hint {
    font-size: 12px;
    color: var(--color-text-subtle);
  }

  &__error {
    background-color: var(--surface-3);
    color: var(--color-text-danger);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
```

- [ ] **Step 3: Translate error keys**

Find `src/hooks/business/validation/errorTranslator.ts` (or wherever desktop maps `errorKey` codes to Lingui strings). Add poll error keys:

```typescript
// In the existing errorKey → string switch / map:
case 'pollQuestion.required':
  return t`Poll question is required`;
case 'pollQuestion.tooLong':
  return t`Question must be ${vars.max} characters or fewer`;
case 'pollQuestion.xss':
  return t`Question contains disallowed characters`;
case 'pollOption.required':
  return t`Option text is required`;
case 'pollOption.tooLong':
  return t`Option must be ${vars.max} characters or fewer`;
case 'pollOption.xss':
  return t`Option contains disallowed characters`;
case 'pollOptions.tooFew':
  return t`Add at least 2 options`;
case 'pollOptions.tooMany':
  return t`No more than 10 options`;
case 'pollOptions.duplicate':
  return t`Options must be unique`;
case 'pollOptions.countOutOfRange':
  return t`Poll must have 2-10 options`;
```

Then in `CreatePollModal.tsx`, replace the raw `{errorKey}` with the translated value via the translator hook.

- [ ] **Step 4: TypeScript check + build**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/CreatePollModal.tsx src/components/modals/CreatePollModal.scss src/hooks/business/validation/errorTranslator.ts
git commit -m "feat(modals): add CreatePollModal + translate poll error keys"
```

---

## Task 17: Wire the composer `+` menu (paperclip → plus + ContextMenu)

**Files:**
- Modify: `src/components/message/MessageComposer.tsx`

- [ ] **Step 1: Identify current state**

Re-read `MessageComposer.tsx:793-805` (the current paperclip button with dropzone wrapper).

- [ ] **Step 2: Modify the dropzone hook call**

Find where `useDropzone` is called in this file. Add `noClick: true` to the options so the dropzone no longer opens on click — we'll trigger it from the menu:

```typescript
const {
  getRootProps,
  getInputProps,
  open: openFilePicker, // capture the programmatic open()
  // ... existing destructures
} = useDropzone({
  // ... existing options
  noClick: true, // NEW — we manage clicks via the ContextMenu
});
```

- [ ] **Step 3: Add state and handlers for the menu**

Inside the `MessageComposer` component body, near other `useState` declarations:

```typescript
import { useRef } from 'react';
import { ContextMenu, type MenuItem } from '../ui/ContextMenu';
import { CreatePollModal } from '../modals/CreatePollModal';
import { canCreatePoll } from '@quilibrium/quorum-shared';

const [attachMenuPos, setAttachMenuPos] = useState<{ x: number; y: number } | null>(null);
const [createPollOpen, setCreatePollOpen] = useState(false);
const attachBtnRef = useRef<HTMLDivElement>(null);

const openAttachMenu = () => {
  const rect = attachBtnRef.current?.getBoundingClientRect();
  if (!rect) return;
  setAttachMenuPos({ x: rect.left, y: rect.top });
};

const closeAttachMenu = () => setAttachMenuPos(null);

const attachMenuItems: MenuItem[] = [
  {
    id: 'attach-image',
    icon: 'photo',
    label: t`Add an image`,
    onClick: () => {
      closeAttachMenu();
      openFilePicker();
    },
  },
  {
    id: 'create-poll',
    icon: 'chart-bar',
    label: t`Create poll`,
    hidden: !canCreatePoll(space, currentUserAddress),
    onClick: () => {
      closeAttachMenu();
      setCreatePollOpen(true);
    },
  },
];
```

> `space` and `currentUserAddress` should already be in scope. If not, pull from the same hook/context the composer already uses for posting.

- [ ] **Step 4: Replace the existing button**

Replace `MessageComposer.tsx:793-805`:

```typescript
<Tooltip id="attach" content={t`Attach`} place="top" showOnTouch={false}>
  <div ref={attachBtnRef} {...getRootProps()}>
    <input {...getInputProps()} />
    <Button
      type="unstyled"
      onClick={openAttachMenu}
      className="message-composer-upload-btn"
      iconName="plus"
      iconSize="lg"
      iconOnly
    />
  </div>
</Tooltip>
```

- [ ] **Step 5: Render the menu and the create-poll modal**

Near the bottom of the JSX (e.g., right before the closing fragment), add:

```typescript
{attachMenuPos && (
  <ContextMenu
    items={attachMenuItems}
    position={attachMenuPos}
    onClose={closeAttachMenu}
  />
)}
<CreatePollModal
  isOpen={createPollOpen}
  onClose={() => setCreatePollOpen(false)}
  spaceId={spaceId}
  channelId={channelId}
/>
```

- [ ] **Step 6: Smoke-test in browser**

Run: `yarn dev` (ask the user to start it). Navigate to a channel. Click the new `+` button.
Expected: ContextMenu opens above the button with two items. "Add an image" opens the file picker. "Create poll" opens the modal. Drag-and-drop on the button still works.

- [ ] **Step 7: Commit**

```bash
git add src/components/message/MessageComposer.tsx
git commit -m "feat(composer): replace paperclip with + menu (image | create poll)"
```

---

## Task 18: Create `PollResultsModal`

**Files:**
- Create: `src/components/modals/PollResultsModal.tsx`
- Create: `src/components/modals/PollResultsModal.scss`

- [ ] **Step 1: Implement the modal**

Create `src/components/modals/PollResultsModal.tsx`:

```typescript
import React, { useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { Modal, Button, Tooltip } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { formatMessageDate, formatTime } from '@quilibrium/quorum-shared';
import type { Message, PollMessage } from '@quilibrium/quorum-shared';
import './PollResultsModal.scss';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  pollMessage: Message;
};

export const PollResultsModal: React.FC<Props> = ({ isOpen, onClose, pollMessage }) => {
  const content = pollMessage.content as PollMessage;
  const pollState = pollMessage.pollState;
  const totalVotes = pollState?.votes.length ?? 0;

  // Per-option voter list (sorted by votedAt desc), preserves authoring order across options
  const sectionsByOption = useMemo(() => {
    return content.options.map(opt => {
      const voters = (pollState?.votes ?? [])
        .filter(v => v.optionId === opt.optionId)
        .sort((a, b) => b.votedAt - a.votedAt);
      const percentage = totalVotes === 0 ? 0 : Math.round((voters.length / totalVotes) * 100);
      return { opt, voters, percentage };
    });
  }, [content.options, pollState, totalVotes]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <div className="poll-results-modal">
        <div className="poll-results-modal__header">
          <h2><Trans>Poll results</Trans></h2>
          <Button type="subtle" iconName="close" iconOnly onClick={onClose} />
        </div>

        <p className="poll-results-modal__question">{content.question}</p>
        <p className="poll-results-modal__total">
          <Trans>{totalVotes} votes</Trans>
        </p>

        <div className="poll-results-modal__sections">
          {sectionsByOption.map(({ opt, voters, percentage }) => (
            <section key={opt.optionId} className="poll-results-modal__section">
              <header className="poll-results-modal__section-header">
                <span className="poll-results-modal__section-label">
                  {opt.text} — {percentage}%
                </span>
                <span className="poll-results-modal__section-count">
                  <Trans>{voters.length} votes</Trans>
                </span>
              </header>
              <ul className="poll-results-modal__voters">
                {voters.map(v => (
                  <li key={v.voterAddress} className="poll-results-modal__voter">
                    <UserAvatar address={v.voterAddress} size="sm" />
                    <span className="poll-results-modal__voter-name">
                      {/* Display name resolution — use existing pattern */}
                      {v.voterAddress}
                    </span>
                    {v.isChanged && (
                      <Tooltip id={`changed-${v.voterAddress}`} content={t`Changed their vote`}>
                        <span className="poll-results-modal__changed-glyph">↻</span>
                      </Tooltip>
                    )}
                    <span className="poll-results-modal__voter-time">
                      <span>{formatMessageDate(v.votedAt)}</span>
                      <span>{formatTime(v.votedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
};
```

> Display name resolution should follow whatever pattern other voter-list-style components use (e.g. show-reaction-users tooltip). The `{v.voterAddress}` literal is a placeholder — replace with the canonical "display name from member" lookup used elsewhere. Search `git grep "displayName" -- src/components/message/` for the right hook.

- [ ] **Step 2: Create the SCSS**

Create `src/components/modals/PollResultsModal.scss`:

```scss
.poll-results-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 80vh;
  overflow: hidden;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
  }

  &__question {
    margin: 0;
    color: var(--color-text-subtle);
    font-size: 14px;
  }

  &__total {
    margin: 0;
    color: var(--color-text-subtle);
    font-size: 13px;
  }

  &__sections {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--surface-3);
    border-radius: 6px;
  }

  &__section-label {
    font-weight: 500;
    color: var(--color-text-strong);
  }

  &__section-count {
    font-size: 12px;
    color: var(--color-text-subtle);
  }

  &__voters {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__voter {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;

    &:hover {
      background-color: var(--surface-3);
      border-radius: 6px;
    }
  }

  &__voter-name {
    color: var(--color-text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__changed-glyph {
    color: var(--color-text-subtle);
    font-size: 14px;
    cursor: help;
  }

  &__voter-time {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    color: var(--color-text-subtle);
    font-size: 12px;
    line-height: 1.3;
  }
}
```

- [ ] **Step 3: Build check**

Run: `yarn build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/PollResultsModal.tsx src/components/modals/PollResultsModal.scss
git commit -m "feat(modals): add PollResultsModal (Telegram-style voter detail)"
```

---

## Task 19: Create `EditPollQuestionModal` + wire author actions

**Files:**
- Create: `src/components/modals/EditPollQuestionModal.tsx`
- Modify: wherever the message hover-action menu is defined (search step 1)

- [ ] **Step 1: Locate the message action menu**

Run: `git grep -nE "MessageActions|message-actions|hover.*menu" -- src/components/message/`
Expected: identifies `src/components/message/MessageActions.tsx` (or similar). This is where Edit / Delete / Pin / Reply items live.

- [ ] **Step 2: Implement the modal**

Create `src/components/modals/EditPollQuestionModal.tsx`:

```typescript
import React, { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { Modal, Button, Input } from '../primitives';
import {
  validatePollQuestion,
  MAX_POLL_QUESTION_LENGTH,
} from '@quilibrium/quorum-shared';
import { usePollVoting } from '../../hooks/business/polls';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
  pollMessageId: string;
  initialQuestion: string;
};

export const EditPollQuestionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  spaceId,
  channelId,
  pollMessageId,
  initialQuestion,
}) => {
  const [question, setQuestion] = useState(initialQuestion);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const { editPollQuestion } = usePollVoting(spaceId, channelId);

  const handleSubmit = async () => {
    const v = validatePollQuestion(question);
    if (!v.ok) {
      setErrorKey(v.errorKey);
      return;
    }
    const result = await editPollQuestion(pollMessageId, question);
    if ('error' in result) {
      setErrorKey(result.error);
      return;
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 4 }}>
        <h2 style={{ margin: 0 }}><Trans>Edit poll question</Trans></h2>
        <Input value={question} onChange={setQuestion} />
        <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', alignSelf: 'flex-end' }}>
          {question.length} / {MAX_POLL_QUESTION_LENGTH}
        </div>
        {errorKey && (
          <div style={{ color: 'var(--color-text-danger)', fontSize: 13 }}>{errorKey}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="secondary" onClick={onClose}><Trans>Cancel</Trans></Button>
          <Button type="primary" onClick={handleSubmit}><Trans>Save</Trans></Button>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 3: Add author actions to the message menu**

In the message-actions component (from step 1), find where author-only items live (e.g. existing "Edit message" item). Add two new conditional items:

```typescript
// Inside the items array, gated by isAuthor:
...(isAuthor && message.content.type === 'poll' && (message.pollState?.votes.length ?? 0) === 0
  ? [{
      id: 'edit-poll-question',
      icon: 'edit',
      label: t`Edit question`,
      onClick: () => openEditPollModal(message),
    }]
  : []),

...(isAuthor && message.content.type === 'poll' && !message.pollState?.isClosed
  ? [{
      id: 'close-poll',
      icon: 'lock',
      label: t`Close poll`,
      onClick: () => confirmClosePoll(message),
    }]
  : []),
```

`confirmClosePoll` uses the existing `useTwoStepConfirm` from shared:

```typescript
const { castVote, retractVote, closePoll } = usePollVoting(message.spaceId, message.channelId);
const closeConfirm = useTwoStepConfirm(/* config */);

const confirmClosePoll = (m: Message) => {
  if (closeConfirm.armed) {
    closePoll(m.messageId);
    closeConfirm.reset();
  } else {
    closeConfirm.arm();
  }
};
```

Adapt to the existing `useTwoStepConfirm` API — search `useTwoStepConfirm` for its actual signature.

- [ ] **Step 4: Render `EditPollQuestionModal`**

In the same component, manage modal state and render:

```typescript
const [editingPoll, setEditingPoll] = useState<Message | null>(null);
const openEditPollModal = (m: Message) => setEditingPoll(m);

// In JSX:
{editingPoll && editingPoll.content.type === 'poll' && (
  <EditPollQuestionModal
    isOpen={!!editingPoll}
    onClose={() => setEditingPoll(null)}
    spaceId={editingPoll.spaceId}
    channelId={editingPoll.channelId}
    pollMessageId={editingPoll.messageId}
    initialQuestion={editingPoll.content.question}
  />
)}
```

- [ ] **Step 5: Build check**

Run: `yarn build && npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/EditPollQuestionModal.tsx src/components/message/MessageActions.tsx
git commit -m "feat(message-actions): add author edit-question + close-poll items"
```

---

## Task 20: Add `allowPolls` Switch to Space Settings → General

**Files:**
- Modify: `src/components/modals/SpaceSettingsModal/General.tsx`

- [ ] **Step 1: Read the current file**

Open `src/components/modals/SpaceSettingsModal/General.tsx` and identify the pattern for existing field rows. Find a `Switch`-based row if present; otherwise an `Input` row will show the file's conventions.

- [ ] **Step 2: Add the Features section + Switch row**

Append a new section near the bottom of the form (before any "danger zone" / delete actions):

```typescript
import { Switch } from '../../primitives';
import { Trans } from '@lingui/react/macro';

// Inside the component, near the existing state declarations:
const [allowPolls, setAllowPolls] = useState<boolean>(space.allowPolls !== false);

// In the form JSX, append a Features section:
<section className="space-settings-section">
  <h3><Trans>Features</Trans></h3>
  <div className="space-settings-row">
    <div>
      <label><Trans>Allow polls</Trans></label>
      <p className="space-settings-row__hint">
        <Trans>Members can create polls in any channel.</Trans>
      </p>
    </div>
    <Switch
      value={allowPolls}
      onChange={setAllowPolls}
    />
  </div>
</section>
```

- [ ] **Step 3: Persist `allowPolls` in the save handler**

Find the existing save handler in this file (the one that calls `SpaceService.updateSpace` or similar). Include `allowPolls` in the payload:

```typescript
const handleSave = async () => {
  await spaceService.updateSpace(spaceId, {
    // ... existing fields ...
    allowPolls,
  });
};
```

If the existing save uses a partial-update pattern with only changed fields, follow that pattern.

- [ ] **Step 4: Build + smoke-test**

Run: `yarn build && yarn dev` (ask user to start). Open Space Settings → General. Toggle "Allow polls" off. Save. Reload. Verify the toggle is still off. Verify that the composer `+` menu no longer shows "Create poll" for any channel in this space.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/General.tsx
git commit -m "feat(space-settings): add allowPolls toggle in General → Features"
```

---

## Task 21: Extend `SearchService` to index poll text

**Files:**
- Modify: `src/services/SearchService.ts`

- [ ] **Step 1: Find the text-extractor function**

Run: `git grep -nE "getSearchableText|SearchableMessage|case 'post'" -- src/services/SearchService.ts`
Expected: identifies the text-extraction function (or inline extraction in indexing).

- [ ] **Step 2: Add the 'poll' case**

In `SearchService.ts`, find the function that extracts indexable text from a `Message`. Add:

```typescript
import type { PollMessage } from '@quilibrium/quorum-shared';

// In the extractor:
case 'poll': {
  const c = message.content as PollMessage;
  return [c.question, ...c.options.map(o => o.text)].join(' ');
}
```

If the function uses a different pattern (e.g. `if`/`else if`), follow that pattern.

- [ ] **Step 3: Verify by searching for poll text**

Smoke-test in `yarn dev`: create a poll with question "uniquepollphrasexyz", then search the space for "uniquepollphrasexyz". Expected: the poll message appears in results.

- [ ] **Step 4: Commit**

```bash
git add src/services/SearchService.ts
git commit -m "feat(search): index poll question + options"
```

---

## Task 22: Reply-preview rendering for poll replies + receipt eligibility

**Files:**
- Modify: the reply-preview rendering location (search step 1)
- Modify: `src/services/ReceiptService.ts` (or wherever receipt eligibility is decided)

- [ ] **Step 1: Find reply-preview rendering**

Run: `git grep -nE "repliesToMessageId|replyMetadata|reply-preview" -- src/components/message/`
Expected: identifies the file rendering the "replying to X" preview above a message.

- [ ] **Step 2: Add poll case to the preview renderer**

In that file, find where the preview text is extracted from the parent message's content. Add:

```typescript
import { Icon } from '../primitives';

// In the preview-extraction switch/if-chain:
if (parent.content.type === 'poll') {
  return (
    <span className="reply-preview">
      <Icon name="chart-bar" size="xs" />
      <span className="reply-preview__text">{parent.content.question}</span>
    </span>
  );
}
```

Truncate to ~80 chars if there's an existing truncation utility — match the existing post-message preview behaviour.

- [ ] **Step 3: Find receipt eligibility**

Run: `git grep -nE "deliveryAck|readAck|content\.type" -- src/services/ReceiptService.ts`
Expected: identifies the set of content types that emit acks.

- [ ] **Step 4: Add poll to receipt-eligible types**

In `ReceiptService.ts`, find the set of message types that trigger delivery/read acks (likely an array or switch). Add `'poll'`:

```typescript
const RECEIPT_ELIGIBLE_TYPES = new Set([
  'post',
  'embed',
  'sticker',
  'poll', // NEW
]);
```

Confirm that `'vote'`, `'close-poll'`, `'edit-poll'` are NOT in this set (they should be silent like reactions).

- [ ] **Step 5: Build + commit**

Run: `yarn build`
Expected: no errors.

```bash
git add src/components/message/ src/services/ReceiptService.ts
git commit -m "feat(replies,receipts): poll reply previews + receipt eligibility"
```

---

## Task 23: Manual cross-tab integration test + validation hardening

**Files:** none modified (this is verification, not new code, with potential one-line fixes)

- [ ] **Step 1: Verify the unknown-content-type fallback in Message.tsx**

Re-read `Message.tsx`'s render path. Confirm that if `content.type` is something unknown (e.g. an old client receiving a future type), the renderer does NOT throw — it should silently skip or render a small fallback.

If the renderer can throw (e.g. via a `switch` with no `default`), add a guard:

```typescript
// At the start of the rendering body, after the vote/close-poll/edit-poll early-return:
const knownTypes = new Set(['post', 'event', 'embed', 'reaction', /* ... etc ... */, 'poll']);
if (!knownTypes.has(message.content.type)) {
  logger.warn(`Unknown message content type: ${message.content.type}`);
  return null;
}
```

(Adapt to the codebase's existing pattern — there may already be a default branch.)

- [ ] **Step 2: Cross-tab test — create + vote**

In two browser tabs logged in as different users:
- Tab A creates a poll.
- Tab B sees it appear; votes for option 1.
- Tab A's poll updates `pollState` (verify in console or via UI: total goes from 0 to 1, and Tab A — author — sees results).
- Tab B's poll moves to State B; tallies appear.
- Tab B changes vote to option 2. Verify count flips.
- Tab B opens PollResultsModal. Verify the `↻` glyph appears next to their entry.

- [ ] **Step 3: Cross-tab test — close**

- Tab A (author) closes the poll.
- Tab B sees State C (closed pill, disabled rows, winner star on top option).
- Tab B attempts to click an option. Verify nothing happens (no `VoteMessage` sent).

- [ ] **Step 4: Validation smoke-tests**

Manually attempt each XSS pattern from `.agents/docs/features/security.md` testing scenarios in the CreatePollModal:
- `<script>alert(1)</script>` in question → validation error.
- `<img src=x onerror=1>` in an option → validation error.
- `<3` in question → allowed (heart emoticon).
- `->` in question → allowed (arrow).

- [ ] **Step 5: Toggle gate test**

- Owner toggles `allowPolls` OFF in Space Settings.
- All connected tabs: composer `+` menu no longer shows "Create poll".
- Existing polls remain visible and votable.

- [ ] **Step 6: Offline test**

- Disconnect Tab B (DevTools → Network → Offline).
- Vote in a poll. Verify optimistic UI updates.
- Reconnect. Verify the vote propagates to Tab A.

- [ ] **Step 7: Commit any guard fixes**

If any guards were added in step 1:

```bash
git add src/components/message/Message.tsx
git commit -m "fix(message): silently skip unknown content types"
```

---

## Task 24: Mobile follow-up + PR

**Files:**
- Modify: `.agents/tasks/quorum-shared-migration/mobile-tasks-pending.md`

- [ ] **Step 1: Drop a mobile follow-up entry**

Append to `.agents/tasks/quorum-shared-migration/mobile-tasks-pending.md`:

```markdown
## Polls feature — port to mobile

**Status:** pending
**Created:** 2026-06-01
**Spec:** [polls-design.md](../2026-06-01-polls-design.md)
**Desktop PR:** [link when merged]

Mobile work to mirror the desktop polls feature:

- [ ] Confirm three new icons (`chart-bar`, `circle`, `circle-check`) render via the native icon map in `@quilibrium/quorum-shared` 2.1.0-22.
- [ ] Render the poll card in the message feed (port `PollMessageRenderer.tsx` → `.native.tsx`).
- [ ] Add `CreatePollModal` to the composer's `+` menu (mobile bottom-sheet variant).
- [ ] Add `PollResultsModal` (renders via `MobileDrawer`).
- [ ] Add the `allowPolls` Switch to Space Settings → General tab.
- [ ] Add `usePollVoting` and `usePollCreation` mobile equivalents (or reuse if hooks become shared in the hooks migration).
- [ ] Extend mobile receive-handlers in MessageService to call the same `handleIncomingPoll` / `handleIncomingVote` / etc. logic.
```

- [ ] **Step 2: Open the desktop PR**

Follow the standard PR workflow. Title: `feat: polls in spaces (v1)`. Body includes:
- Summary linking to spec
- Screenshots of each state (A/B/C, modal, settings toggle)
- Test plan checklist (cross-tab tests from Task 23)

- [ ] **Step 3: Commit the mobile-pending entry**

```bash
git add .agents/tasks/quorum-shared-migration/mobile-tasks-pending.md
git commit -m "docs: queue mobile follow-up for polls feature"
```

---

## Self-review checklist (for the engineer executing this plan)

After all tasks land, verify:

- [ ] Spec coverage: every v1 scope item from `2026-06-01-polls-design.md` is implemented.
- [ ] No `TODO` / `TBD` / placeholder strings remain in any new file.
- [ ] All new TypeScript files build with `npx tsc --noEmit --jsx react-jsx --skipLibCheck`.
- [ ] `yarn lint` passes.
- [ ] `yarn format` has been run on all modified files.
- [ ] All new tests pass (`yarn test --run`).
- [ ] The unknown-content-type fallback in `Message.tsx` does not throw.
- [ ] `errorTranslator.ts` covers all 10 poll error keys.
- [ ] No `dangerouslySetInnerHTML` is used to render poll content.
- [ ] `.agents/INDEX.md` is updated (add entries for `2026-06-01-polls-design.md` and `2026-06-01-polls-plan.md`).

---

*Last updated: 2026-06-01*
