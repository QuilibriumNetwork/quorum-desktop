import React from 'react';
import { Modal, View, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { OverlayBackdropProps } from './types';

export const OverlayBackdrop: React.FC<OverlayBackdropProps> = ({
  visible = true,
  onBackdropClick,
  blur = true,
  opacity = 0.6,
  children,
  closeOnBackdropClick = true,
}) => {
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
        <View style={[styles.backdrop, { backgroundColor: `rgba(0, 0, 0, ${opacity})` }]}>
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