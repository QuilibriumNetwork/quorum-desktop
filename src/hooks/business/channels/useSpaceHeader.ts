import { useMemo, useState, useCallback, useEffect, useRef } from 'react'

// Header height constants
const HEADER_MAX_HEIGHT = 132
const HEADER_MAX_HEIGHT_2XL = 144
const HEADER_MIN_HEIGHT = 44
const SCREEN_2XL = 1536 // Very large screens

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

/**
 * Hook for collapsing header effect based on scroll position
 * Returns scroll handler and dynamic header styles
 */
export const useCollapsingHeader = (hasBanner: boolean) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [maxHeight, setMaxHeight] = useState(HEADER_MAX_HEIGHT)
  const rafRef = useRef<number>()

  // Detect screen size for responsive max height
  // Debounced to avoid excessive recalculations during window drag
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const updateMaxHeight = () => {
      const is2xl = window.innerWidth >= SCREEN_2XL
      setMaxHeight(is2xl ? HEADER_MAX_HEIGHT_2XL : HEADER_MAX_HEIGHT)
    }

    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateMaxHeight, 150)
    }

    updateMaxHeight()
    window.addEventListener('resize', debouncedUpdate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedUpdate)
    }
  }, [])

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Throttle scroll updates with requestAnimationFrame to batch per animation frame
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(newScrollTop)
    })
  }, [])

  // Calculate scroll threshold based on height difference
  const scrollThreshold = maxHeight - HEADER_MIN_HEIGHT

  // Calculate header height based on scroll position
  const headerHeight = useMemo(() => {
    if (!hasBanner) return undefined // Let CSS handle non-banner headers

    // Calculate collapse progress (0 = fully expanded, 1 = fully collapsed)
    const progress = Math.min(scrollTop / scrollThreshold, 1)
    const height = maxHeight - progress * (maxHeight - HEADER_MIN_HEIGHT)
    return height
  }, [hasBanner, scrollTop, maxHeight, scrollThreshold])

  // Dynamic style for the header container
  const collapsingHeaderStyle = useMemo(() => {
    if (!hasBanner || headerHeight === undefined) return {}
    return {
      height: `${headerHeight}px`,
      minHeight: `${HEADER_MIN_HEIGHT}px`,
    }
  }, [hasBanner, headerHeight])

  // Fixed height for the background layer (doesn't shrink, gets clipped)
  const backgroundLayerStyle = useMemo(() => {
    if (!hasBanner) return {}
    return {
      height: `${maxHeight}px`,
    }
  }, [hasBanner, maxHeight])

  return {
    handleScroll,
    collapsingHeaderStyle,
    backgroundLayerStyle,
  }
}
