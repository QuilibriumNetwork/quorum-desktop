# Emoji Picker Portal Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the per-message reaction emoji picker so it renders above the channel header and composer by routing it through a Portal with `position: fixed`, identical to the existing context-menu path.

**Architecture:** The hover-bar smiley button in `MessageActions.tsx` currently passes only `clientY` up the chain, resulting in an inline `position: absolute` picker that clips. We change it to pass the full `DOMRect` of the trigger button, compute `{ x, y }` in `useEmojiPicker.ts`, and always render via the existing Portal+fixed branch. The inline `absolute` branch is deleted. `emojiPickerOpenDirection` state and `onSetEmojiPickerDirection` are removed throughout. `useMessageActions.handleMoreReactions` is simplified to only open the picker (direction logic removed). UserProfile positioning that previously relied on direction is replaced with a `clientY`-based local calculation.

**Tech Stack:** React, TypeScript, quorum-shared `Portal` (already used in `Message.tsx`)

---

## File Map

| File | Change |
|------|--------|
| `src/components/message/MessageActions.tsx` | `onMoreReactions` prop: `number` → `DOMRect`; pass `getBoundingClientRect()` |
| `src/hooks/business/messages/useMessageActions.ts` | Remove `onSetEmojiPickerDirection` from interface and `handleMoreReactions`; simplify to just open picker |
| `src/hooks/business/messages/useEmojiPicker.ts` | `openDesktopEmojiPicker` takes `DOMRect`; computes position; adds `onSetEmojiPickerPosition`; removes direction logic and `height` |
| `src/components/message/Message.tsx` | Wire `setEmojiPickerPosition` into `useEmojiPicker`; update `onMoreReactions` handler; delete inline `absolute` branch; remove `emojiPickerOpenDirection` prop; fix UserProfile direction with local `clientY` state |
| `src/components/message/MessageList.tsx` | Remove `emojiPickerOpenDirection`/`setEmojiPickerOpenDirection` state and prop threading |

---

### Task 1: Update `MessageActions.tsx` — pass DOMRect instead of clientY

**Files:**
- Modify: `src/components/message/MessageActions.tsx`

- [ ] **Step 1: Change the prop type**

In `MessageActionsProps` (line 15), change:
```tsx
onMoreReactions: (clientY: number) => void;
```
to:
```tsx
onMoreReactions: (rect: DOMRect) => void;
```

- [ ] **Step 2: Update the click handler**

In the click handler (around line 118-119):
```tsx
onClick={(e: React.MouseEvent) => {
  onMoreReactions(e.clientY);
}}
```
Change to:
```tsx
onClick={(e: React.MouseEvent) => {
  onMoreReactions((e.currentTarget as HTMLElement).getBoundingClientRect());
}}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | grep -i "MessageActions"
```

Expected: errors only in `Message.tsx` callers (not yet updated) — fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/components/message/MessageActions.tsx
git commit -m "refactor(emoji-picker): pass DOMRect from onMoreReactions trigger"
```

---

### Task 2: Update `useMessageActions.ts` — remove direction from handleMoreReactions

**Files:**
- Modify: `src/hooks/business/messages/useMessageActions.ts`

- [ ] **Step 1: Remove `onSetEmojiPickerDirection` from the interface**

In `UseMessageActionsOptions` (around lines 26-52), remove:
```ts
onSetEmojiPickerDirection: (direction: string) => void;
```

- [ ] **Step 2: Remove from destructuring**

In the destructuring inside `useMessageActions` (around lines 55-80), remove:
```ts
onSetEmojiPickerDirection,
```

- [ ] **Step 3: Simplify `handleMoreReactions`**

Current (around lines 447-455):
```ts
const handleMoreReactions = useCallback(
  (clientY: number) => {
    onSetEmojiPickerOpen(message.messageId);
    onSetEmojiPickerDirection(
      clientY / height > 0.5 ? 'upwards' : 'downwards'
    );
  },
  [message.messageId, height, onSetEmojiPickerOpen, onSetEmojiPickerDirection]
);
```

Replace with:
```ts
const handleMoreReactions = useCallback(
  () => {
    onSetEmojiPickerOpen(message.messageId);
  },
  [message.messageId, onSetEmojiPickerOpen]
);
```

Note: the parameter is removed entirely — the context-menu path that calls `messageActions.handleMoreReactions(0)` in `Message.tsx` will need to be updated in Task 4 to drop the argument.

- [ ] **Step 4: Remove `height` from the hook if it's only used for direction**

Check whether `height` is referenced anywhere else in `useMessageActions.ts` besides the now-deleted direction calculation. If not, remove it from `UseMessageActionsOptions` and the destructuring. If it is used elsewhere, leave it.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | grep -i "useMessageActions\|handleMoreReactions"
```

