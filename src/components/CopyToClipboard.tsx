import * as React from 'react';
import { faClipboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';


type CopyToClipboardProps = {
  text: string;
  className?: string;
  iconClassName?: string;
  onCopy?: () => void;
  tooltipText?: string;
  noArrow?: boolean;
  tooltipLocation?: 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end';
};

const CopyToClipboard: React.FunctionComponent<CopyToClipboardProps> = ({
  text,
  className = '',
  iconClassName = '',
  tooltipText = t`Copy to clipboard`,
  onCopy,
  noArrow = false,
  tooltipLocation = 'top',
}) => {
  const [copied, setCopied] = React.useState(false);
  const [onHover, setOnHover] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    try {
        // remove the on hover tooltip if it's visible
      if (onHover) {
        setOnHover(false);
      }

      // copy to clipboard
      if (window.electron !== undefined) {
        // if in electron, use the electron clipboard
        console.log('copying to clipboard', window.electron);
        window.electron.clipboard.writeText(text);
      } else {
        // if in browser, use the browser clipboard
        navigator.clipboard.writeText(text);
      }

      // display the copied tooltip
      setCopied(true);

      // run any callback function
      if (onCopy) onCopy();

      // hide the copied tooltip after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };


  return (
    <div className={`flex items-center ${className}`}>
      <a
        data-tooltip-id="copy-to-clipboard-tooltip"
        data-tooltip-content={copied ? t`Copied!` : tooltipText}
        data-tooltip-place={tooltipLocation}
        data-tooltip-variant="dark"
        data-tooltip-no-arrow={noArrow}
      >
        <FontAwesomeIcon
          icon={faClipboard}
          className={`cursor-pointer hover:text-text-base text-white ${iconClassName}`}
          onClick={(e) => handleCopy(e)}
        />
      </a>
      <Tooltip id="copy-to-clipboard-tooltip" />
    </div>
  );
};

export default CopyToClipboard;
