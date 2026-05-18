import { t } from '@lingui/core/macro';
import { useTypingIndicator } from '../../hooks/business/messages/useTypingIndicator';
import type { TypingScope } from '@/types/typing';
import './TypingIndicator.scss';

export interface TypingIndicatorProps {
  scope: TypingScope | null;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTypists(names: string[]): string {
  if (names.length === 1) return t`${names[0]} is typing`;
  if (names.length === 2) return t`${names[0]} and ${names[1]} are typing`;
  if (names.length === 3) return t`${names[0]}, ${names[1]} and ${names[2]} are typing`;
  return t`Several people are typing`;
}

export function TypingIndicator({ scope }: TypingIndicatorProps) {
  const typists = useTypingIndicator(scope);

  // v1: render the truncated address as the display name. A follow-up can
  // wire in a proper display-name lookup based on scope (space members for
  // spaces, DM contact profile for DMs). The indicator is transient so an
  // address fallback is acceptable v1 behavior.
  const names = typists.map(truncateAddress);
  const label = names.length > 0 ? formatTypists(names) : null;

  return (
    <div
      className="h-5 px-3 text-xs text-muted overflow-hidden flex items-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {label && (
        <span>
          {label}
          <span className="typing-indicator-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </span>
      )}
    </div>
  );
}
