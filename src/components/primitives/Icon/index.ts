// @ts-ignore - Platform-specific files (.web.tsx/.native.tsx) resolved by bundler
export { Icon } from './Icon';
export type {
  IconProps,
  IconWebProps,
  IconNativeProps,
  IconName,
  IconSize,
} from './types';
// Export mapping utilities (implementation-agnostic interface)
export { iconComponentMap as iconNames, isValidIconName, getIconComponentName } from './iconMapping';
