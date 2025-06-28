import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { faClipboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

type ClickToCopyContentProps = {
  text: string;
  className?: string;
  children: React.ReactNode;
  tooltipText?: string;
  onCopy?: () => void;
  iconClassName?: string;
  noArrow?: boolean;
  tooltipLocation?: 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end';
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
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent<SVGSVGElement>) => {
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

  const generateRandomId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  return (
    <div className={`flex items-center hover:bg-surface-2 hover:text-white rounded-md cursor-pointer ${className}`}>
      <a
        data-tooltip-id="click-to-copy-content-tooltip"
        data-tooltip-content={copied ? t`Copied!` : tooltipText}
        data-tooltip-variant="dark"
        data-tooltip-no-arrow={noArrow}
        data-tooltip-place={tooltipLocation}
      >
        <FontAwesomeIcon
          icon={faClipboard}
          className={`cursor-pointer hover:text-text-base text-white mr-1 ${iconClassName}`}
          onClick={(e) => handleCopy(e)}
        />
      </a>
      <Tooltip id="click-to-copy-content-tooltip" />
      {children}
    </div>
  );
};

export default ClickToCopyContent;
