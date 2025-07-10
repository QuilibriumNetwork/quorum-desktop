import * as React from 'react';
import { t } from '@lingui/core/macro';
import ReactTooltip from './ReactTooltip';
import { faClipboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTheme } from './context/ThemeProvider';

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
}) => {
  const [copied, setCopied] = React.useState(false);
  const { theme: contextTheme } = useTheme();
  const resolvedTheme = theme ?? contextTheme;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (window.electron !== undefined) {
        window.electron.clipboard.writeText(text);
      } else {
        navigator.clipboard.writeText(text);
      }

      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const wrapperClass = `flex items-center rounded-md ${
    copyOnContentClick ? 'cursor-pointer' : ''
  } ${className}`;

  const icon = (
    <FontAwesomeIcon
      icon={faClipboard}
      id={!copyOnContentClick ? 'click-to-copy-content-icon' : undefined}
      className={`${
        iconClassName || 'text-main'
      } ${iconPosition === 'left' ? 'mr-1' : 'ml-1'} ${
        !copyOnContentClick ? 'cursor-pointer hover:text-subtle' : ''
      }`}
      onClick={!copyOnContentClick ? handleCopy : undefined}
    />
  );

  return (
    <div
      className={wrapperClass}
      onClick={copyOnContentClick ? handleCopy : undefined}
      id={copyOnContentClick ? 'click-to-copy-content-wrapper' : undefined}
    >
      {iconPosition === 'left' && icon}
      <span className={!copyOnContentClick ? 'select-text' : 'flex-1'}>
        {children}
      </span>
      {iconPosition === 'right' && icon}

      <ReactTooltip
        id="click-to-copy-content-tooltip"
        content={copied ? t`Copied!` : tooltipText}
        place={tooltipLocation}
        noArrow={noArrow}
        theme={resolvedTheme}
        anchorSelect={
          copyOnContentClick
            ? '#click-to-copy-content-wrapper'
            : '#click-to-copy-content-icon'
        }
      />
    </div>
  );
};

export default ClickToCopyContent;
