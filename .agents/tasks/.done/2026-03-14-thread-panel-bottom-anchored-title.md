# Thread Panel: Bottom-Anchored Title Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the large thread title + "Started by" block into the scrollable message list (as a Virtuoso `Header`), anchor it near the composer when sparse, and keep a compact sticky row in the fixed header — matching the Discord thread panel pattern. Both the fixed header and the large list header show the `"messages"` thread icon.

**Architecture:** Add an optional `headerContent` prop to `MessageList` that gets passed as `components.Header` to Virtuoso. Switch the thread list from `alignToTop={true}` to `alignToTop={false}` so sparse threads anchor content near the bottom. `ThreadPanel` renders the large title block as `headerContent` (with large icon above the title) and keeps the fixed header strip compact (thread icon + small title text + settings/close icon buttons).

**Tech Stack:** React, TypeScript, react-virtuoso, SCSS

---

## File Map

| File | Change |
|------|--------|
| `src/components/message/MessageList.tsx` | Add `headerContent?: React.ReactNode` prop; pass as `components.Header` to Virtuoso |
| `src/components/thread/ThreadPanel.tsx` | Restructure fixed header to compact icon+title row; add large icon+title as `headerContent`; change `alignToTop={false}` |
| `src/components/thread/ThreadPanel.scss` | Add `.thread-panel__list-header` styles; update header styles for compact icon+title row |

---

## Chunk 1: MessageList — headerContent prop

### Task 1: Add `headerContent` prop to `MessageList`

**Files:**
- Modify: `src/components/message/MessageList.tsx`

- [x] **Step 1: Add `headerContent` to `MessageListProps` interface**

In `MessageList.tsx`, add to the `interface MessageListProps` block (after `onStartThread?`, before the closing `}`):

```typescript
/** Optional content rendered as a scrollable header above the first message (Virtuoso Header) */
headerContent?: React.ReactNode;
```

- [x] **Step 2: Destructure `headerContent` in the component**

In the destructuring block inside the `forwardRef` component, add `headerContent` after `alignToTop = false,`:

```typescript
alignToTop = false,
headerContent,
```

- [x] **Step 3: Replace the `components` prop on `<Virtuoso>` with Header support**

Find the existing `components` prop (currently only `Footer`):

```typescript
components={{
  Footer: () => <div className="message-list-bottom-spacer" />,
}}
```

Replace **only** the `components={{...}}` prop attribute with:

```typescript
components={{
  Header: headerContent ? () => <>{headerContent}</> : undefined,
  Footer: () => <div className="message-list-bottom-spacer" />,
}}
```

- [x] **Step 4: Verify TypeScript compiles**

```bash
cd "d:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors related to `MessageList`.

- [ ] **Step 5: Commit**

```bash
git add src/components/message/MessageList.tsx
git commit -m "feat(thread): add headerContent prop to MessageList via Virtuoso Header"
```

---

## Chunk 2: ThreadPanel — Discord-style dual title with thread icon

### Task 2: Restructure ThreadPanel title layout

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`
- Modify: `src/components/thread/ThreadPanel.scss`

- [x] **Step 1: Update the fixed header in `ThreadPanel.tsx` to match the channel header layout**

`.chat-header` in `_chat.scss` is already the shared class for Channel and DirectMessage. The thread panel header should add this class alongside `thread-panel__header` so all spacing, border, font, and responsive rules are inherited automatically — no duplication needed.

Find the `thread-panel__header` block (the entire `<div className="thread-panel__header">` and its contents). Replace it, adding `chat-header` to the className:

```tsx
<div className="thread-panel__header chat-header">
  <div className="thread-panel__header-left">
    <Icon
      name="messages"
      size="lg"
      className="thread-panel__header-icon"
    />
    <span className="thread-panel__header-title">{threadTitle}</span>
  </div>
  <div className="thread-panel__header-actions">
    {canManage && rootMessage && (
      <Tooltip id="thread-settings-tooltip" content={t`Thread settings`} place="bottom" showOnTouch={false}>
        <Button
          type="unstyled"
          onClick={() => openThreadSettings({
            threadId: threadId!,
            rootMessage,
            threadMessages,
            channelProps,
            updateTitle,
            setThreadClosed,
            updateThreadSettings,
            removeThread,
          })}
          className="header-icon-button"
          aria-label={t`Thread settings`}
          iconName="settings"
          iconSize="lg"
          iconOnly
        />
      </Tooltip>
    )}
    <Button
      type="unstyled"
      onClick={closeThread}
      className="header-icon-button"
      iconName="close"
      iconSize="lg"
      iconOnly
    />
  </div>
</div>
```

> **Note:** `Icon` is already imported in `ThreadPanel.tsx`.

