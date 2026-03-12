# Mobile Thread Reply Visibility Implementation Plan

not applicable

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make thread replies visible to mobile users by surfacing them inline in the main message feed with a root-message quote preview, preventing data loss while the mobile hub lacks a thread panel.

**Architecture:** Add a `supportsThreadPanel` capability flag to `platformFeatures` in both platform files (`platform.ts` for web/Electron, `platform.native.ts` for React Native). Gate the four existing `isThreadReply` filter points behind this flag so they become no-ops on mobile. Add a small adapter in `Message.tsx` that renders the existing reply-quote component for thread replies on mobile, looking up the root message by `message.threadId` (a top-level field on `Message`, not inside `message.content`).

**Tech Stack:** TypeScript, React, IndexedDB (via custom DB layer), React Query, React Router

**Spec:** `.agents/tasks/2026-03-11-mobile-thread-reply-visibility.md`

---

## Chunk 1: Platform Capability Flag

**Files:**
- Modify: `src/utils/platform.ts`
- Modify: `src/utils/platform.native.ts`

### Task 1: Add `supportsThreadPanel` to `platformFeatures` (web/Electron)

**File:** `src/utils/platform.ts`

The `platformFeatures` object is at line 214.

- [ ] **Step 1: Add the `supportsThreadPanel` flag**

  Find this block (lines 214–223):
  ```ts
  export const platformFeatures = {
    hasFileSystem: isElectron(),
    hasNativeNotifications: isElectron() || isMobile(),
    hasCamera: isMobile(),
    hasDeepLinking: isMobile() || isElectron(),
    hasPushNotifications: isMobile(),
    hasTouch: typeof window !== 'undefined' ? isTouchDevice() : false,
    supportsSmoothScrolling:
      typeof window !== 'undefined' ? supportsSmoothScrolling() : false,
  };
  ```

  Replace with:
  ```ts
  export const platformFeatures = {
    hasFileSystem: isElectron(),
    hasNativeNotifications: isElectron() || isMobile(),
    hasCamera: isMobile(),
    hasDeepLinking: isMobile() || isElectron(),
    hasPushNotifications: isMobile(),
    hasTouch: typeof window !== 'undefined' ? isTouchDevice() : false,
    supportsSmoothScrolling:
      typeof window !== 'undefined' ? supportsSmoothScrolling() : false,
    supportsThreadPanel: !isMobile(),
  };
  ```

  On web/Electron, `isMobile()` checks `navigator.product === 'ReactNative'` — always `false` in a browser/Electron context — so this evaluates to `true`. Desktop behavior is unchanged.

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

  Expected: no errors related to `platformFeatures`.

---

### Task 2: Add `supportsThreadPanel` to `platformFeatures` (React Native)

**File:** `src/utils/platform.native.ts`

The React Native `platformFeatures` object is at line 61. This file is resolved instead of `platform.ts` by the React Native bundler's module aliasing. It must be updated independently.

- [ ] **Step 1: Add the `supportsThreadPanel` flag**

  Find this block (lines 61–67):
  ```ts
  export const platformFeatures = {
    hasFileSystem: false,
    hasNativeNotifications: true,
    hasCamera: true,
    hasDeepLinking: true,
    hasPushNotifications: true,
  };
  ```

  Replace with:
  ```ts
  export const platformFeatures = {
    hasFileSystem: false,
    hasNativeNotifications: true,
    hasCamera: true,
    hasDeepLinking: true,
    hasPushNotifications: true,
    supportsThreadPanel: false,
  };
  ```

  `false` because mobile never has a thread panel under this spec. When mobile eventually gets one, flip this to `true` and all filter behavior restores automatically.

- [ ] **Step 2: Commit**

  ```bash
  git add src/utils/platform.ts src/utils/platform.native.ts
  git commit -m "feat: add supportsThreadPanel capability flag to platformFeatures"
  ```

---

## Chunk 2: Filter Point Guards

**Files:**
- Modify: `src/db/messages.ts`
- Modify: `src/hooks/business/channels/useChannelMessages.ts`
- Modify: `src/hooks/queries/messages/loadMessagesAround.ts`

