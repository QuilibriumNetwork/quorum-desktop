# ReactTooltip Mobile Optimization

[← Back to INDEX](../../INDEX.md)

Dear Claude, read the text and code below and decide if it's a good idea to implement it, or if it could be improved upon.

Objective is to made ReactTooltip.tsx optimized for mobile. This component could have mobile features that we are unaware of, so search online in their docs.

Once we have the component optimized for mobile, all "i" icons on the app that have a tooltip for more info, should open the tooltip on touch devices upon normal touch (not long pres). In all othercases, the tooltips should be hidden on touch devices, at least for now.
These "i" icons are mainly in SpaceEditor and UserSettingsModal modals.

========

The new version of the ReactTooltip component adds two optional props:

- **showOnTouch**: If true, this tooltip will be enabled on touch devices (mobile/tablet). By default, tooltips are hidden on touch devices.
- **trigger**: Allows you to choose how the tooltip is activated on touch devices. You can specify 'hover', 'click', or 'long-press' (default: 'hover' for desktop).

**How it works:**

- On desktop, tooltips work as usual (hover-based).
- On touch devices:
  - Tooltips are hidden by default (return null).
  - If `showOnTouch` is true:
    - The tooltip is shown and can be triggered based on the `trigger` prop:
      - 'click': shows/hides the tooltip on tap.
      - 'long-press': shows the tooltip after pressing and holding for 500ms, hides on release/cancel.
    - Listeners are attached to the anchor element matching `anchorSelect`.
    - Tooltip visibility is controlled internally through React state.

**Summary:**  
By default, no tooltips show on mobile/touch. But now, by opting in (`showOnTouch`), you can provide interactive tooltips on mobile using tap or long press, for specific tooltips where they're helpful. This gives you control and improves accessibility for both desktop and mobile users.

Current ReactTooltip.tsx may have added features compared to the below one, we must alwys maintain the latest features we implemented (like the "highlighted" prop).

```tsx
import * as React from 'react';
import { Tooltip } from 'react-tooltip';
import './ReactTooltip.scss';
import 'react-tooltip/dist/react-tooltip.css';

import { useTheme } from './context/ThemeProvider';

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
  showOnTouch?: boolean;
  touchTrigger?: 'press' | 'long-press'; // choose how the tooltip is triggered on touch
  longPressDuration?: number; // ms for long-press, default 500
};

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0);

const ReactTooltip: React.FunctionComponent<ReactTooltipProps> = ({
  id,
  content,
  place = 'top',
  noArrow = false,
  className = '',
  theme,
  anchorSelect,
  showOnTouch = false,
  touchTrigger = 'press',
  longPressDuration = 500,
}) => {
  const { resolvedTheme } = useTheme();
  const resolvedThemeInUse = theme || resolvedTheme;
  const [visible, setVisible] = React.useState(false);
  const tooltipRef = React.useRef<HTMLElement | null>(null);

  // Handle opening/closing on touch devices with press or long-press, and outside click/touch to close
  React.useEffect(() => {
    if (!showOnTouch || !isTouchDevice() || !anchorSelect) return;

    const elem = document.querySelector(anchorSelect) as HTMLElement | null;
    if (!elem) return;
    tooltipRef.current = elem;
    let pressTimer: NodeJS.Timeout | null = null;

    // Open tooltip logic for press or long-press
    const openTooltip = (e: Event) => {
      e.stopPropagation();
      setVisible(true);
    };

    if (touchTrigger === 'press') {
      const handleTouch = (e: TouchEvent) => {
        e.preventDefault();
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

  // Dismiss on outside tap/click when tooltip is open and on a touch device
  React.useEffect(() => {
    if (!showOnTouch || !isTouchDevice() || !visible) return;

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
        className={`${resolvedThemeInUse === 'dark' ? 'quorum-react-tooltip-dark' : 'quorum-react-tooltip'} ${className}`}
        anchorSelect={anchorSelect}
        open={visible}
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
      className={`${resolvedThemeInUse === 'dark' ? 'quorum-react-tooltip-dark' : 'quorum-react-tooltip'} ${className}`}
      anchorSelect={anchorSelect}
    />
  );
};

export default ReactTooltip;
```

**How this works:**

- On desktop: Hovers work normally.
- On touch devices: If `showOnTouch` is true, a tap (press) or long-press (configurable) on the anchor will show the tooltip, and it will **remain open** until the user taps anywhere outside the icon/anchor.
- Tooltip does not show on mobile unless `showOnTouch` is explicitly set.
- For accessibility, tapping the icon always opens the tooltip.

**Usage Example:**

```jsx
<ReactTooltip
  id="info-tooltip"
  content="More information..."
  anchorSelect="#info-icon"
  showOnTouch
  touchTrigger="press"
/>
```
