# Space/Channel Thread Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-level toggle system (space + channel) that controls whether threads are available, with non-destructive disable behavior that unfilters thread replies into the main feed.

**Architecture:** Add `allowThreads?: boolean` to both `Space` and `Channel` types. Compute `threadsEnabled = !!space.allowThreads && (channel.allowThreads !== false)` in `Channel.tsx`. Gate all thread UI entry points on this flag and make the three `isThreadReply` filter layers conditional.

**Tech Stack:** React, TypeScript, IndexedDB, React Query, Lingui i18n

**Spec:** `.agents/tasks/2026-03-14-space-channel-thread-toggle-design.md`

---

## Chunk 1: Data Model & Filter Layers

### Task 1: Add `allowThreads` to Space and Channel types

**Files:**
- Modify: `src/api/quorumApi.ts`

- [ ] **Step 1: Add `allowThreads` to `Space` type**

In `src/api/quorumApi.ts`, add after the `spaceTag` field (line 57):

```typescript
  allowThreads?: boolean; // Master gate: threads enabled in this space (default: off)
```

- [ ] **Step 2: Add `allowThreads` to `Channel` type**

In `src/api/quorumApi.ts`, add after the `iconVariant` field (line 84):

```typescript
  allowThreads?: boolean; // Per-channel override (default: on when space enables threads)
```

- [ ] **Step 3: Commit**

```bash
git add src/api/quorumApi.ts
git commit -m "$(cat <<'EOF'
feat: add allowThreads field to Space and Channel types

Two-level thread toggle: Space.allowThreads is the master gate (default off),
Channel.allowThreads is per-channel override (default on when space enables).
EOF
)"
```

---

### Task 2: Add `includeThreadReplies` option to DB `getMessages()`

**Files:**
- Modify: `src/db/messages.ts`

- [ ] **Step 1: Add `includeThreadReplies` parameter to `getMessages()`**

In `src/db/messages.ts`, modify the `getMessages` method signature (around line 395-405). Add `includeThreadReplies?: boolean` to the params object:

```typescript
  async getMessages({
    spaceId,
    channelId,
    cursor,
    direction = 'backward',
    limit = 100,
    includeThreadReplies = false,
  }: {
    spaceId: string;
    channelId: string;
    cursor?: number;
    direction?: 'forward' | 'backward';
    limit?: number;
    includeThreadReplies?: boolean;
  }): Promise<{
```

- [ ] **Step 2: Make the `isThreadReply` cursor skip conditional**

In `src/db/messages.ts` around line 452-456, change:

```typescript
          if (cursor.value.isThreadReply) {
            cursor.continue();
            return;
          }
```

to:

```typescript
          if (!includeThreadReplies && cursor.value.isThreadReply) {
            cursor.continue();
            return;
          }
```

- [ ] **Step 3: Commit**

```bash
git add src/db/messages.ts
git commit -m "$(cat <<'EOF'
feat: add includeThreadReplies option to getMessages()

When true, thread replies are not filtered from the cursor iteration,
allowing them to appear in the main channel feed.
EOF
)"
```

---

### Task 3: Add `includeThreadReplies` option to DB `getFirstUnreadMessage()`

**Files:**
- Modify: `src/db/messages.ts`

- [ ] **Step 1: Add `includeThreadReplies` parameter to `getFirstUnreadMessage()`**

In `src/db/messages.ts`, modify the `getFirstUnreadMessage` method signature (around line 2189-2197):

```typescript
  async getFirstUnreadMessage({
    spaceId,
    channelId,
    afterTimestamp,
    includeThreadReplies = false,
  }: {
    spaceId: string;
    channelId: string;
    afterTimestamp: number;
    includeThreadReplies?: boolean;
  }): Promise<{ messageId: string; timestamp: number } | null> {
```

- [ ] **Step 2: Make the `isThreadReply` skip conditional**

In `src/db/messages.ts` around line 2220-2223, change:

```typescript
          if (message.isThreadReply) {
            cursor.continue();
            return;
          }
```

to:

