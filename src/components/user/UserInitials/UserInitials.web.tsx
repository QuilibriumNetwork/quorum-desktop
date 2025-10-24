import { useMemo } from 'react';
import { UserInitialsProps } from './UserInitials.types';
import { getInitials, lightenColor, darkenColor } from '../../../utils/avatar';
import './UserInitials.scss';

export function UserInitials({
  name,
  backgroundColor,
  size = 40,
  className = '',
  id,
  onClick
}: UserInitialsProps) {
  // Memoize initials calculation for performance
  const initials = useMemo(() => getInitials(name), [name]);

  // Memoize font size calculation for performance
  const fontSize = useMemo(() => size * 0.4, [size]);

  // Check if this is an unknown user (performance: O(1) string comparison)
  const isUnknown = initials === '?';

  // Memoize gradient colors for performance (only recalculates when backgroundColor changes)
  // Skip calculation for unknown users to save CPU cycles
  const gradientColors = useMemo(() => {
    if (isUnknown) return null;
    return {
      lighter: lightenColor(backgroundColor, 5),
      darker: darkenColor(backgroundColor, 10)
    };
  }, [backgroundColor, isUnknown]);

  return (
    <div
      id={id}
      role="img"
      aria-label={`${name}'s avatar`}
      className={`user-initials ${isUnknown ? 'user-initials--unknown' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        // Only apply inline gradient for known users (unknown users use CSS class)
        ...(gradientColors && {
          background: `linear-gradient(180deg, ${gradientColors.lighter} 0%, ${gradientColors.darker} 100%)`
        }),
        fontSize
      }}
      onClick={onClick}
    >
      {initials}
    </div>
  );
}
