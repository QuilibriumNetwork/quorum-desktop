import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer, ScrollContainer, Callout } from '../primitives';
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
  showProtip?: boolean; // Show PROTIP text (default: true)
  protipAction?: string; // Action name for PROTIP text (e.g., "delete message")
  busy?: boolean; // Disable controls and closing when busy
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
  showProtip = true,
  protipAction,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={title}
      size={size}
      hideClose={true} // Hide X button to prevent conflicts with parent modals
      swipeToClose={false} // Keep swipe disabled for consistency
      className="confirmation-modal" // Add specific class for CSS targeting
    >
      <Container className="space-y-4">
        {/* Main message */}
        <Container>
          <Text variant="main" className="whitespace-pre-line">
            {message}
          </Text>
        </Container>

        {/* Preview content in scrollable container */}
        {preview && (
          <Container>
            <ScrollContainer
              height="sm"
              className="p-2 bg-surface-2 rounded-lg border border-surface-4"
              showBorder={false}
            >
              {preview}
            </ScrollContainer>
          </Container>
        )}

        {/* PROTIP section */}
        {showProtip && protipAction && (
          <Callout variant="info" size="sm">
            <Trans>
              TIP: Hold down shift when clicking {protipAction} to bypass this confirmation entirely.
            </Trans>
          </Callout>
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