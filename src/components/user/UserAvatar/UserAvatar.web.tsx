import { useMemo, useState, useEffect } from 'react';
import { UserInitials } from '../UserInitials';
import { DefaultImages } from '../../../utils';
import { getColorFromDisplayName } from '@quilibrium/quorum-shared';

// A userIcon string can be truthy but not actually a renderable image:
// an empty/whitespace data URI, a malformed value, or a record whose image
// payload never synced. Treat those as "no image" so we fall back to initials
// instead of rendering a blank box.
const isLikelyRenderableImage = (icon?: string): boolean => {
  if (!icon) return false;
  const trimmed = icon.trim();
  if (!trimmed) return false;
  if (trimmed.includes(DefaultImages.UNKNOWN_USER)) return false;
  // A data URI with no payload after the comma (e.g. "data:image/png;base64,")
  // is present-but-empty — the most common broken case.
  if (/^data:[^,]*,\s*$/.test(trimmed)) return false;
  return true;
};

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
  const hasValidImage = isLikelyRenderableImage(userIcon);

  // Track runtime image-load failure: a value that passes the static check can
  // still 404 / be undecodable. On error we flip to initials. Reset when the
  // icon changes so a later valid icon gets a fresh attempt.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [userIcon]);

  // Memoize color calculation for performance (only recalculates when display name changes)
  const backgroundColor = useMemo(() => getColorFromDisplayName(displayName), [displayName]);

  if (hasValidImage && !imageFailed) {
    return (
      <div
        id={id}
        className={`rounded-full overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          ...style
        }}
        onClick={onClick}
      >
        <img
          src={userIcon}
          alt={displayName}
          width={size}
          height={size}
          onError={() => setImageFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <UserInitials
      name={displayName}
      backgroundColor={backgroundColor}
      size={size}
      className={className}
      id={id}
      onClick={onClick}
    />
  );
}
