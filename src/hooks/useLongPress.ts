import { useCallback, useRef, useState } from 'react';
import { isTouchDevice } from '../utils/platform';

export interface LongPressOptions {
  delay?: number;
  onLongPress?: () => void;
  onTap?: () => void;
  shouldPreventDefault?: boolean;
  threshold?: number;
  /** Automatically prevent browser default context menu and text selection on touch devices */
  preventTouchDefaults?: boolean;
}

export interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  /** Prevent context menu on touch devices - use this on your element */
  onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * Enhanced interface that includes styles and className for touch behavior prevention
 */
export interface LongPressHandlersWithStyles extends LongPressHandlers {
  /** CSS styles to prevent text selection and touch callouts */
  style?: React.CSSProperties;
  /** CSS classes for touch behavior prevention */
  className?: string;
}

/**
 * Custom hook for handling long-press gestures with touch and mouse support
 *
 * @param options Configuration object for long-press behavior
 * @returns Object containing event handlers for touch and mouse events
 */
export const useLongPress = (
  options: LongPressOptions = {}
): LongPressHandlers => {
  const {
    delay = 500,
    onLongPress,
    onTap,
    shouldPreventDefault = true,
    threshold = 10,
    preventTouchDefaults = true,
  } = options;

  const isTouch = isTouchDevice();

  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<NodeJS.Timeout>(undefined);
  const target = useRef<EventTarget>(undefined);
  const startPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      if (shouldPreventDefault && event.target && event.cancelable) {
        event.preventDefault();
      }

      const clientX =
        'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY =
        'touches' in event ? event.touches[0].clientY : event.clientY;

      startPoint.current = { x: clientX, y: clientY };
      target.current = event.target;
      setLongPressTriggered(false);

      timeout.current = setTimeout(() => {
        if (onLongPress) {
          onLongPress();
          setLongPressTriggered(true);
        }
      }, delay);
    },
    [delay, onLongPress, shouldPreventDefault]
  );

  const clear = useCallback(
    (event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current);

      if (shouldTriggerClick && !longPressTriggered && onTap) {
        onTap();
      }

      setLongPressTriggered(false);
    },
    [longPressTriggered, onTap]
  );

  const move = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      const clientX =
        'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY =
        'touches' in event ? event.touches[0].clientY : event.clientY;

      const deltaX = Math.abs(clientX - startPoint.current.x);
      const deltaY = Math.abs(clientY - startPoint.current.y);

      // If user moves finger/mouse too much, cancel long press
      if (deltaX > threshold || deltaY > threshold) {
        timeout.current && clearTimeout(timeout.current);
      }
    },
    [threshold]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (isTouch && preventTouchDefaults && onLongPress) {
        e.preventDefault();
      }
    },
    [isTouch, preventTouchDefaults, onLongPress]
  );

  return {
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
    onTouchMove: (e: React.TouchEvent) => move(e),
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onContextMenu: handleContextMenu,
  };
};

/**
 * Enhanced version of useLongPress that automatically provides styles and classes
 * for preventing browser default touch behaviors (context menu, text selection, etc.)
 *
 * Use this for elements where you want long press functionality with automatic
 * touch behavior prevention.
 */
export const useLongPressWithDefaults = (
  options: LongPressOptions = {}
): LongPressHandlersWithStyles => {
  const handlers = useLongPress(options);
  const isTouch = isTouchDevice();
  const { preventTouchDefaults = true, onLongPress } = options;

  const touchPreventionStyles: React.CSSProperties | undefined =
    isTouch && preventTouchDefaults && onLongPress ? {
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
      WebkitTapHighlightColor: 'transparent',
      userSelect: 'none',
      touchAction: 'manipulation',
    } : undefined;

  const touchPreventionClasses =
    isTouch && preventTouchDefaults && onLongPress ? 'select-none' : undefined;

  return {
    ...handlers,
    style: touchPreventionStyles,
    className: touchPreventionClasses,
  };
};