These are the four places that currently filter `isThreadReply` from the main feed. Each gets a one-line guard. On desktop (`supportsThreadPanel: true`) the conditions are logically identical to today. On mobile (`supportsThreadPanel: false`) the filters are skipped.

---

### Task 3: Guard filter in `getMessages()`

**File:** `src/db/messages.ts`

- [ ] **Step 1: Add the required import**

  `messages.ts` does not currently import `platformFeatures`. The existing imports at lines 1–8 are all package/local imports ending with `import MiniSearch from 'minisearch';` at line 8. Add the new import after line 8, before the first `export interface`:
  ```ts
  import { platformFeatures } from '../utils/platform';
  ```

- [ ] **Step 2: Add the platform guard**

  Find this block (starting at line 439):
  ```ts
  if (cursor.value.isThreadReply) {
    cursor.continue();
    return;
  }
  ```

  Replace with:
  ```ts
  if (platformFeatures.supportsThreadPanel && cursor.value.isThreadReply) {
    cursor.continue();
    return;
  }
  ```

---

### Task 4: Guard filter in `getFirstUnreadMessage()`

**File:** `src/db/messages.ts` (same file, second change)

- [ ] **Step 1: Add the platform guard**

  Find this block (starting at line 2065):
  ```ts
  if (message.isThreadReply) {
    cursor.continue();
    return;
  }
  ```

  Replace with:
  ```ts
  if (platformFeatures.supportsThreadPanel && message.isThreadReply) {
    cursor.continue();
    return;
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

  Expected: no errors.

---

### Task 5: Guard filter in `useChannelMessages`

**File:** `src/hooks/business/channels/useChannelMessages.ts`

- [ ] **Step 1: Add the required import**

  This file does not currently import `platformFeatures`. Add this import:
  ```ts
  import { platformFeatures } from '../../../utils/platform';
  ```

- [ ] **Step 2: Add the platform guard**

  Find the `isThreadReply` filter at line 74 inside the `allMessages.filter` callback. The surrounding block looks like:
  ```ts
  const seen = new Set<string>();
  return allMessages.filter((msg) => {
    if (seen.has(msg.messageId)) return false;
    if (msg.isThreadReply) return false;
    seen.add(msg.messageId);
    return true;
  });
  ```

  Replace with:
  ```ts
  const seen = new Set<string>();
  return allMessages.filter((msg) => {
    if (seen.has(msg.messageId)) return false;
    if (platformFeatures.supportsThreadPanel && msg.isThreadReply) return false;
    seen.add(msg.messageId);
    return true;
  });
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

  Expected: no errors.

---

### Task 6: Guard filter in `loadMessagesAround`

**File:** `src/hooks/queries/messages/loadMessagesAround.ts`

This is the critical fourth filter point. It is hit when a user taps a quote preview that navigates to a message not currently in the visible window. Without this guard, the tap target would be silently dropped, leaving the user scrolled to empty space.

- [ ] **Step 1: Add the required import**

  This file does not currently import `platformFeatures`. Add this import:
  ```ts
  import { platformFeatures } from '../../../utils/platform';
  ```

- [ ] **Step 2: Add the platform guard**

  Find this block (lines 76–80):
  ```ts
  const messages = [
    ...beforeResponse.messages,
    ...(targetMessage.isThreadReply ? [] : [targetMessage]),
    ...afterResponse.messages,
  ];
  ```

  Replace with:
  ```ts
  const messages = [
    ...beforeResponse.messages,
    ...(!platformFeatures.supportsThreadPanel || !targetMessage.isThreadReply
      ? [targetMessage]
      : []),
    ...afterResponse.messages,
  ];
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/db/messages.ts src/hooks/business/channels/useChannelMessages.ts src/hooks/queries/messages/loadMessagesAround.ts
  git commit -m "feat: gate isThreadReply filters behind supportsThreadPanel flag"
  ```

---

## Chunk 3: Reply Preview Adapter in Message.tsx

**Files:**
- Modify: `src/components/message/Message.tsx`