```typescript
          if (!includeThreadReplies && message.isThreadReply) {
            cursor.continue();
            return;
          }
```

- [ ] **Step 3: Commit**

```bash
git add src/db/messages.ts
git commit -m "$(cat <<'EOF'
feat: add includeThreadReplies option to getFirstUnreadMessage()

When true, thread replies are included in unread message detection,
matching the getMessages() pattern.
EOF
)"
```

---

### Task 4: Thread `includeThreadReplies` through the hook chain

**Files:**
- Modify: `src/hooks/queries/messages/buildMessagesFetcher.ts`
- Modify: `src/hooks/queries/messages/buildMessagesKey.ts`
- Modify: `src/hooks/queries/messages/useMessages.ts`
- Modify: `src/hooks/business/channels/useChannelMessages.ts`

- [ ] **Step 1: Add `includeThreadReplies` to `buildMessagesFetcher`**

In `src/hooks/queries/messages/buildMessagesFetcher.ts`, modify `determineInitialCursor` (around line 15-23) to accept and pass the flag:

```typescript
async function determineInitialCursor({
  messageDB,
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}): Promise<number | null> {
```

Then update the `getFirstUnreadMessage` call (around line 41-45):

```typescript
  const firstUnread = await messageDB.getFirstUnreadMessage({
    spaceId,
    channelId,
    afterTimestamp: lastReadTimestamp,
    includeThreadReplies,
  });
```

Modify `buildMessagesFetcher` params (around line 52-60) to accept and pass the flag:

```typescript
const buildMessagesFetcher = ({
  messageDB,
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}) =>
```

Pass `includeThreadReplies` to `determineInitialCursor` (around line 65):

```typescript
      effectiveCursor = await determineInitialCursor({
        messageDB,
        spaceId,
        channelId,
        includeThreadReplies,
      });
```

Pass `includeThreadReplies` to `messageDB.getMessages()` (around line 72):

```typescript
    const response = await messageDB.getMessages({
      spaceId,
      channelId,
      cursor: effectiveCursor,
      direction: cursor?.direction,
      includeThreadReplies,
    });
```

- [ ] **Step 2: Add `includeThreadReplies` to `useMessages` and query key**

In `src/hooks/queries/messages/useMessages.ts`, modify the hook params (around line 7-13):

```typescript
const useMessages = ({
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}) => {
```

Pass it to `buildMessagesFetcher` (around line 19):

```typescript
    queryFn: buildMessagesFetcher({ messageDB, spaceId, channelId, includeThreadReplies }),
```

**CRITICAL:** Also include `includeThreadReplies` in the query key so React Query refetches when the toggle changes. In `src/hooks/queries/messages/buildMessagesKey.ts`, modify:

```typescript
const buildMessagesKey = ({
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}) => ['Messages', spaceId, channelId, includeThreadReplies ? 'with-threads' : 'no-threads'];
```

Then update the `queryKey` in `useMessages`:

```typescript
    queryKey: buildMessagesKey({ spaceId, channelId, includeThreadReplies }),
```

**Note:** Other callers of `buildMessagesKey` (e.g., cache invalidation in `MessageService`) don't pass `includeThreadReplies`, so they'll default to `false` and produce the key `['Messages', spaceId, channelId, 'no-threads']`. This means cache invalidation from `MessageService` will match the default key. When `includeThreadReplies` is `true`, the query uses a different key — which is correct because it's a different dataset. Any cache manipulation that uses `buildMessagesKey` without the flag will need to be checked — search for all `buildMessagesKey` usages and verify they either:
  - Don't need the `includeThreadReplies` flag (most cache operations happen in threads-enabled context)
  - Or use `queryClient.invalidateQueries({ queryKey: ['Messages', spaceId, channelId] })` with partial matching (React Query matches prefixes by default)

React Query's `invalidateQueries` uses **prefix matching** by default, so `['Messages', spaceId, channelId]` will match both `['Messages', spaceId, channelId, 'no-threads']` and `['Messages', spaceId, channelId, 'with-threads']`. This means existing `invalidateQueries` calls will continue to work correctly without modification.

