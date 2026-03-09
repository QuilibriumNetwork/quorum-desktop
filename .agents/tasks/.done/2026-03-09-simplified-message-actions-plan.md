# Simplified Message Actions Toolbar — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the message hover toolbar to 6 buttons (3 emojis, emoji picker, reply, dots menu) and move all other actions into the context menu opened by the dots button.

**Architecture:** The `MessageActions` component gets stripped down to only render quick reactions, emoji picker, reply, and a new dots button. The dots button triggers the existing `MessageActionsMenu` context menu, positioned to the left of the button with vertical flip awareness. No new components needed.

**Tech Stack:** React, TypeScript, Tailwind CSS, Tabler Icons

---

### Task 1: Add `onDotsClick` callback to MessageActions

**Files:**
- Modify: `src/components/message/MessageActions.tsx:14-39` (interface)
- Modify: `src/components/message/MessageActions.tsx:41-65` (destructuring)

**Step 1: Add the new prop to the interface**

In `MessageActions.tsx`, add `onDotsClick` to `MessageActionsProps`:

```typescript
interface MessageActionsProps {
  message: MessageType;
  userAddress: string;
  canUserDelete: boolean;
  canUserEdit?: boolean;
  canViewEditHistory?: boolean;
  canPinMessages?: boolean;
  height: number;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onCopyLink: () => void;
  onCopyMessageText: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPin?: (e: React.MouseEvent) => void;
  onMoreReactions: (clientY: number) => void;
  onEdit?: () => void;
  onViewEditHistory?: () => void;
  copiedLinkId: string | null;
  copiedMessageText: boolean;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
  hasThread?: boolean;
  onStartThread?: () => void;
  // Dots menu callback — receives position for context menu anchoring
  onDotsClick: (position: { x: number; y: number }) => void;
}
```

**Step 2: Destructure the new prop**

In the component function signature, add `onDotsClick` to destructuring:

```typescript
  onDotsClick,
```

---

### Task 2: Strip toolbar down to minimal buttons + add dots button

**Files:**
- Modify: `src/components/message/MessageActions.tsx:96-129` (getTooltipContent — simplify)
- Modify: `src/components/message/MessageActions.tsx:150-366` (JSX — replace everything after emojis)

**Step 1: Simplify `getTooltipContent`**

Only these tooltip cases are needed now:

```typescript
  const getTooltipContent = () => {
    switch (hoveredAction) {
      case 'emoji':
        return t`More reactions`;
      case 'reply':
        return t`Reply`;
      case 'dots':
        return t`More actions`;
      default:
        return '';
    }
  };
```

**Step 2: Remove `getTooltipPlace`**

Delete the `getTooltipPlace` function entirely — all remaining tooltips use default `'top'` placement.

**Step 3: Remove pin-related state and handlers**

Delete these from the component body (no longer needed in the toolbar):
- `pinAction` state (line 69-71)
- `handlePinClick` function (lines 83-87)
- `handlePinHover` function (lines 90-93)
- The pin confirmation check in `getTooltipContent` (lines 98-99)

Also remove `pinAction` from the Tooltip `disabled` check — simplify to:
```typescript
disabled={!hoveredAction}
```

**Step 4: Replace the JSX body**

Replace everything inside the `<div className="absolute flex flex-row ...">` with:

