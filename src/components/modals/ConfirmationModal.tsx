import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer, ScrollContainer, Icon } from '../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import clsx from 'clsx';

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
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      onClose={onCancel} // Close triggers cancel action
      title={title}
      size={size}
      hideClose={true} // Hide X button to prevent conflicts with parent modals
      closeOnBackdropClick={true} // Enable backdrop click
      closeOnEscape={true} // Enable ESC key
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
          <Container className="bg-info/10 border border-info rounded-lg p-3">
            <FlexRow className="items-start gap-2">
              <Icon 
                name="info-circle" 
                className="text-info flex-shrink-0 mt-0.5" 
                size="sm"
              />
              <Text variant="subtle" className="text-sm">
                <Trans>
                  TIP: Hold down shift when clicking {protipAction} to bypass this confirmation entirely.
                </Trans>
              </Text>
            </FlexRow>
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