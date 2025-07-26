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
  maxWidth = 400,
  disabled = false,
}: TooltipWebProps) {
  const tooltipId = `${id}-tooltip`;
  const anchorId = `${id}-anchor`;

  // Clone the child element and add the anchor ID for tooltip targeting
  const childWithAnchor = isValidElement(children)
    ? cloneElement(children as ReactElement, {
        id: anchorId,
        ...(children as ReactElement).props,
      })
    : children;

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      {childWithAnchor}
      <ReactTooltip
        id={tooltipId}
        content={content}
        place={place}
        noArrow={noArrow}
        className={`!w-[${maxWidth}px] ${className}`}
        anchorSelect={`#${anchorId}`}
        highlighted={highlighted}
        showOnTouch
        touchTrigger="click"
      />
    </>
  );
}