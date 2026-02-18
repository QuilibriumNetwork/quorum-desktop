import React, { useState } from 'react';
import { useTheme } from '../../primitives';
import { getSpaceTagColorHex } from '../IconPicker/types';
import { BroadcastSpaceTag } from '../../../api/quorumApi';
import './SpaceTag.scss';

interface SpaceTagProps {
  tag: BroadcastSpaceTag;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SpaceTag = React.memo<SpaceTagProps>(({ tag, size = 'sm', className }) => {
  const [imageError, setImageError] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  if (!tag?.letters) return null;

  const bgColor = getSpaceTagColorHex(tag.backgroundColor, isDarkTheme);

  return (
    <div
      className={`space-tag space-tag--${size}${className ? ` ${className}` : ''}`}
      style={{ backgroundColor: bgColor }}
    >
      {tag.url && !imageError && (
        <img
          src={tag.url}
          className="space-tag__image"
          alt=""
          onError={() => setImageError(true)}
        />
      )}
      <span className="space-tag__letters">{tag.letters}</span>
    </div>
  );
});

SpaceTag.displayName = 'SpaceTag';
