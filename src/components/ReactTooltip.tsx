import * as React from 'react';
import { Tooltip } from 'react-tooltip';
import './ReactTooltip.scss';
import 'react-tooltip/dist/react-tooltip.css';

import { useTheme } from './primitives/theme';
import { isTouchDevice } from '../utils/platform';

type ReactTooltipProps = {
  id: string;
  content: string;
  place?:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end';
  noArrow?: boolean;
  theme?: 'dark' | 'light' | 'system';
  anchorSelect?: string;
  className?: string;
  highlighted?: boolean;
  showOnTouch?: boolean;
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  alwaysVisible?: boolean;
  autoHideAfter?: number; // Optional auto-hide timeout in milliseconds
};

const ReactTooltip: React.FunctionComponent<ReactTooltipProps> = ({
  id,
  content,
  place = 'top',
  noArrow = false,
  className = '',
  theme,
  anchorSelect,
  highlighted = false,
  showOnTouch = false,
  touchTrigger = 'click',
  longPressDuration = 700,
  alwaysVisible = false,
  autoHideAfter,
}) => {
  const { resolvedTheme } = useTheme();
  const resolvedThemeInUse = theme || resolvedTheme;
  const [visible, setVisible] = React.useState(false);
  const tooltipRef = React.useRef<HTMLElement | null>(null);
  

  // Auto-apply responsive width and text wrapping for showOnTouch tooltips
  const touchClass = showOnTouch ? 'quorum-react-tooltip-touch' : '';
  const tooltipClassName = `${resolvedThemeInUse === 'dark' ? 'quorum-react-tooltip-dark' : 'quorum-react-tooltip'} ${highlighted ? 'quorum-react-tooltip-highlighted' : ''} ${touchClass} ${className}`;

  // Handle opening/closing on touch devices with click or long-press, and outside click/touch to close
  React.useEffect(() => {
    if (!showOnTouch || !isTouchDevice() || !anchorSelect || alwaysVisible)
      return;

    const elem = document.querySelector(anchorSelect) as HTMLElement | null;
    if (!elem) return;
    tooltipRef.current = elem;
    let pressTimer: NodeJS.Timeout | null = null;

    // Open tooltip logic for click or long-press
    const openTooltip = (e: Event) => {
      // Don't stop propagation - let the original click handler work too
      setVisible(true);
    };

    if (touchTrigger === 'click') {
      const handleTouch = (e: TouchEvent) => {
        // Don't prevent default - let the original click handler work
        openTooltip(e);
      };
      elem.addEventListener('touchend', handleTouch, { passive: false });
      // For accessibility, also open on click
      elem.addEventListener('click', openTooltip);

      return () => {
        elem.removeEventListener('touchend', handleTouch);
        elem.removeEventListener('click', openTooltip);
      };
    }

    if (touchTrigger === 'long-press') {
      const handleTouchStart = (e: TouchEvent) => {
        pressTimer = setTimeout(() => openTooltip(e), longPressDuration);
      };
      const handleTouchEnd = (e: TouchEvent) => {
        if (pressTimer) clearTimeout(pressTimer);
      };
      elem.addEventListener('touchstart', handleTouchStart);
      elem.addEventListener('touchend', handleTouchEnd);
      elem.addEventListener('touchcancel', handleTouchEnd);
      // For accessibility, also open on click
      elem.addEventListener('click', openTooltip);

      return () => {
        elem.removeEventListener('touchstart', handleTouchStart);
        elem.removeEventListener('touchend', handleTouchEnd);
        elem.removeEventListener('touchcancel', handleTouchEnd);
        elem.removeEventListener('click', openTooltip);
      };
    }
  }, [showOnTouch, anchorSelect, touchTrigger, longPressDuration]);

  // Auto-hide after specified time on touch devices (if autoHideAfter is provided)
  React.useEffect(() => {
    if (!showOnTouch || !isTouchDevice() || !visible || alwaysVisible || !autoHideAfter) return;

    const autoHideTimer = setTimeout(() => {
      setVisible(false);
    }, autoHideAfter);

    return () => {
      clearTimeout(autoHideTimer);
    };
  }, [visible, showOnTouch, alwaysVisible, autoHideAfter]);

  // Dismiss on outside tap/click when tooltip is open and on a touch device
  React.useEffect(() => {
    if (!showOnTouch || !isTouchDevice() || !visible || alwaysVisible) return;

    const handleOutside = (e: Event) => {
      // If anchor is not present or the click was outside
      const elem = tooltipRef.current;
      if (!elem) return setVisible(false);
      if (!(e.target instanceof Node) || !elem.contains(e.target)) {
        setVisible(false);
      }
    };
    document.addEventListener('touchstart', handleOutside, true);
    document.addEventListener('mousedown', handleOutside, true);
    return () => {
      document.removeEventListener('touchstart', handleOutside, true);
      document.removeEventListener('mousedown', handleOutside, true);
    };
  }, [visible, showOnTouch]);

  // Hide by default on touch unless showOnTouch is set
  if (isTouchDevice() && !showOnTouch) {
    return null;
  }

  // On touch devices and showOnTouch, show controlled tooltip
  if (isTouchDevice() && showOnTouch) {
    return (
      <Tooltip
        id={id}
        content={content}
        place={place}
        noArrow={noArrow}
        className={tooltipClassName}
        anchorSelect={anchorSelect}
        border={
          highlighted ? '1px solid var(--color-border-default)' : undefined
        }
        isOpen={alwaysVisible ? true : visible}
        disableFocusListener
        disableHoverListener
        disableTouchListener
      />
    );
  }

  // Normal desktop/hover operation
  return (
    <Tooltip
      id={id}
      content={content}
      place={place}
      noArrow={noArrow}
      className={tooltipClassName}
      anchorSelect={anchorSelect}
      border={highlighted ? '1px solid var(--color-border-default)' : undefined}
    />
  );
};

export default ReactTooltip;
