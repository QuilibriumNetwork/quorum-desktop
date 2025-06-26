import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Tooltip from './Tooltip';

type ClickToCopyContentProps = {
  text: string;
  className?: string;
  children: React.ReactNode;
  tooltipText?: string;
  onCopy?: () => void;
  arrow?: 'down' | 'top' | 'left' | 'right' | 'none';
};

const ClickToCopyContent: React.FunctionComponent<ClickToCopyContentProps> = ({
  text,
  className = '',
  children,
  tooltipText = t`Click to copy`,
  onCopy,
  arrow = 'none',
}) => {
  const [copied, setCopied] = React.useState(false);
  const [onHover, setOnHover] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLDivElement>) => {
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
    <div
      className={`relative cursor-pointer ${className}`}
      onClick={handleCopy}
      onMouseEnter={() => !copied && setTimeout(() => setOnHover(true), 1000)}
      onMouseLeave={() => setOnHover(false)}
    >
      {children}
      <Tooltip visible={onHover} arrow={arrow}>
        {tooltipText}
      </Tooltip>
      <Tooltip visible={copied} arrow={arrow}>
        <Trans>Copied!</Trans>
      </Tooltip>
    </div>
  );
};

export default ClickToCopyContent;
