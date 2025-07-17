# Mobile Message Options UX Enhancement

## Overview

Transform the current hover-based message actions into a Discord-like mobile experience with long-press interactions and drawer-based UI patterns.

## Current State Analysis

### Existing Desktop Implementation

Currently in `Message.tsx` (lines 284-448), message actions appear on hover:

- **Quick reactions**: ❤️, 👍, 🔥 (direct click)
- **More reactions**: FontAwesome smile icon → opens emoji picker
- **Reply**: FontAwesome reply icon → sets reply mode
- **Copy link**: FontAwesome link icon → copies message URL
- **Delete**: FontAwesome trash icon → deletes message (if user has permissions)

### Mobile UX Problems

1. **No hover on mobile**: Touch devices don't have hover states
2. **Tiny touch targets**: Current icons are too small for mobile interaction
3. **No discoverability**: Users don't know message actions exist
4. **Poor accessibility**: No proper mobile interaction patterns

## Target UX Pattern (Discord-Inspired)

### Reference Screenshots Analysis

- **image.png**: Discord mobile long-press drawer showing:
  - Quick reaction bar at top (❤️, 👍, 🔥, etc.)
  - Action menu below: Reply, Forward, Copy Link, Copy Text, Reactions, Delete (if permitted)
- **image2.png**: Discord emoji picker with search and organized categories

### Proposed Mobile Flow

1. **Long-press message** → Opens action drawer
2. **Quick reactions** → Tap to add reaction immediately
3. **"Reactions" option** → Opens second drawer with full emoji picker

## Implementation Strategy

Check each box once a task has been completed. Add notes if necessary.

### Phase 1: Mobile Detection & Long-Press Handler

- [ ] Add mobile device detection
- [ ] Implement long-press gesture handling
- [ ] Create touch event handlers for message interaction
- [ ] Add haptic feedback (if supported)

### Phase 2: Action Drawer Component

- [ ] Create `MessageActionsDrawer` component
- [ ] Implement slide-up animation from bottom
- [ ] Add backdrop dismiss functionality
- [ ] Create responsive layout for different screen sizes

### Phase 3: Quick Reactions Bar

- [ ] Design quick reaction UI matching Discord pattern
- [ ] Implement horizontal scrollable reaction list
- [ ] Add reaction submission logic
- [ ] Handle reaction state updates

### Phase 4: Action Menu Items

- [ ] Create action menu item component
- [ ] Implement Reply action
- [ ] Implement Copy Link action
- [ ] Implement Delete action (with permissions)
- [ ] Add "More Reactions" option

### Phase 5: Secondary Emoji Picker Drawer

- [ ] Create secondary drawer for full emoji picker
- [ ] Integrate with existing emoji picker logic
- [ ] Implement proper mobile sizing (no CSS scaling)
- [ ] Add search functionality prominence
- [ ] Handle drawer stacking (action drawer → emoji drawer)

### Phase 6: Desktop/Tablet Compatibility

- [ ] Ensure desktop hover actions still work
- [ ] Add tablet-specific interaction patterns
- [ ] Implement responsive behavior switching
- [ ] Test cross-device compatibility

## Technical Implementation Plan

### 1. Mobile Detection Hook

```typescript
// src/hooks/useMobileDetection.ts
export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTouch('ontouchstart' in window);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isTouch };
};
```

### 2. Long-Press Handler

```typescript
// src/hooks/useLongPress.ts
export const useLongPress = (
  onLongPress: () => void,
  onTap?: () => void,
  delay: number = 500
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleStart = useCallback(() => {
    timeoutRef.current = setTimeout(onLongPress, delay);
  }, [onLongPress, delay]);

  const handleEnd = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  return {
    onTouchStart: handleStart,
    onTouchEnd: handleEnd,
    onTouchCancel: handleEnd,
    onMouseDown: handleStart,
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
  };
};
```

### 3. Action Drawer Component Structure

