import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal as RNModal,
  TouchableWithoutFeedback,
  PanResponder,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModalProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';

const Modal: React.FC<NativeModalProps> = ({
  title,
  visible,
  onClose,
  hideClose = false,
  children,
  size = 'medium',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  swipeToClose = true,
  keyboardAvoidingView = true,
}) => {
  const theme = useTheme();
  const colors = getColors(theme.mode, theme.accentColor);
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Calculate height based on size
  const getModalHeight = () => {
    switch (size) {
      case 'small':
        return screenHeight * 0.4;
      case 'medium':
        return screenHeight * 0.7;
      case 'large':
        return screenHeight * 0.9;
      case 'full':
        return screenHeight - insets.top; // Full height minus status bar
      default:
        return screenHeight * 0.7;
    }
  };

  const modalHeight = getModalHeight();

  // Determine if we're on a tablet based on screen width
  const isTablet = screenWidth >= 768;

  // Animation effects
  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity, screenHeight]);

  // Handle close
  const handleClose = () => {
    onClose();
  };

  // Pan responder for swipe to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => swipeToClose,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return swipeToClose && gestureState.dy > 5;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) {
    return null;
  }

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback
          onPress={closeOnBackdropClick ? handleClose : undefined}
        >
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          />
        </TouchableWithoutFeedback>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContent,
            {
              height: modalHeight + insets.bottom, // Extend height to cover bottom area
              backgroundColor: colors.surface[1],
              transform: [{ translateY }],
              maxWidth: isTablet ? 600 : '100%',
              alignSelf: 'center',
            },
          ]}
          {...(swipeToClose ? panResponder.panHandlers : {})}
        >
          {/* Handle indicator */}
          {swipeToClose && (
            <View
              style={[styles.handle, { backgroundColor: colors.surface[5] }]}
            />
          )}

          {/* Header */}
          {(title || !hideClose) && (
            <View style={styles.header}>
              {title && (
                <Text style={[styles.title, { color: colors.text.strong }]}>
                  {title}
                </Text>
              )}

              {!hideClose && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.closeText, { color: colors.text.main }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            enabled={keyboardAvoidingView}
          >
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View
                style={[
                  styles.contentContainer,
                  { paddingBottom: insets.bottom + 16 },
                ]}
              >
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden', // Ensure content doesn't bleed outside rounded corners
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 0,
    alignSelf: 'center',
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    margin: 0,
  },
  closeButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 4,
    marginLeft: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});

export default Modal;