Expected: errors in `Message.tsx` (not yet updated — passes `onSetEmojiPickerDirection` and calls `handleMoreReactions(0)`).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/business/messages/useMessageActions.ts
git commit -m "refactor(emoji-picker): remove direction logic from useMessageActions.handleMoreReactions"
```

---

### Task 3: Update `useEmojiPicker.ts` — compute position from DOMRect

**Files:**
- Modify: `src/hooks/business/messages/useEmojiPicker.ts`

- [ ] **Step 1: Replace the options interface**

Current `UseEmojiPickerOptions`:
```ts
interface UseEmojiPickerOptions {
  customEmoji?: Emoji[];
  height: number;
  onEmojiClick: (emoji: string) => void;
  onSetEmojiPickerOpen: (messageId: string | undefined) => void;
  onSetEmojiPickerDirection: (direction: string) => void;
}
```

Replace with (remove `height`, remove `onSetEmojiPickerDirection`, add `onSetEmojiPickerPosition`):
```ts
interface UseEmojiPickerOptions {
  customEmoji?: Emoji[];
  onEmojiClick: (emoji: string) => void;
  onSetEmojiPickerOpen: (messageId: string | undefined) => void;
  onSetEmojiPickerPosition: (pos: { x: number; y: number } | null) => void;
}
```

- [ ] **Step 2: Update destructuring in the hook body**

Current:
```ts
const {
  customEmoji,
  height,
  onEmojiClick,
  onSetEmojiPickerOpen,
  onSetEmojiPickerDirection,
} = options;
```

Replace with:
```ts
const {
  customEmoji,
  onEmojiClick,
  onSetEmojiPickerOpen,
  onSetEmojiPickerPosition,
} = options;
```

- [ ] **Step 3: Rewrite `openDesktopEmojiPicker`**

Current:
```ts
const openDesktopEmojiPicker = useCallback(
  (messageId: string, clientY: number) => {
    onSetEmojiPickerOpen(messageId);
    onSetEmojiPickerDirection(
      clientY / height > 0.5 ? 'upwards' : 'downwards'
    );
  },
  [height, onSetEmojiPickerOpen, onSetEmojiPickerDirection]
);
```

Replace with:
```ts
const openDesktopEmojiPicker = useCallback(
  (messageId: string, rect: DOMRect) => {
    onSetEmojiPickerOpen(messageId);
    const pickerHeight = 480;
    const pickerWidth = 380;
    const spaceBelow = window.innerHeight - rect.bottom;
    const y = spaceBelow < pickerHeight + 16
      ? rect.top - pickerHeight - 4   // flip upward — not enough room below
      : rect.bottom + 4;              // open downward
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - pickerWidth - 8));
    onSetEmojiPickerPosition({ x, y });
  },
  [onSetEmojiPickerOpen, onSetEmojiPickerPosition]
);
```

Note on x: `rect.left` aligns the picker's left edge with the trigger button's left edge. It is clamped so it cannot go off-screen right (subtract picker width) or off-screen left (minimum 8px). This is the correct behavior — the picker opens aligned below/above the button.

- [ ] **Step 4: Remove `handleUserProfileClick` direction usage**

Find `handleUserProfileClick` in the hook. It currently calls `onSetEmojiPickerDirection`. Remove that call — keep the `_clientY` parameter so the call site in `Message.tsx` (which still passes `clientY`) doesn't need to change:

```ts
const handleUserProfileClick = useCallback(
  (_clientY: number, onProfileClick: () => void) => {
    onProfileClick();
  },
  []
);
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | grep -i "useEmojiPicker\|openDesktopEmoji"
```

Expected: errors in `Message.tsx` (not yet updated — still passes `height`, `onSetEmojiPickerDirection`).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/business/messages/useEmojiPicker.ts
git commit -m "refactor(emoji-picker): compute fixed position from DOMRect in useEmojiPicker"
```

---

### Task 4: Update `Message.tsx` — wire position, remove inline branch, fix UserProfile direction

**Files:**
- Modify: `src/components/message/Message.tsx`

- [ ] **Step 1: Add local state for UserProfile direction**

`emojiPickerOpenDirection` was previously used to position the `<UserProfile>` popup (line 604). Since we're removing that prop, add local state near the top of the component (after existing `useState` declarations):

```ts
const [userProfileDirection, setUserProfileDirection] = useState<'upwards' | 'downwards'>('downwards');
```

- [ ] **Step 2: Update `useEmojiPicker` call — remove direction, remove height, add position**

