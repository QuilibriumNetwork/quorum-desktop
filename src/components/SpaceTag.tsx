import * as React from 'react';
import { useSpaces } from '../hooks/queries';

interface SpaceTagProps {
  spaceId: string;
  size?: 'small' | 'medium' | 'large';
}

const SpaceTag: React.FC<SpaceTagProps> = ({ spaceId, size = 'medium' }) => {
  const { data: spaces } = useSpaces({});

  const [spaceLetters, setSpaceLetters] = React.useState<string>('');
  const [spaceUrl, setSpaceUrl] = React.useState<string>('');

  React.useEffect(() => {
    const space = spaces?.find((space) => space.spaceId === spaceId);
    if (space) {
      setSpaceLetters(space.spaceTag?.letters ?? '');
      setSpaceUrl(space.spaceTag?.url ?? '');
    }
  }, [spaceId, spaces]);


  const sizeClasses = {
    small: 'w-4 h-4 text-[8px]',
    medium: 'w-6 h-6 text-[10px]',
    large: 'w-8 h-8 text-[12px]',
  };

  return (
    <div className="inline-flex items-center justify-center rounded-full overflow-hidden">
      {spaceUrl ? (
        <img
          src={spaceUrl}
          alt={spaceLetters}
          className={`${sizeClasses[size]} object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} bg-primary flex items-center justify-center text-white font-bold`}
        >
          {spaceLetters}
        </div>
      )}
    </div>
  );
};

export default SpaceTag;
