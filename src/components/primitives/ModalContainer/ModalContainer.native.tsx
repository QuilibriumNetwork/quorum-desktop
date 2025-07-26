import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  BackHandler,
  Dimensions,
} from 'react-native';
import { ModalContainerProps } from './types';
import { useCrossPlatformTheme } from '../theme/ThemeProvider';

const { height: screenHeight } = Dimensions.get('window');

export const ModalContainer: React.FC<ModalContainerProps> = ({
  visible,
  onClose,
  children,
  closeOnBackdropClick = true,
  showBackdrop = true,
  animationDuration = 300,
  closeOnEscape = true, // On mobile, this translates to back button
}) => {
  const { colors } = useCrossPlatformTheme();
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide up from bottom
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity, animationDuration]);

  // Handle Android back button
  useEffect(() => {
    if (!visible || !closeOnEscape || !onClose) return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [visible, closeOnEscape, onClose]);

  const handleBackdropPress = () => {
    if (closeOnBackdropClick && onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {showBackdrop && (
          <TouchableWithoutFeedback onPress={handleBackdropPress}>
            <Animated.View
              style={[
                styles.backdrop,
                {
                  backgroundColor: colors.bg.overlay,
                  opacity: opacity,
                },
              ]}
            />
          </TouchableWithoutFeedback>
        )}

        <Animated.View
          style={[
            styles.content,
            {
              backgroundColor: colors.bg.app,
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <TouchableWithoutFeedback>
            <View>{children}</View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // backgroundColor will be set dynamically from theme
  },
  content: {
    // backgroundColor will be set dynamically from theme
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 200,
    maxHeight: screenHeight * 0.9,
    paddingBottom: 34, // Safe area
  },
});
