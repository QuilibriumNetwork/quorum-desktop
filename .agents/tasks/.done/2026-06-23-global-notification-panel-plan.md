# Global Notification Panel (Desktop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global notification panel to Quorum Desktop that aggregates unread mentions and replies across ALL spaces, opened from a new NavRail bell as a centered modal overlay, while keeping the existing per-space header bell unchanged.

**Architecture:** Approach A (live-derived). The per-space query bodies of `useAllMentions`/`useAllReplies` are extracted into pure async functions reused by new global hooks that loop over `useSpaces()`. No persisted log, no IndexedDB schema change, no `quorum-shared` change. The global panel reuses `NotificationPanel`/`NotificationItem` with a `global` mode (centered presentation, breadcrumb rows, global mark-all + confirm).

**Tech Stack:** React 18, TypeScript, TanStack Query (React Query), Vitest (tests in `src/dev/tests/`), Lingui (`t` macro), IndexedDB via `MessageDB`, SCSS. Shared logic from `@quilibrium/quorum-shared`.

**Branch:** `feat/global-notification-panel` (already created; design spec committed there).

**Spec:** `.agents/tasks/2026-06-23-global-notification-panel-design.md`

---

## File Structure

### Create
- `src/hooks/business/mentions/fetchSpaceMentions.ts` — pure async fn: unread mentions for ONE space
- `src/hooks/business/replies/fetchSpaceReplies.ts` — pure async fn: unread replies for ONE space
- `src/hooks/business/mentions/useAllMentionsGlobal.ts` — global mention aggregation hook
- `src/hooks/business/replies/useAllRepliesGlobal.ts` — global reply aggregation hook
- `src/hooks/business/notifications/useGlobalNotifications.ts` — composes both + merged sorted list + global unread flag
- `src/hooks/business/notifications/index.ts` — barrel for the new composition hook
- `src/utils/resolveGlobalSender.ts` — resolve a sender's display name from a space's member data, given `spaceId`
- `src/dev/tests/hooks/fetchSpaceMentions.unit.test.ts` — tests for the extracted mention fn
- `src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts` — tests for the extracted reply fn
- `src/dev/tests/utils/resolveGlobalSender.unit.test.ts` — tests for the global sender resolver

### Modify
- `src/hooks/business/mentions/useAllMentions.ts` — call `fetchSpaceMentions` internally (no public API change), add `spaceId`/`spaceName` to rows
- `src/hooks/business/replies/useAllReplies.ts` — call `fetchSpaceReplies` internally (no public API change), add `spaceId`/`spaceName` to rows
- `src/hooks/business/mentions/index.ts` — export `useAllMentionsGlobal`, `fetchSpaceMentions`
- `src/hooks/business/replies/index.ts` — export `useAllRepliesGlobal`, `fetchSpaceReplies`
- `src/components/notifications/NotificationItem.tsx` — optional `spaceName` prop + breadcrumb render
- `src/components/notifications/NotificationItem.scss` — breadcrumb styling
- `src/components/notifications/NotificationPanel.tsx` — `global` mode (centered, global hooks, global mark-all + confirm)
- `src/components/shell/NavRail.tsx` — bell item, toggle state, unread dot, render global panel
- `src/components/shell/NavRail.scss` — unread dot positioning on a rail item

### Reused as-is (no change)
- `useSpaces`, `useSpaceMentionCounts`, `useSpaceReplyCounts`
- `DropdownPanel` (`positionStyle="centered"`, `headerContent` slot)
- `useConfirmation` + `ConfirmationModalProvider`
- `buildMessageHash`, `useMessageFormatting`, `useSearchResultFormatting`
- `isMentionedWithSettings`, `getUnreadMentions`, `getUnreadReplies`, `getDefaultNotificationSettings`, `getUserRoles`, `resolveSpaceMemberName`

---

## Type contracts (locked — used across tasks)

`MentionNotification` (existing, in `useAllMentions.ts`) gains two optional fields:

```typescript
export interface MentionNotification {
  message: Message;
  channelId: string;
  channelName: string;
  mentionType: 'you' | 'everyone' | 'roles';
  spaceId?: string;    // NEW — set by global path; undefined for per-space path
  spaceName?: string;  // NEW — set by global path; undefined for per-space path
}
```

`ReplyNotification` is re-exported from `quorum-shared` (cannot edit there per scope). The global reply rows need `spaceId`/`spaceName` too, so the global hooks return a desktop-local widened type:

```typescript
// in src/hooks/business/notifications/useGlobalNotifications.ts
import type { ReplyNotification } from '../../../types/notifications';
import type { MentionNotification } from '../mentions/useAllMentions';

export type GlobalReplyNotification = ReplyNotification & { spaceId: string; spaceName: string };
export type GlobalMentionNotification = MentionNotification & { spaceId: string; spaceName: string };
export type GlobalNotification = GlobalMentionNotification | GlobalReplyNotification;
```

Extracted fn signatures (locked):

```typescript
// fetchSpaceMentions.ts
export async function fetchSpaceMentions(
  messageDB: MessageDB,
  space: Space,
  userAddress: string,
  opts: {
    enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
    userRoleIds?: string[];
    config: UserConfig | undefined; // pre-fetched user config (avoids N getUserConfig calls)
    perChannelLimit?: number; // default 1000 (per-space); global path passes 50
  },
): Promise<MentionNotification[]>

// fetchSpaceReplies.ts
export async function fetchSpaceReplies(
  messageDB: MessageDB,
  space: Space,
  userAddress: string,
  opts: {
    enabled: boolean;
    config: UserConfig | undefined;
    perChannelLimit?: number; // default 1000 (per-space); global path passes 50
  },
): Promise<ReplyNotification[]>
```

Both set `spaceId: space.spaceId` and `spaceName: space.spaceName` on every row they return.

### Performance cap constants (locked — global path only)

Defined in a STANDALONE module to avoid a circular import (the global hooks in
`mentions/`/`replies/` import the per-channel limit; `useGlobalNotifications`
imports those hooks — so the constants must NOT live in `useGlobalNotifications.ts`):

```typescript
// src/hooks/business/notifications/constants.ts
export const GLOBAL_PER_CHANNEL_LIMIT = 50;  // passed as perChannelLimit to the fetch fns
export const GLOBAL_DISPLAY_CAP = 100;        // max rows shown after global sort
```

Rationale (see design doc "Performance" section): the global fetch fans out per-channel
reads across ALL spaces. Lowering the per-channel `limit` from 1000→50 and slicing the
globally-sorted result to 100 bounds memory without biasing by space iteration order
(slice happens AFTER the merge+sort). The per-space header bell keeps `limit: 1000`
(its default) and is unaffected. The composition hook exposes a `truncated` flag when
the merged count exceeds the cap so the UI can show "Showing 100 most recent" (no silent
truncation).

> **RESOLVED (Task 1):** the `Space` human-name field is **`space.spaceName`** (NOT `space.name`). Use `space.spaceName` everywhere.

---

### Task 1: Extract `fetchSpaceMentions` (pure fn) + verify Space.name

**Files:**
- Create: `src/hooks/business/mentions/fetchSpaceMentions.ts`
- Create: `src/dev/tests/hooks/fetchSpaceMentions.unit.test.ts`

