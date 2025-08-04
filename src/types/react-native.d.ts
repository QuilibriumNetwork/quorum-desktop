// Temporary type definitions for React Native components
// These will be replaced when we set up the actual React Native environment

declare module 'react-native' {
  import { ComponentType, ReactNode } from 'react';

  export interface ViewStyle {
    flex?: number;
    justifyContent?:
      | 'center'
      | 'flex-start'
      | 'flex-end'
      | 'space-between'
      | 'space-around';
    alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch';
    backgroundColor?: string;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    minHeight?: number;
    maxHeight?: number;
    paddingBottom?: number;
    transform?: Array<{ translateY: any }>;
    opacity?: any;
  }

  export interface ViewProps {
    style?: ViewStyle | ViewStyle[];
    children?: ReactNode;
  }

  export interface ModalProps {
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    onRequestClose?: () => void;
    children?: ReactNode;
  }

  export interface TouchableWithoutFeedbackProps {
    onPress?: () => void;
    children?: ReactNode;
  }

  export const View: ComponentType<ViewProps>;
  export const Modal: ComponentType<ModalProps>;
  export const TouchableWithoutFeedback: ComponentType<TouchableWithoutFeedbackProps>;

  export namespace StyleSheet {
    export function create<T extends { [key: string]: ViewStyle }>(
      styles: T
    ): T;
    export const absoluteFillObject: {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    };
  }

  export namespace Animated {
    export const View: ComponentType<ViewProps & { style?: any }>;
    export class Value {
      constructor(value: number);
    }
    export function timing(
      value: any,
      config: any
    ): {
      start: (callback?: () => void) => void;
    };
    export function parallel(animations: any[]): {
      start: (callback?: () => void) => void;
    };
  }

  export namespace Dimensions {
    export function get(dim: 'window' | 'screen'): {
      width: number;
      height: number;
    };
  }

  export namespace BackHandler {
    export function addEventListener(
      event: string,
      handler: () => boolean
    ): {
      remove: () => void;
    };
  }
}
