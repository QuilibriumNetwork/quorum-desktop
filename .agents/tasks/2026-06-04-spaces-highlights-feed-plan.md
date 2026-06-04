---
type: plan
title: Spaces Highlights Feed — Implementation Plan
status: ready
created: 2026-06-04
related_design: 2026-06-04-spaces-highlights-feed-design.md
---

# Spaces Highlights Feed Implementation Plan

> **For agentic workers:** This plan is task-by-task. Each task ends with a commit. Do not skip the test-first cycle; the codebase has 384 tests and regression coverage is non-negotiable.

**Goal:** Replace the static three-card empty state on `/spaces` with an aggregated "Highlights" feed of `@everyone` mentions and pinned messages from all joined spaces in the last 30 days.

**Architecture:** A new DB query (`getHighlightCandidates`) plus a new business hook (`useHighlights`) feeds a small set of presentational components rendered at the `/spaces` route. Five `['highlights']` invalidation sites in existing code keep the feed live. Zero new sync, zero new IndexedDB schema, zero shared-package changes for v1 (migration to quorum-shared deferred until PR #4 unblocks).

**Tech Stack:** TypeScript, React 19, TanStack Query 5, IndexedDB (via `MessageDB`), SCSS with semantic variables (`_colors.scss`), Lingui for i18n, Tabler icons via the `Icon` primitive, Vitest + Testing Library for tests.

**Spec:** see [`2026-06-04-spaces-highlights-feed-design.md`](2026-06-04-spaces-highlights-feed-design.md). All architectural decisions live there; this plan executes them.

---

## File Map

| File | Status | Role |
|------|--------|------|
| `src/db/messages.ts` | modify | Add `getHighlightCandidates` method |
| `src/services/MessageService.ts` | modify | 3 insertion sites for `['highlights']` invalidation |
| `src/hooks/business/conversations/useUpdateReadTime.ts` | modify | 1 insertion site |
| `src/hooks/business/messages/usePinnedMessages.ts` | modify | 2 insertion sites (pin + unpin) |
| `src/hooks/business/highlights/useHighlights.ts` | create | Cross-space aggregation hook |
| `src/hooks/business/highlights/buildHighlight.ts` | create | Pure helper: denormalize + preview |
| `src/hooks/business/highlights/buildMutedChannelsKey.ts` | create | Canonical query-key serializer |
| `src/hooks/business/highlights/index.ts` | create | Barrel export |
| `src/components/highlights/SpacesHighlights.tsx` | create | Route component, branches state |
| `src/components/highlights/HighlightsFeed.tsx` | create | List renderer |
| `src/components/highlights/HighlightItem.tsx` | create | Single feed card |
| `src/components/highlights/HighlightsEmpty.tsx` | create | "No highlights yet" empty state |
| `src/components/highlights/HighlightsSkeleton.tsx` | create | Suspense fallback + loading state |
| `src/components/highlights/SpacesHighlights.scss` | create | Styles for all four components |
| `src/components/highlights/index.ts` | create | Barrel export |
| `src/components/discover-page/SpacesEmpty.tsx` | create | Extracted from `DiscoverPage.tsx` |
| `src/components/discover-page/DiscoverPage.tsx` | modify | Remove `mode` prop + `SpacesEmpty` inline |
| `src/components/discover-page/index.ts` | modify | Export the new `SpacesEmpty` |
| `src/components/Router/Router.web.tsx` | modify | Change `/spaces` route element |
| `src/utils/mock/mockSpaces.ts` (or wherever messages are mocked) | modify | Inject `@everyone` + pinned flags into mock messages |
| `src/dev/tests/db/highlightCandidates.test.ts` | create | Unit tests for the DB query |
| `src/dev/tests/utils/buildHighlight.test.ts` | create | Unit tests for the build helper |
| `src/dev/tests/utils/buildMutedChannelsKey.test.ts` | create | Unit tests for the key serializer |
| `src/dev/tests/components/HighlightItem.test.tsx` | create | Component tests |
| `src/dev/tests/components/SpacesHighlights.test.tsx` | create | Branch behavior tests |

**File sizing reasoning:** All new files are small (< 200 LoC). `useHighlights.ts` is the largest, ~120 LoC including types and imports. No file in the plan grows beyond what one developer can hold in context.

---

## Pre-Flight Checks

- [ ] **Step 0.1: Verify baseline tests pass**

Run: `npx vitest run --reporter=verbose`
Expected: All existing tests pass. Note any pre-existing failures so we know they're not from our changes.

- [ ] **Step 0.2: Verify type-checker is clean**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Zero errors. (If there are pre-existing errors, snapshot them so we can compare later.)

---

## Task 1: Add `getHighlightCandidates` to MessageDB

**Files:**
- Modify: `src/db/messages.ts` (add new method near `getPinnedMessages` at line 2173)
- Test: `src/dev/tests/db/highlightCandidates.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `src/dev/tests/db/highlightCandidates.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { MessageDB } from '../../../db/messages';
import type { Message } from '@quilibrium/quorum-shared';

const buildMessage = (overrides: Partial<Message> = {}): Message => ({
  messageId: `msg-${Math.random().toString(36).slice(2)}`,
  spaceId: 'space-1',
  channelId: 'channel-1',
  createdDate: Date.now(),
  modifiedDate: Date.now(),
  lastModifiedHash: 'hash',
  digestAlgorithm: 'sha256',
  nonce: 'nonce',
  content: { type: 'post', text: 'hello', senderId: 'user-1' } as any,
  reactions: [],
  mentions: {},
  ...overrides,
});

describe('MessageDB.getHighlightCandidates', () => {
  let db: MessageDB;

  beforeEach(async () => {
    indexedDB = new IDBFactory(); // reset fake-indexeddb
    db = new MessageDB();
    await db.init();
  });

  it('returns empty array when channel has no messages', async () => {
    const result = await db.getHighlightCandidates('space-1', 'channel-1', 0);
    expect(result).toEqual([]);
  });

  it('returns @everyone messages', async () => {
    const msg = buildMessage({ mentions: { everyone: true } });
    await db.saveMessage(msg, 0, 'space-1', 'space', '', '', 'user-1');

    const result = await db.getHighlightCandidates('space-1', 'channel-1', 0);
    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe(msg.messageId);
  });

  it('returns pinned messages', async () => {
    const msg = buildMessage({ isPinned: true } as any);
    await db.saveMessage(msg, 0, 'space-1', 'space', '', '', 'user-1');

    const result = await db.getHighlightCandidates('space-1', 'channel-1', 0);
    expect(result).toHaveLength(1);
  });

  it('excludes plain messages with neither flag', async () => {
    const msg = buildMessage({});
    await db.saveMessage(msg, 0, 'space-1', 'space', '', '', 'user-1');

    const result = await db.getHighlightCandidates('space-1', 'channel-1', 0);
    expect(result).toEqual([]);
  });

  it('respects sinceTimestamp lower bound', async () => {
    const oldMsg = buildMessage({
      messageId: 'old',
      createdDate: 1000,
      mentions: { everyone: true },
    });
    const newMsg = buildMessage({
      messageId: 'new',
      createdDate: 5000,
      mentions: { everyone: true },
    });
    await db.saveMessage(oldMsg, 0, 'space-1', 'space', '', '', 'user-1');
    await db.saveMessage(newMsg, 0, 'space-1', 'space', '', '', 'user-1');

    const result = await db.getHighlightCandidates('space-1', 'channel-1', 3000);
    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe('new');
  });

  it('excludes thread replies even when carrying @everyone', async () => {
    const reply = buildMessage({
      mentions: { everyone: true },
      isThreadReply: true,
      threadId: 'thread-1',
    } as any);
    await db.saveMessage(reply, 0, 'space-1', 'space', '', '', 'user-1');

    const result = await db.getHighlightCandidates('space-1', 'channel-1', 0);
    expect(result).toEqual([]);
  });

  it('includes messages where isThreadReply is undefined (older messages)', async () => {
    const msg = buildMessage({ mentions: { everyone: true } });
    // No isThreadReply field at all — undefined.
    await db.saveMessage(msg, 0, 'space-1', 'space', '', '', 'user-1');

    const result = await db.getHighlightCandidates('space-1', 'channel-1', 0);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `npx vitest run src/dev/tests/db/highlightCandidates.test.ts`
Expected: All tests fail with `getHighlightCandidates is not a function`.

- [ ] **Step 1.3: Implement `getHighlightCandidates`**

In `src/db/messages.ts`, add this method immediately after `getPinnedMessages` (which ends around line 2210):

```typescript
async getHighlightCandidates(
  spaceId: string,
  channelId: string,
  sinceTimestamp: number,
): Promise<Message[]> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('messages', 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('by_conversation_time');

    const range = IDBKeyRange.bound(
      [spaceId, channelId, sinceTimestamp],
      [spaceId, channelId, Number.MAX_SAFE_INTEGER],
    );

    const request = index.getAll(range);
    request.onsuccess = () => {
      const messages = (request.result || []).filter(
        (m: Message) =>
          !m.isThreadReply &&
          (m.mentions?.everyone === true || m.isPinned === true),
      );
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `npx vitest run src/dev/tests/db/highlightCandidates.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/db/messages.ts src/dev/tests/db/highlightCandidates.test.ts
git commit -m "feat(db): add getHighlightCandidates query for highlights feed"
```

---

## Task 2: Add `buildMutedChannelsKey` helper

**Files:**
- Create: `src/hooks/business/highlights/buildMutedChannelsKey.ts`
- Test: `src/dev/tests/utils/buildMutedChannelsKey.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `src/dev/tests/utils/buildMutedChannelsKey.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildMutedChannelsKey } from '../../../hooks/business/highlights/buildMutedChannelsKey';

describe('buildMutedChannelsKey', () => {
  it('returns "null" when mutedChannels is undefined', () => {
    expect(buildMutedChannelsKey(undefined)).toBe('null');
  });

  it('returns "null" when mutedChannels is null', () => {
    expect(buildMutedChannelsKey(null as any)).toBe('null');
  });

  it('produces identical key for same content in different key order', () => {
    const a = { 'space-1': ['ch-1'], 'space-2': ['ch-2'] };
    const b = { 'space-2': ['ch-2'], 'space-1': ['ch-1'] };
    expect(buildMutedChannelsKey(a)).toBe(buildMutedChannelsKey(b));
  });

  it('produces identical key for same content in different value order', () => {
    const a = { 'space-1': ['ch-b', 'ch-a'] };
    const b = { 'space-1': ['ch-a', 'ch-b'] };
    expect(buildMutedChannelsKey(a)).toBe(buildMutedChannelsKey(b));
  });

  it('produces different key when content actually differs', () => {
    const a = { 'space-1': ['ch-1'] };
    const b = { 'space-1': ['ch-2'] };
    expect(buildMutedChannelsKey(a)).not.toBe(buildMutedChannelsKey(b));
  });

  it('handles empty object', () => {
    expect(buildMutedChannelsKey({})).toBe('{}');
  });

  it('handles space with empty array', () => {
    expect(buildMutedChannelsKey({ 'space-1': [] })).toBe('{"space-1":[]}');
  });
});
```

- [ ] **Step 2.2: Run the test to verify it fails**

Run: `npx vitest run src/dev/tests/utils/buildMutedChannelsKey.test.ts`
Expected: All tests fail with module-not-found.

- [ ] **Step 2.3: Implement `buildMutedChannelsKey`**

Create `src/hooks/business/highlights/buildMutedChannelsKey.ts`:

```typescript
export type MutedChannelsMap = { [spaceId: string]: string[] };

/**
 * Canonical serialization of mutedChannels for the React Query key.
 * Sorts both outer keys (spaceIds) and inner arrays (channelIds) so that
 * semantically-equal mute sets produce identical string keys, even if
 * config sync from another device returns them in a different order.
 */
export function buildMutedChannelsKey(
  mutedChannels: MutedChannelsMap | undefined | null,
): string {
  if (!mutedChannels) return 'null';
  const sortedKeys = Object.keys(mutedChannels).sort();
  const canonical: Record<string, string[]> = {};
  for (const spaceId of sortedKeys) {
    canonical[spaceId] = [...(mutedChannels[spaceId] || [])].sort();
  }
  return JSON.stringify(canonical);
}
```

- [ ] **Step 2.4: Run the test to verify it passes**

Run: `npx vitest run src/dev/tests/utils/buildMutedChannelsKey.test.ts`
Expected: 7/7 pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/hooks/business/highlights/buildMutedChannelsKey.ts src/dev/tests/utils/buildMutedChannelsKey.test.ts
git commit -m "feat(highlights): add canonical mutedChannels query-key serializer"
```

---

## Task 3: Add `buildHighlight` pure helper

**Files:**
- Create: `src/hooks/business/highlights/buildHighlight.ts`
- Test: `src/dev/tests/utils/buildHighlight.test.ts`

- [ ] **Step 3.1: Write the failing test**

Create `src/dev/tests/utils/buildHighlight.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildHighlight } from '../../../hooks/business/highlights/buildHighlight';
import type { Message, Space, Channel, SpaceMember } from '@quilibrium/quorum-shared';

const baseMessage = (overrides: Partial<Message> = {}): Message => ({
  messageId: 'msg-1',
  spaceId: 'space-1',
  channelId: 'channel-1',
  createdDate: 1000,
  modifiedDate: 1000,
  lastModifiedHash: 'hash',
  digestAlgorithm: 'sha256',
  nonce: 'nonce',
  content: { type: 'post', text: 'Hello **world**', senderId: 'user-1' } as any,
  reactions: [],
  mentions: { everyone: true },
  ...overrides,
});

const baseSpace: Space = {
  spaceId: 'space-1',
  spaceName: 'Test Space',
  iconUrl: 'icon.png',
} as any;

const baseChannel: Channel = {
  channelId: 'channel-1',
  spaceId: 'space-1',
  channelName: 'general',
} as any;

const membersMap = new Map<string, SpaceMember>([
  ['user-1', { user_address: 'user-1', display_name: 'Alice', user_icon: 'alice.png' } as any],
]);

describe('buildHighlight', () => {
  it('sets reason to "everyone" when mentions.everyone is true', () => {
    const h = buildHighlight(
      baseMessage({ mentions: { everyone: true } }),
      baseSpace, baseChannel, membersMap, 0,
    );
    expect(h.reason).toBe('everyone');
  });

  it('sets reason to "pinned" when only isPinned is true', () => {
    const h = buildHighlight(
      baseMessage({ mentions: {}, isPinned: true } as any),
      baseSpace, baseChannel, membersMap, 0,
    );
    expect(h.reason).toBe('pinned');
  });

  it('prefers "everyone" when both apply', () => {
    const h = buildHighlight(
      baseMessage({ mentions: { everyone: true }, isPinned: true } as any),
      baseSpace, baseChannel, membersMap, 0,
    );
    expect(h.reason).toBe('everyone');
  });

  it('strips markdown from preview text', () => {
    const h = buildHighlight(
      baseMessage({ content: { type: 'post', text: '**Bold** and _italic_', senderId: 'user-1' } as any }),
      baseSpace, baseChannel, membersMap, 0,
    );
    expect(h.preview).not.toContain('**');
    expect(h.preview).not.toContain('_');
    expect(h.preview).toContain('Bold');
    expect(h.preview).toContain('italic');
  });

  it('truncates preview at ~280 chars with ellipsis', () => {
    const longText = 'a'.repeat(500);
    const h = buildHighlight(
      baseMessage({ content: { type: 'post', text: longText, senderId: 'user-1' } as any }),
      baseSpace, baseChannel, membersMap, 0,
    );
    expect(h.preview.length).toBeLessThanOrEqual(281); // 280 + ellipsis
    expect(h.preview.endsWith('…')).toBe(true);
  });

  it('does not truncate text shorter than the limit', () => {
    const h = buildHighlight(
      baseMessage({ content: { type: 'post', text: 'short', senderId: 'user-1' } as any }),
      baseSpace, baseChannel, membersMap, 0,
    );
    expect(h.preview).toBe('short');
    expect(h.preview.endsWith('…')).toBe(false);
  });

  it('resolves sender display name from members map', () => {
    const h = buildHighlight(baseMessage(), baseSpace, baseChannel, membersMap, 0);
    expect(h.sender.displayName).toBe('Alice');
    expect(h.sender.iconUrl).toBe('alice.png');
  });

  it('falls back when sender is not in members map', () => {
    const h = buildHighlight(
      baseMessage({ content: { type: 'post', text: 'hi', senderId: 'unknown-user' } as any }),
      baseSpace, baseChannel, new Map(), 0,
    );
    expect(h.sender.address).toBe('unknown-user');
    expect(h.sender.displayName).toMatch(/unknown-user/);
  });

  it('marks isUnread when createdDate > lastReadTimestamp', () => {
    const h = buildHighlight(
      baseMessage({ createdDate: 5000 }),
      baseSpace, baseChannel, membersMap, 3000,
    );
    expect(h.isUnread).toBe(true);
  });

  it('marks not unread when createdDate <= lastReadTimestamp', () => {
    const h = buildHighlight(
      baseMessage({ createdDate: 2000 }),
      baseSpace, baseChannel, membersMap, 3000,
    );
    expect(h.isUnread).toBe(false);
  });

  it('extracts media thumbnail when embeddedMedia has image-thumbnail', () => {
    const h = buildHighlight(
      baseMessage({
        content: {
          type: 'post',
          text: 'check this',
          senderId: 'user-1',
          embeddedMedia: [{ type: 'image-thumbnail', key: 'k1', data: 'data:image/png;base64,AAAA' }],
        } as any,
      }),
      baseSpace, baseChannel, membersMap, 0,
    );
    expect(h.hasMedia).toBe(true);
    expect(h.mediaThumb).toBeDefined();
  });
});
```

- [ ] **Step 3.2: Run the test to verify it fails**

Run: `npx vitest run src/dev/tests/utils/buildHighlight.test.ts`
Expected: Module not found.

- [ ] **Step 3.3: Implement `buildHighlight`**

Create `src/hooks/business/highlights/buildHighlight.ts`:

```typescript
import type { Message, Space, Channel, SpaceMember, PostMessage } from '@quilibrium/quorum-shared';
import { stripMarkdownAndMentions } from '@quilibrium/quorum-shared';
import { getAddressSuffix, DefaultImages } from '../../../utils';
import { getEmbeddedMediaSrc } from '../../../utils/embeddedMedia';

const PREVIEW_MAX_CHARS = 280;

export interface Highlight {
  messageId: string;
  spaceId: string;
  channelId: string;
  createdDate: number;
  reason: 'everyone' | 'pinned';
  space: { spaceId: string; spaceName: string; iconUrl: string };
  channel: { channelId: string; channelName: string };
  sender: { address: string; displayName: string; iconUrl?: string };
  preview: string;
  hasMedia: boolean;
  mediaThumb?: string;
  isUnread: boolean;
  message: Message;
}

const extractText = (message: Message): string => {
  if (message.content?.type !== 'post') return '';
  const post = message.content as PostMessage;
  return Array.isArray(post.text) ? post.text.join('\n') : (post.text ?? '');
};

const truncate = (text: string, max: number): string =>
  text.length > max ? text.slice(0, max).trimEnd() + '…' : text;

const extractMediaThumb = (message: Message): string | undefined => {
  if (message.content?.type !== 'post') return undefined;
  const post = message.content as PostMessage;
  const media = post.embeddedMedia;
  if (!media || media.length === 0) return undefined;
  // Prefer thumbnail, fall back to full image.
  for (const entry of media) {
    if (entry.type === 'image-thumbnail') {
      return getEmbeddedMediaSrc(post, 'image-thumbnail', entry.key) ?? undefined;
    }
  }
  for (const entry of media) {
    if (entry.type === 'image') {
      return getEmbeddedMediaSrc(post, 'image', entry.key) ?? undefined;
    }
  }
  return undefined;
};

export function buildHighlight(
  message: Message,
  space: Space,
  channel: Channel,
  members: Map<string, SpaceMember>,
  lastReadTimestamp: number,
): Highlight {
  const senderId = (message.content as any)?.senderId ?? '';
  const member = members.get(senderId);

  const rawText = extractText(message);
  const stripped = stripMarkdownAndMentions(rawText);
  const preview = truncate(stripped, PREVIEW_MAX_CHARS);

  const thumb = extractMediaThumb(message);

  return {
    messageId: message.messageId,
    spaceId: message.spaceId,
    channelId: message.channelId,
    createdDate: message.createdDate,
    reason: message.mentions?.everyone === true ? 'everyone' : 'pinned',
    space: {
      spaceId: space.spaceId,
      spaceName: space.spaceName,
      iconUrl: space.iconUrl,
    },
    channel: {
      channelId: channel.channelId,
      channelName: channel.channelName,
    },
    sender: {
      address: senderId,
      displayName: member?.display_name || (senderId ? getAddressSuffix(senderId) : 'Unknown'),
      iconUrl: member?.user_icon || DefaultImages.UNKNOWN_USER,
    },
    preview,
    hasMedia: !!thumb,
    mediaThumb: thumb,
    isUnread: message.createdDate > lastReadTimestamp,
    message,
  };
}
```

- [ ] **Step 3.4: Run the test to verify it passes**

Run: `npx vitest run src/dev/tests/utils/buildHighlight.test.ts`
Expected: 11/11 pass.

If `stripMarkdownAndMentions` produces text that fails the strip-test expectations, inspect its actual behavior and adjust the test (don't change the function's contract).

- [ ] **Step 3.5: Commit**

```bash
git add src/hooks/business/highlights/buildHighlight.ts src/dev/tests/utils/buildHighlight.test.ts
git commit -m "feat(highlights): add buildHighlight pure helper with preview/media extraction"
```

---

## Task 4: Implement `useHighlights` hook

**Files:**
- Create: `src/hooks/business/highlights/useHighlights.ts`
- Create: `src/hooks/business/highlights/index.ts` (barrel)

- [ ] **Step 4.1: Implement `useHighlights`**

Create `src/hooks/business/highlights/useHighlights.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { logger } from '@quilibrium/quorum-shared';
import type { Message, Space, SpaceMember } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useSpaces } from '../../'; // top-level hooks barrel — same as SpacesSidebar uses
import { useMutedSpacesSet } from '../spaces';
import { useConfig } from '../../queries/config';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';
import { buildHighlight, type Highlight } from './buildHighlight';
import { buildMutedChannelsKey } from './buildMutedChannelsKey';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface UseHighlightsResult {
  highlights: Highlight[];
  isLoading: boolean;
}

export function useHighlights(): UseHighlightsResult {
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const { data: spaces = [] } = useSpaces({});
  const { mutedSpacesSet } = useMutedSpacesSet();
  const { messageDB } = useMessageDB();
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  const mutedChannelsKey = buildMutedChannelsKey(config?.mutedChannels);

  const query = useQuery({
    queryKey: [
      'highlights',
      userAddress,
      spaces.map((s) => s.spaceId).sort(),
      Array.from(mutedSpacesSet).sort(),
      mutedChannelsKey,
    ],
    queryFn: async () => {
      if (!userAddress) return [];
      const since = Date.now() - THIRTY_DAYS_MS;
      const eligible = spaces.filter((s) => !mutedSpacesSet.has(s.spaceId));

      // Parallelize across BOTH spaces AND channels.
      const perSpace = await Promise.all(
        eligible.map(async (space): Promise<Highlight[]> => {
          try {
            const mutedChannelIds = new Set(
              getMutedChannelsForSpace(space.spaceId, config?.mutedChannels) ?? [],
            );
            const channels = (space.groups || []).flatMap((g) => g.channels);
            const activeChannels = channels.filter(
              (c) => !mutedChannelIds.has(c.channelId),
            );

            // One members lookup per space, not per message.
            const memberList: SpaceMember[] = await messageDB.getSpaceMembers(space.spaceId);
            const membersMap = new Map<string, SpaceMember>(
              memberList.map((m) => [m.user_address, m]),
            );

            const messagesPerChannel: Message[][] = await Promise.all(
              activeChannels.map(async (channel) => {
                try {
                  return await messageDB.getHighlightCandidates(
                    space.spaceId,
                    channel.channelId,
                    since,
                  );
                } catch (err) {
                  logger.warn('[useHighlights] channel scan failed', {
                    spaceId: space.spaceId,
                    channelId: channel.channelId,
                    error: err,
                  });
                  return [];
                }
              }),
            );

            const channelById = new Map(activeChannels.map((c) => [c.channelId, c]));
            const highlightsForSpace: Highlight[] = [];

            for (let i = 0; i < activeChannels.length; i++) {
              const channel = activeChannels[i];
              const conversationId = `${space.spaceId}/${channel.channelId}`;
              // Best-effort lastReadTimestamp lookup. If it fails, treat as unread (0).
              let lastRead = 0;
              try {
                const { conversation } = await messageDB.getConversation({ conversationId });
                lastRead = conversation?.lastReadTimestamp ?? 0;
              } catch (err) {
                logger.warn('[useHighlights] conversation read-time lookup failed', {
                  conversationId,
                  error: err,
                });
              }
              for (const msg of messagesPerChannel[i]) {
                highlightsForSpace.push(
                  buildHighlight(msg, space, channel, membersMap, lastRead),
                );
              }
            }

            return highlightsForSpace;
          } catch (err) {
            logger.warn('[useHighlights] space scan failed', {
              spaceId: space.spaceId,
              error: err,
            });
            return [];
          }
        }),
      );

      return perSpace.flat().sort((a, b) => b.createdDate - a.createdDate);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: !!userAddress,
  });

  return {
    highlights: query.data ?? [],
    isLoading: query.isLoading,
  };
}
```

- [ ] **Step 4.2: Create the barrel export**

Create `src/hooks/business/highlights/index.ts`:

```typescript
export { useHighlights } from './useHighlights';
export type { UseHighlightsResult } from './useHighlights';
export { buildHighlight } from './buildHighlight';
export type { Highlight } from './buildHighlight';
export { buildMutedChannelsKey } from './buildMutedChannelsKey';
```

- [ ] **Step 4.3: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Zero errors (or the same set of pre-existing errors from Step 0.2).

- [ ] **Step 4.4: Commit**

```bash
git add src/hooks/business/highlights/
git commit -m "feat(highlights): implement useHighlights aggregation hook"
```

---

## Task 5: Wire `['highlights']` invalidations

Five insertion sites. Each is a small, surgical change. We commit the whole batch at the end.

- [ ] **Step 5.1: Insertion 1 — `@everyone` in MessageService cache-update phase**

Open `src/services/MessageService.ts` and find the existing mention-counts invalidation block at ~line 1937-1961 (it starts with `if (decryptedContent.mentions?.memberIds && ...`).

**Immediately AFTER the closing `}` of that block** (around line 1961), add:

```typescript
// Highlights feed: invalidate when an @everyone message arrives.
// Standalone check (NOT inside memberIds.length > 0 block) because @everyone
// can have empty memberIds.
if (decryptedContent.mentions?.everyone === true) {
  await queryClient.invalidateQueries({ queryKey: ['highlights'] });
}
```

- [ ] **Step 5.2: Insertion 2 — pin/unpin control message in MessageService**

In `src/services/MessageService.ts`, find the existing pin-invalidation block at ~line 1640-1646 (it has `queryClient.invalidateQueries({ queryKey: ['pinnedMessages', spaceId, channelId] })` and `['pinnedMessageCount', ...]`).

**Immediately AFTER that block**, add:

```typescript
// Highlights feed: pin/unpin affects what shows in the feed.
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

- [ ] **Step 5.3: Insertion 3 — edit message in MessageService**

In `src/services/MessageService.ts`, find the `else if (decryptedContent.content.type === 'edit-message')` branch at ~line 1382. The `queryClient.setQueriesData(...)` block ends at ~line 1381 (just before the `else if`).

After the entire edit-message branch body (after the closing `}` of the `setQueriesData` call inside it, around line 1438-1440 where `}` closes the branch), add:

```typescript
// Highlights feed: an edit may add or remove @everyone.
// IndexedDB was already updated in the save phase (~line 1054) before this
// cache phase runs.
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

Verify by reading the surrounding context: the invalidation must be inside the `else if (decryptedContent.content.type === 'edit-message') { ... }` body, immediately before that branch's closing `}`.

- [ ] **Step 5.4: Insertion 4 — local pin/unpin in `usePinnedMessages`**

Open `src/hooks/business/messages/usePinnedMessages.ts`. Find `doPinMessage` (around line 70) — after the `actionQueueService.enqueue('pin-message', ...)` call near line 146-156, add:

```typescript
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

Find `doUnpinMessage` in the same file (search for `doUnpinMessage`). After its own `actionQueueService.enqueue(...)` call, add the same line:

```typescript
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

- [ ] **Step 5.5: Insertion 5 — `useUpdateReadTime`**

Open `src/hooks/business/conversations/useUpdateReadTime.ts`. Find the `onSuccess` callback (line 38). After the last existing `queryClient.invalidateQueries(...)` call (around line 88, inside the `if (isDM)` block — or after the `if (isDM) { ... }` block if you want it always to run), add at the end of `onSuccess`:

```typescript
// Highlights feed: keep read/unread styling consistent with sidebar.
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

This call must be unconditional (outside the `if (isDM)` block) since highlights span both DMs and channels — though in practice DMs don't surface in the feed, the invalidation cost is trivial.

- [ ] **Step 5.6: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Zero new errors.

- [ ] **Step 5.7: Run existing test suite**

Run: `npx vitest run`
Expected: All passing tests still pass. (The new invalidation calls are additive — they should not break any existing assertions.)

- [ ] **Step 5.8: Commit**

```bash
git add src/services/MessageService.ts src/hooks/business/messages/usePinnedMessages.ts src/hooks/business/conversations/useUpdateReadTime.ts
git commit -m "feat(highlights): wire 5 invalidation sites for ['highlights'] cache"
```

---

## Task 6: Extract `SpacesEmpty` from `DiscoverPage`

**Files:**
- Create: `src/components/discover-page/SpacesEmpty.tsx`
- Modify: `src/components/discover-page/DiscoverPage.tsx`
- Modify: `src/components/discover-page/index.ts`

- [ ] **Step 6.1: Create `SpacesEmpty.tsx`**

Create `src/components/discover-page/SpacesEmpty.tsx`. Copy the existing `SpacesEmpty` component plus `SpacesEmptyCard` plus `PhoneHeader` from `DiscoverPage.tsx` (lines 17-100) into the new file. Adjust imports.

```typescript
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Button, Icon } from '../primitives';
import { useOptionalShellState } from '../shell/useShellState';
import { useSpaceModals } from '../context/SpaceModalsProvider';
import type { IconName } from '@quilibrium/quorum-shared';

/**
 * Phone-only header strip with the drawer trigger. Tab views don't have their
 * own chat-header, so this gives the user a way to reach the navigation
 * drawer on phone widths.
 */
const PhoneHeader: React.FC = () => {
  const shell = useOptionalShellState();
  if (!shell || shell.viewport !== 'phone') return null;
  return (
    <div className="chat-header text-main">
      <Button
        type="unstyled"
        onClick={shell.openDrawer}
        className="header-icon-button"
        iconName="menu"
        iconSize="lg"
        iconOnly
        ariaLabel={t`Open navigation`}
      />
    </div>
  );
};

interface SpacesEmptyCardProps {
  icon: IconName;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}

const SpacesEmptyCard: React.FC<SpacesEmptyCardProps> = ({
  icon,
  title,
  description,
  cta,
  onClick,
}) => (
  <button
    type="button"
    className="spaces-empty__card"
    onClick={onClick}
    aria-label={title}
  >
    <Icon name={icon} size="4xl" className="spaces-empty__card-icon" />
    <span className="spaces-empty__card-title">{title}</span>
    <span className="spaces-empty__card-description">{description}</span>
    <span className="spaces-empty__card-cta">
      {cta}
      <Icon name="arrow-right" size="sm" />
    </span>
  </button>
);

export const SpacesEmpty: React.FC = () => {
  const navigate = useNavigate();
  const { showAddSpaceModal, showCreateSpaceModal } = useSpaceModals();

  return (
    <>
      <PhoneHeader />
      <div className="spaces-empty">
        <div className="spaces-empty__cards">
          <SpacesEmptyCard
            icon="compass"
            title={t`Discover spaces`}
            description={t`Browse public spaces and find a community to join.`}
            cta={t`Explore`}
            onClick={() => navigate('/discover/spaces')}
          />
          <SpacesEmptyCard
            icon="link"
            title={t`Join a space`}
            description={t`Got an invite link? Hop straight in.`}
            cta={t`Join`}
            onClick={showAddSpaceModal}
          />
          <SpacesEmptyCard
            icon="plus"
            title={t`Create a space`}
            description={t`Start your own private or public community.`}
            cta={t`Create`}
            onClick={showCreateSpaceModal}
          />
        </div>
      </div>
    </>
  );
};

export default SpacesEmpty;
```

- [ ] **Step 6.2: Modify `DiscoverPage.tsx` — remove `SpacesEmpty`, remove `mode` prop**

In `src/components/discover-page/DiscoverPage.tsx`:

1. Delete the `PhoneHeader`, `SpacesEmptyCard`, `SpacesEmpty`, and `SpacesEmptyCardProps` definitions (lines 17-100).
2. Re-import the moved `PhoneHeader` if `DiscoverPage` still needs it (it does — for the discover-mode header). Either move it back as a private component inside `DiscoverPage.tsx`, or also export it from `SpacesEmpty.tsx`. **Recommended:** keep `PhoneHeader` private to `SpacesEmpty.tsx` only, and duplicate the 15-LoC `PhoneHeader` inline in `DiscoverPage.tsx`. Yes it's a small DRY violation; promoting `PhoneHeader` to a shared utility is out of scope.
3. Remove the `mode` prop from the `DiscoverPage` export signature. The new signature is `export const DiscoverPage: React.FC = () => { ... }`.
4. Remove the `if (mode === 'spaces-empty') return <SpacesEmpty />` branch from the body.

The final `DiscoverPage.tsx` body should look like:

```typescript
import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Button } from '../primitives';
import { DiscoverTab } from './DiscoverTab';
import { PeopleTab } from './PeopleTab';
import { useOptionalShellState } from '../shell/useShellState';
import './DiscoverPage.scss';

const PhoneHeader: React.FC = () => {
  const shell = useOptionalShellState();
  if (!shell || shell.viewport !== 'phone') return null;
  return (
    <div className="chat-header text-main">
      <Button
        type="unstyled"
        onClick={shell.openDrawer}
        className="header-icon-button"
        iconName="menu"
        iconSize="lg"
        iconOnly
        ariaLabel={t`Open navigation`}
      />
    </div>
  );
};

export const DiscoverPage: React.FC = () => {
  const location = useLocation();
  const isPeople = location.pathname.startsWith('/discover/people');

  return (
    <div className="discover-page">
      <PhoneHeader />
      <div className="discover-page__content" role="tabpanel">
        <React.Suspense
          fallback={<div className="discover-page__loading">{t`Loading...`}</div>}
        >
          {isPeople ? <PeopleTab /> : <DiscoverTab />}
        </React.Suspense>
      </div>
    </div>
  );
};
```

- [ ] **Step 6.3: Update `src/components/discover-page/index.ts`**

Add `SpacesEmpty` to the barrel:

```typescript
export { DiscoverPage } from './DiscoverPage';
export { SpacesEmpty } from './SpacesEmpty';
```

(Adjust to match the existing barrel — preserve any other exports.)

- [ ] **Step 6.4: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Zero new errors.

- [ ] **Step 6.5: Commit**

```bash
git add src/components/discover-page/
git commit -m "refactor(discover): extract SpacesEmpty from DiscoverPage; drop mode prop"
```

---

## Task 7: Create presentational components — Item, Empty, Skeleton

**Files:**
- Create: `src/components/highlights/HighlightItem.tsx`
- Create: `src/components/highlights/HighlightsEmpty.tsx`
- Create: `src/components/highlights/HighlightsSkeleton.tsx`

- [ ] **Step 7.1: Create `HighlightItem.tsx`**

```typescript
import * as React from 'react';
import { t } from '@lingui/core/macro';
import { useNavigate } from 'react-router-dom';
import type { Highlight } from '../../hooks/business/highlights';
import { Flex, Icon } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import SpaceIcon from '../space/SpaceIcon';
import { formatMessageDate } from '../../utils';
import { buildMessageHash } from '../../utils/messageHashNavigation';

export interface HighlightItemProps {
  highlight: Highlight;
}

export const HighlightItem: React.FC<HighlightItemProps> = ({ highlight }) => {
  const navigate = useNavigate();

  const handleClick = React.useCallback(() => {
    navigate(
      `/spaces/${highlight.spaceId}/${highlight.channelId}${buildMessageHash(highlight.messageId)}`,
    );
  }, [navigate, highlight.spaceId, highlight.channelId, highlight.messageId]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const badge = highlight.reason === 'everyone' ? (
    <span className="highlight-item__badge highlight-item__badge--everyone">
      <Icon name="megaphone" size="sm" />
      <span>@everyone</span>
    </span>
  ) : (
    <span className="highlight-item__badge highlight-item__badge--pinned">
      <Icon name="pin" size="sm" />
      <span>{t`Pinned`}</span>
    </span>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={`highlight-item${highlight.isUnread ? ' highlight-item--unread' : ''} cursor-pointer`}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-label={t`Open ${highlight.space.spaceName} #${highlight.channel.channelName}`}
    >
      <Flex align="center" className="highlight-item__source">
        <SpaceIcon
          selected={false}
          iconUrl={highlight.space.iconUrl}
          spaceName={highlight.space.spaceName}
          size="small"
          notifs={false}
          noTooltip
          spaceId={highlight.space.spaceId}
        />
        <span className="highlight-item__space-name truncate">
          {highlight.space.spaceName}
        </span>
        <Icon name="chevron-right" size="sm" className="highlight-item__sep" />
        <span className="highlight-item__channel-name truncate">
          #{highlight.channel.channelName}
        </span>
        <div className="highlight-item__spacer" />
        {badge}
      </Flex>

      <Flex className="highlight-item__body items-start">
        <UserAvatar
          userIcon={highlight.sender.iconUrl}
          displayName={highlight.sender.displayName}
          address={highlight.sender.address}
          size={36}
          className="highlight-item__avatar"
        />
        <div className="highlight-item__content">
          <Flex align="center" className="highlight-item__header">
            <span className="highlight-item__author truncate">
              {highlight.sender.displayName}
            </span>
            <span className="highlight-item__timestamp">
              {formatMessageDate(highlight.createdDate)}
            </span>
          </Flex>

          <div className="highlight-item__preview break-words">
            {highlight.preview}
            {highlight.hasMedia && highlight.mediaThumb && (
              <img
                src={highlight.mediaThumb}
                alt=""
                className="highlight-item__thumb"
              />
            )}
          </div>
        </div>
      </Flex>
    </div>
  );
};

export default HighlightItem;
```

- [ ] **Step 7.2: Create `HighlightsEmpty.tsx`**

```typescript
import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Icon } from '../primitives';

