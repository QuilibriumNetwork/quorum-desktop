---
type: task
title: "Show Users Who Reacted (Tooltip + Modal)"
status: open
complexity: medium
ai_generated: true
reviewed_by: feature-analyzer
created: 2026-01-10
updated: 2026-01-10
---

# Show Users Who Reacted (Tooltip + Modal)

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Files**:
- `src/components/message/Message.tsx:1206-1237` - Reaction display + tooltip
- `src/api/quorumApi.ts:248-254` - Reaction type definition
- `src/components/modals/ReactionsModal.tsx` - New modal component (Phase 2)
- `src/components/context/ReactionsModalProvider.tsx` - New context provider (Phase 2)
- `src/hooks/business/ui/useModalManagement.ts` - Add reactions modal state (Phase 2)
- `src/components/Layout.tsx` - Integrate ReactionsModal (Phase 2)

## What & Why

Currently, message reactions display the emoji and count but don't show **who** reacted. The data already exists - each `Reaction` object contains a `memberIds: string[]` array with all user addresses who used that reaction. Adding a tooltip on hover would improve social transparency, letting users see exactly who reacted with each emoji.

**Current state**: Reactions show emoji + count only
**Desired state**: Hovering over a reaction shows a tooltip listing user display names
**Value**: Better social context, similar to Discord/Slack behavior

## Data Available

The `Reaction` type already stores all necessary data:
```typescript
export type Reaction = {
  emojiId: string;
  spaceId: string;
  emojiName: string;
  count: number;
  memberIds: string[];  // ← User addresses who reacted
};
```

The `mapSenderToUser` function is already available in `Message.tsx` props to convert addresses to display names.

## Implementation

1. **Add Tooltip to reaction display** (`src/components/message/Message.tsx:1207-1237`)
   - Wrap the existing reaction `<FlexRow>` with a `<Tooltip>` component
   - Generate tooltip content by mapping `r.memberIds` through `mapSenderToUser()`
   - Display as comma-separated list of display names
   - Reference: Existing `<Tooltip>` usage in same file (e.g., pin indicator at line 749)

2. **Handle mobile touch interaction**
   - Use `touchTrigger="long-press"` with `longPressDuration={500}` to avoid conflict with reaction click handler
   - On mobile, the Tooltip native implementation wraps children in `TouchableOpacity` - long-press prevents blocking the reaction toggle

3. **Handle edge cases**
   - Truncate after 3 users with "+X more" (keeps tooltip compact)
   - Use i18n `t` macro for "+X more" text
   - Fallback to truncated address if `mapSenderToUser` returns no displayName

## Example Implementation

```tsx
import { t } from '@lingui/core/macro';

{message.reactions?.map((r) => {
  const maxNames = 3;
  const reactorNames = r.memberIds
    .map(id => mapSenderToUser(id)?.displayName || id.slice(0, 8) + '...')
    .slice(0, maxNames);
  const hasMore = r.memberIds.length > maxNames;
  const tooltipContent = reactorNames.join(', ') +
    (hasMore ? t` +${r.memberIds.length - maxNames} more` : '');

  return (
    <Tooltip
      key={message.messageId + '-reactions-' + r.emojiId}
      id={`reaction-${message.messageId}-${r.emojiId}`}
      content={tooltipContent}
      showOnTouch={true}
      touchTrigger="long-press"
      longPressDuration={500}
      autoHideAfter={3000}
    >
      <FlexRow
        className={/* existing classes */}
        onClick={() => messageActions.handleReaction(r.emojiId)}
      >
        {/* existing emoji and count rendering */}
      </FlexRow>
    </Tooltip>
  );
})}
```

## Verification

✅ **Tooltip appears on hover (desktop)**
   - Test: Hover over a reaction → See list of user names who reacted

✅ **Tooltip appears on long-press (mobile)**
   - Test: Long-press a reaction → Tooltip shows, tap still toggles reaction

✅ **Long lists truncated gracefully**
   - Test: Message with 5+ reactions → Shows "name1, name2, name3 +2 more"

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

## Phase 2: "+X more" Opens Reactions Modal (Desktop Only)

> **Note**: Modal feature is **desktop-only**. On touch devices, use `isTouchDevice()` utility to hide the clickable "+X more" and show only the tooltip on long-press.

