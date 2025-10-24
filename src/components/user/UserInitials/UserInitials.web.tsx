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

  // Memoize gradient colors for performance (only recalculates when backgroundColor changes)
  const gradientColors = useMemo(() => ({
    lighter: lightenColor(backgroundColor, 10),
    darker: darkenColor(backgroundColor, 10)
  }), [backgroundColor]);

  return (
    <div
      id={id}
      role="img"
      aria-label={`${name}'s avatar`}
      className={`user-initials ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(180deg, ${gradientColors.lighter} 0%, ${gradientColors.darker} 100%)`,
        fontSize
      }}
      onClick={onClick}
    >
      {initials}
    </div>
  );
}
