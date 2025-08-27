import { UserConfig } from '../src/db/messages';

export enum DefaultImages {
  UNKNOWN_USER = '/unknown.png',
}

export const getDefaultUserConfig = (address: string): UserConfig => {
  return {
    address: address,
    allowSync: false,
    nonRepudiable: true,
    spaceKeys: [],
    spaceIds: [],
    timestamp: Date.now(),
  };
};

export const truncateAddress = (
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0);

export const hasVirtualKeyboardSupport = () => {
  if (typeof window === 'undefined') return false;
  
  return !!(window.visualViewport || 'virtualKeyboard' in navigator);
};

export const getKeyboardAvoidanceTimings = () => {
  if (typeof window === 'undefined') return [300];
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Samsung devices often need longer delays
  if (userAgent.includes('samsung') || userAgent.includes('sm-')) {
    return [400, 600, 800];
  }
  
  // iOS Safari needs different timing
  if (userAgent.includes('safari') && userAgent.includes('mobile')) {
    return [200, 400, 600];
  }
  
  // Default timing for other devices
  return [300, 500, 700];
};

export const applyKeyboardAwareCss = () => {
  if (!isTouchDevice()) return;
  
  // Apply 2025 CSS viewport units best practice
  const style = document.createElement('style');
  style.textContent = `
    @supports (height: 100dvh) {
      .mobile-full-height {
        height: 100vh; /* Fallback */
        height: 100dvh; /* Dynamic viewport height - adjusts for keyboard */
      }
    }
    
    @supports (height: 100svh) {
      .mobile-small-height {
        height: 100svh; /* Small viewport height - assumes keyboard visible */
      }
    }
  `;
  
  if (!document.head.querySelector('[data-keyboard-aware-css]')) {
    style.setAttribute('data-keyboard-aware-css', 'true');
    document.head.appendChild(style);
  }
};

export const createKeyboardAvoidanceHandler = () => {
  // Only activate on touch devices with mobile viewport (not desktop with touch)
  if (!isTouchDevice() || window.innerWidth >= 768) return null;

  let retryTimeouts: NodeJS.Timeout[] = [];
  let isKeyboardVisible = false;
  let lastViewportHeight = window.visualViewport?.height || window.innerHeight;
  
  // Cache the device check result to avoid repeated calculations
  const isMobileTouch = isTouchDevice() && window.innerWidth < 768;

  const cleanup = () => {
    retryTimeouts.forEach(timeout => clearTimeout(timeout));
    retryTimeouts = [];
  };

  const scrollElementIntoView = async (element: HTMLElement): Promise<boolean> => {
    if (!element) return false;

    try {
      // Method 1: Use dynamic viewport height (dvh) aware calculation - 2025 best practice
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const elementRect = element.getBoundingClientRect();
      const isInView = elementRect.bottom <= viewportHeight && elementRect.top >= 0;
      
      if (!isInView) {
        // Calculate scroll position relative to current visual viewport
        const scrollTop = window.pageYOffset + elementRect.bottom - viewportHeight + 20;
        window.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }

      // Method 2: Standard scrollIntoView as fallback
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });

      return true;
    } catch (error) {
      console.warn('Keyboard avoidance scroll failed:', error);
      return false;
    }
  };

  const handleKeyboardWithRetry = (element: HTMLElement, timings: number[] = getKeyboardAvoidanceTimings()) => {
    cleanup();

    timings.forEach((delay, index) => {
      const timeout = setTimeout(async () => {
        const success = await scrollElementIntoView(element);
        
        // If this is the last attempt and it failed, try a more aggressive approach
        if (!success && index === timings.length - 1) {
          try {
            element.focus();
            element.scrollIntoView({ behavior: 'auto', block: 'center' });
          } catch (e) {
            console.warn('Final keyboard avoidance attempt failed:', e);
          }
        }
      }, delay);
      
      retryTimeouts.push(timeout);
    });
  };

  // Multi-layered detection system
  const createDetectionHandlers = (element: HTMLElement, composerElement: HTMLElement) => {
    const handleFocus = () => {
      if (!isMobileTouch) return;
      handleKeyboardWithRetry(composerElement);
    };

    // Visual Viewport API (primary) - follows 2025 best practices
    const handleVisualViewportChange = () => {
      if (!isMobileTouch || document.activeElement !== element) return;
      
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = lastViewportHeight - currentHeight;
      
      // Keyboard likely appeared if viewport shrank significantly
      if (heightDifference > 150) {
        isKeyboardVisible = true;
        handleKeyboardWithRetry(composerElement);
        lastViewportHeight = currentHeight; // Update tracking
      } else if (heightDifference < -50 && isKeyboardVisible) {
        // Keyboard likely disappeared
        isKeyboardVisible = false;
        lastViewportHeight = currentHeight; // Update tracking
      }
    };

    // Window resize fallback (secondary) - only if Visual Viewport API unavailable
    const handleWindowResize = () => {
      if (!isMobileTouch || hasVirtualKeyboardSupport()) return;
      
      const currentHeight = window.innerHeight;
      const heightDifference = lastViewportHeight - currentHeight;
      
      if (heightDifference > 150 && document.activeElement === element) {
        handleKeyboardWithRetry(composerElement);
      }
      
      lastViewportHeight = currentHeight;
    };

    return {
      handleFocus,
      handleVisualViewportChange,
      handleWindowResize
    };
  };

  return {
    createDetectionHandlers,
    cleanup,
    isKeyboardVisible: () => isKeyboardVisible
  };
};
