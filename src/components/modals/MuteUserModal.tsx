import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer, Callout } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { t } from '@lingui/core/macro';
import { truncateAddress } from '../../utils';

interface MuteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  userName: string;
  userIcon?: string;
  userAddress: string;
  isUnmuting?: boolean;
}

const MuteUserModal: React.FunctionComponent<MuteUserModalProps> = ({
  visible,
  onClose,
  onConfirm,
  userName,
  userIcon,
  userAddress,
  isUnmuting = false,
}) => {
  const [error, setError] = React.useState<string | null>(null);
  const [isComplete, setIsComplete] = React.useState(false);

  // Close modal after showing success message for 2 seconds
  React.useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onClose]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setError(null);
      setIsComplete(false);
    }
  }, [visible]);

  const handleConfirm = React.useCallback(async () => {
    setError(null);
    try {
      await onConfirm();
      setIsComplete(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (isUnmuting ? t`Failed to unmute user` : t`Failed to mute user`);
      setError(message);
    }
  }, [onConfirm, isUnmuting]);

  return (
    <Modal
      visible={visible}
      onClose={isComplete ? undefined : onClose}
      closeOnBackdropClick={!isComplete}
      closeOnEscape={!isComplete}
      title={isUnmuting ? t`Unmute User` : t`Mute User`}
      size="small"
      swipeToClose={!isComplete}
    >
      <Container>
        <FlexRow gap="md" align="center">
          <UserAvatar
            userIcon={userIcon}
            displayName={userName}
            address={userAddress}
            size={40}
          />
          <Container className="flex-1 min-w-0 flex flex-col">
            <Text typography="body" className="font-semibold truncate-user-name">
              {userName}
            </Text>
            <Text typography="small">
              {truncateAddress(userAddress)}
            </Text>
          </Container>
        </FlexRow>

        <Spacer size="lg" />

        {error ? (
          <Callout variant="error" size="sm">
            {error}
          </Callout>
        ) : (
          <Text typography="body" variant="subtle">
            {isUnmuting
              ? t`This user will be able to send messages in this Space again.`
              : t`This user will no longer be able to send messages in this Space.`}
          </Text>
        )}

        <Spacer size="lg" />

        <FlexRow gap="sm">
          <Button
            type="subtle"
            onClick={onClose}
            disabled={isComplete}
            fullWidth={true}
          >
            {t`Cancel`}
          </Button>
          <Button
            type={isComplete ? 'secondary' : (isUnmuting ? 'primary' : 'danger')}
            onClick={handleConfirm}
            disabled={isComplete}
            hapticFeedback={true}
            fullWidth={true}
          >
            {isComplete
              ? (isUnmuting ? t`User Unmuted!` : t`User Muted!`)
              : (isUnmuting ? t`Unmute` : t`Mute`)}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default MuteUserModal;