```typescript
// src/components/message/MessageActionsDrawer.tsx
interface MessageActionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  message: MessageType;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onCopyLink: () => void;
  onDelete?: () => void;
  onMoreReactions: () => void;
}

const MessageActionsDrawer = ({
  isOpen,
  onClose,
  message,
  onReaction,
  onReply,
  onCopyLink,
  onDelete,
  onMoreReactions,
}: MessageActionsDrawerProps) => {
  return (
    <div
      className={`fixed inset-0 z-[10000] ${
        isOpen ? 'visible' : 'invisible'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-surface-1 rounded-t-lg transform transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Quick Reactions Bar */}
        <div className="flex flex-row justify-around p-4 border-b border-surface-3">
          <QuickReactionButton emoji="❤️" onReaction={onReaction} />
          <QuickReactionButton emoji="👍" onReaction={onReaction} />
          <QuickReactionButton emoji="🔥" onReaction={onReaction} />
          <QuickReactionButton emoji="😂" onReaction={onReaction} />
          <QuickReactionButton emoji="😢" onReaction={onReaction} />
          <QuickReactionButton emoji="😡" onReaction={onReaction} />
        </div>

        {/* Action Menu */}
        <div className="p-4">
          <ActionMenuItem
            icon={faReply}
            label={t`Reply`}
            onAction={onReply}
          />
          <ActionMenuItem
            icon={faFaceSmileBeam}
            label={t`More Reactions`}
            onAction={onMoreReactions}
          />
          <ActionMenuItem
            icon={faLink}
            label={t`Copy Link`}
            onAction={onCopyLink}
          />
          {onDelete && (
            <ActionMenuItem
              icon={faTrash}
              label={t`Delete Message`}
              onAction={onDelete}
              destructive
            />
          )}
        </div>
      </div>
    </div>
  );
};
```

### 4. Quick Reaction Button Component

```typescript
// src/components/message/QuickReactionButton.tsx
interface QuickReactionButtonProps {
  emoji: string;
  onReaction: (emoji: string) => void;
}

const QuickReactionButton = ({ emoji, onReaction }: QuickReactionButtonProps) => {
  return (
    <button
      onClick={() => onReaction(emoji)}
      className="w-12 h-12 flex items-center justify-center text-2xl rounded-full bg-surface-2 hover:bg-surface-3 active:scale-95 transition-all duration-150"
    >
      {emoji}
    </button>
  );
};
```

### 5. Action Menu Item Component

```typescript
// src/components/message/ActionMenuItem.tsx
interface ActionMenuItemProps {
  icon: IconDefinition;
  label: string;
  onAction: () => void;
  destructive?: boolean;
}

const ActionMenuItem = ({ icon, label, onAction, destructive = false }: ActionMenuItemProps) => {
  return (
    <button
      onClick={onAction}
      className={`w-full flex items-center p-3 rounded-lg hover:bg-surface-2 active:bg-surface-3 transition-colors ${
        destructive ? 'text-danger' : 'text-main'
      }`}
    >
      <FontAwesomeIcon icon={icon} className="w-5 h-5 mr-3" />
      <span className="text-left">{label}</span>
    </button>
  );
};
```

### 6. Secondary Emoji Drawer Component

```typescript
// src/components/message/EmojiPickerDrawer.tsx
interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  customEmojis?: Emoji[];
}

