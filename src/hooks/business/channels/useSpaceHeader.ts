import { useMemo } from 'react'

/**
 * Custom hook for space header styling and banner logic
 * Handles dynamic styling based on banner presence and background image logic
 */
export const useSpaceHeader = (space: any) => {
  const hasBanner = Boolean(space?.bannerUrl)

  const headerClassName = useMemo(() => {
    const baseClasses = 'space-header relative flex flex-row justify-between'
    const bannerClasses = hasBanner
      ? ''
      : ' !h-[41px] border-b space-header-no-banner'
    return baseClasses + bannerClasses
  }, [hasBanner])

  const bannerStyle = useMemo(() => {
    if (!hasBanner) return {}
    return {
      backgroundImage: `url('${space.bannerUrl}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }, [hasBanner, space?.bannerUrl])

  const gradientOverlayStyle = useMemo(() => {
    if (!hasBanner) return {}
    return {
      background:
        'linear-gradient(to bottom, rgba(var(--surface-00-rgb), 0.85), rgba(var(--surface-00-rgb), 0))',
    }
  }, [hasBanner])

  return {
    headerClassName,
    bannerStyle,
    hasBanner,
    gradientOverlayStyle,
    spaceName: space?.spaceName,
  }
}
