import React, { useState } from 'react';
import { BroadcastSpaceTag } from '../../../api/quorumApi';
import { isValidSpaceTagUrl } from '../../../utils/validation';
import './SpaceTag.scss';

interface SpaceTagProps {
  tag: BroadcastSpaceTag;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SpaceTag = React.memo<SpaceTagProps>(({ tag, size = 'sm', className }) => {
  const [imageError, setImageError] = useState(false);

  if (!tag?.letters) return null;

  return (
    <div
      className={`space-tag space-tag--${size}${className ? ` ${className}` : ''}`}
    >
      {tag.url && isValidSpaceTagUrl(tag.url) && !imageError && (
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
