/**
 * TypeScript augmentation for React Native components
 * This file helps IDEs recognize React Native components when working with .native.tsx files
 * in a mixed web/mobile codebase where the root tsconfig is web-focused.
 */

declare module 'react-native' {
  // Re-export common React Native components and APIs for IDE support
  export const Pressable: any;
  export const Alert: any;
  export const TouchableOpacity: any;
  export const View: any;
  export const Text: any;
  export const ScrollView: any;
  export const SafeAreaView: any;
  export const StyleSheet: any;
  
  // Note: At runtime, these will resolve to the actual React Native implementations
  // This is just for TypeScript IDE support in cross-platform development
}