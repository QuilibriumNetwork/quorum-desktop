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
    | 'top' | 'top-start' | 'top-end'
    | 'right' | 'right-start' | 'right-end'
    | 'bottom' | 'bottom-start' | 'bottom-end'
    | 'left' | 'left-start' | 'left-end';
  theme?: 'dark' | 'light' | 'system';
  copyOnContentClick?: boolean;
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

  return (
    <div
      className={`flex items-center hover:bg-surface-2 hover:text-white rounded-md cursor-pointer ${className}`}
      onClick={copyOnContentClick ? handleCopy : undefined}
      id={copyOnContentClick ? 'click-to-copy-content-wrapper' : undefined}
    >
      <FontAwesomeIcon
        icon={faClipboard}
        id={!copyOnContentClick ? 'click-to-copy-content-icon' : undefined}
        className={`cursor-pointer hover:text-main text-white mr-1 ${iconClassName}`}
        onClick={!copyOnContentClick ? handleCopy : undefined}
      />
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
      {children}
    </div>
  );
};

export default ClickToCopyContent;
