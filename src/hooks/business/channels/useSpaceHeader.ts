import { useMemo } from 'react';

/**
 * Custom hook for space header styling and banner logic
 * Handles dynamic styling based on banner presence and background image logic
 */
export const useSpaceHeader = (space: any) => {
  const headerClassName = useMemo(() => {
    const baseClasses = 'space-header relative flex flex-row justify-between';
    const bannerClasses = space?.bannerUrl
      ? ''
      : ' !h-[41px] border-b border-b-1 border-b-surface-6';

    return baseClasses + bannerClasses;
  }, [space?.bannerUrl]);

  const headerStyle = useMemo(
    () => ({
      backgroundImage: space?.bannerUrl
        ? `url('${space.bannerUrl}')`
        : undefined,
    }),
    [space?.bannerUrl]
  );

  const hasBanner = Boolean(space?.bannerUrl);

  const gradientOverlayStyle = useMemo(
    () => ({
      background:
        'linear-gradient(to bottom, rgba(var(--surface-00-rgb), 0.85), rgba(var(--surface-00-rgb), 0))',
    }),
    []
  );

  return {
    headerClassName,
    headerStyle,
    hasBanner,
    gradientOverlayStyle,
    spaceName: space?.spaceName,
  };
};
