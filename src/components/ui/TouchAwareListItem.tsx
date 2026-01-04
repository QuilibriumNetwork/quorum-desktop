import React from 'react';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { hapticLight } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { isTouchDevice } from '../../utils/platform';

interface TouchAwareListItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Click/tap handler - called without event parameter for consistency */
  onClick: () => void;
  /** Optional long press handler for touch devices */
  onLongPress?: () => void;
  /** Children to render */
  children: React.ReactNode;
}

/**
 * A wrapper component for list items that need touch-aware click handling.
 * On touch devices, it uses the useLongPress hook to distinguish between
 * scrolling and tapping, preventing accidental taps when scrolling.
 * On desktop, it uses standard onClick handling.
 */
export const TouchAwareListItem: React.FC<TouchAwareListItemProps> = ({
  onClick,
  onLongPress,
  className = '',
  style,
  children,
  role = 'button',
  tabIndex = 0,
  ...rest
}) => {
  const isTouch = isTouchDevice();

  // Keyboard handler for accessibility (shared between touch and desktop)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Long press handlers for touch devices with scroll threshold detection
  const longPressHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    onLongPress: onLongPress
      ? () => {
          hapticLight();
          onLongPress();
        }
      : undefined,
    onTap: () => {
      hapticLight();
      onClick();
    },
    shouldPreventDefault: false, // Don't prevent default to allow scrolling
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
  });

  // Touch device: use long press handlers with scroll threshold detection
  if (isTouch) {
    return (
      <div
        {...longPressHandlers}
        {...rest}
        onKeyDown={handleKeyDown}
        className={`${className} ${longPressHandlers.className || ''}`}
        style={{ ...style, ...longPressHandlers.style }}
        role={role}
        tabIndex={tabIndex}
      >
        {children}
      </div>
    );
  }

  // Desktop: use standard click handlers
  return (
    <div
      {...rest}
      className={className}
      style={style}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={role}
      tabIndex={tabIndex}
    >
      {children}
    </div>
  );
};

export default TouchAwareListItem;