- [ ] **Step 3: Add `threadsEnabled` to `useChannelMessages` and make filter conditional**

In `src/hooks/business/channels/useChannelMessages.ts`, add `threadsEnabled` to the props interface (around line 11-23):

```typescript
interface UseChannelMessagesProps {
  spaceId: string;
  channelId: string;
  roles: Role[];
  members: {
    [address: string]: {
      address: string;
      userIcon?: string;
      displayName?: string;
    };
  };
  channel?: Channel;
  threadsEnabled?: boolean;
}
```

Destructure it (around line 25-31):

```typescript
export function useChannelMessages({
  spaceId,
  channelId,
  roles,
  members,
  channel,
  threadsEnabled = false,
}: UseChannelMessagesProps) {
```

Pass `includeThreadReplies: !threadsEnabled` to `useMessages` (around line 33-36):

```typescript
  const { data: messages, fetchPreviousPage, fetchNextPage, hasNextPage } = useMessages({
    spaceId,
    channelId,
    includeThreadReplies: !threadsEnabled,
  });
```

Make the React filter conditional (around line 74):

Change:
```typescript
      if (msg.isThreadReply) return false;
```

To:
```typescript
      if (msg.isThreadReply && threadsEnabled) return false;
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/queries/messages/buildMessagesFetcher.ts src/hooks/queries/messages/buildMessagesKey.ts src/hooks/queries/messages/useMessages.ts src/hooks/business/channels/useChannelMessages.ts
git commit -m "$(cat <<'EOF'
feat: thread includeThreadReplies flag through hook chain

buildMessagesFetcher -> useMessages -> useChannelMessages all accept
the flag. Query key includes the flag so React Query refetches on toggle.
The React-layer isThreadReply filter is now conditional on threadsEnabled.
EOF
)"
```

---

### Task 5: Make `loadMessagesAround` conditional on `threadsEnabled`

**Files:**
- Modify: `src/hooks/queries/messages/loadMessagesAround.ts`

- [ ] **Step 1: Add `includeThreadReplies` parameter**

In `src/hooks/queries/messages/loadMessagesAround.ts`, add the parameter (around line 19-32):

```typescript
export async function loadMessagesAround({
  messageDB,
  spaceId,
  channelId,
  targetMessageId,
  beforeLimit = 40,
  afterLimit = 40,
  includeThreadReplies = false,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  targetMessageId: string;
  beforeLimit?: number;
  afterLimit?: number;
  includeThreadReplies?: boolean;
}): Promise<{
```

- [ ] **Step 2: Pass to `getMessages` calls and make target exclusion conditional**

Pass `includeThreadReplies` to both `getMessages` calls (around lines 53, 62):

```typescript
  const beforeResponse = await messageDB.getMessages({
    spaceId,
    channelId,
    cursor: targetTimestamp,
    direction: 'backward',
    limit: beforeLimit,
    includeThreadReplies,
  });

  const afterResponse = await messageDB.getMessages({
    spaceId,
    channelId,
    cursor: targetTimestamp,
    direction: 'forward',
    limit: afterLimit,
    includeThreadReplies,
  });
```

Make the target message exclusion conditional (around line 78):

Change:
```typescript
    ...(targetMessage.isThreadReply ? [] : [targetMessage]),
```

To:
```typescript
    ...(targetMessage.isThreadReply && !includeThreadReplies ? [] : [targetMessage]),
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/queries/messages/loadMessagesAround.ts
git commit -m "$(cat <<'EOF'
feat: add includeThreadReplies to loadMessagesAround

Passes the flag through to getMessages calls and makes the target
message thread reply exclusion conditional.
EOF
)"
```

---

## Chunk 2: UI Gating & Settings

### Task 6: Compute `threadsEnabled` in Channel.tsx and gate thread UI

**Files:**
- Modify: `src/components/space/Channel.tsx`

- [ ] **Step 1: Compute `threadsEnabled` after channel data is loaded**

