import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer, ScrollContainer, Icon, Callout } from '../primitives';
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
      <Container className="space-y-4">
        {/* Main message */}
        <Container>
          <Text variant="main">
            {message}
          </Text>
        </Container>

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
          <Container>
            <ScrollContainer 
              height="sm" 
              className="p-3 bg-surface-1 rounded-lg"
              showBorder={true}
            >
              {preview}
            </ScrollContainer>
          </Container>
        )}

        <Spacer size="lg" />

        {/* Action buttons */}
        <FlexRow className="gap-3">
          <Button
            type="subtle"
            onClick={onCancel}
            hapticFeedback={true}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            type={variant}
            onClick={onConfirm}
            hapticFeedback={true}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default ConfirmationModal;