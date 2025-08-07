import React from 'react';
import {
  Modal,
  View,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { OverlayBackdropProps } from './types';
import { useTheme } from '../theme';

export const OverlayBackdrop: React.FC<OverlayBackdropProps> = ({
  visible = true,
  onBackdropClick,
  blur = true, // Note: blur is not supported in React Native Modal
  opacity = 0.6,
  children,
  closeOnBackdropClick = true,
}) => {
  const { colors } = useTheme();
  const handleBackdropPress = () => {
    if (closeOnBackdropClick && onBackdropClick) {
      onBackdropClick();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onBackdropClick}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={[styles.backdrop, { backgroundColor: colors.bg.overlay }]}>
          <TouchableWithoutFeedback>
            <View>{children}</View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