In `src/components/space/Channel.tsx`, after the `useChannelData` call (around line 240), add:

```typescript
  // Thread toggle: space-level master gate + channel-level override
  const threadsEnabled = !!space?.allowThreads && (channel?.allowThreads !== false);
```

- [ ] **Step 2: Pass `threadsEnabled` to `useChannelMessages`**

Modify the `useChannelMessages` call (around line 252):

```typescript
  } = useChannelMessages({ spaceId, channelId, roles, members, channel, threadsEnabled });
```

- [ ] **Step 3: Conditionally pass `onStartThread` to MessageList**

Around line 1578, change:

```typescript
                onStartThread={handleOpenThread}
```

To:

```typescript
                onStartThread={threadsEnabled ? handleOpenThread : undefined}
```

- [ ] **Step 4: Conditionally render the Threads header button and ThreadsListPanel**

Around lines 1370-1393, wrap the Threads button block in a `threadsEnabled` check:

```typescript
              {threadsEnabled && (
              <div className="relative">
                <Tooltip
                  id={`threads-${channelId}`}
                  content={t`Threads`}
                  showOnTouch={false}
                >
                  <Button
                    type="unstyled"
                    onClick={() => setActivePanel(p => p === 'threads' ? null : 'threads')}
                    className={`header-icon-button ${activePanel === 'threads' ? 'active' : ''}`}
                    iconName="messages"
                    iconSize={headerIconSize}
                    iconVariant={activePanel === 'threads' ? 'filled' : 'outline'}
                    iconOnly
                  />
                </Tooltip>
                <ThreadsListPanel
                  isOpen={activePanel === 'threads'}
                  onClose={() => setActivePanel(null)}
                  spaceId={spaceId}
                  channelId={channelId}
                  mapSenderToUser={mapSenderToUser}
                />
              </div>
              )}
```

- [ ] **Step 5: Skip thread hash navigation when threads are disabled**

In the thread hash navigation `useEffect` (around line 958-962), add a guard after the `parsed` check:

```typescript
    const parsed = parseMessageHash(hash);
    if (!parsed || parsed.type !== 'threadMessage') return;
    if (!threadsEnabled) {
      // Threads disabled — fall through to regular message navigation
      // Thread replies are visible inline, so the message can be found in the main feed
      return;
    }
```

Add `threadsEnabled` to the effect's dependency array.

- [ ] **Step 6: Pass `includeThreadReplies` to `loadMessagesAround` calls**

Find all `loadMessagesAround` calls in `Channel.tsx` and add `includeThreadReplies: !threadsEnabled`. Search for `loadMessagesAround({` and add the parameter to each call.

- [ ] **Step 7: Commit**

```bash
git add src/components/space/Channel.tsx
git commit -m "$(cat <<'EOF'
feat: gate thread UI on threadsEnabled in Channel.tsx

Computes threadsEnabled from space and channel allowThreads fields.
Conditionally shows/hides thread header button, ThreadsListPanel,
onStartThread prop, and thread hash navigation.
EOF
)"
```

---

### Task 7: Add `allowThreads` to `useSpaceManagement` hook

**Files:**
- Modify: `src/hooks/business/spaces/useSpaceManagement.ts`

- [ ] **Step 1: Add `allowThreads` state and return values**

Add state (after `saveEditHistory` state, around line 49):

```typescript
  const [allowThreads, setAllowThreads] = useState(false);
```

In the `useEffect` that syncs space data (around line 62-68), add:

```typescript
      setAllowThreads(space.allowThreads ?? false);
```

In the `saveChanges` callback, add `allowThreads` to the `updatedSpace` object (around line 95-102):

```typescript
      const updatedSpace = {
        ...space,
        spaceName,
        iconUrl,
        bannerUrl,
        isRepudiable,
        saveEditHistory,
        allowThreads,
      };
```

Add `allowThreads` to the `saveChanges` dependency array (around line 118).

- [ ] **Step 2: Add to return interface and return object**

Add to `UseSpaceManagementReturn` interface (after `setSaveEditHistory`, around line 24):

