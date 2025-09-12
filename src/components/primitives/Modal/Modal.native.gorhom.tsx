// Not used, fallback if we have issues with our custom implementation fo bottom sheets

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  BackHandler,
  ViewStyle,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  titleAlign = 'left',
}) => {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  // Determine if we're on a tablet based on screen width
  const isTablet = screenWidth >= 768;

  // Calculate snap points - use percentage strings for proper @gorhom/bottom-sheet behavior
  const snapPoints = useMemo(() => {
    const baseSnapPoints = [];

    // Add the target size as first snap point
    switch (size) {
      case 'small':
        baseSnapPoints.push('40%');
        break;
      case 'medium':
        baseSnapPoints.push('70%');
        break;
      case 'large':
        baseSnapPoints.push('90%');
        break;
      default:
        baseSnapPoints.push('70%');
    }

    // Always add a larger snap point for expand gesture (unless already at max)
    if (size !== 'large') {
      baseSnapPoints.push('90%');
    }

    return baseSnapPoints;
  }, [size]);

  // Bottom sheet modal ref
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [visible]);

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (onClose) {
          onClose();
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [visible, onClose]);

  // Handle close
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle sheet changes
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        // Sheet is closed
        handleClose();
      }
    },
    [handleClose]
  );

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior={closeOnBackdropClick ? 'close' : 'none'}
      />
    ),
    [closeOnBackdropClick]
  );

  // Content container styles with safe area handling
  const contentContainerStyle = useMemo(
    () => ({
      flex: 1,
      paddingBottom: Math.max(insets.bottom || 0, 20), // Ensure proper bottom padding for older devices
    }),
    [insets.bottom]
  );

  if (!visible) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose={swipeToClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.surface[1],
      }}
      handleIndicatorStyle={{
        backgroundColor: colors.surface[5],
        opacity: 0.6,
      }}
      style={[
        styles.bottomSheetStyle,
        isTablet && {
          maxWidth: 600,
          alignSelf: 'center',
          width: '100%',
        },
      ]}
    >
      <BottomSheetView style={contentContainerStyle}>
        {/* Header section - keep this outside of scrollable area */}
        <View>
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
            <View
              style={
                titleAlign === 'center'
                  ? [styles.header, styles.headerCenter]
                  : styles.header
              }
            >
              <Title size="md" weight="semibold" color={colors.text.strong}>
                {title}
              </Title>
            </View>
          )}

          {/* Spacer between title and content */}
          <Spacer size="lg" />
        </View>

        {/* Scrollable content area - using BottomSheetScrollView for proper gesture integration */}
        <BottomSheetScrollView
          showsVerticalScrollIndicator={true}
          bounces={true}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentContainer}>{children}</View>
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  bottomSheetStyle: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  } as ViewStyle,
  header: {
    paddingHorizontal: 28,
  } as ViewStyle,
  headerCenter: {
    alignItems: 'center',
  } as ViewStyle,
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
  } as ViewStyle,
  scrollContentContainer: {
    // ScrollView contentContainerStyle - allows content to grow and be scrollable
    paddingBottom: Math.max(40, 0), // Safe area bottom padding
  } as ViewStyle,
  contentContainer: {
    paddingHorizontal: 28,
  } as ViewStyle,
});

export default Modal;
