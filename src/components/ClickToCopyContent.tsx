import * as React from 'react';
import { t } from '@lingui/core/macro';
import ReactTooltip from './ReactTooltip';
import { faClipboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTheme } from './context/ThemeProvider';

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0);

type ClickToCopyContentProps = {
  text: string;
  className?: string;
  children: React.ReactNode;
  tooltipText?: string;
  onCopy?: () => void;
  iconClassName?: string;
  noArrow?: boolean;
  tooltipLocation?:
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
  theme?: 'dark' | 'light' | 'system';
  copyOnContentClick?: boolean;
  iconPosition?: 'left' | 'right';
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
};

const ClickToCopyContent: React.FunctionComponent<ClickToCopyContentProps> = ({
  text,
  className = '',
  children,
  tooltipText = t`Click to copy`,
  iconClassName = '',
  onCopy,
  noArrow = false,
  tooltipLocation,
  theme,
  copyOnContentClick = false,
  iconPosition = 'left',
  touchTrigger = 'click',
  longPressDuration = 700,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [hideTooltip, setHideTooltip] = React.useState(false);
  const { theme: contextTheme } = useTheme();
  const resolvedTheme = theme ?? contextTheme;

  const uid = React.useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const tooltipId = `click-to-copy-tooltip-${uid}`;
  const anchorId = `click-to-copy-anchor-${uid}`;

  const handleCopy = async (e?: React.MouseEvent | Event) => {
    e?.stopPropagation();
    try {
      if (window.electron !== undefined) {
        window.electron.clipboard.writeText(text);
      } else {
        navigator.clipboard.writeText(text);
      }

      setCopied(true);
      setHideTooltip(false);
      if (onCopy) onCopy();

      if (isTouchDevice()) {
        setTimeout(() => {
          setHideTooltip(true);
          setCopied(false);
        }, 3000);
      } else {
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Touch event handling for mobile devices
  React.useEffect(() => {
    if (!isTouchDevice()) return;

    const anchorElement = document.getElementById(anchorId);
    if (!anchorElement) return;

    let pressTimer: NodeJS.Timeout | null = null;

    const handleTouchCopy = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      handleCopy(e);
    };

    if (touchTrigger === 'click') {
      anchorElement.addEventListener('touchend', handleTouchCopy, {
        passive: false,
      });
      return () => {
        anchorElement.removeEventListener('touchend', handleTouchCopy);
      };
    }

    if (touchTrigger === 'long-press') {
      const handleTouchStart = (e: TouchEvent) => {
        pressTimer = setTimeout(() => handleTouchCopy(e), longPressDuration);
      };
      const handleTouchEnd = () => {
        if (pressTimer) clearTimeout(pressTimer);
      };

      anchorElement.addEventListener('touchstart', handleTouchStart);
      anchorElement.addEventListener('touchend', handleTouchEnd);
      anchorElement.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        anchorElement.removeEventListener('touchstart', handleTouchStart);
        anchorElement.removeEventListener('touchend', handleTouchEnd);
        anchorElement.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [anchorId, touchTrigger, longPressDuration, text, onCopy]);

  const wrapperClass = `flex items-center rounded-md ${
    copyOnContentClick ? 'cursor-pointer hover:text-subtle' : ''
  } ${className}`;

  const icon = (
    <FontAwesomeIcon
      icon={faClipboard}
      id={!copyOnContentClick ? anchorId : undefined}
      className={`${
        iconClassName || 'text-main'
      } ${iconPosition === 'left' ? 'mr-1' : 'ml-1'} ${
        !copyOnContentClick
          ? 'cursor-pointer hover:text-subtle focus:outline-none focus:ring-0 active:bg-transparent'
          : ''
      }`}
      onClick={!copyOnContentClick ? handleCopy : undefined}
    />
  );

  return (
    <div
      className={wrapperClass}
      onClick={copyOnContentClick ? handleCopy : undefined}
      id={copyOnContentClick ? anchorId : undefined}
    >
      {iconPosition === 'left' && icon}
      <span className={!copyOnContentClick ? 'select-text' : 'flex-1'}>
        {children}
      </span>
      {iconPosition === 'right' && icon}

      {!(isTouchDevice() && hideTooltip) && (
        <ReactTooltip
          id={tooltipId}
          content={copied ? t`Copied!` : tooltipText}
          place={tooltipLocation}
          noArrow={noArrow}
          theme={resolvedTheme}
          anchorSelect={`#${anchorId}`}
          showOnTouch
          touchTrigger={touchTrigger}
          longPressDuration={longPressDuration}
        />
      )}
    </div>
  );
};

export default ClickToCopyContent;