- [ ] **Step 1: Confirm the `Space` human-name field**

Run: `npx tsc --noEmit -p tsconfig.json` is not needed yet. Instead inspect the type:
Open `node_modules/@quilibrium/quorum-shared/dist/**` or the source, OR grep usage:
Run: `rg "space\.name|spaceName:" src/components/space/SpacesSidebar.tsx -n`
Expected: find the property used for a space's display name. Use that exact key as `SPACE_NAME_FIELD` everywhere below. (Plan assumes `space.name`.)

- [ ] **Step 2: Write the failing test**

```typescript
// src/dev/tests/hooks/fetchSpaceMentions.unit.test.ts
import { describe, it, expect, vi } from 'vitest';

const ME = 'QmMeAddr0000000000000000000000000000000000';
const SENDER = 'QmSender000000000000000000000000000000000';

function makeSpace() {
  return {
    spaceId: 'space-1',
    name: 'Test Space',
    roles: [],
    members: {},
    groups: [{ channels: [{ channelId: 'chan-1', channelName: 'general' }] }],
  } as any;
}

function makeMessage(overrides: any = {}) {
  return {
    messageId: 'm1',
    createdDate: 1000,
    content: { senderId: SENDER, text: 'hey @<' + ME + '>' },
    mentions: { memberIds: [ME], roleIds: [], everyone: false, channelIds: [] },
    ...overrides,
  };
}

function makeDB(over: any = {}) {
  return {
    getUserConfig: vi.fn().mockResolvedValue({ notificationSettings: {}, mutedChannels: {} }),
    getSpace: vi.fn().mockResolvedValue(makeSpace()),
    getConversation: vi.fn().mockResolvedValue({ conversation: { lastReadTimestamp: 0 } }),
    getThreadReadTimesForChannel: vi.fn().mockResolvedValue({}),
    getUnreadMentions: vi.fn().mockResolvedValue([makeMessage()]),
    ...over,
  } as any;
}

describe('fetchSpaceMentions', () => {
  it('returns a mention row tagged with spaceId and spaceName', async () => {
    const { fetchSpaceMentions } = await import('../../../hooks/business/mentions/fetchSpaceMentions');
    const db = makeDB();
    const rows = await fetchSpaceMentions(db, makeSpace(), ME, {
      enabledTypes: ['mention-you', 'mention-everyone', 'mention-roles'],
      userRoleIds: [],
      config: { notificationSettings: {}, mutedChannels: {} } as any,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].spaceId).toBe('space-1');
    expect(rows[0].spaceName).toBe('Test Space');
    expect(rows[0].channelName).toBe('general');
    expect(rows[0].mentionType).toBe('you');
  });

  it('returns [] when the space is muted', async () => {
    const { fetchSpaceMentions } = await import('../../../hooks/business/mentions/fetchSpaceMentions');
    const db = makeDB();
    const rows = await fetchSpaceMentions(db, makeSpace(), ME, {
      enabledTypes: ['mention-you'],
      userRoleIds: [],
      config: { notificationSettings: { 'space-1': { isMuted: true } } } as any,
    });
    expect(rows).toEqual([]);
  });

  it('excludes muted channels', async () => {
    const { fetchSpaceMentions } = await import('../../../hooks/business/mentions/fetchSpaceMentions');
    const db = makeDB();
    const rows = await fetchSpaceMentions(db, makeSpace(), ME, {
      enabledTypes: ['mention-you'],
      userRoleIds: [],
      config: { notificationSettings: {}, mutedChannels: { 'space-1': ['chan-1'] } } as any,
    });
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn vitest src/dev/tests/hooks/fetchSpaceMentions.unit.test.ts --run`
Expected: FAIL — cannot resolve module `fetchSpaceMentions`.

- [ ] **Step 4: Implement `fetchSpaceMentions`**

Copy the per-channel loop body out of the current `useAllMentions` queryFn verbatim, parameterized. The config is passed in (not fetched) so the global hook fetches it once.

```typescript
// src/hooks/business/mentions/fetchSpaceMentions.ts
import { isMentionedWithSettings, getDefaultNotificationSettings } from '@quilibrium/quorum-shared';
import type { Message, Space } from '@quilibrium/quorum-shared';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';
import type { MessageDB } from '../../../db/messages';
import type { MentionNotification } from './useAllMentions';

function getMentionType(message: Message, userAddress: string): 'you' | 'everyone' | 'roles' {
  if (message.mentions?.everyone) return 'everyone';
  if (message.mentions?.roleIds?.length && message.mentions.roleIds.length > 0) return 'roles';
  if (message.mentions?.memberIds?.includes(userAddress)) return 'you';
  return 'you';
}

export async function fetchSpaceMentions(
  messageDB: MessageDB,
  space: Space,
  userAddress: string,
  opts: {
    enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
    userRoleIds: string[];
    config: any; // UserConfig | undefined
  },
): Promise<MentionNotification[]> {
  const { enabledTypes, userRoleIds, config } = opts;
  const settings = config?.notificationSettings?.[space.spaceId];
  if (settings?.isMuted) return [];

  let typesToCheck: string[];
  if (enabledTypes) {
    typesToCheck = enabledTypes;
  } else {
    const allTypes = settings?.enabledNotificationTypes
      || getDefaultNotificationSettings(space.spaceId).enabledNotificationTypes;
    typesToCheck = allTypes.filter((tp: string) => tp.startsWith('mention-'));
  }
  if (typesToCheck.length === 0) return [];

  const mutedChannelIds = getMutedChannelsForSpace(space.spaceId, config?.mutedChannels);
  const channelIds = space.groups.flatMap((g) => g.channels.map((c) => c.channelId));
  const out: MentionNotification[] = [];

  for (const channelId of channelIds) {
    if (mutedChannelIds.includes(channelId)) continue;
    const conversationId = `${space.spaceId}/${channelId}`;
    const { conversation } = await messageDB.getConversation({ conversationId });
    const lastReadTimestamp = conversation?.lastReadTimestamp || 0;
    const threadReadTimes = await messageDB.getThreadReadTimesForChannel({ spaceId: space.spaceId, channelId });
    const messages = await messageDB.getUnreadMentions({
      spaceId: space.spaceId, channelId, afterTimestamp: lastReadTimestamp, limit: 1000,
    });
    const channel = space.groups.flatMap((g) => g.channels).find((c) => c.channelId === channelId);

    const unread = messages.filter((message: Message) => {
      if (message.isThreadReply && message.threadId) {
        const trt = threadReadTimes[message.threadId];
        if (trt !== undefined && message.createdDate <= trt) return false;
      } else if (message.createdDate <= lastReadTimestamp) {
        return false;
      }
      return isMentionedWithSettings(message, {
        userAddress, enabledTypes: typesToCheck, userRoles: userRoleIds, space,
      });
    });

    for (const message of unread) {
      out.push({
        message,
        channelId,
        channelName: channel?.channelName || 'Unknown Channel',
        mentionType: getMentionType(message, userAddress),
        spaceId: space.spaceId,
        spaceName: space.name,
      });
    }
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest src/dev/tests/hooks/fetchSpaceMentions.unit.test.ts --run`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/business/mentions/fetchSpaceMentions.ts src/dev/tests/hooks/fetchSpaceMentions.unit.test.ts
git commit -m "feat(notifications): extract fetchSpaceMentions pure fn"
```

---

### Task 2: Refactor `useAllMentions` to use `fetchSpaceMentions`

**Files:**
- Modify: `src/hooks/business/mentions/useAllMentions.ts`

- [ ] **Step 1: Replace the queryFn body to call the extracted fn**

Keep the hook's props/return identical. Fetch config once, loop channels via the shared fn (the fn already loops channels for the whole space, so call it once per the single `spaceId`, passing only `channelIds` indirectly — but `useAllMentions` is single-space with an explicit `channelIds` list that may be a subset). To preserve the explicit `channelIds` contract, keep the existing channel loop but delegate the per-message logic. SIMPLEST: since `fetchSpaceMentions` derives channels from `space.groups`, and the per-space panel passes ALL channels of the space, call the shared fn and rely on the same channel set.

Replace `useAllMentions.ts` queryFn with:

```typescript
    queryFn: async () => {
      if (!userAddress) return [];
      try {
        const config = await messageDB.getUserConfig({ address: userAddress });
        const space = await messageDB.getSpace(spaceId);
        if (!space) return [];

        // Mirror the previous channelIds contract: filter the space's channels
        // down to the explicit channelIds the caller passed.
        const allowed = new Set(channelIds);
        const scoped = {
          ...space,
          groups: space.groups.map((g) => ({
            ...g,
            channels: g.channels.filter((c) => allowed.has(c.channelId)),
          })),
        };

        const rows = await fetchSpaceMentions(messageDB, scoped, userAddress, {
          enabledTypes,
          userRoleIds,
          config,
        });
        rows.sort((a, b) => b.message.createdDate - a.message.createdDate);
        return rows;
      } catch (error) {
        console.error('[AllMentions] Error fetching mentions:', error);
        return [];
      }
    },