```typescript
  allowThreads: boolean;
  setAllowThreads: (allowThreads: boolean) => void;
```

Add to return object (after `setSaveEditHistory`, around line 180):

```typescript
    allowThreads,
    setAllowThreads,
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/spaces/useSpaceManagement.ts
git commit -m "$(cat <<'EOF'
feat: add allowThreads state to useSpaceManagement

Follows the same pattern as isRepudiable and saveEditHistory.
Syncs from space data on load, included in saveChanges.
EOF
)"
```

---

### Task 8: Add "Allow Threads" toggle to Space Settings General tab

**Files:**
- Modify: `src/components/modals/SpaceSettingsModal/General.tsx`
- Modify: `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`

- [ ] **Step 1: Add props to `GeneralProps` interface**

In `src/components/modals/SpaceSettingsModal/General.tsx`, add to the `GeneralProps` interface (after `setSaveEditHistory`, around line 60):

```typescript
  allowThreads: boolean;
  setAllowThreads: (value: boolean) => void;
```

- [ ] **Step 2: Destructure the new props**

In the component's destructured props (after `setSaveEditHistory`, around line 101):

```typescript
  allowThreads,
  setAllowThreads,
```

- [ ] **Step 3: Rename section title and add toggle**

In `src/components/modals/SpaceSettingsModal/General.tsx`, around line 283-284, change:

```typescript
        <div className="text-subtitle-2 mb-2">
          <Trans>Privacy Settings</Trans>
        </div>
```

To:

```typescript
        <div className="text-subtitle-2 mb-2">
          <Trans>Features</Trans>
        </div>
```

After the `showEditHistoryToggle` block closing `</>` (around line 335-336), before the closing `</div>` of the `modal-content-info` container (line 337), add the Allow Threads toggle:

```typescript
          <div className="flex flex-row items-center gap-3 mt-3">
            <Switch
              onChange={() => setAllowThreads(!allowThreads)}
              value={allowThreads}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                <Trans>Allow Threads</Trans>
              </div>
              <Tooltip
                id="allow-threads-tooltip"
                content={t`Enable threaded conversations in channels`}
                place="bottom"
                className="!w-[400px]"
                maxWidth={400}
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                />
              </Tooltip>
            </div>
          </div>
```

- [ ] **Step 4: Pass props from SpaceSettingsModal**

In `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`, destructure `allowThreads` and `setAllowThreads` from `useSpaceManagement` (around line 140-157):

Add to the destructured values:
```typescript
    allowThreads,
    setAllowThreads,
```

Add `allowThreads` to the `saveChanges` callback where the updated space is built (around line 375-388):

```typescript
      await updateSpace({
        ...space,
        spaceName,
        defaultChannelId: defaultChannel?.channelId || space.defaultChannelId,
        isRepudiable,
        saveEditHistory,
        allowThreads,
        iconUrl,
        bannerUrl,
        roles,
        emojis,
        stickers,
        description,
        spaceTag: buildSpaceTag(),
      });
```

Add `allowThreads` to the `saveChanges` dependency array (around line 390-409).

Pass the props to `General` component (after `setSaveEditHistory`, around line 518):

```typescript
                          allowThreads={allowThreads}
                          setAllowThreads={setAllowThreads}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/SpaceSettingsModal/General.tsx src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx
git commit -m "$(cat <<'EOF'
feat: add Allow Threads toggle to Space Settings General tab

Renames 'Privacy Settings' section to 'Features'. Adds a Switch toggle
with tooltip for enabling threaded conversations space-wide.
EOF
)"
```

---

### Task 9: Add `allowThreads` to Channel Editor Modal

**Files:**
- Modify: `src/hooks/business/channels/useChannelManagement.ts`
- Modify: `src/components/modals/ChannelEditorModal.tsx`

- [ ] **Step 1: Add `allowThreads` to `ChannelData` interface**

In `src/hooks/business/channels/useChannelManagement.ts`, add to `ChannelData` (after `iconVariant`, around line 23):

