import { useMemo } from 'react';
import { UserInitials } from '../UserInitials';
import { DefaultImages } from '../../../utils';
import { getColorFromAddress } from '../../../utils/avatar';

interface UserAvatarProps {
  userIcon?: string;
  displayName: string;
  address: string;
  size?: number;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent) => void;
}

export function UserAvatar({
  userIcon,
  displayName,
  address,
  size = 40,
  className = '',
  id,
  style,
  onClick
}: UserAvatarProps) {
  const hasValidImage = userIcon && !userIcon.includes(DefaultImages.UNKNOWN_USER);

  // Memoize color calculation for performance (only recalculates when address changes)
  const backgroundColor = useMemo(() => getColorFromAddress(address), [address]);

  if (hasValidImage) {
    return (
      <div
        id={id}
        className={className}
        style={{
          backgroundImage: `url(${userIcon})`,
          width: size,
          height: size,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          ...style
        }}
        onClick={onClick}
      />
    );
  }

  return (
    <UserInitials
      name={displayName}
      backgroundColor={backgroundColor}
      size={size}
      className={className}
      id={id}
    />
  );
}
