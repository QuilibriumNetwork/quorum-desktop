import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { NativeModalProps } from './types';
import { ModalContainer } from '../ModalContainer';
import { useCrossPlatformTheme } from '../theme/ThemeProvider';

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
  const { colors } = useCrossPlatformTheme();

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { maxHeight: '40%' };
      case 'medium':
        return { maxHeight: '70%' };
      case 'large':
        return { maxHeight: '90%' };
      case 'full':
        return { height: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0 };
      default:
        return { maxHeight: '70%' };
    }
  };

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      closeOnBackdropClick={closeOnBackdropClick && !hideClose}
      closeOnEscape={closeOnEscape && !hideClose}
      animationDuration={300}
    >
      <View style={[styles.modalContent, getSizeStyles(), { backgroundColor: colors.bg.modal }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border.default }]}>
          <Text style={[styles.title, { color: colors.text.strong }]}>
            {title}
          </Text>
          
          {!hideClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.closeText, { color: colors.text.subtle }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.contentContainer}>
            {children}
          </View>
        </ScrollView>
      </View>
    </ModalContainer>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  closeText: {
    fontSize: 18,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
});

export default Modal;