export const HighlightsEmpty: React.FC = () => (
  <div className="highlights-empty">
    <div className="highlights-empty__card">
      <Icon name="megaphone" size="4xl" className="highlights-empty__icon" />
      <span className="highlights-empty__title">{t`No highlights yet`}</span>
      <span className="highlights-empty__description">
        {t`Important messages from your spaces will show up here.`}
      </span>
    </div>
  </div>
);

export default HighlightsEmpty;
```

- [ ] **Step 7.3: Create `HighlightsSkeleton.tsx`**

```typescript
import * as React from 'react';

const SkeletonCard: React.FC = () => (
  <div className="highlight-item highlight-item--skeleton" aria-hidden="true">
    <div className="highlight-item__source">
      <div className="skeleton-block skeleton-block--circle" />
      <div className="skeleton-block skeleton-block--text skeleton-block--sm" />
    </div>
    <div className="highlight-item__body">
      <div className="skeleton-block skeleton-block--avatar" />
      <div className="highlight-item__content">
        <div className="skeleton-block skeleton-block--text skeleton-block--md" />
        <div className="skeleton-block skeleton-block--text" />
        <div className="skeleton-block skeleton-block--text" />
      </div>
    </div>
  </div>
);

export const HighlightsSkeleton: React.FC = () => (
  <div className="highlights-feed">
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </div>
);

