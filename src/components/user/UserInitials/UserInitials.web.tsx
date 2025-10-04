import { useMemo } from 'react';
import { UserInitialsProps } from './UserInitials.types';
import { getInitials } from '../../../utils/avatar';
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

  return (
    <div
      id={id}
      role="img"
      aria-label={`${name}'s avatar`}
      className={`user-initials ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor,
        fontSize
      }}
      onClick={onClick}
    >
      {initials}
    </div>
  );
}
