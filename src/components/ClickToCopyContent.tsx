import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Container, Icon, Text, Tooltip } from './primitives';
import { useCopyToClipboard } from '../hooks';
import { isTouchDevice } from '../hooks/platform/clipboard/useClipboard.web';

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
  copyOnContentClick?: boolean;
  iconPosition?: 'left' | 'right';
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  textVariant?:
    | 'default'
    | 'strong'
    | 'subtle'
    | 'muted'
    | 'error'
    | 'success'
    | 'warning';
  textSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  iconSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
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
  copyOnContentClick = false,
  iconPosition = 'left',
  touchTrigger = 'click',
  longPressDuration = 700,
  textVariant,
  textSize,
  iconSize = 'sm',
}) => {
  // Use extracted hooks
  const { copied, copyToClipboard } = useCopyToClipboard({
    onCopy,
    timeout: 2000,
    touchTimeout: 3000,
  });

  const [hideTooltip, setHideTooltip] = React.useState(false);

  const tooltipId = React.useMemo(
    () => `click-to-copy-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const handleCopy = async (e?: React.MouseEvent | Event) => {
    e?.stopPropagation();
    await copyToClipboard(text);
    setHideTooltip(false); // Show tooltip after copy

    // On touch devices, auto-hide tooltip after 3 seconds
    if (isTouchDevice()) {
      setTimeout(() => {
        setHideTooltip(true);
      }, 3000);
    }
  };

  // Touch event handling for mobile devices
  React.useEffect(() => {
    if (!isTouchDevice()) return;

    // Our Tooltip primitive uses ${id}-anchor format for anchor IDs
    const actualAnchorId = `${tooltipId}-anchor`;
    const anchorElement = document.getElementById(actualAnchorId);
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
  }, [tooltipId, touchTrigger, longPressDuration, text, onCopy]);

  const iconElement = (
    <Icon
      name="clipboard"
      size={iconSize}
      className={iconClassName || undefined}
      onClick={!copyOnContentClick ? handleCopy : undefined}
      style={{
        marginLeft: iconPosition === 'right' ? '4px' : undefined,
        marginRight: iconPosition === 'left' ? '4px' : undefined,
        cursor: !copyOnContentClick ? 'pointer' : undefined,
      }}
    />
  );

  // Wrap icon with tooltip if not copyOnContentClick
  const icon = !copyOnContentClick ? (
    <Tooltip
      id={tooltipId}
      content={copied ? t`Copied!` : tooltipText}
      place={tooltipLocation}
      noArrow={noArrow}
      showOnTouch={!(isTouchDevice() && hideTooltip)}
      touchTrigger={touchTrigger}
      longPressDuration={longPressDuration}
    >
      {iconElement}
    </Tooltip>
  ) : (
    iconElement
  );

  const containerContent = (
    <Container
      className={className}
      onClick={copyOnContentClick ? handleCopy : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: '6px',
        cursor: copyOnContentClick ? 'pointer' : undefined,
      }}
    >
      {iconPosition === 'left' && icon}
      <Text
        variant={textVariant}
        size={textSize}
        className={className}
        style={{
          userSelect: !copyOnContentClick ? 'text' : 'none',
          flex: copyOnContentClick ? 1 : undefined,
        }}
      >
        {children}
      </Text>
      {iconPosition === 'right' && icon}
    </Container>
  );

  // Wrap entire container with tooltip if copyOnContentClick
  return copyOnContentClick ? (
    <Tooltip
      id={tooltipId}
      content={copied ? t`Copied!` : tooltipText}
      place={tooltipLocation}
      noArrow={noArrow}
      showOnTouch={!(isTouchDevice() && hideTooltip)}
      touchTrigger={touchTrigger}
      longPressDuration={longPressDuration}
    >
      {containerContent}
    </Tooltip>
  ) : (
    containerContent
  );
};

export default ClickToCopyContent;