export default HighlightsSkeleton;
```

- [ ] **Step 7.4: Commit**

```bash
git add src/components/highlights/HighlightItem.tsx src/components/highlights/HighlightsEmpty.tsx src/components/highlights/HighlightsSkeleton.tsx
git commit -m "feat(highlights): add HighlightItem, HighlightsEmpty, HighlightsSkeleton components"
```

---

## Task 8: Create the feed and route components

**Files:**
- Create: `src/components/highlights/HighlightsFeed.tsx`
- Create: `src/components/highlights/SpacesHighlights.tsx`
- Create: `src/components/highlights/index.ts`

- [ ] **Step 8.1: Create `HighlightsFeed.tsx`**

```typescript
import * as React from 'react';
import type { Highlight } from '../../hooks/business/highlights';
import { HighlightItem } from './HighlightItem';

export interface HighlightsFeedProps {
  items: Highlight[];
}

export const HighlightsFeed: React.FC<HighlightsFeedProps> = ({ items }) => (
  <div className="highlights-feed">
    {items.map((h) => (
      <HighlightItem key={h.messageId} highlight={h} />
    ))}
  </div>
);

export default HighlightsFeed;
```

- [ ] **Step 8.2: Create `SpacesHighlights.tsx`**

```typescript
import * as React from 'react';
import { t } from '@lingui/core/macro';
import { useSpaces } from '../../hooks';
import { useHighlights } from '../../hooks/business/highlights';
import { SpacesEmpty } from '../discover-page';
import { HighlightsFeed } from './HighlightsFeed';
import { HighlightsEmpty } from './HighlightsEmpty';
import { HighlightsSkeleton } from './HighlightsSkeleton';
import './SpacesHighlights.scss';

