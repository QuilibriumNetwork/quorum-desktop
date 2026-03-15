import * as React from 'react';
import { View } from 'react-native';
import { Button, Modal, Text, Flex, Spacer, ScrollContainer, Icon, Callout } from '../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  preview?: React.ReactNode; // Optional content preview
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  size?: 'small' | 'medium' | 'large';
  showProtip?: boolean; // Show PROTIP text (default: false on mobile - no shift key)
  protipAction?: string; // Action name for PROTIP text
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FunctionComponent<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  preview,
  confirmText = t`Delete`,
  cancelText = t`Cancel`,
  variant = 'danger',
  size = 'small',
  showProtip = false, // Default to false on mobile (no shift key)
  protipAction,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      onClose={() => {}} // No-op - only buttons can close
      title={title}
      size={size}
      hideClose={true} // Hide X button
      closeOnBackdropClick={false} // Disable backdrop click
      closeOnEscape={false} // Disable ESC key
      swipeToClose={false} // Disable swipe to close
    >
      <View style={{ gap: 16 }}>
        {/* Main message */}
        <View>
          <Text variant="main">
            {message}
          </Text>
        </View>

        {/* PROTIP section - rarely shown on mobile since no shift key */}
        {showProtip && protipAction && (
          <Callout variant="info" size="sm">
            <Trans>
              TIP: Hold down shift when clicking {protipAction} to bypass this confirmation entirely.
            </Trans>
          </Callout>
        )}

        {/* Preview content in scrollable container */}
        {preview && (
          <View>
            <ScrollContainer
              height="sm"
              showBorder={true}
            >
              {preview}
            </ScrollContainer>
          </View>
        )}

        <Spacer size="lg" />

        {/* Action buttons */}
        <Flex gap="sm">
          <Button
            type="subtle"
            onClick={onCancel}
            hapticFeedback={true}
            style={{ flex: 1 }}
          >
            {cancelText}
          </Button>
          <Button
            type={variant}
            onClick={onConfirm}
            hapticFeedback={true}
            style={{ flex: 1 }}
          >
            {confirmText}
          </Button>
        </Flex>
      </View>
    </Modal>
  );
};

export default ConfirmationModal;