```

Add the import at the top:

```typescript
import { fetchSpaceMentions } from './fetchSpaceMentions';
```

Add `spaceId`/`spaceName` to the `MentionNotification` interface:

```typescript
export interface MentionNotification {
  message: Message;
  channelId: string;
  channelName: string;
  mentionType: 'you' | 'everyone' | 'roles';
  spaceId?: string;
  spaceName?: string;
}
```

Remove the now-unused local `getMentionType` helper at the bottom of the file (it moved into `fetchSpaceMentions`). Remove now-unused imports (`isMentionedWithSettings`, `getDefaultNotificationSettings`, `getMutedChannelsForSpace`) if no longer referenced — let tsc tell you.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS (no errors in `useAllMentions.ts`). Fix unused-import errors by deleting them.

- [ ] **Step 3: Run the full existing suite to confirm no regression**

Run: `yarn vitest src/dev/tests/ --run`
Expected: PASS — all currently-passing tests still pass (no behavior change to the per-space path).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/business/mentions/useAllMentions.ts
git commit -m "refactor(notifications): useAllMentions delegates to fetchSpaceMentions"
```

---

### Task 3: Extract `fetchSpaceReplies` + refactor `useAllReplies`

**Files:**
- Create: `src/hooks/business/replies/fetchSpaceReplies.ts`
- Create: `src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts`
- Modify: `src/hooks/business/replies/useAllReplies.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts
import { describe, it, expect, vi } from 'vitest';

const ME = 'QmMeAddr0000000000000000000000000000000000';

function makeSpace() {
  return {
    spaceId: 'space-1',
    spaceName: 'Test Space',
    roles: [],
    members: {},
    groups: [{ channels: [{ channelId: 'chan-1', channelName: 'general' }] }],
  } as any;
}

function makeReply() {
  return {
    messageId: 'r1',
    createdDate: 2000,
    content: { senderId: 'QmSomeoneElse', text: 'reply text' },
    replyMetadata: { parentAuthor: ME },
  };
}

function makeDB(over: any = {}) {
  return {
    getConversation: vi.fn().mockResolvedValue({ conversation: { lastReadTimestamp: 0 } }),
    getThreadReadTimesForChannel: vi.fn().mockResolvedValue({}),
    getUnreadReplies: vi.fn().mockResolvedValue([makeReply()]),
    ...over,
  } as any;
}

describe('fetchSpaceReplies', () => {
  it('returns a reply row tagged with spaceId and spaceName when enabled', async () => {
    const { fetchSpaceReplies } = await import('../../../hooks/business/replies/fetchSpaceReplies');
    const rows = await fetchSpaceReplies(makeDB(), makeSpace(), ME, {
      enabled: true,
      config: { notificationSettings: {}, mutedChannels: {} } as any,
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as any).spaceId).toBe('space-1');
    expect((rows[0] as any).spaceName).toBe('Test Space');
    expect(rows[0].type).toBe('reply');
  });

  it('returns [] when not enabled', async () => {
    const { fetchSpaceReplies } = await import('../../../hooks/business/replies/fetchSpaceReplies');
    const rows = await fetchSpaceReplies(makeDB(), makeSpace(), ME, {
      enabled: false,
      config: { notificationSettings: {} } as any,
    });
    expect(rows).toEqual([]);
  });

  it('returns [] when the space is muted', async () => {
    const { fetchSpaceReplies } = await import('../../../hooks/business/replies/fetchSpaceReplies');
    const rows = await fetchSpaceReplies(makeDB(), makeSpace(), ME, {
      enabled: true,
      config: { notificationSettings: { 'space-1': { isMuted: true } } } as any,
    });
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts --run`
Expected: FAIL — cannot resolve module `fetchSpaceReplies`.

- [ ] **Step 3: Implement `fetchSpaceReplies`**

> **Apply the Task 1 review lessons here from the start** (so this file doesn't
> repeat them): type `messageDB` as the full `MessageDB` (not `Pick<>`), type
> `config` as `UserConfig | undefined` (imported from `../../../db/messages`), and
> hoist the channel list once (`const allChannels = space.groups.flatMap(...)`)
> instead of re-flatMapping inside the loop. Add a JSDoc note that output is
> unsorted (caller sorts).