export const SpacesHighlights: React.FC = () => {
  const { data: spaces = [] } = useSpaces({});
  const { highlights, isLoading } = useHighlights();

  if (spaces.length === 0) {
    return <SpacesEmpty />;
  }

  return (
    <div className="spaces-highlights">
      <h1 className="spaces-highlights__title">{t`Highlights`}</h1>
      {isLoading ? (
        <HighlightsSkeleton />
      ) : highlights.length === 0 ? (
        <HighlightsEmpty />
      ) : (
        <HighlightsFeed items={highlights} />
      )}
    </div>
  );
};

export default SpacesHighlights;
```

- [ ] **Step 8.3: Create the barrel**

Create `src/components/highlights/index.ts`:

```typescript
export { SpacesHighlights } from './SpacesHighlights';
export { HighlightsFeed } from './HighlightsFeed';
export { HighlightItem } from './HighlightItem';
export { HighlightsEmpty } from './HighlightsEmpty';
export { HighlightsSkeleton } from './HighlightsSkeleton';
```

- [ ] **Step 8.4: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Zero new errors.

- [ ] **Step 8.5: Commit**

```bash
git add src/components/highlights/HighlightsFeed.tsx src/components/highlights/SpacesHighlights.tsx src/components/highlights/index.ts
git commit -m "feat(highlights): add HighlightsFeed and SpacesHighlights route component"
```

---

## Task 9: Add styles

**Files:**
- Create: `src/components/highlights/SpacesHighlights.scss`

- [ ] **Step 9.1: Create `SpacesHighlights.scss`**

Reference [`src/components/bookmarks/BookmarksPanel.scss`](src/components/bookmarks/BookmarksPanel.scss) for the bookmark-card visual pattern. Use only semantic variables from `src/styles/_colors.scss`. No emoji. No inline-color literals.

```scss
@use '../../styles/colors' as *;