On mobile, thread replies now appear in the main feed but have no `repliesToMessageId` — so no quote preview would render without this change. This task adds a lookup path using `message.threadId` (a **top-level field on `Message`**, not inside `message.content`) that feeds into the same existing quote rendering component.

---

### Task 7: Add thread-root quote preview for mobile thread replies

**File:** `src/components/message/Message.tsx`

- [ ] **Step 1: Extend the existing platform import**

  `src/components/message/Message.tsx` already imports from `../../utils/platform` at line 52:
  ```ts
  import { isTouchDevice } from '../../utils/platform';
  ```

  Extend it to also import `platformFeatures`:
  ```ts
  import { isTouchDevice, platformFeatures } from '../../utils/platform';
  ```

  Do not add a second import line — extend the existing one.

- [ ] **Step 2: Extend the reply lookup to handle inline thread replies**

  The existing reply preview IIFE starts at line 458. The lookup block currently reads:
  ```ts
  if (message.content.type == 'post') {
    const replyIndex = !message.content.repliesToMessageId
      ? undefined
      : messageList.findIndex(
          (c) =>
            c.messageId === (message.content as any).repliesToMessageId
        );
    const reply =
      replyIndex !== undefined ? messageList[replyIndex] : undefined;
  ```

  Replace with:
  ```ts
  if (message.content.type == 'post') {
    // On mobile (no thread panel), thread replies surface inline with a quote of the root message.
    // threadId is a top-level field on Message (not inside message.content).
    const isInlineThreadReply =
      !platformFeatures.supportsThreadPanel && !!message.threadId;

    const replyIndex = isInlineThreadReply
      ? messageList.findIndex((c) => c.messageId === message.threadId)
      : !message.content.repliesToMessageId
        ? undefined
        : messageList.findIndex(
            (c) =>
              c.messageId === (message.content as any).repliesToMessageId
          );

    // findIndex returns -1 when not found; guard against both undefined and -1
    const reply =
      replyIndex !== undefined && replyIndex !== -1
        ? messageList[replyIndex]
        : undefined;
  ```

  Note: `message.threadId` is defined as `threadId?: string` at the top level of the `Message` type in `src/api/quorumApi.ts`. Do **not** use `message.content.threadId` — it does not exist there.

  The click handler for the quote already uses `foundMessage.messageId` for navigation — do not change it. Because `threadId` equals the root message's `messageId`, the navigation target resolves to `#msg-{threadId}` automatically through the existing pattern.

- [ ] **Step 3: Extend the deleted-placeholder fallback**

  > **Note:** This step depends on Step 2. `isInlineThreadReply` is declared in the same `if (message.content.type == 'post')` block scope introduced by Step 2. Do not apply this step independently.

  Find the existing fallback (immediately after the closing `}` of the `if (reply)` block):
  ```ts
  } else if (message.content.repliesToMessageId) {
  ```

  Replace with:
  ```ts
  } else if (message.content.repliesToMessageId || isInlineThreadReply) {
  ```

  This ensures the "deleted" placeholder shows for thread replies whose root message is not in the local list.

  The `replyIndex !== -1` guard in Step 2 ensures `reply` is `undefined` when the root message is absent. The click handler inside `if (reply)` is never reached in that case, so `replyIndex` being `-1` never reaches `scrollToIndex`.

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit --jsx react-jsx --skipLibCheck
  ```

  Expected: no errors.

- [ ] **Step 5: Manual smoke test on desktop**

  Run the app locally and verify:
  - Existing reply quotes still render correctly in the main feed (regression check)
  - Thread replies are still hidden from the main feed on desktop
  - Clicking a reply quote still scrolls to the original message

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/message/Message.tsx
  git commit -m "feat: show thread replies inline on mobile with root message quote preview"
  ```

---

## Known Limitation (Not in Scope)

**Real-time thread replies on mobile:** When a new thread reply arrives via WebSocket/sync while the app is open, `MessageService.ts` routes it to the `['thread-messages', ...]` query cache and skips main feed invalidation. This means live-arriving thread replies won't appear in the mobile main feed until the user navigates away and back. This is a follow-up task.

---

*Created: 2026-03-11*