- [x] **Step 2: Build the large list header JSX**

Above the `return` statement, create a memoized `listHeaderContent` variable. This renders the large icon followed by the big title and "Started by" line:

```tsx
const listHeaderContent = useMemo(() => (
  <div className="thread-panel__list-header">
    <Icon name="messages" size="xl" className="thread-panel__list-header-icon" />
    <div className="thread-panel__list-title">{threadTitle}</div>
    {starterName && (
      <span className="thread-panel__list-started-by">
        {t`Started by`} <strong>{starterName}</strong>
      </span>
    )}
  </div>
), [threadTitle, starterName]);
```

- [x] **Step 3: Pass `listHeaderContent` and change `alignToTop` on `MessageList`**

Find `<MessageList ... alignToTop={true} ... />`. Make two changes:
1. Change `alignToTop={true}` → `alignToTop={false}` (or remove the prop entirely since `false` is the default)
2. Add `headerContent={listHeaderContent}`

```tsx
<MessageList
  ...
  alignToTop={false}
  headerContent={listHeaderContent}
  ...
/>
```

> **Note on scroll behavior:** With `alignToBottom={true}` (which `alignToTop={false}` enables), Virtuoso renders the first frame at the bottom-most position. When `scrollToMessageId` / `targetMessageId` is set (e.g., jumping to a specific message), the list will briefly show the bottom before jumping to the target — this is identical to the main channel list behavior and is expected.

- [x] **Step 4: Update SCSS**

In `ThreadPanel.scss`, make these changes:

**a) Replace `&__header` — spacing/border/font/responsive rules are all inherited from `.chat-header` (added in JSX above), so only add flex layout here:**

```scss
&__header {
  // Spacing, border, typography, and responsive margins come from .chat-header (_chat.scss).
  // Only thread-panel-specific flex layout defined here.
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $s-2;
  flex-shrink: 0;
}

&__header-left {
  display: flex;
  align-items: center;
  gap: $s-2;
  min-width: 0;
  flex: 1;
}

&__header-icon {
  flex-shrink: 0;
  color: var(--color-text-subtle);
}

&__header-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  // font-size and font-weight inherited from .chat-header
}

&__header-actions {
  display: flex;
  align-items: center;
  gap: $s-1;
  flex-shrink: 0;
}
```

**b) Remove the old** `&__header-content`, `&__title-area`, `&__title`, `&__started-by` blocks (no longer used).

**c) Add new list header styles:**

```scss
&__list-header {
  padding: $s-6 $s-4 $s-4;
  border-bottom: 1px solid var(--border-default);
  margin-bottom: $s-2;
  background: var(--color-bg-chat);
}

&__list-header-icon {
  display: block;
  color: var(--text-subtle);
  margin-bottom: $s-3;
}

&__list-title {
  font-weight: 700;
  font-size: $text-2xl;
  color: var(--text-primary);
  margin: 0 0 $s-1;
  word-break: break-word;
}

&__list-started-by {
  display: block;
  font-size: $text-sm;
  color: var(--text-subtle);

  strong {
    color: var(--text-primary);
    font-weight: 600;
  }
}
```

- [x] **Step 5: Verify TypeScript**

```bash
cd "d:/GitHub/Quilibrium/quorum-desktop"
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx src/components/thread/ThreadPanel.scss
git commit -m "feat(thread): discord-style dual title with thread icon in header and list"
```

---

## Chunk 3: Visual verification & cleanup

### Task 3: Manual verification checklist

- [ ] **Step 1: Start dev server and open a thread**

```bash
cd "d:/GitHub/Quilibrium/quorum-desktop"
yarn dev
```

Open a thread with few messages. Confirm:
- Fixed header: thread (`messages`) icon on left, small thread title (truncated if long), settings + close icons on right
- Large `messages` icon + large title + "Started by" appears near the bottom, just above the first message
- No layout breaks

- [ ] **Step 2: Verify scroll behavior**

Add enough messages to fill the thread panel. Scroll up. Confirm:
- Large icon+title block scrolls away upward as messages fill the panel
- Fixed header strip with small icon+title remains visible at all times
- Virtuoso `Header` does not stick (by design — it scrolls away)

> **Note:** If sticky behavior for the large header is needed, add `position: sticky; top: 0; z-index: 1` to `.thread-panel__list-header` in the SCSS.

- [ ] **Step 3: Verify mobile (narrow viewport)**

Resize browser to mobile width. Confirm thread panel overlay looks correct — compact header, large title visible near bottom with few messages.

- [ ] **Step 4: Final commit if any style tweaks were made**

```bash
git add -p
git commit -m "fix(thread): adjust list header spacing/styles after visual review"
```

---

*Updated: 2026-03-14*