.spaces-highlights {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px;
  overflow-y: auto;
  height: 100%;

  &__title {
    font-size: 24px;
    font-weight: 600;
    color: var(--color-text-heading);
    margin: 0 0 16px 0;
  }
}

.highlights-feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.highlight-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: 12px;
  transition: border-color 120ms ease, background 120ms ease;
  cursor: pointer;
  outline: none;

  &:hover,
  &:focus-visible {
    border-color: var(--color-accent);
    background: var(--surface-3);
  }

  &--unread {
    border-left: 3px solid var(--color-accent);
    padding-left: 13px;

    .highlight-item__author {
      font-weight: 600;
    }
  }

  &__source {
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  &__space-name {
    font-weight: 500;
    color: var(--color-text-main);
  }

  &__sep {
    color: var(--color-text-subtle);
  }

  &__spacer {
    flex: 1;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.4;

    &--everyone {
      background: var(--color-accent-soft);
      color: var(--color-accent);
    }

    &--pinned {
      background: var(--surface-4);
      color: var(--color-text-main);
    }
  }

  &__body {
    gap: 12px;
  }

  &__avatar {
    flex-shrink: 0;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__header {
    gap: 8px;
    margin-bottom: 4px;
  }

  &__author {
    font-size: 14px;
    color: var(--color-text-main);
    min-width: 0;
  }

  &__timestamp {
    font-size: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  &__preview {
    font-size: 14px;
    color: var(--color-text-main);
    line-height: 1.5;
  }

  &__thumb {
    display: block;
    width: 60px;
    height: 60px;
    border-radius: 8px;
    object-fit: cover;
    margin-top: 8px;
  }
}

.highlight-item--skeleton {
  pointer-events: none;
  cursor: default;

  &:hover,
  &:focus-visible {
    border-color: transparent;
    background: var(--surface-2);
  }
}

.skeleton-block {
  background: var(--surface-4);
  border-radius: 4px;
  animation: highlights-skeleton-pulse 1.4s ease-in-out infinite;

  &--circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  &--avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &--text {
    height: 12px;
    margin: 4px 0;
  }

  &--sm {
    width: 30%;
  }

  &--md {
    width: 50%;
  }
}

@keyframes highlights-skeleton-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.9; }
}