const EmojiPickerDrawer = ({
  isOpen,
  onClose,
  onEmojiSelect,
  customEmojis,
}: EmojiPickerDrawerProps) => {
  return (
    <div
      className={`fixed inset-0 z-[10001] ${
        isOpen ? 'visible' : 'invisible'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-surface-1 rounded-t-lg transform transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '70vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-3">
          <h3 className="text-lg font-semibold">{t`Select Emoji`}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-2"
          >
            <FontAwesomeIcon icon={faX} />
          </button>
        </div>

        {/* Emoji Picker */}
        <div className="flex-1 overflow-hidden">
          <EmojiPicker
            width="100%"
            height="100%"
            customEmojis={customEmojis}
            theme={Theme.DARK}
            onEmojiClick={(e) => {
              onEmojiSelect(e.emoji);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
```

## Message.tsx Integration Plan

### Current Desktop Behavior (Keep)

- [ ] Maintain hover actions for desktop/tablet
- [ ] Keep existing emoji picker positioning for non-mobile
- [ ] Preserve current functionality and styling

### Mobile Behavior (New)

- [ ] Replace hover with long-press interaction
- [ ] Show action drawer instead of inline buttons
- [ ] Use drawer-based emoji picker
- [ ] Add haptic feedback for interactions

### Implementation Steps

```typescript
// In Message.tsx component
const { isMobile, isTouch } = useMobileDetection();
const [showActionsDrawer, setShowActionsDrawer] = useState(false);
const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);

const longPressHandlers = useLongPress(
  () => {
    if (isMobile) {
      setShowActionsDrawer(true);
      // Haptic feedback if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  },
  undefined,
  500
);

// In JSX:
<div
  {...(isMobile ? longPressHandlers : {})}
  className="message-container"
>
  {/* Existing message content */}

  {/* Desktop hover actions - only show on non-mobile */}
  {!isMobile && hoverTarget === message.messageId && (
    <div className="absolute flex flex-row right-0 top-[-10px] p-1 bg-tooltip select-none shadow-lg rounded-lg">
      {/* Existing hover actions */}
    </div>
  )}
</div>

{/* Mobile action drawer */}
<MessageActionsDrawer
  isOpen={showActionsDrawer}
  onClose={() => setShowActionsDrawer(false)}
  message={message}
  onReaction={(emoji) => {
    submitMessage({
      type: 'reaction',
      messageId: message.messageId,
      reaction: emoji,
    });
    setShowActionsDrawer(false);
  }}
  onReply={() => {
    setInReplyTo(message);
    editorRef?.focus();
    setShowActionsDrawer(false);
  }}
  onCopyLink={() => {
    const url = `${window.location.origin}${window.location.pathname}#msg-${message.messageId}`;
    navigator.clipboard.writeText(url);
    setShowActionsDrawer(false);
  }}
  onDelete={canUserDelete ? () => {
    submitMessage({
      type: 'remove-message',
      removeMessageId: message.messageId,
    });
    setShowActionsDrawer(false);
  } : undefined}
  onMoreReactions={() => {
    setShowActionsDrawer(false);
    setShowEmojiDrawer(true);
  }}
/>

{/* Mobile emoji picker drawer */}
<EmojiPickerDrawer
  isOpen={showEmojiDrawer}
  onClose={() => setShowEmojiDrawer(false)}
  onEmojiSelect={(emoji) => {
    submitMessage({
      type: 'reaction',
      messageId: message.messageId,
      reaction: emoji,
    });
  }}
  customEmojis={customEmojis}
/>
```

## Files to Create/Modify

### New Files

- [ ] `src/hooks/useMobileDetection.ts` - Mobile device detection (check if existing already)
- [ ] `src/hooks/useLongPress.ts` - Long-press gesture handler (check if existing already)
- [ ] `src/components/message/MessageActionsDrawer.tsx` - Main action drawer
- [ ] `src/components/message/QuickReactionButton.tsx` - Quick reaction buttons
- [ ] `src/components/message/ActionMenuItem.tsx` - Action menu items
- [ ] `src/components/message/EmojiPickerDrawer.tsx` - Secondary emoji drawer

### Modified Files

- [ ] `src/components/message/Message.tsx` - Add mobile interaction logic
- [ ] `src/styles/_components.scss` - Add mobile drawer styling
- [ ] `src/components/message/MessageList.tsx` - Handle drawer positioning context

## Styling Requirements

### Mobile Drawer Styles

```scss
// Action drawer animations
.message-actions-drawer {
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.open {
    transform: translateY(0);
  }
}

// Quick reaction buttons
.quick-reaction-btn {
  min-width: 48px;
  min-height: 48px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

// Action menu items
.action-menu-item {
  min-height: 48px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

// Backdrop
.drawer-backdrop {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
```

### Responsive Breakpoints

- **Mobile**: ≤ 768px (use drawer pattern)
- **Tablet**: 769px - 1023px (hybrid approach)
- **Desktop**: ≥ 1024px (keep hover pattern)

## Testing Checklist

### Mobile Testing

- [ ] Long-press gesture detection works reliably
- [ ] Haptic feedback triggers on supported devices
- [ ] Drawer animations are smooth (60fps)
- [ ] Touch targets meet accessibility guidelines (≥44px)
- [ ] Backdrop dismissal works correctly
- [ ] Quick reactions submit properly
- [ ] Secondary emoji drawer opens/closes correctly

### Cross-Device Testing

- [ ] Desktop hover actions still work
- [ ] Tablet experience is optimized
- [ ] No conflicts between mobile and desktop patterns
- [ ] Responsive switching works at breakpoints

### Accessibility Testing

- [ ] Screen reader compatibility
- [ ] High contrast mode support
- [ ] Keyboard navigation (for desktop)
- [ ] Focus management in drawers
- [ ] ARIA labels and roles

## Performance Considerations

### Optimization Strategies

- [ ] Lazy load drawer components
- [ ] Use `React.memo` for frequently rendered components
- [ ] Debounce resize events for responsive switching
- [ ] Optimize animation performance with `transform` properties
- [ ] Use `will-change` CSS property for animated elements

### Memory Management

- [ ] Clean up event listeners on unmount
- [ ] Cancel pending timeouts on component unmount
- [ ] Avoid memory leaks in gesture handlers

## Success Metrics

### User Experience

- [ ] Reduced tap errors on mobile
- [ ] Increased message interaction rate
- [ ] Improved discoverability of message actions
- [ ] Better accessibility compliance

### Technical

- [ ] No performance regression
- [ ] Smooth animations (60fps)
- [ ] Proper gesture recognition
- [ ] Cross-device compatibility maintained

## Integration with Existing Systems

### Emoji Picker Integration

- [ ] Reference `emojipicker-responsive.md` for proper mobile sizing
- [ ] Use same responsive strategy (no CSS scaling)
- [ ] Maintain existing theme integration
- [ ] Preserve custom emoji support

### Message System Integration

- [ ] Use existing `submitMessage` function
- [ ] Maintain reaction state management
- [ ] Preserve reply functionality
- [ ] Keep delete permissions logic

### Translation Integration

- [ ] Use existing `@lingui/core` for all text
- [ ] Add new translation keys for drawer labels
- [ ] Maintain RTL language support

## Rollback Plan

### Phase-by-Phase Rollback

1. **Phase 1 Rollback**: Remove mobile detection, restore hover-only
2. **Phase 2 Rollback**: Remove drawer components, keep desktop behavior
3. **Phase 3+ Rollback**: Disable mobile features with feature flag

### Feature Flag Implementation

```typescript
// src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  MOBILE_MESSAGE_ACTIONS: process.env.NODE_ENV === 'development' || false,
};

// Usage in Message.tsx
const useMobileActions = FEATURE_FLAGS.MOBILE_MESSAGE_ACTIONS && isMobile;
```

This ensures safe rollback if issues arise during implementation.

## Next Steps

1. **Start with Phase 1**: Mobile detection and long-press handling
2. **Create basic drawer**: Implement MessageActionsDrawer component
3. **Add quick reactions**: Implement Discord-style quick reaction bar
4. **Integrate with existing**: Connect to current message action logic
5. **Test thoroughly**: Validate mobile experience
6. **Iterate based on feedback**: Refine UX based on user testing

This comprehensive plan transforms the message interaction experience to match modern mobile app expectations while maintaining desktop functionality.
