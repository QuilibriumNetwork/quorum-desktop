import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { NativeModalProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';
import { Icon } from '../Icon';

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
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Convert size to snap points
  const snapPoints = useMemo(() => {
    switch (size) {
      case 'small':
        return ['40%'];
      case 'medium':
        return ['70%'];
      case 'large':
        return ['90%'];
      default:
        return ['70%'];
    }
  }, [size]);

  // Handle modal visibility changes
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  // Handle close events
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle sheet changes
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        // Sheet closed
        handleClose();
      }
    },
    [handleClose]
  );

  // Custom backdrop component
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        onPress={closeOnBackdropClick ? handleClose : undefined}
      />
    ),
    [closeOnBackdropClick, handleClose]
  );

  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose={swipeToClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surface[1] }}
      handleIndicatorStyle={{
        backgroundColor: colors.surface[5],
        opacity: swipeToClose ? 0.6 : 0,
      }}
    >
      <BottomSheetView style={styles.contentContainer}>
        {/* Header */}
        {(title || !hideClose) && (
          <View style={styles.header}>
            {title && (
              <Text style={[styles.title, { color: colors.text.strong }]}>
                {title}
              </Text>
            )}

            {!hideClose && !swipeToClose && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="times" size="md" color={colors.text.subtle} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>{children}</View>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default Modal;