When the tooltip shows "+X more" on desktop, clicking it should open a **ReactionsModal** (Discord-style) showing:
- **Left column**: All reaction emojis with counts (clickable tabs)
- **Right column**: User avatars + display names for selected reaction

### Modal System Integration

Per `.agents/docs/features/modals.md`, use **Layout-Level** system since this is triggered from deep in component tree (Message.tsx):

1. **Create ReactionsModal** (`src/components/modals/ReactionsModal.tsx`)
   - Uses Modal primitive with `size="small"`
   - Left sidebar: reaction tabs (emoji + count)
   - Right content: ScrollContainer with user list (UserAvatar + name)
   - Style with Tailwind classes (no separate SCSS file unless needed)

2. **Add state** (`src/hooks/business/ui/useModalManagement.ts`):
   ```tsx
   // ⚠️ Pass DATA, not functions (functions aren't serializable)
   reactionsModal: {
     visible: boolean;
     reactions: Reaction[];
     customEmojis: CustomEmoji[];  // from useEmojiPicker hook
     members: Record<string, Member>;  // ← data, not mapSenderToUser function
   }
   ```

   ReactionsModal handles mapping internally:
   ```tsx
   const getUserInfo = (memberId: string) => {
     const member = members[memberId];
     return {
       displayName: member?.displayName || memberId.slice(0, 8) + '...',
       userIcon: member?.userIcon
     };
   };
   ```

3. **Create ReactionsModalProvider** (`src/components/context/ReactionsModalProvider.tsx`)
   - Follow EditHistoryModalProvider pattern
   - Export `useReactionsModal` hook
   - Place after EditHistoryModalProvider in Layout.tsx nesting order

4. **Add to Layout.tsx**:
   ```tsx
   {reactionsModal.visible && (
     <ReactionsModal
       visible={reactionsModal.visible}
       reactions={reactionsModal.reactions}
       customEmojis={reactionsModal.customEmojis}
       members={reactionsModal.members}
       onClose={hideReactionsModal}
     />
   )}
   ```
   - Wrap children with `<ReactionsModalProvider>` (after EditHistoryModalProvider)

5. **Update tooltip in Message.tsx** (desktop only):
   ```tsx
   import { isTouchDevice } from '../../utils/platform';

   // In tooltip content generation:
   const isTouch = isTouchDevice();
   const tooltipContent = isTouch
     ? reactorNames.join(', ') + (hasMore ? t` +${remaining} more` : '')
     : (
         <>
           {reactorNames.join(', ')}
           {hasMore && (
             <span
               className="text-accent cursor-pointer hover:underline"
               onClick={(e) => {
                 e.stopPropagation();
                 showReactionsModal({ reactions: message.reactions, customEmojis, members });
               }}
             >
               {t` +${remaining} more`}
             </span>
           )}
         </>
       );
   ```

### Example Modal Layout

```
┌─────────────────────────────────┐
│ Reactions                    ✕  │
├─────────┬───────────────────────┤
│ 🔥 5    │ [avatar] LLTI _mrpipe │
│ 🙏 2    │ [avatar] VELVIL VR... │
│         │ [avatar] LaMat lamat.│
│         │ [avatar] Tetris Tow..│
│         │ [avatar] Agent 003 j2│
└─────────┴───────────────────────┘
```

## Definition of Done

### Phase 1: Tooltip
- [ ] Tooltip shows user display names on reaction hover
- [ ] Long user lists truncated after 3 names with "+X more"
- [ ] "+X more" text uses i18n `t` macro
- [ ] Works on desktop (hover) and mobile (long-press)
- [ ] Mobile: tap still toggles reaction (no touch conflict)

### Phase 2: Modal (Desktop Only)
- [ ] "+X more" in tooltip is clickable (desktop only, use `isTouchDevice()`)
- [ ] Clicking "+X more" opens ReactionsModal
- [ ] Modal shows all reactions as tabs on left
- [ ] Clicking reaction tab shows users who reacted
- [ ] Users displayed with avatar + display name + truncated address
- [ ] Modal uses Layout-Level system (not rendered in Message.tsx)
- [ ] ReactionsModalProvider created for deep component access
- [ ] Pass `members` data object instead of `mapSenderToUser` function

### Both Phases
- [ ] TypeScript passes
- [ ] No console errors