```typescript
// src/hooks/business/replies/fetchSpaceReplies.ts
import { isNotificationTypeEnabled } from '@quilibrium/quorum-shared';
import type { Space } from '@quilibrium/quorum-shared';
import type { ReplyNotification } from '../../../types/notifications';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';
import type { MessageDB, UserConfig } from '../../../db/messages';

/**
 * Fetch unread replies for ONE space (pure; no React). Replicates the per-space
 * gating from `useAllReplies`. Returns rows in channel-iteration order — the
 * CALLER sorts (the global hook sorts after merging across all spaces).
 */
export async function fetchSpaceReplies(
  messageDB: MessageDB,
  space: Space,
  userAddress: string,
  opts: { enabled: boolean; config: UserConfig | undefined; perChannelLimit?: number },
): Promise<(ReplyNotification & { spaceId: string; spaceName: string })[]> {
  const { enabled, config, perChannelLimit = 1000 } = opts;
  const settings = config?.notificationSettings?.[space.spaceId];
  if (settings?.isMuted) return [];

  // `enabled` overrides persistent settings (matches old useAllReplies semantics).
  const shouldFetch = enabled !== undefined ? enabled : isNotificationTypeEnabled(settings, 'reply');
  if (!shouldFetch) return [];

  const mutedChannelIds = getMutedChannelsForSpace(space.spaceId, config?.mutedChannels);
  const allChannels = space.groups.flatMap((g) => g.channels);
  const channelIds = allChannels.map((c) => c.channelId);
  const out: (ReplyNotification & { spaceId: string; spaceName: string })[] = [];

  for (const channelId of channelIds) {
    if (mutedChannelIds.includes(channelId)) continue;
    const conversationId = `${space.spaceId}/${channelId}`;
    const { conversation } = await messageDB.getConversation({ conversationId });
    const lastReadTimestamp = conversation?.lastReadTimestamp || 0;
    const threadReadTimes = await messageDB.getThreadReadTimesForChannel({ spaceId: space.spaceId, channelId });
    const messages = await messageDB.getUnreadReplies({
      spaceId: space.spaceId, channelId, userAddress, afterTimestamp: lastReadTimestamp, limit: perChannelLimit,
    });
    const channel = allChannels.find((c) => c.channelId === channelId);

    for (const message of messages) {
      if (message.isThreadReply && message.threadId) {
        const trt = threadReadTimes[message.threadId];
        if (trt !== undefined && message.createdDate <= trt) continue;
      }
      out.push({
        message,
        channelId,
        channelName: channel?.channelName || 'Unknown Channel',
        type: 'reply',
        spaceId: space.spaceId,
        spaceName: space.spaceName,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `useAllReplies` to delegate**

Replace the `useAllReplies.ts` queryFn with:

```typescript
    queryFn: async () => {
      if (!userAddress) return [];
      try {
        const config = await messageDB.getUserConfig({ address: userAddress });
        const space = await messageDB.getSpace(spaceId);
        if (!space) return [];

        const allowed = new Set(channelIds);
        const scoped = {
          ...space,
          groups: space.groups.map((g) => ({
            ...g,
            channels: g.channels.filter((c) => allowed.has(c.channelId)),
          })),
        };

        const rows = await fetchSpaceReplies(messageDB, scoped, userAddress, { enabled: enabled as boolean, config });
        rows.sort((a, b) => b.message.createdDate - a.message.createdDate);
        return rows;
      } catch (error) {
        console.error('[AllReplies] Error fetching replies:', error);
        return [];
      }
    },
```

Add import: `import { fetchSpaceReplies } from './fetchSpaceReplies';`
Remove now-unused imports (`isNotificationTypeEnabled`, `getMutedChannelsForSpace`) if tsc flags them.

Note: the old `useAllReplies` used `enabled !== undefined ? enabled : isNotificationTypeEnabled(...)`. The hook always passes `enabled` from the panel, so passing it straight through preserves behavior. Keep the `enabled as boolean` cast since the prop is optional.

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.
Run: `yarn vitest src/dev/tests/ --run`
Expected: PASS (all prior tests + 3 new).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/business/replies/fetchSpaceReplies.ts src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts src/hooks/business/replies/useAllReplies.ts
git commit -m "feat(notifications): extract fetchSpaceReplies, useAllReplies delegates"
```

---

### Task 4: Global aggregation hooks

**Files:**
- Create: `src/hooks/business/notifications/constants.ts` (cap constants — standalone to avoid circular import)
- Modify: `src/hooks/business/mentions/fetchSpaceMentions.ts` (add `perChannelLimit` param)
- Create: `src/hooks/business/mentions/useAllMentionsGlobal.ts`
- Create: `src/hooks/business/replies/useAllRepliesGlobal.ts`
- Modify: `src/hooks/business/mentions/index.ts`
- Modify: `src/hooks/business/replies/index.ts`

- [ ] **Step 0a: Create the cap constants module**

```typescript
// src/hooks/business/notifications/constants.ts
export const GLOBAL_PER_CHANNEL_LIMIT = 50;  // per-channel getUnreadMentions/Replies cap (global path)
export const GLOBAL_DISPLAY_CAP = 100;        // max rows shown after the global newest-first sort
```

- [ ] **Step 0b: Retrofit `perChannelLimit` into `fetchSpaceMentions`**

