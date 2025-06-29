import * as React from 'react';
import { faClipboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';
import ReactTooltip from './ReactTooltip';

declare global {
  interface Window {
    electron?: {
      clipboard: {
        writeText: (text: string) => void;
      };
    };
  }
}

type CopyToClipboardProps = {
  text: string;
  className?: string;
  iconClassName?: string;
  onCopy?: () => void;
  tooltipText?: string;
  noArrow?: boolean;
  tooltipLocation?: 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end';
  theme?: 'dark' | 'light' | 'system';
};

const CopyToClipboard: React.FunctionComponent<CopyToClipboardProps> = ({
  text,
  className = '',
  iconClassName = '',
  tooltipText = t`Copy to clipboard`,
  onCopy,
  noArrow = false,
  tooltipLocation = 'top',
  theme,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [onHover, setOnHover] = React.useState(false);
  const handleCopy = async (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    try {
      if (onHover) {
        setOnHover(false);
      }

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
    <div className={`flex items-center ${className}`}>
      <FontAwesomeIcon
        icon={faClipboard}
        id="copy-to-clipboard-icon"
        className={`cursor-pointer hover:text-text-base text-white ${iconClassName}`}
        onClick={(e) => handleCopy(e)}
      />
      <ReactTooltip
        id="copy-to-clipboard-tooltip"
        content={copied ? t`Copied!` : tooltipText}
        place={tooltipLocation}
        noArrow={noArrow}
        theme={theme}
        anchorSelect="#copy-to-clipboard-icon"
      />
    </div>
  );
};

export default CopyToClipboard;
