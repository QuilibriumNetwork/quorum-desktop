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
  const [dotCount, setDotCount] = React.useState(1);
  const directionRef = React.useRef(1);

  React.useEffect(() => {
    if (!busy) {
      setDotCount(1);
      directionRef.current = 1;
      return;
    }
    const intervalId = setInterval(() => {
      setDotCount((prev) => {
        let next = prev + directionRef.current;
        if (next >= 3) {
          next = 3;
          directionRef.current = -1;
        } else if (next <= 1) {
          next = 1;
          directionRef.current = 1;
        }
        return next;
      });
    }, 400);
    return () => clearInterval(intervalId);
  }, [busy]);

  const animatedDeletingLabel = `${t`Deleting`}${'.'.repeat(dotCount)}`;
  const displayMessage = busy
    ? t`This conversation is now deleting.  This may take a little time to remove all related data.`
    : message;
  return (
    <Modal
      visible={visible}
      onClose={busy ? undefined : onCancel} // Prevent close while busy
      title={title}
      size={size}
      hideClose={true} // Hide X button to prevent conflicts with parent modals
      closeOnBackdropClick={!busy} // Disable backdrop click while busy
      closeOnEscape={!busy} // Disable ESC while busy
      swipeToClose={false} // Keep swipe disabled for consistency
      className="confirmation-modal" // Add specific class for CSS targeting
    >
      <Container className="space-y-4">
        {/* Main message */}
        <Container>
          <Text variant="main" className="whitespace-pre-line">
            {displayMessage}
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
          {!busy && (
            <Button
              type="subtle"
              onClick={onCancel}
              hapticFeedback={true}
              className="flex-1"
            >
              {cancelText}
            </Button>
          )}
          <Button
            type={variant}
            onClick={busy ? undefined : onConfirm}
            disabled={busy}
            hapticFeedback={true}
            className="flex-1"
          >
            {busy ? animatedDeletingLabel : confirmText}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default ConfirmationModal;