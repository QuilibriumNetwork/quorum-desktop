import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal as RNModal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';

// @ts-ignore - PanResponder exists at runtime but not in named exports
const { PanResponder } = require('react-native');
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeModalProps } from './types';
import { useTheme } from '../theme';
import { Icon } from '../Icon';
import { Title } from '../Text';
import { Spacer } from '../Spacer';

const Modal: React.FC<NativeModalProps> = ({
  title,
  visible,
  onClose,
  hideClose = false,
  children,
  size = 'medium',
  closeOnBackdropClick = true,
  swipeToClose = true,
  swipeUpToOpen = false,
  titleAlign = 'left',
}) => {
  const theme = useTheme();
  const colors = theme.colors;
  // const insets = useSafeAreaInsets(); // Not currently used but may be needed for safe areas
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isEnlarged, setIsEnlarged] = useState(false);

  // Calculate initial height based on size
  const getInitialHeight = () => {
    switch (size) {
      case 'small':
        return screenHeight * 0.4;
      case 'medium':
        return screenHeight * 0.7;
      case 'large':
        return screenHeight * 0.9;
      default:
        return screenHeight * 0.7;
    }
  };

  const initialHeight = getInitialHeight();
  const enlargedHeight = screenHeight * 0.9;
  
  // Current height for rendering
  const currentHeight = swipeUpToOpen && isEnlarged ? enlargedHeight : initialHeight;

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
      // Reset enlarged state when modal closes
      setIsEnlarged(false);
      
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


  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return swipeToClose || swipeUpToOpen;
      },
      onMoveShouldSetPanResponder: (_evt: any, gestureState: any) => {
        const swipeDown = swipeToClose && gestureState.dy > 5;
        const swipeUp = swipeUpToOpen && gestureState.dy < -5;
        return swipeDown || swipeUp;
      },
      onPanResponderMove: (_evt: any, gestureState: any) => {
        // Only allow swipe down movement for closing
        if (swipeToClose && gestureState.dy > 0) {
          (translateY as any).setValue(gestureState.dy);
        }
        // No visual feedback during swipe up to avoid stretching
      },
      onPanResponderRelease: (_evt: any, gestureState: any) => {
        // Handle swipe down to close
        if (swipeToClose && (gestureState.dy > 100 || gestureState.vy > 0.5)) {
          handleClose();
        }
        // Handle swipe up to enlarge (only if swipeUpToOpen is enabled and not already enlarged)
        else if (swipeUpToOpen && !isEnlarged && (gestureState.dy < -100 || gestureState.vy < -0.5)) {
          setIsEnlarged(true);
          // Return to normal position
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
        // Return to normal position if gesture wasn't strong enough
        else {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
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
              height: currentHeight,
              backgroundColor: colors.surface[1],
              transform: [{ translateY }],
              maxWidth: isTablet ? 600 : '100%',
              alignSelf: 'center',
            },
          ]}
        >
          {/* Handle indicator and header with gesture for swipe actions */}
          <View
            {...((swipeToClose || swipeUpToOpen) ? panResponder.panHandlers : {})}
            style={{ minHeight: 50 }} // Ensure gesture area has minimum height
          >
            {/* Handle indicator */}
            {(swipeToClose || swipeUpToOpen) && (
              <View
                style={[styles.handle, { backgroundColor: colors.surface[5] }]}
              />
            )}

            {/* Close button - positioned absolutely at top right */}
            {!hideClose && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="times" size="sm" color={colors.text.subtle} />
              </TouchableOpacity>
            )}

            {/* Top Spacer - consistent spacing from handle/top */}
            <Spacer size="xl" />

            {/* Title (when present) */}
            {title && (
              <View style={[styles.header, ...(titleAlign === 'center' ? [styles.headerCenter] : [])]}>
                <Title size="md" weight="semibold" color={colors.text.strong}>
                  {title}
                </Title>
              </View>
            )}

            {/* Spacer between title and content (or top spacer when no title) */}
            <Spacer size="xl" />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.contentContainer}>
                {children}
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create<any>({
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
    paddingHorizontal: 28,
  },
  headerCenter: {
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 28,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 18,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 28,
  },
});

export default Modal;