Task 1 created `fetchSpaceMentions` with a hardcoded `limit: 1000` in the
`getUnreadMentions` call. `fetchSpaceReplies` (Task 3) already takes
`perChannelLimit?: number` (default 1000). Make `fetchSpaceMentions` symmetric:
- Add `perChannelLimit?: number;` to its `opts` type.
- Destructure with default: `const { enabledTypes, userRoleIds = [], config, perChannelLimit = 1000 } = opts;`
- Change the `getUnreadMentions` call's `limit: 1000` → `limit: perChannelLimit`.
This is additive — the per-space `useAllMentions` (which doesn't pass it) keeps `1000`.

Run: `yarn vitest src/dev/tests/hooks/fetchSpaceMentions.unit.test.ts --run`
Expected: still 3 PASS (default unchanged).

- [ ] **Step 1: Implement `useAllMentionsGlobal`**

```typescript
// src/hooks/business/mentions/useAllMentionsGlobal.ts
import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { getUserRoles } from '@quilibrium/quorum-shared';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { fetchSpaceMentions } from './fetchSpaceMentions';
import type { MentionNotification } from './useAllMentions';
import { GLOBAL_PER_CHANNEL_LIMIT } from '../notifications/constants';

interface Props {
  spaces: Space[];
  enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
}

export function useAllMentionsGlobal({ spaces, enabledTypes }: Props) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['mention-notifications', 'global', userAddress, ...spaces.map((s) => s.spaceId).sort(), ...(enabledTypes?.slice().sort() || [])],
    queryFn: async () => {
      if (!userAddress) return [] as MentionNotification[];
      const config = await messageDB.getUserConfig({ address: userAddress });
      const all: MentionNotification[] = [];
      for (const space of spaces) {
        const userRoleIds = getUserRoles(userAddress, space).map((r) => r.roleId);
        const rows = await fetchSpaceMentions(messageDB, space, userAddress, {
          enabledTypes, userRoleIds, config, perChannelLimit: GLOBAL_PER_CHANNEL_LIMIT,
        });
        all.push(...rows);
      }
      all.sort((a, b) => b.message.createdDate - a.message.createdDate);
      return all;
    },
    enabled: !!userAddress && spaces.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  return { mentions: data || [], isLoading };
}
```

- [ ] **Step 2: Implement `useAllRepliesGlobal`**

```typescript
// src/hooks/business/replies/useAllRepliesGlobal.ts
import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { fetchSpaceReplies } from './fetchSpaceReplies';
import type { ReplyNotification } from '../../../types/notifications';
import { GLOBAL_PER_CHANNEL_LIMIT } from '../notifications/constants';

interface Props {
  spaces: Space[];
  enabled: boolean;
}

export function useAllRepliesGlobal({ spaces, enabled }: Props) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['reply-notifications', 'global', userAddress, ...spaces.map((s) => s.spaceId).sort(), enabled],
    queryFn: async () => {
      if (!userAddress) return [] as (ReplyNotification & { spaceId: string; spaceName: string })[];
      const config = await messageDB.getUserConfig({ address: userAddress });
      const all: (ReplyNotification & { spaceId: string; spaceName: string })[] = [];
      for (const space of spaces) {
        const rows = await fetchSpaceReplies(messageDB, space, userAddress, {
          enabled, config, perChannelLimit: GLOBAL_PER_CHANNEL_LIMIT,
        });
        all.push(...rows);
      }
      all.sort((a, b) => b.message.createdDate - a.message.createdDate);
      return all;
    },
    enabled: !!userAddress && spaces.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  return { replies: data || [], isLoading };
}
```

- [ ] **Step 3: Export from barrels**

Append to `src/hooks/business/mentions/index.ts`:

```typescript
export { useAllMentionsGlobal } from './useAllMentionsGlobal';
export { fetchSpaceMentions } from './fetchSpaceMentions';
```

Append to `src/hooks/business/replies/index.ts`:

```typescript
export { useAllRepliesGlobal } from './useAllRepliesGlobal';
export { fetchSpaceReplies } from './fetchSpaceReplies';
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/business/mentions/useAllMentionsGlobal.ts src/hooks/business/replies/useAllRepliesGlobal.ts src/hooks/business/mentions/index.ts src/hooks/business/replies/index.ts
git commit -m "feat(notifications): add global mention/reply aggregation hooks"
```

---

### Task 4b: Invalidate the global keys on new messages and on read

**Files:**
- Modify: `src/services/MessageService.ts:2106-2108` and `:2129-2131`
- Modify: `src/hooks/business/conversations/useUpdateReadTime.ts`

**Why:** The global hooks use keys `['mention-notifications', 'global', ...]` /
`['reply-notifications', 'global', ...]`. Existing invalidations are scoped to
`['mention-notifications', spaceId]` / `['reply-notifications', spaceId]`
(`MessageService.ts:2107`/`:2130`). React Query prefix-matching requires a
matching prefix in order — `['mention-notifications', spaceId]` does NOT match
`['mention-notifications', 'global', ...]` (the second element differs). So
without this task, a new mention/reply (or reading a channel) refreshes the
per-space panel but leaves the GLOBAL panel stale for up to 30s. Broadening to
`['mention-notifications']` (one element) matches BOTH `spaceId` and `'global'`
variants.

- [ ] **Step 1: Broaden the MessageService notification-list invalidations**

In `src/services/MessageService.ts`, change the mention-notifications invalidation
(around line 2106) from the space-scoped key to the bare prefix:

```typescript
      // Also invalidate notification inbox query (per-space AND global panels).
      // Bare prefix matches both ['mention-notifications', spaceId] and
      // ['mention-notifications', 'global', ...].
      await queryClient.invalidateQueries({
        queryKey: ['mention-notifications'],
      });
```

And the reply-notifications invalidation (around line 2129):

```typescript
      await queryClient.invalidateQueries({
        queryKey: ['reply-notifications'],
      });
```

- [ ] **Step 2: Broaden the useUpdateReadTime notification-list invalidations**

`useUpdateReadTime` currently invalidates count keys but NOT the notification-list
keys. Add two broad invalidations in its `onSuccess` (after the existing
`['mention-counts', 'space']` / `['reply-counts', 'space']` calls), so reading a
channel refreshes the global panel too:

```typescript
      // Notification inbox lists (per-space + global). Bare prefixes match both.
      queryClient.invalidateQueries({ queryKey: ['mention-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['reply-notifications'] });
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.
Run: `yarn vitest src/dev/tests/ --run`
Expected: PASS (MessageService.unit.test.tsx may assert invalidation keys — if a
test asserts `['mention-notifications', spaceId]` exactly, update it to the bare
prefix and note the per-space panel still refreshes via prefix match).

- [ ] **Step 4: Commit**

```bash
git add src/services/MessageService.ts src/hooks/business/conversations/useUpdateReadTime.ts
git commit -m "fix(notifications): broaden inbox invalidations to cover the global panel"
```

---

### Task 5: `useGlobalNotifications` composition hook

**Files:**
- Create: `src/hooks/business/notifications/useGlobalNotifications.ts`
- Create: `src/hooks/business/notifications/index.ts`

- [ ] **Step 1: Implement the composition hook**

The composition hook merges + sorts, then applies the global display cap and
exposes a `truncated` flag (so the UI can say "Showing N most recent" — no silent
truncation, per the design's perf section).

```typescript
// src/hooks/business/notifications/useGlobalNotifications.ts
import { useMemo } from 'react';
import type { Space } from '@quilibrium/quorum-shared';
import { useAllMentionsGlobal } from '../mentions/useAllMentionsGlobal';
import { useAllRepliesGlobal } from '../replies/useAllRepliesGlobal';
import type { MentionNotification } from '../mentions/useAllMentions';
import type { ReplyNotification } from '../../../types/notifications';
import { GLOBAL_DISPLAY_CAP } from './constants';

export type GlobalMentionNotification = MentionNotification & { spaceId: string; spaceName: string };
export type GlobalReplyNotification = ReplyNotification & { spaceId: string; spaceName: string };
export type GlobalNotification = GlobalMentionNotification | GlobalReplyNotification;

interface Props {
  spaces: Space[];
  enabledTypes: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
  replyEnabled: boolean;
}

export function useGlobalNotifications({ spaces, enabledTypes, replyEnabled }: Props) {
  const { mentions, isLoading: mLoading } = useAllMentionsGlobal({ spaces, enabledTypes });
  const { replies, isLoading: rLoading } = useAllRepliesGlobal({ spaces, enabled: replyEnabled });

  const { notifications, truncated } = useMemo(() => {
    const merged = [...(mentions as GlobalMentionNotification[]), ...(replies as GlobalReplyNotification[])]
      .sort((a, b) => b.message.createdDate - a.message.createdDate);
    // Slice AFTER the global sort so the cap is order-independent (no bias toward
    // whichever space was iterated first).
    return {
      notifications: merged.slice(0, GLOBAL_DISPLAY_CAP) as GlobalNotification[],
      truncated: merged.length > GLOBAL_DISPLAY_CAP,
    };
  }, [mentions, replies]);

  return { notifications, truncated, isLoading: mLoading || rLoading };
}
```

- [ ] **Step 2: Barrel**

```typescript
// src/hooks/business/notifications/index.ts
export { useGlobalNotifications } from './useGlobalNotifications';
export { GLOBAL_DISPLAY_CAP, GLOBAL_PER_CHANNEL_LIMIT } from './constants';
export type {
  GlobalNotification,
  GlobalMentionNotification,
  GlobalReplyNotification,
} from './useGlobalNotifications';
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

```bash
git add src/hooks/business/notifications/
git commit -m "feat(notifications): add useGlobalNotifications composition hook"
```

---

### Task 6: Global sender resolver

**Files:**
- Create: `src/utils/resolveGlobalSender.ts`
- Create: `src/hooks/business/notifications/useGlobalSenderResolver.ts`
- Create: `src/dev/tests/utils/resolveGlobalSender.unit.test.ts`
- Modify: `src/hooks/business/notifications/index.ts`

The global panel can't use `Channel`'s `mapSenderToUser` (it's per-space and built from enriched members). It resolves a sender's name from the sender's own space data.

> **DEVIATION FROM ORIGINAL SPEC (2026-06-23).** The original spec read
> `space.members[senderId]`, assuming `Space.members` was a `Record<address, member>`.
> Verified false: `Space.members` is `string[]` (addresses only); enriched member
> objects (`display_name`, `user_icon`) come from `messageDB.getSpaceMembers(spaceId)`
> (returns `channel.UserProfile[]`). Corrected design (approved by user — "Async map
> via getSpaceMembers"):
> - `resolveGlobalSender.ts` exports a PURE core `buildGlobalSenderMap(membersBySpace)`
>   → `(spaceId, senderId) => ResolvedGlobalSender`, mapping `user_address`→`address`,
>   `display_name`→`displayName`, `user_icon`→`userIcon`. Unknown → `{ address: senderId }`.
> - `useGlobalSenderResolver(spaces)` hook fetches each space's roster via
>   `messageDB.getSpaceMembers` (React Query, 30s stale) and returns the sync resolver,
>   with an address-only fallback until rosters load.
> - `primaryUsername`/`globalDisplayName` are NOT on the roster (they come from the
>   public-profile fetch), so they're optional — parity with the per-space path when
>   unenriched. Output shape feeds the existing `resolveSpaceMemberName(...)` call in
>   `NotificationPanel` unchanged.
> - Import `UserProfile` via the `channel` namespace (`import type { channel }` →
>   `channel.UserProfile`); it is NOT exported from the package root.
> The code blocks below are the ORIGINAL (broken) spec, kept for history. See the
> shipped files for the real implementation.

- [ ] **Step 1: Write the failing test**

```typescript
// src/dev/tests/utils/resolveGlobalSender.unit.test.ts
import { describe, it, expect } from 'vitest';

const SENDER = 'QmSender000000000000000000000000000000000';

describe('resolveGlobalSender', () => {
  it('resolves a sender to its member object from the matching space', async () => {
    const { makeResolveGlobalSender } = await import('../../../utils/resolveGlobalSender');
    const spaces = [
      { spaceId: 's1', members: { [SENDER]: { address: SENDER, displayName: 'Ada' } } },
    ] as any;
    const resolve = makeResolveGlobalSender(spaces);
    const user = resolve('s1', SENDER);
    expect(user?.displayName).toBe('Ada');
  });

  it('returns a minimal address-only object when the sender is unknown', async () => {
    const { makeResolveGlobalSender } = await import('../../../utils/resolveGlobalSender');
    const resolve = makeResolveGlobalSender([{ spaceId: 's1', members: {} }] as any);
    const user = resolve('s1', SENDER);
    expect(user?.address).toBe(SENDER);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn vitest src/dev/tests/utils/resolveGlobalSender.unit.test.ts --run`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```typescript
// src/utils/resolveGlobalSender.ts
import type { Space } from '@quilibrium/quorum-shared';

/**
 * Build a sender-resolver for the GLOBAL notification panel. Unlike Channel's
 * per-space `mapSenderToUser` (built from enriched/back-filled members), this
 * resolves a sender from the member map of whichever space the row came from.
 * Falls back to an address-only object so name resolvers show the address suffix.
 */
export function makeResolveGlobalSender(spaces: Space[]) {
  const bySpace = new Map<string, Space>();
  for (const s of spaces) bySpace.set(s.spaceId, s);

  return (spaceId: string, senderId: string): any => {
    const space = bySpace.get(spaceId);
    const member = (space?.members as Record<string, any> | undefined)?.[senderId];
    if (member) return member;
    return { address: senderId };
  };
}
```

> Verify `Space` exposes `members` as a `Record<address, member>` during this task (grep `space.members` in `src/`). If members live elsewhere (e.g. an array), adapt the lookup. `Channel` builds its map from a `members` prop, so the data exists on the space; confirm the shape.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn vitest src/dev/tests/utils/resolveGlobalSender.unit.test.ts --run`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolveGlobalSender.ts src/dev/tests/utils/resolveGlobalSender.unit.test.ts
git commit -m "feat(notifications): add global sender resolver"
```

---

### Task 7: `NotificationItem` breadcrumb

**Files:**
- Modify: `src/components/notifications/NotificationItem.tsx`
- Modify: `src/components/notifications/NotificationItem.scss`

- [ ] **Step 1: Add `spaceName` prop + breadcrumb render**

In `NotificationItemProps` add:

```typescript
  spaceName?: string; // When set (global panel), renders a "Space › #channel" breadcrumb
```

Destructure it in the component signature (`spaceName,`). Then in the JSX, change the channel meta block so the space name leads when present. Replace the existing channel `<span>` block:

```tsx
        <Flex className="notification-meta min-w-0">
          {spaceName && (
            <>
              <span className="notification-space truncate-channel-name flex-shrink min-w-0">{spaceName}</span>
              <span className="notification-thread-chevron">›</span>
            </>
          )}
          <Icon name="hashtag" className="notification-channel-icon flex-shrink-0" />
          <span className={`notification-channel ${isThread ? '' : 'mr-2'} truncate-channel-name flex-shrink min-w-0`}>{channelName}</span>
          {isThread && (
            <>
              <span className="notification-thread-chevron">›</span>
              <span className="notification-thread-label mr-2">{t`Thread`}</span>
            </>
          )}
          <Icon name={notificationIcon} className="notification-mention-type-icon flex-shrink-0" />
          <span className="notification-sender truncate-user-name flex-shrink min-w-0">{displayName}</span>
        </Flex>
```

- [ ] **Step 2: Add SCSS for the space lead**

Append to `src/components/notifications/NotificationItem.scss`:

```scss
.notification-space {
  font-weight: 600;
  color: var(--text-heading, inherit);
  margin-right: 4px;
}
```

> Verify the heading text token name in `src/styles/_variables.scss` during this task; use the project's existing heading color variable (the codebase uses semantic tokens — match the one `notification-sender`/headings already use). Do NOT introduce a new arbitrary color.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS. Per-space callers omit `spaceName` → no breadcrumb → unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/notifications/NotificationItem.tsx src/components/notifications/NotificationItem.scss
git commit -m "feat(notifications): NotificationItem renders optional space breadcrumb"
```

---

### Task 8: `NotificationPanel` global mode

**Files:**
- Modify: `src/components/notifications/NotificationPanel.tsx`

This task adds an opt-in `global` path. When `global` is true, the panel:
- uses `useGlobalNotifications` (driven by `spaces`) instead of per-space hooks,
- renders centered (`positionStyle="centered"`),
- passes `spaceName` to rows,
- uses a global mark-all-read gated by a confirm dialog.

- [ ] **Step 1: Extend props**

Add to `NotificationPanelProps`:

```typescript
  /** Global mode: aggregate across all spaces, centered presentation. */
  global?: boolean;
  /** Required in global mode: all the user's spaces. */
  spaces?: Space[];
  /** Global mode sender resolver (spaceId, senderId) → user. */
  resolveGlobalSender?: (spaceId: string, senderId: string) => any;
```

Import: `import type { Space } from '@quilibrium/quorum-shared';` and `import { useGlobalNotifications } from '../../hooks/business/notifications';` and `import { useConfirmation } from '../../hooks/ui/useConfirmation';` and the confirmation modal piece (see Step 4).

- [ ] **Step 2: Branch the data source**

Replace the current `useAllMentions`/`useAllReplies` calls with a conditional. Because hooks can't be called conditionally, call BOTH the per-space and global hooks but gate each with `enabled` semantics via empty inputs:

```typescript
  const mentionTypes = selectedTypes.filter((tp) => tp.startsWith('mention-')) as ('mention-you' | 'mention-everyone' | 'mention-roles')[];
  const replyEnabled = selectedTypes.includes('reply');

  // Per-space path (existing) — pass empty channelIds in global mode to disable.
  const { mentions: spaceMentions, isLoading: smLoading } = useAllMentions({
    spaceId,
    channelIds: global ? [] : channelIds,
    enabledTypes: mentionTypes,
    userRoleIds,
  });
  const { replies: spaceReplies, isLoading: srLoading } = useAllReplies({
    spaceId,
    channelIds: global ? [] : channelIds,
    enabled: replyEnabled,
  });

  // Global path — pass empty spaces in per-space mode to disable.
  const { notifications: globalNotifications, truncated: globalTruncated, isLoading: gLoading } = useGlobalNotifications({
    spaces: global ? (spaces ?? []) : [],
    enabledTypes: mentionTypes,
    replyEnabled,
  });

  const allNotifications = global
    ? globalNotifications
    : [...spaceMentions, ...spaceReplies].sort((a, b) => b.message.createdDate - a.message.createdDate);

  const isLoading = global ? (gLoading || settingsLoading) : (smLoading || srLoading || settingsLoading);
```

(Both hooks have `enabled: spaces.length > 0` / `channelIds.length > 0` already, so the disabled side does no work.)

**Truncation affordance (global only):** when `global && globalTruncated`, render a
subtle footer below the list, e.g.:

```tsx
      {global && globalTruncated && (
        <div className="notification-panel__truncation-note">
          {t`Showing the ${GLOBAL_DISPLAY_CAP} most recent notifications`}
        </div>
      )}
```

Import `GLOBAL_DISPLAY_CAP` from `../../hooks/business/notifications`. Add a muted
small-text style for `.notification-panel__truncation-note` in `NotificationPanel.scss`
(use an existing muted-text token; `text-sm`-equivalent, centered, padded). This
satisfies the "no silent caps" rule — the user is told the list is capped.

- [ ] **Step 3: Pass `spaceName` + global sender resolver to rows**

In BOTH the touch and desktop row maps, change the sender lookup and `NotificationItem` props:

```tsx
                const senderId = notification.message.content?.senderId;
                const rowSpaceId = (notification as any).spaceId ?? spaceId;
                const sender = global && resolveGlobalSender
                  ? resolveGlobalSender(rowSpaceId, senderId)
                  : mapSenderToUser(senderId);
```

And add to the `<NotificationItem ... />` props:

```tsx
                      spaceName={global ? (notification as any).spaceName : undefined}
```

- [ ] **Step 4: Global mark-all-read with confirm**

Generalize `handleMarkAllRead` to iterate the `(spaceId, channelId)` pairs present in `allNotifications` (in global mode each row carries its own `spaceId`; in per-space mode use the panel `spaceId`):

```typescript
  const handleMarkAllReadCore = useCallback(async () => {
    try {
      const now = Date.now();
      // Build the set of (spaceId, channelId) pairs to mark read.
      const pairs = new Map<string, { spaceId: string; channelId: string }>();
      for (const n of allNotifications) {
        const sId = global ? ((n as any).spaceId ?? spaceId) : spaceId;
        pairs.set(`${sId}/${n.channelId}`, { spaceId: sId, channelId: n.channelId });
      }
      for (const { spaceId: sId, channelId } of pairs.values()) {
        await messageDB.saveReadTime({ conversationId: `${sId}/${channelId}`, lastMessageTimestamp: now });
      }
      const threadEntries: Array<{ threadId: string; spaceId: string; channelId: string; lastReadTimestamp: number }> = [];
      for (const { spaceId: sId, channelId } of pairs.values()) {
        const threads = await messageDB.getChannelThreads({ spaceId: sId, channelId });
        for (const thread of threads) {
          threadEntries.push({ threadId: thread.threadId, spaceId: sId, channelId, lastReadTimestamp: now });
        }
      }
      if (threadEntries.length > 0) await messageDB.bulkSaveThreadReadTimes(threadEntries);

      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel'] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'channel'] });
      queryClient.invalidateQueries({ queryKey: ['mention-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['reply-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      onClose();
    } catch (error) {
      console.error('[NotificationPanel] Error marking all as read:', error);
    }
  }, [allNotifications, spaceId, global, messageDB, queryClient, onClose]);

  // Confirm gate for the GLOBAL blast-radius action only.
  const confirm = useConfirmation({
    type: 'modal',
    modalConfig: {
      variant: 'warning',
      title: t`Mark all as read?`,
      message: t`This marks mentions and replies as read across all your spaces. This can't be undone.`,
      confirmText: t`Mark all read`,
      cancelText: t`Cancel`,
    },
  });

  const handleMarkAllRead = useCallback((e: React.MouseEvent) => {
    if (global) {
      confirm.handleClick(e, handleMarkAllReadCore);
    } else {
      handleMarkAllReadCore();
    }
  }, [global, confirm, handleMarkAllReadCore]);
```

Render the confirmation modal when `confirm.showModal` is true. The codebase exposes confirmation modals via `ConfirmationModalProvider`; mirror an existing consumer. Find the pattern:
Run during this task: `rg "useConfirmation\(" src/ -l` then open one consumer (e.g. `src/hooks/business/messages/usePinnedMessages.ts` or `ConversationSettingsModal.tsx`) and replicate exactly how it renders `confirm.modalConfig` (either a local `<ConfirmationModal>` or the provider). Use that established pattern — do not invent a new modal.

> The `handleMarkAllRead` signature changes from `() => ...` to `(e) => ...`. Update the `<Button onClick={...}>` — the primitive `Button`'s `onClick` already passes the event, so `onClick={handleMarkAllRead}` works.

- [ ] **Step 5: Centered presentation + dynamic title**

In the `DropdownPanel`, make `positionStyle` conditional:

```tsx
      positionStyle={global ? 'centered' : 'right-aligned'}
```

Leave `maxWidth`/`maxHeight` as-is (centered honors both).

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.
Run: `yarn vitest src/dev/tests/ --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/notifications/NotificationPanel.tsx
git commit -m "feat(notifications): NotificationPanel global mode (centered, breadcrumb, confirm mark-all)"
```

---

### Task 9: NavRail bell + global panel mount + unread dot

**Files:**
- Modify: `src/components/shell/NavRail.tsx`
- Modify: `src/components/shell/NavRail.scss`

> **DEVIATION FROM ORIGINAL SPEC (2026-06-23).** Two corrections vs the steps below:
> 1. The sender resolver is the `useGlobalSenderResolver(spaces)` HOOK (Task 6
>    deviation), NOT `makeResolveGlobalSender(spaces)` + `useMemo`. Import it from
>    `../../hooks/business/notifications`. The steps below referencing
>    `makeResolveGlobalSender` are obsolete.
> 2. Suspense: verified NavRail renders under the app-level `<Suspense>` in
>    `App.tsx` (line ~120), same boundary the sibling `SpacesSidebar` relies on for
>    its own `useSpaces()` call. So `useSpaces()` is called directly in NavRail (no
>    extra local boundary needed); the cached query won't re-suspend.
> 3. The `.nav-rail__notif-dot` SCSS must also reset the base `.icon-unread-dot`'s
>    `left: -15px` / `top: 50%` / `transform` (which position it left-of-an-avatar):
>    `top: -2px; right: -2px; left: auto; transform: none;`.

- [ ] **Step 1: Add the notifications rail item**

In `RailSectionId` add `'notifications'`. In `buildItems()` insert after the `spaces` entry:

```typescript
  {
    id: 'notifications',
    icon: 'bell',
    label: t`Notifications`,
    route: '', // not navigated — opens the global panel
  },
```

- [ ] **Step 2: Add panel state + spaces + unread dot data**

Inside the component, before `return`:

```tsx
  const [notifOpen, setNotifOpen] = React.useState(false);
  const { data: spaces = [] } = useSpaces();
  const mentionCounts = useSpaceMentionCounts({ spaces });
  const replyCounts = useSpaceReplyCounts({ spaces });
  const hasUnreadNotifications =
    Object.keys(mentionCounts).length > 0 || Object.keys(replyCounts).length > 0;
  const resolveGlobalSender = React.useMemo(() => makeResolveGlobalSender(spaces), [spaces]);
```

Imports:

```typescript
import { useSpaces } from '../../hooks/queries/spaces';
import { useSpaceMentionCounts } from '../../hooks/business/mentions';
import { useSpaceReplyCounts } from '../../hooks/business/replies';
import { makeResolveGlobalSender } from '../../utils/resolveGlobalSender';
import { NotificationPanel } from '../notifications/NotificationPanel';
```

> `useSpaces` uses `useSuspenseQuery`. NavRail renders inside the app shell which already sits under a Suspense boundary (spaces are loaded app-wide). Confirm NavRail is within a Suspense boundary during this task (it renders alongside SpacesSidebar which already calls `useSpaces`). If not, wrap the counts in a child component. Verify by running the app (Task 10).

- [ ] **Step 3: Branch `onItemClick` for notifications**

At the top of `onItemClick`:

```typescript
    if (item.id === 'notifications') {
      setNotifOpen(true);
      return;
    }
```

- [ ] **Step 4: Render the unread dot on the bell**

In the item render, the icon is wrapped in `<span className="relative flex-shrink-0">`. Add a dot for the notifications item:

```tsx
              <span className="relative flex-shrink-0">
                <Icon name={item.icon} size="xl" />
                {item.id === 'notifications' && hasUnreadNotifications && (
                  <span className="icon-unread-dot nav-rail__notif-dot" aria-hidden="true" />
                )}
              </span>
```

- [ ] **Step 5: Render the global panel**

Just before the closing `</nav>` (after the user avatar block), add:

```tsx
      <NotificationPanel
        global
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        spaces={spaces}
        resolveGlobalSender={resolveGlobalSender}
        spaceId=""
        channelIds={[]}
        mapSenderToUser={() => undefined}
      />
```

(`spaceId`/`channelIds`/`mapSenderToUser` are required by the existing props but unused in global mode; pass inert values.)

- [ ] **Step 6: SCSS for the dot on a rail item**

Append to `src/components/shell/NavRail.scss`:

```scss
.nav-rail__notif-dot {
  position: absolute;
  top: -2px;
  right: -2px;
}
```

> `.icon-unread-dot` base visual lives in `src/styles/_components.scss`; this only nudges its anchor for the rail icon. Verify the dot sits on the top-right of the bell during Task 10; adjust offsets if needed.

- [ ] **Step 7: Typecheck + full suite**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.
Run: `yarn vitest src/dev/tests/ --run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/NavRail.tsx src/components/shell/NavRail.scss
git commit -m "feat(notifications): NavRail bell opens global notification panel"
```

---

### Task 10: Manual verification (browser) + docs

**Files:**
- Modify: `.agents/docs/features/mention-notification-system.md` (add a "Global panel" subsection)

- [ ] **Step 1: Run the app and verify behavior**

Run: `yarn dev` (or use the project `run` skill / `mcp__Claude_Preview__preview_start`).
Verify in the browser:
1. A bell item appears in the NavRail with the label "Notifications".
2. Clicking it opens a CENTERED panel with a dimmed backdrop.
3. With unread mentions/replies in any space, rows show `Space › #channel` breadcrumbs and the correct sender names.
4. The type filter (@you/@everyone/@roles/Replies) narrows the global list.
5. Clicking a row navigates to the message in the right space/channel and closes the panel.
6. The bell shows a presence dot when unread mentions/replies exist anywhere; it clears after reading those channels.
7. "Mark all as read" opens a confirm dialog; confirming clears notifications across all spaces.
8. The per-space header bell inside a space still works unchanged (anchored dropdown, current-space scope, NO space breadcrumb on its rows).

- [ ] **Step 2: Update the feature doc**

Add a `## Global Notification Panel` section to `.agents/docs/features/mention-notification-system.md` documenting: NavRail bell entry, centered presentation, Approach A (live aggregation via `useGlobalNotifications` → `fetchSpaceMentions`/`fetchSpaceReplies`), `Space › #channel` breadcrumb, presence dot from `useSpaceMentionCounts`+`useSpaceReplyCounts`, global mark-all + confirm, and that the per-space header bell is unchanged. End with a `*Last updated: 2026-06-23*` line.

- [ ] **Step 3: Commit**

```bash
git add .agents/docs/features/mention-notification-system.md
git commit -m "docs(notifications): document the global notification panel"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** Approach A live aggregation (T1–5), cache-invalidation correctness for the new global keys (T4b — found during self-review: existing `MessageService`/`useUpdateReadTime` invalidations were spaceId-scoped and would NOT reach `['*-notifications','global',...]`), NavRail centered entry (T9, T8), flat newest-first + breadcrumb (T7, T8), type-filter-only (T8 reuses existing filter), presence dot (T9), global mark-all + confirm (T8), per-space bell unchanged (T2/T3 keep public APIs; T8 gates global behind `global` prop). All covered.
- **Type consistency:** `MentionNotification` gains `spaceId?`/`spaceName?` (T1/T2); global rows widen to required via `GlobalNotification` (T5); `fetchSpaceMentions`/`fetchSpaceReplies` signatures fixed in T1/T3 and consumed unchanged in T4. `handleMarkAllRead` signature change noted in T8.
- **Verification flags:** three "verify during this task" notes (Space name field, Space.members shape, heading color token, Suspense boundary) are real lookups, each with a stated default and fallback — not deferred design decisions.

*Last updated: 2026-06-23*
