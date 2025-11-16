/**
 * TEMPLATE: New Primitive Component
 *
 * Use this template when creating new primitive components that need
 * to work on both web and mobile platforms.
 *
 * File structure:
 * src/components/primitives/PRIMITIVE_NAME/
 * ├── PRIMITIVE_NAME.web.tsx        # Web implementation
 * ├── PRIMITIVE_NAME.native.tsx     # React Native implementation
 * ├── types.ts                      # Shared TypeScript definitions
 * └── index.ts                      # Platform-aware export
 *
 * Instructions:
 * 1. Replace PRIMITIVE_NAME with your primitive name
 * 2. Define shared interface in types.ts
 * 3. Implement platform-specific versions
 * 4. Export from src/components/primitives/index.ts
 * 5. Add to API documentation
 */

// types.ts - Shared interface
export interface BasePRIMITIVE_NAMEProps {
  // Core props that work on both platforms
  children?: React.ReactNode;

  // Styling props (convert to platform-appropriate styles)
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  // Theme integration
  backgroundColor?: string; // CSS variable or hex

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

// Web-specific props
export interface WebPRIMITIVE_NAMEProps extends BasePRIMITIVE_NAMEProps {
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
  // Other web-specific props
}

// Native-specific props
export interface NativePRIMITIVE_NAMEProps extends BasePRIMITIVE_NAMEProps {
  onPress?: () => void;
  // Other React Native specific props
}

// Export appropriate type based on platform
export type PRIMITIVE_NAMEProps =
  | WebPRIMITIVE_NAMEProps
  | NativePRIMITIVE_NAMEProps;

// ================================
// PRIMITIVE_NAME.web.tsx - Web Implementation
import React from 'react';
import { WebPRIMITIVE_NAMEProps } from './types';

const spacingMap = {
  none: '0',
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem'        // 32px
};

export function PRIMITIVE_NAME(props: WebPRIMITIVE_NAMEProps) {
  const {
    children,
    padding = 'none',
    margin = 'none',
    backgroundColor,
    className = '',
    onClick,
    accessibilityLabel,
    testID,
    ...restProps
  } = props;

  const style: React.CSSProperties = {
    padding: spacingMap[padding],
    margin: spacingMap[margin],
    backgroundColor,
    // Add other computed styles
  };

  return (
    <div
      className={`primitive-PRIMITIVE_NAME ${className}`}
      style={style}
      onClick={onClick}
      aria-label={accessibilityLabel}
      data-testid={testID}
      {...restProps}
    >
      {children}
    </div>
  );
}

// ================================
// PRIMITIVE_NAME.native.tsx - React Native Implementation
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { NativePRIMITIVE_NAMEProps } from './types';

const spacingMap = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
};

export function PRIMITIVE_NAME(props: NativePRIMITIVE_NAMEProps) {
  const {
    children,
    padding = 'none',
    margin = 'none',
    backgroundColor,
    onPress,
    accessibilityLabel,
    testID,
    ...restProps
  } = props;

  const style = {
    padding: spacingMap[padding],
    margin: spacingMap[margin],
    backgroundColor,
    // Add other computed styles
  };

  // Use TouchableOpacity if interactive, View if not
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={style}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      {...restProps}
    >
      {children}
    </Component>
  );
}

// ================================
// index.ts - Platform-aware export
export { PRIMITIVE_NAME } from './PRIMITIVE_NAME';
export type { PRIMITIVE_NAMEProps } from './types';

// ================================
// Add to src/components/primitives/index.ts:
// export { PRIMITIVE_NAME } from './PRIMITIVE_NAME';
// export type { PRIMITIVE_NAMEProps } from './PRIMITIVE_NAME/types';

/**
 * PRIMITIVE DESIGN PRINCIPLES:
 *
 * 1. **Unified Interface**: Same props work on both platforms
 * 2. **Platform Optimization**: Use best native patterns (.web/.native)
 * 3. **Theme Integration**: Support CSS variables and semantic colors
 * 4. **Accessibility First**: Include proper ARIA/accessibility props
 * 5. **Consistent Spacing**: Use standardized spacing scale
 * 6. **TypeScript Safety**: Full type definitions for both platforms
 *
 * TESTING CHECKLIST:
 * ✅ Works on web with Tailwind CSS classes
 * ✅ Works on React Native with StyleSheet
 * ✅ Props behave consistently on both platforms
 * ✅ Accessibility attributes work correctly
 * ✅ Theme colors integrate properly
 * ✅ TypeScript types are accurate
 * ✅ Added to API documentation
 */