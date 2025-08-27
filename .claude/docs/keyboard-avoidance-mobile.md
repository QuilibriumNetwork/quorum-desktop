# Mobile Keyboard Avoidance System

## Overview

Enhanced keyboard avoidance system for mobile web browsers that ensures message input areas remain visible when virtual keyboards appear. Implements 2025 best practices with multi-layered detection, device-specific optimizations, and graceful fallbacks.

## Problem Solved

The original keyboard avoidance implementation worked in browser simulators but failed on real devices (e.g., Samsung Fold 6 with Chrome) because:

- Single 300ms delay insufficient for modern device animations
- Only relied on Visual Viewport API (limited browser support)  
- No fallback mechanisms when Visual Viewport API failed
- Missing detection for actual keyboard appearance vs disappearance

## Implementation Details

### Architecture

The system uses a **multi-layered detection approach**:

1. **Visual Viewport API** (primary) - Modern browsers
2. **Window resize events** (secondary) - Fallback for older browsers
3. **Multiple scroll methods** (tertiary) - Ensures scroll actually works

### Key Features

#### 1. Device-Specific Timing Optimization
```javascript
// Samsung devices: 400ms, 600ms, 800ms delays
// iOS Safari: 200ms, 400ms, 600ms delays  
// Other devices: 300ms, 500ms, 700ms delays
```

#### 2. Enhanced Touch Device Detection
- Only activates on `isTouchDevice() && viewport width < 768px`
- Prevents interference with desktop devices that have touch screens
- Maintains existing `isTouchDevice()` functionality for other components

#### 3. Visual Viewport API Integration (2025 Standard)
- Uses `window.visualViewport?.height` for accurate viewport calculations
- Properly handles viewport changes when keyboard appears/disappears
- Fallback to `window.innerHeight` for older browsers

#### 4. CSS Viewport Units Support
- Added `applyKeyboardAwareCss()` utility for dvh/svh units
- Provides CSS classes with fallbacks: `100vh` → `100dvh`
- Uses dynamic viewport height calculations in scroll logic

#### 5. Robust Scroll Implementation
```javascript
// Method 1: Visual viewport aware calculation
const viewportHeight = window.visualViewport?.height || window.innerHeight;
// Method 2: Standard scrollIntoView as fallback
element.scrollIntoView({ behavior: 'smooth', block: 'end' });
```

#### 6. Performance Optimizations
- Caches device detection result to avoid repeated calculations
- Proper event listener cleanup to prevent memory leaks  
- Clears timeouts on component unmount

## Files Modified

### 1. `src/utils.ts`
**Added new utilities:**
- `hasVirtualKeyboardSupport()` - Detects Visual Viewport API support
- `getKeyboardAvoidanceTimings()` - Device-specific timing arrays
- `applyKeyboardAwareCss()` - Applies 2025 CSS viewport units
- `createKeyboardAvoidanceHandler()` - Main keyboard avoidance system

**Enhanced existing:**
- Kept `isTouchDevice()` for backward compatibility
- Removed temporary `isMobileDevice()` function

### 2. `src/components/channel/Channel.tsx`
**Changes:**
- Updated import: `createKeyboardAvoidanceHandler` from utils
- Replaced simple keyboard avoidance with enhanced multi-layered system
- Added proper useEffect cleanup and dependencies
- Maintained composerRef and editor ref usage

### 3. `src/components/direct/DirectMessage.tsx`  
**Changes:**
- Updated import: `createKeyboardAvoidanceHandler` from utils
- Applied same enhanced keyboard avoidance system as Channel
- Added proper useEffect cleanup and dependencies
- Maintained composerRef and editor ref usage

## Browser Compatibility

| Browser | Visual Viewport API | Keyboard Avoidance | Notes |
|---------|-------------------|-------------------|-------|
| Chrome Mobile | ✅ Full Support | ✅ Primary method | Includes VirtualKeyboard API |
| Safari iOS | ✅ Full Support | ✅ Primary method | No VirtualKeyboard API |
| Firefox Mobile | ✅ Supported | ✅ Primary method | Limited documentation |
| Older Browsers | ❌ No Support | ✅ Window resize fallback | Graceful degradation |

## Best Practices Implemented

### 1. **2025 Web Standards**
- Visual Viewport API as primary detection method
- CSS viewport units (dvh, svh) support with fallbacks
- Progressive enhancement approach

### 2. **Performance**  
- Event listener cleanup prevents memory leaks
- Cached device detection avoids repeated calculations
- Timeout management with proper cleanup

### 3. **React Best Practices**
- Proper useEffect dependencies (empty array for mount-only)
- Complete cleanup in useEffect return function
- No side effects during render

### 4. **Mobile-First Design**
- Only activates on actual mobile devices
- Respects desktop behavior - zero interference
- Device-specific optimizations

### 5. **Error Handling**
- Try-catch blocks around scroll operations  
- Console warnings for debugging
- Graceful fallbacks when operations fail

## Usage Example

```javascript
// Automatic activation in Channel and DirectMessage components
useEffect(() => {
  const keyboardHandler = createKeyboardAvoidanceHandler();
  if (!keyboardHandler) return; // Not a mobile device

  const textarea = editor.current;
  const composer = composerRef.current;
  
  if (!textarea || !composer) return;

  const handlers = keyboardHandler.createDetectionHandlers(textarea, composer);

  // Set up multi-layered detection
  textarea.addEventListener('focus', handlers.handleFocus);
  
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handlers.handleVisualViewportChange);
  }
  
  window.addEventListener('resize', handlers.handleWindowResize);

  return () => {
    // Complete cleanup
    textarea.removeEventListener('focus', handlers.handleFocus);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', handlers.handleVisualViewportChange);
    }
    window.removeEventListener('resize', handlers.handleWindowResize);
    keyboardHandler.cleanup();
  };
}, []);
```

## Testing Recommendations

### Desktop Testing
- ✅ Verify no keyboard avoidance activation on desktop browsers
- ✅ Test touch-enabled desktops/laptops don't trigger mobile behavior  
- ✅ Confirm existing functionality unchanged

### Mobile Testing
- ✅ Test on Samsung devices (Fold, Galaxy series)
- ✅ Test on various iOS devices and Safari versions
- ✅ Test keyboard appearance/disappearance in different orientations
- ✅ Verify message input remains visible during typing

### Edge Cases
- ✅ Test on tablets (should activate based on viewport width)
- ✅ Test with browser zoom levels
- ✅ Test rapid keyboard open/close cycles

## Future Enhancements

1. **CSS Integration**: Consider adding utility classes to existing Tailwind setup
2. **Performance Monitoring**: Add optional telemetry for keyboard avoidance effectiveness  
3. **A11y Improvements**: Enhanced screen reader support during keyboard transitions
4. **PWA Support**: Integration with PWA manifest for better mobile app behavior

---

*Last updated: August 27, 2025*
*Implementation: Enhanced mobile keyboard avoidance with 2025 web standards*