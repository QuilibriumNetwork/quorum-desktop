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
  highlighted?: boolean;
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
}) => {
  const { resolvedTheme } = useTheme();
  const resolvedThemeInUse = theme || resolvedTheme;

  const tooltipClassName = `${resolvedThemeInUse === 'dark' ? 'quorum-react-tooltip-dark' : 'quorum-react-tooltip'} ${highlighted ? 'quorum-react-tooltip-highlighted' : ''} ${className}`;

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
