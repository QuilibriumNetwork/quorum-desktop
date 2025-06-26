import * as React from 'react';
import { faClipboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Tooltip from './Tooltip';


type CopyToClipboardProps = {
  text: string;
  className?: string;
  iconClassName?: string;
  onCopy?: () => void;
  tooltipText?: string;
  arrow?: 'down' | 'top' | 'left' | 'right' | 'none';
};

const CopyToClipboard: React.FunctionComponent<CopyToClipboardProps> = ({
  text,
  className = '',
  iconClassName = '',
  tooltipText = t`Copy to clipboard`,
  onCopy,
  arrow = 'none',
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
      <Tooltip visible={onHover} arrow={arrow}>
        {tooltipText}
      </Tooltip>
      <FontAwesomeIcon
        icon={faClipboard}
        className={`cursor-pointer hover:text-text-base ${iconClassName}`}
        onClick={(e) => handleCopy(e)}
        onMouseEnter={() => !copied && setTimeout(() => setOnHover(true), 1000)}
        onMouseLeave={() => setOnHover(false)}
        onMouseOut={() => setOnHover(false)}
      />
      <Tooltip visible={copied} arrow={arrow}>
        <Trans>Copied!</Trans>
      </Tooltip>
    </div>
  );
};

export default CopyToClipboard;