.highlights-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;

  &__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    max-width: 320px;
  }

  &__icon {
    color: var(--color-text-subtle);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-heading);
  }

  &__description {
    font-size: 14px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
}

@media (max-width: 480px) {
  .spaces-highlights {
    padding: 16px 12px;
  }

  .highlight-item {
    padding: 12px 14px;

    &__badge {
      font-size: 10px;
    }
  }
}
```

> **Note on semantic-variable names:** the names `--color-text-main`, `--color-text-heading`, `--surface-2`, etc., assume the existing `_colors.scss` exports them. If any of these don't exist, replace with the actual exported variable that has the same role. Run a quick `grep -h "^\\s*--color-" src/styles/_colors.scss` to verify before assuming. **Do not introduce new variables; only use existing ones.**

- [ ] **Step 9.2: Verify the SCSS variables exist**

Run: `grep -E "^\s*--(color|surface)-" src/styles/_colors.scss | head -50`

For any variable used in the SCSS above that doesn't exist, find the closest existing variable and substitute it. Use the [styling guidelines](.agents/docs/styling-guidelines.md) as the authoritative reference for which variable corresponds to which role.

- [ ] **Step 9.3: Commit**

```bash
git add src/components/highlights/SpacesHighlights.scss
git commit -m "feat(highlights): add highlights feed styles"
```

---

## Task 10: Wire the route

**Files:**
- Modify: `src/components/Router/Router.web.tsx`

- [ ] **Step 10.1: Modify the `/spaces` route**

In `src/components/Router/Router.web.tsx`, find the `/spaces` route (around line 140-155). Currently:

```typescript
<Route
  path="/spaces"
  element={
    <ModalProvider user={user} setUser={setUser}>
      <MobileProvider>
        <SidebarProvider>
          <Layout>
            <RouteErrorBoundary fallback={<Navigate to="/" replace />}>
              <DiscoverPage mode="spaces-empty" />
            </RouteErrorBoundary>
          </Layout>
        </SidebarProvider>
      </MobileProvider>
    </ModalProvider>
  }
