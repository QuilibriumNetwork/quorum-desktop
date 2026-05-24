import { t } from '@lingui/core/macro';
import { Fragment } from 'react';
import { useTypingIndicator } from '../../hooks/business/messages/useTypingIndicator';
import type { TypingScope } from '@quilibrium/quorum-shared';
import './TypingIndicator.scss';

export interface TypingIndicatorProps {
  scope: TypingScope | null;
  /**
   * Resolve a typist's address to a display name. Provided by the parent
   * (Channel/Thread use the space members map; DirectMessage uses the
   * conversation contact). Falls back to a truncated address when omitted
   * or when the resolver returns a falsy value.
   */
  resolveName?: (address: string) => string | undefined;
}

const MAX_NAME_LEN = 20;

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LEN) return name;
  return `${name.slice(0, MAX_NAME_LEN - 1)}…`;
}

export function TypingIndicator({ scope, resolveName }: TypingIndicatorProps) {
  const typists = useTypingIndicator(scope);

  const names = typists.map((addr) => {
    const resolved = resolveName?.(addr);
    return resolved ? truncateName(resolved) : truncateAddress(addr);
  });

  let content: React.ReactNode = null;
  if (names.length === 1) {
    content = (
      <Fragment>
        <strong>{names[0]}</strong> {t`is typing`}
      </Fragment>
    );
  } else if (names.length === 2) {
    content = (
      <Fragment>
        <strong>{names[0]}</strong> {t`and`} <strong>{names[1]}</strong> {t`are typing`}
      </Fragment>
    );
  } else if (names.length === 3) {
    content = (
      <Fragment>
        <strong>{names[0]}</strong>, <strong>{names[1]}</strong> {t`and`} <strong>{names[2]}</strong> {t`are typing`}
      </Fragment>
    );
  } else if (names.length >= 4) {
    content = t`Several people are typing`;
  }

  return (
    <div
      className={`typing-indicator-overlay text-xs text-subtle pl-5 pr-3 flex items-center pointer-events-none ${content ? 'is-active' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {content && (
        <span>
          <span className="typing-indicator-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
          {content}
        </span>
      )}
    </div>
  );
}