```tsx
          {/* Quick reactions - top 3 most frequently used emojis */}
          {frequentEmojis.map(({ emoji, unified }) => {
            let twemojiSrc: string | null = null;
            if (unified) {
              twemojiSrc = `/twitter/64/${unified}.png`;
            } else {
              const entities = parseEmoji(emoji);
              if (entities.length > 0) {
                twemojiSrc = `/twitter/64/${emojiToUnified(entities[0].text)}.png`;
              }
            }

            return (
              <div
                key={emoji}
                onClick={() => handleQuickReaction(message, emoji)}
                className={emojiButtonClass}
              >
                {twemojiSrc ? (
                  <img
                    src={twemojiSrc}
                    alt={emoji}
                    width={16}
                    height={16}
                    draggable={false}
                    className="xl:w-[18px] xl:h-[18px]"
                  />
                ) : (
                  emoji
                )}
              </div>
            );
          })}

          {/* Separator */}
          <div className={separatorClass}></div>

          {/* More reactions */}
          <div
            onClick={(e: React.MouseEvent) => {
              onMoreReactions(e.clientY);
            }}
            onMouseEnter={() => setHoveredAction('emoji')}
            className={iconButtonClass}
          >
            <Icon name="mood-happy" size="md" variant="filled" className="xl:hidden" />
            <Icon name="mood-happy" size="lg" variant="filled" className="hidden xl:block" />
          </div>

          {/* Reply */}
          <div
            onClick={onReply}
            onMouseEnter={() => setHoveredAction('reply')}
            className={iconButtonClassMr}
          >
            <Icon name="reply" size="md" className="xl:hidden" />
            <Icon name="reply" size="lg" className="hidden xl:block" />
          </div>

          {/* Dots — open context menu */}
          <div
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onDotsClick({ x: rect.left, y: rect.bottom });
            }}
            onMouseEnter={() => setHoveredAction('dots')}
            className={iconButtonClass}
          >
            <Icon name="dots" size="md" className="xl:hidden" />
            <Icon name="dots" size="lg" className="hidden xl:block" />
          </div>
```

**Step 5: Remove unused props from destructuring**

These props are no longer used in the toolbar (actions moved to context menu):
- `canUserDelete`, `canUserEdit`, `canViewEditHistory`, `canPinMessages`
- `onCopyLink`, `onCopyMessageText`, `onDelete`, `onPin`
- `onEdit`, `onViewEditHistory`
- `copiedLinkId`, `copiedMessageText`
- `isBookmarked`, `onBookmarkToggle`
- `hasThread`, `onStartThread`

Keep them in the **interface** for now (Message.tsx still passes them), but remove from destructuring and mark as unused in the interface with a comment, OR remove from the interface too and clean up the Message.tsx caller in the next task. **Recommended:** Remove from both interface and destructuring.

**Step 6: Clean up imports**

Remove the `useState` import for `pinAction` if it was the only state using it. After removing pin state, check if `useState` is still needed (yes — `hoveredAction` still uses it). Also remove the `MESSAGE_ACTIONS_CONFIG` constant (no longer used).

---

### Task 3: Wire up dots button in Message.tsx

**Files:**
- Modify: `src/components/message/Message.tsx:606-635` (MessageActions rendering)

**Step 1: Add `onDotsClick` handler to MessageActions**

In the `<MessageActions>` JSX in Message.tsx (~line 606), add the new prop and remove props that are no longer in the interface:

```tsx
              <MessageActions
                message={message}
                userAddress={user.currentPasskeyInfo!.address}
                height={height}
                onReaction={messageActions.handleReaction}
                onReply={messageActions.handleReply}
                onMoreReactions={messageActions.handleMoreReactions}
                onDotsClick={(position) => setContextMenu(position)}
              />
```

This reuses the existing `contextMenu` state and `MessageActionsMenu` rendering — the same context menu that opens on right-click will now also open from the dots button.

**Step 2: Verify context menu positioning**

The `MessageActionsMenu.calculatePosition` function already handles viewport edge flipping. When called from the dots button, `position.x` will be the button's `left` edge and `position.y` will be the button's `bottom` edge. The existing `flipX` logic will position the menu to the left if it would overflow the right edge — since the dots button is on the far right of the toolbar, this will naturally place the menu to its left. The `flipY` logic handles upward expansion near viewport bottom.

No changes needed to `MessageActionsMenu.tsx`.

---

### Task 4: Verify and commit

**Step 1: Run type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: No errors

**Step 2: Run lint**

```bash
yarn lint
```

Expected: No errors (or only pre-existing ones)

**Step 3: Manual smoke test**

- Hover over a message → should see: 3 emojis | emoji-picker reply dots
- Click dots → context menu appears to the left of the button
- Right-click message → same context menu at cursor position
- Click emoji → reaction added
- Click reply → reply mode activated

**Step 4: Commit**

```bash
git add src/components/message/MessageActions.tsx src/components/message/Message.tsx
git commit -m "feat: simplify message actions toolbar to emoji, reply, and dots menu

Reduce the hover toolbar from 12+ buttons to just preferred emojis,
emoji picker, reply, and a dots button that opens the full context menu.
All removed actions remain accessible via the context menu."
```

---

*Updated: 2026-03-09*