Current (around lines 261-267):
```ts
const emojiPicker = useEmojiPicker({
  customEmoji,
  height,
  onEmojiClick: messageActions.handleReaction,
  onSetEmojiPickerOpen: setEmojiPickerOpen,
  onSetEmojiPickerDirection: setEmojiPickerOpenDirection,
});
```

Replace with:
```ts
const emojiPicker = useEmojiPicker({
  customEmoji,
  onEmojiClick: messageActions.handleReaction,
  onSetEmojiPickerOpen: setEmojiPickerOpen,
  onSetEmojiPickerPosition: setEmojiPickerPosition,
});
```

- [ ] **Step 3: Update `useMessageActions` call — remove direction**

Around line 211, remove:
```ts
onSetEmojiPickerDirection: setEmojiPickerOpenDirection,
```

- [ ] **Step 4: Remove `emojiPickerOpenDirection` and `setEmojiPickerOpenDirection` from props interface**

In the props interface (around lines 84-91), remove:
```ts
emojiPickerOpenDirection: string | undefined;
setEmojiPickerOpenDirection: React.Dispatch<
  React.SetStateAction<string | undefined>
>;
```

- [ ] **Step 5: Remove from component destructuring**

Around lines 143-144, remove:
```ts
emojiPickerOpenDirection,
setEmojiPickerOpenDirection,
```

- [ ] **Step 6: Fix UserProfile direction — replace `emojiPickerOpenDirection` with local state**

At line 604, the UserProfile panel uses direction to offset its position:
```tsx
className={
  emojiPickerOpenDirection == 'upwards'
    ? 'ml-[10px] mt-[-220px]'
    : 'ml-[10px]'
}
```

Replace with the local state:
```tsx
className={
  userProfileDirection === 'upwards'
    ? 'ml-[10px] mt-[-220px]'
    : 'ml-[10px]'
}
```

- [ ] **Step 7: Set `userProfileDirection` where UserProfile is triggered**

Find where `emojiPicker.handleUserProfileClick` is called from `useMessageInteractions` (passed as `onEmojiPickerUserProfileClick` around line 284). That call site in `useMessageInteractions` calls it with `clientY`. Since `handleUserProfileClick` now ignores `clientY`, we need to set `userProfileDirection` at the point where user profile is opened.

Search for where `setShowUserProfile(true)` is called, or where `handleUserProfileBackgroundClick` / `interactions.handleUserProfileBackgroundClick` is set up. The pattern is in `useMessageInteractions.ts`. Find the click handler that opens the user profile and update it to also call `setUserProfileDirection`.

Look for the call to `onEmojiPickerUserProfileClick` in `useMessageInteractions.ts` — it will look like:
```ts
onEmojiPickerUserProfileClick(e.clientY, () => setShowUserProfile(true));
```

We need to set direction before that. The simplest approach: wrap the open-profile action to also set direction:

In `Message.tsx`, change the `onEmojiPickerUserProfileClick` option passed to `useMessageInteractions`:
```ts
onEmojiPickerUserProfileClick: (clientY: number, onProfileClick: () => void) => {
  setUserProfileDirection(clientY / window.innerHeight > 0.5 ? 'upwards' : 'downwards');
  emojiPicker.handleUserProfileClick(clientY, onProfileClick);
},
```

- [ ] **Step 8: Update hover bar `onMoreReactions` handler**

Current (around line 664):
```tsx
onMoreReactions={messageActions.handleMoreReactions}
```

Replace with (passes DOMRect to `openDesktopEmojiPicker`):
```tsx
onMoreReactions={(rect: DOMRect) => {
  emojiPicker.openDesktopEmojiPicker(message.messageId, rect);
}}
```

- [ ] **Step 9: Update context-menu `onMoreReactions` call**

Around lines 1419-1428, the context-menu "More reactions" path calls `messageActions.handleMoreReactions(0)`. Since `handleMoreReactions` now takes no arguments (Task 2), update this call:

Current:
```ts
messageActions.handleMoreReactions(0);
```
Change to:
```ts
messageActions.handleMoreReactions();
```

- [ ] **Step 10: Delete the inline `absolute` emoji picker branch**

Find and delete this entire block (around lines 673-689):
```tsx
{emojiPickerOpen === message.messageId && !emojiPickerPosition && (
  <div
    onClick={(e: React.MouseEvent) => e.stopPropagation()}
    className={
      'absolute right-10 z-[9999] bg-modal border border-default rounded-lg shadow-lg overflow-hidden ' +
      (emojiPickerOpenDirection == 'upwards'
        ? 'bottom-full mb-1'
        : 'top-0')
    }
  >
    <Suspense fallback={<div className="emoji-picker-loading" />}>
      <EmojiPicker
        customEmojis={emojiPicker.customEmojis}
        onEmojiClick={(e: EmojiData) => emojiPicker.handleDesktopEmojiClick(e.emoji)}
      />
    </Suspense>
  </div>
)}
```

