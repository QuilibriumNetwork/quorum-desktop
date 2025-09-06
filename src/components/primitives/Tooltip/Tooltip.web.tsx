import { cloneElement, isValidElement, ReactElement } from 'react';
import { TooltipWebProps } from './types';
import ReactTooltip from '../../ReactTooltip';

export function Tooltip({
  id,
  content,
  children,
  place = 'top',
  noArrow = false,
  className = '',
  highlighted = false,
  showCloseButton = false, // Not used on web, for API consistency
  maxWidth = 400,
  disabled = false,
  touchTrigger = 'click',
  longPressDuration = 700,
  showOnTouch = true,
  autoHideAfter,
}: TooltipWebProps) {
  const tooltipId = `${id}-tooltip`;
  const anchorId = `${id}-anchor`;

  // Clone the child element and add the anchor ID for tooltip targeting
  const childWithAnchor = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        id: anchorId,
        ...(children as ReactElement<any>).props,
      })
    : children;

  if (disabled) {
    return <>{children}</>;
  }

  // Create maxWidth style - only apply if not default
  const maxWidthStyle = maxWidth !== 400 ? `!max-w-[${maxWidth}px]` : '';
  const tooltipClassName = `${maxWidthStyle} ${className}`.trim();

  return (
    <>
      {childWithAnchor}
      <ReactTooltip
        id={tooltipId}
        content={content}
        place={place}
        noArrow={noArrow}
        className={tooltipClassName}
        anchorSelect={`#${anchorId}`}
        highlighted={highlighted}
        showOnTouch={showOnTouch}
        touchTrigger={touchTrigger}
        longPressDuration={longPressDuration}
        autoHideAfter={autoHideAfter}
      />
    </>
  );
}