```typescript
  allowThreads?: boolean;
```

- [ ] **Step 2: Initialize and sync `allowThreads` in channel data state**

In the `useState<ChannelData>` initializer (around line 48-58), add:

```typescript
    allowThreads: currentChannel?.allowThreads,
```

In the `useEffect` that syncs channel data (around line 70-90), add to the `setChannelData` call:

```typescript
          allowThreads: channel.allowThreads,
```

- [ ] **Step 3: Add handler for allowThreads toggle**

After the `handlePinChange` callback (around line 150), add:

```typescript
  // Handle allow threads toggle
  const handleAllowThreadsChange = useCallback((value: boolean) => {
    setChannelData((prev) => ({ ...prev, allowThreads: value }));
  }, []);
```

- [ ] **Step 4: Add `allowThreads` to save flow**

In `saveChanges`, where the channel object is built for update (around line 180-189), add:

```typescript
                          allowThreads: channelData.allowThreads,
```

And in the create path (around line 210-221), add:

```typescript
                      allowThreads: channelData.allowThreads,
```

- [ ] **Step 5: Export `allowThreads` and handler from hook**

Add to the return object (around line 352-383):

In the State section:
```typescript
    allowThreads: channelData.allowThreads,
```

In the Actions section:
```typescript
    handleAllowThreadsChange,
```

- [ ] **Step 6: Add toggle to ChannelEditorModal**

In `src/components/modals/ChannelEditorModal.tsx`, destructure from hook (around line 39-67), add:

```typescript
    allowThreads,
    handleAllowThreadsChange,
```

The modal also needs access to the space to check `space.allowThreads`. Add `useSpace` import and hook call:

```typescript
import { useSpace } from '../../hooks/queries';
```

Inside the component, before the return:

```typescript
  const { data: space } = useSpace({ spaceId });
```

After the "Read only" toggle section (around line 156, after the `</Container>` closing the read-only switch), add the conditional threads toggle:

```typescript
        {space?.allowThreads && (
          <Container className="mb-3">
            <Flex className="items-center gap-3">
              <Switch
                value={allowThreads !== false}
                onChange={() => handleAllowThreadsChange(allowThreads === false ? undefined : false)}
                accessibilityLabel={t`Allow threads in this channel`}
              />
              <div className="text-label-strong">
                <Trans>Allow Threads</Trans>
              </div>
            </Flex>
          </Container>
        )}
```

Note: The toggle value uses `allowThreads !== false` because `undefined` means "on" (default). Toggling off sets it to `false`, toggling on sets it back to `undefined` (removing the explicit override).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/business/channels/useChannelManagement.ts src/components/modals/ChannelEditorModal.tsx
git commit -m "$(cat <<'EOF'
feat: add Allow Threads toggle to Channel Editor Modal

Only visible when space.allowThreads is true. Uses the opposite-default
pattern: undefined = on, explicit false = off.
EOF
)"
```

---

### Task 10: Verify and test

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: No type errors.

- [ ] **Step 2: Run linter**

```bash
yarn lint
```

Expected: No lint errors in modified files.

- [ ] **Step 3: Run build**

```bash
yarn build
```

Expected: Successful build.

- [ ] **Step 4: Manual verification checklist**

Test the following scenarios in the running app:

1. Space Settings → General → "Features" section shows "Allow Threads" toggle (off by default)
2. Toggle on → thread UI appears in channels (context menu, ThreadIndicator, Threads button)
3. Toggle off → thread UI disappears, thread replies appear inline in main feed
4. Channel Editor → "Allow Threads" toggle only visible when space toggle is on
5. Channel toggle off → threads disabled in that channel only
6. Channel toggle on → threads re-enabled, replies return to thread view
7. Bookmark/search with thread hash while threads disabled → scrolls to message inline

- [ ] **Step 5: Final commit (if any fixes needed)**

---

_Created: 2026-03-14_
_Updated: 2026-03-14 (plan review fix: added includeThreadReplies to buildMessagesKey query key to ensure React Query refetches on toggle change)_