- [ ] **Step 11: Update Portal branch — remove redundant clamping and `setEmojiPickerPosition(null)` call**

Current Portal branch `style` and `onEmojiClick`:
```tsx
style={{
  left: Math.min(emojiPickerPosition.x, window.innerWidth - 400),
  top: Math.min(emojiPickerPosition.y, window.innerHeight - 500),
}}
...
onEmojiClick={(e: EmojiData) => {
  emojiPicker.handleDesktopEmojiClick(e.emoji);
  setEmojiPickerPosition(null);
}}
```

Clamping is now done in `useEmojiPicker`. `setEmojiPickerPosition(null)` is made redundant by the `useEffect` in `MessageList.tsx` (which resets position when `emojiPickerOpen` becomes `undefined`). Simplify to:
```tsx
style={{
  left: emojiPickerPosition.x,
  top: emojiPickerPosition.y,
}}
...
onEmojiClick={(e: EmojiData) => emojiPicker.handleDesktopEmojiClick(e.emoji)}
```

- [ ] **Step 12: Verify TypeScript — no errors in Message.tsx**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | grep -i "Message.tsx\|MessageActions\|useEmojiPicker\|useMessageActions"
```

Expected: errors only in `MessageList.tsx` (not yet updated).

- [ ] **Step 13: Commit**

```bash
git add src/components/message/Message.tsx
git commit -m "fix(emoji-picker): route hover-bar picker through Portal, remove inline absolute branch"
```

---

### Task 5: Clean up `MessageList.tsx` — remove direction state

**Files:**
- Modify: `src/components/message/MessageList.tsx`

- [ ] **Step 1: Remove state declarations**

Find (around lines 179-180):
```ts
const [emojiPickerOpenDirection, setEmojiPickerOpenDirection] =
  useState<string | undefined>(undefined);
```

Delete both lines.

- [ ] **Step 2: Remove from prop passing to `<Message>`**

Find where `<Message>` is rendered (around lines 336-341). Remove these two props:
```tsx
emojiPickerOpenDirection={emojiPickerOpenDirection}
setEmojiPickerOpenDirection={setEmojiPickerOpenDirection}
```

- [ ] **Step 3: Remove from the memoization items array**

Around lines 392-397, find the array that includes `emojiPickerOpenDirection` and `setEmojiPickerOpenDirection`. Remove both entries.

- [ ] **Step 4: Verify TypeScript — clean build**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1
```

Expected: no errors (or only pre-existing unrelated errors unrelated to emoji picker).

- [ ] **Step 5: Commit**

```bash
git add src/components/message/MessageList.tsx
git commit -m "chore(emoji-picker): remove emojiPickerOpenDirection state from MessageList"
```

---

### Task 6: Verify and manual smoke test

- [ ] **Step 1: Run lint**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
yarn lint 2>&1 | grep -E "error|warning" | grep -i "emoji\|Message\|picker" | head -20
```

Expected: no new errors in the touched files.

- [ ] **Step 2: Manual test — hover-bar picker, middle of list**

Start the dev server and open a channel with messages. Hover a message in the middle of the visible list. Click the smiley icon. Verify:
- The emoji picker appears fully visible, not clipped by header or composer
- The picker left edge is approximately aligned with the smiley button's left edge
- It opens below the button
- Clicking an emoji inserts it as a reaction and the picker closes

- [ ] **Step 3: Manual test — hover-bar picker, near bottom**

Hover the last visible message (near the composer). Click the smiley icon. Verify:
- Picker flips upward and is not clipped by the composer

- [ ] **Step 4: Manual test — hover-bar picker, near top**

Hover the first visible message (near the channel header). Click the smiley icon. Verify:
- Picker opens downward and is not clipped by the header

- [ ] **Step 5: Manual test — context-menu picker**

Right-click a message → "More reactions". Verify:
- Picker still appears at the cursor position via Portal (unchanged path)
- No regression

- [ ] **Step 6: Manual test — UserProfile popup**

Click a username near the bottom of the message list. Verify the UserProfile popup still appears in a sensible direction (above or below the avatar) without being cut off.

- [ ] **Step 7: Final commit if anything was adjusted**

```bash
git add -p
git commit -m "fix(emoji-picker): smoke test adjustments"
```

---

*Last updated: 2026-04-14*