/>
```

Replace with:

```typescript
<Route
  path="/spaces"
  element={
    <ModalProvider user={user} setUser={setUser}>
      <MobileProvider>
        <SidebarProvider>
          <Layout>
            <RouteErrorBoundary fallback={<Navigate to="/" replace />}>
              <Suspense fallback={<HighlightsSkeleton />}>
                <SpacesHighlights />
              </Suspense>
            </RouteErrorBoundary>
          </Layout>
        </SidebarProvider>
      </MobileProvider>
    </ModalProvider>
  }
/>
```

Add imports at the top of the file:

```typescript
import { SpacesHighlights, HighlightsSkeleton } from '@/components/highlights';
```

(`Suspense` is already imported on line 1: `import React, { Suspense } from 'react';`.)

- [ ] **Step 10.2: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Zero new errors.

- [ ] **Step 10.3: Build the app to catch runtime imports**

Run: `yarn build`
Expected: Build succeeds. If there are import-resolution errors, fix them.

- [ ] **Step 10.4: Commit**

```bash
git add src/components/Router/Router.web.tsx
git commit -m "feat(highlights): route /spaces to SpacesHighlights with Suspense boundary"
```

---

## Task 11: Component tests

**Files:**
- Create: `src/dev/tests/components/HighlightItem.test.tsx`
- Create: `src/dev/tests/components/SpacesHighlights.test.tsx`

- [ ] **Step 11.1: `HighlightItem.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HighlightItem } from '../../../components/highlights/HighlightItem';
import type { Highlight } from '../../../hooks/business/highlights';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const buildHighlight = (overrides: Partial<Highlight> = {}): Highlight => ({
  messageId: 'msg-1',
  spaceId: 'space-1',
  channelId: 'channel-1',
  createdDate: Date.now(),
  reason: 'everyone',
  space: { spaceId: 'space-1', spaceName: 'Test Space', iconUrl: 'icon.png' },
  channel: { channelId: 'channel-1', channelName: 'general' },
  sender: { address: 'user-1', displayName: 'Alice', iconUrl: 'alice.png' },
  preview: 'Hello world',
  hasMedia: false,
  isUnread: false,
  message: {} as any,
  ...overrides,
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('HighlightItem', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders @everyone badge when reason is "everyone"', () => {
    renderWithRouter(<HighlightItem highlight={buildHighlight({ reason: 'everyone' })} />);
    expect(screen.getByText('@everyone')).toBeInTheDocument();
  });

  it('renders Pinned badge when reason is "pinned"', () => {
    renderWithRouter(<HighlightItem highlight={buildHighlight({ reason: 'pinned' })} />);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('renders sender display name', () => {
    renderWithRouter(<HighlightItem highlight={buildHighlight()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders the preview text', () => {
    renderWithRouter(<HighlightItem highlight={buildHighlight({ preview: 'My announcement' })} />);
    expect(screen.getByText('My announcement')).toBeInTheDocument();
  });

  it('renders media thumb when hasMedia is true', () => {
    const h = buildHighlight({ hasMedia: true, mediaThumb: 'data:image/png;base64,AAAA' });
    renderWithRouter(<HighlightItem highlight={h} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,AAAA');
  });

  it('applies unread class when isUnread is true', () => {
    const { container } = renderWithRouter(<HighlightItem highlight={buildHighlight({ isUnread: true })} />);
    expect(container.querySelector('.highlight-item--unread')).toBeInTheDocument();
  });

  it('navigates with buildMessageHash format on click', () => {
    renderWithRouter(<HighlightItem highlight={buildHighlight({ messageId: 'msg-abc' })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/spaces\/space-1\/channel-1#msg-msg-abc$/),
    );
  });

  it('navigates on Enter key', () => {
    renderWithRouter(<HighlightItem highlight={buildHighlight()} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 11.2: `SpacesHighlights.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SpacesHighlights } from '../../../components/highlights/SpacesHighlights';

vi.mock('../../../hooks', () => ({
  useSpaces: vi.fn(),
}));
vi.mock('../../../hooks/business/highlights', () => ({
  useHighlights: vi.fn(),
}));
vi.mock('../../../components/discover-page', () => ({
  SpacesEmpty: () => <div data-testid="spaces-empty" />,
}));

import { useSpaces } from '../../../hooks';
import { useHighlights } from '../../../hooks/business/highlights';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('SpacesHighlights branching', () => {
  it('renders SpacesEmpty when user has no joined spaces', () => {
    (useSpaces as any).mockReturnValue({ data: [] });
    (useHighlights as any).mockReturnValue({ highlights: [], isLoading: false });

    renderWithRouter(<SpacesHighlights />);
    expect(screen.getByTestId('spaces-empty')).toBeInTheDocument();
  });

  it('renders the empty-feed state when joined spaces have no highlights', () => {
    (useSpaces as any).mockReturnValue({ data: [{ spaceId: 's1' }] });
    (useHighlights as any).mockReturnValue({ highlights: [], isLoading: false });

    renderWithRouter(<SpacesHighlights />);
    expect(screen.getByText(/No highlights yet/)).toBeInTheDocument();
  });

  it('renders the loading skeleton while loading', () => {
    (useSpaces as any).mockReturnValue({ data: [{ spaceId: 's1' }] });
    (useHighlights as any).mockReturnValue({ highlights: [], isLoading: true });

    const { container } = renderWithRouter(<SpacesHighlights />);
    expect(container.querySelector('.highlight-item--skeleton')).toBeInTheDocument();
  });

  it('renders the feed when items exist', () => {
    (useSpaces as any).mockReturnValue({ data: [{ spaceId: 's1' }] });
    (useHighlights as any).mockReturnValue({
      highlights: [{
        messageId: 'm1', spaceId: 's1', channelId: 'c1', createdDate: 0,
        reason: 'everyone',
        space: { spaceId: 's1', spaceName: 'S', iconUrl: '' },
        channel: { channelId: 'c1', channelName: 'general' },
        sender: { address: 'u1', displayName: 'Alice', iconUrl: '' },
        preview: 'Hello', hasMedia: false, isUnread: false, message: {},
      }],
      isLoading: false,
    });

    renderWithRouter(<SpacesHighlights />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

- [ ] **Step 11.3: Run the component tests**

Run: `npx vitest run src/dev/tests/components/HighlightItem.test.tsx src/dev/tests/components/SpacesHighlights.test.tsx`
Expected: All pass.

If a test fails because of a missing dependency (e.g., `UserAvatar` or `SpaceIcon` references something not in the test env), mock it minimally with `vi.mock` rather than changing the production code.

- [ ] **Step 11.4: Commit**

```bash
git add src/dev/tests/components/HighlightItem.test.tsx src/dev/tests/components/SpacesHighlights.test.tsx
git commit -m "test(highlights): component tests for HighlightItem and SpacesHighlights branching"
```

---

## Task 12: Extend mock generators for QA

**Files:**
- Modify: `src/utils/mock/mockSpaces.ts` (or whichever mock generator produces channel messages)

- [ ] **Step 12.1: Identify the mock-message generator**

Run: `grep -rn "createdDate" src/utils/mock/ | head -10`

This shows which mock generator produces messages. It's likely `mockSpaces.ts` if mock messages are generated alongside spaces, or there may be a separate `mockMessages` helper.

- [ ] **Step 12.2: Inject `@everyone` and `isPinned` on subsets**

In the mock-message generator function, modify the message-construction loop to deterministically tag a subset:

```typescript
// Existing message construction inside a loop with index `i`:
const baseMsg = { /* existing fields */ };

// New: inject highlight flags for QA.
if (i % 9 === 0) {
  baseMsg.mentions = { ...(baseMsg.mentions || {}), everyone: true };
}
if (i % 13 === 0) {
  (baseMsg as any).isPinned = true;
  (baseMsg as any).pinnedAt = baseMsg.createdDate;
}
```

The exact location depends on the existing code; insert the tagging just before the message is pushed into the returned array. The `% 9` and `% 13` are coprime so we get a mix of `@everyone`-only, pin-only, and both.

- [ ] **Step 12.3: Verify the mock pathway with the dev flag**

Manual: launch the dev server (`yarn dev`), navigate to `/spaces?spaces=10`, and confirm:
- The Highlights feed renders items
- Some items show the `@everyone` badge, some show `Pinned`, some show both (the `@everyone` wins on display)
- Clicking a card navigates to the source channel

- [ ] **Step 12.4: Commit**

```bash
git add src/utils/mock/
git commit -m "test(mock): inject @everyone and isPinned flags for highlights QA"
```

---

## Task 13: Manual QA pass

This task is a checklist, not code. Do not commit anything from this task unless you find a bug that needs a follow-up fix.

- [ ] **Step 13.1: Empty state with zero joined spaces**

Use a fresh user (or temporarily mock `useSpaces` to return `[]`). Visit `/spaces`. Confirm the three-card layout (Discover / Join / Create) renders. Each card is clickable and routes correctly.

- [ ] **Step 13.2: Empty state with joined spaces but no highlights**

Use a real user who has joined at least one space with no `@everyone` or pinned messages in the last 30 days. Visit `/spaces`. Confirm the "No highlights yet" message renders. No three cards.

- [ ] **Step 13.3: Feed with real content**

Use a user with `@everyone` and/or pinned messages across multiple spaces. Visit `/spaces`. Confirm:
- Items render in reverse-chronological order
- Each item shows space name, channel name, author, timestamp, preview, and the correct badge
- `@everyone` badge wins when a message has both
- Markdown is stripped (no `**` or `__` in preview)
- Long messages are truncated with `…`
- Unread items have a visible accent border

- [ ] **Step 13.4: Mute behavior**

Mute a space that has highlights. Confirm its items disappear from the feed. Unmute. Confirm they reappear.

Mute a single channel inside an unmuted space. Confirm only that channel's items disappear.

- [ ] **Step 13.5: Click-through**

Click an item. Confirm it navigates to the channel and scrolls to / highlights the target message. The hash highlight should fade after the standard duration.

- [ ] **Step 13.6: Read-state updates**

Open a channel containing an unread highlight. Scroll past it. Return to `/spaces`. Confirm the item's unread border disappears within ~1 second (driven by Insertion 5 — the `useUpdateReadTime` invalidation).

- [ ] **Step 13.7: Live invalidation — local pin**

In a space, pin a message you wrote. Navigate to `/spaces`. Confirm the new pin appears at the top of the feed without needing a manual refresh.

- [ ] **Step 13.8: Performance — heavy user**

Visit `/spaces?spaces=30`. Open Chrome DevTools Performance tab. Reload the page and stop recording when the feed has rendered. Confirm the `useHighlights` queryFn completes in under 250ms on a typical laptop. If it's significantly slower, capture the profile for investigation — do not block the merge unless > 1s.

- [ ] **Step 13.9: Phone-width responsive**

In DevTools, switch to a phone viewport (e.g., 375×667). Confirm the feed renders at full column width, the drawer button is reachable, and item cards remain readable. No horizontal scroll.

- [ ] **Step 13.10: Type-checker and full test suite**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Run: `npx vitest run`
Expected: Zero new TS errors. All tests pass.

If anything in Steps 13.1–13.9 fails, file a follow-up task in `.agents/tasks/` and fix before merging. Do not silently land a broken feature.

---

## Task 14: Documentation

**Files:**
- Create: `.agents/docs/features/highlights-feed.md`
- Modify: `.agents/INDEX.md`

- [ ] **Step 14.1: Write the feature doc**

Create `.agents/docs/features/highlights-feed.md`. Summarize:
- What the feature is (1-2 paragraphs)
- File map (which files own what)
- The five invalidation sites and why each exists
- How to extend the feed (e.g., adding threads in v2)
- Known limitations and v2 deferred items

Use the existing feature docs in `.agents/docs/features/` (e.g., `bookmarks.md`, `pinned-messages.md`) as a structural template.

- [ ] **Step 14.2: Add the doc to `.agents/INDEX.md`**

Under the `### Features` section, add an alphabetically-sorted entry:

```markdown
- [Highlights Feed](docs/features/highlights-feed.md)
```

- [ ] **Step 14.3: Commit**

```bash
git add .agents/docs/features/highlights-feed.md .agents/INDEX.md
git commit -m "docs(highlights): add feature documentation"
```

---

## Task 15: Final commit-ready check

- [ ] **Step 15.1: Run full type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: Zero errors (or only pre-existing ones from Step 0.2).

- [ ] **Step 15.2: Run full test suite**

Run: `npx vitest run`
Expected: All passing. Note total test count — should be roughly 384 (pre-existing) + ~25 new = ~409.

- [ ] **Step 15.3: Run lint**

Run: `yarn lint`
Expected: Zero errors. Warnings acceptable if they match the existing baseline.

- [ ] **Step 15.4: Verify the commit log is clean**

Run: `git log --oneline -20`

Each commit should be small, focused, and have a descriptive message. If you have any "wip" or "fix" commits, squash them via interactive rebase (or accept and move on — squash is optional).

- [ ] **Step 15.5: Ready-to-ship state**

At this point: the feature is implemented, tested, documented, and committed. The branch is ready for review or merge to `main`.

---

## Out of scope (do not implement)

Per the spec, the following are deferred to v2:

- Threads in the feed
- Filter UI (per-space chips, content-type toggles)
- "N new items" pill / live insertion animation
- Inline expansion / read-more
- Inline reaction interaction
- Per-user dismissal of feed items
- Mobile parity (separate `quorum-mobile` task)
- Migration to `quorum-shared` (waits for PR #4 unblock)

If during implementation you find yourself wanting to add any of these, stop and flag it. They are explicitly out of v1 scope.

---

*Last updated: 2026-06-04*
