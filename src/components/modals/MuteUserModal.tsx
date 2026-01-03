import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { t } from '@lingui/core/macro';
import { getAddressSuffix } from '../../utils';
import { showError } from '../../utils/toast';

interface MuteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (days: number) => Promise<void>;
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
  const [days, setDays] = React.useState(1); // Default to 1 day

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setDays(1); // Reset to default
    }
  }, [visible]);

  const handleDaysChange = React.useCallback((value: string) => {
    // Extract only digits and clamp to 0-365
    const digitsOnly = value.replace(/\D/g, '');
    const val = parseInt(digitsOnly) || 0;
    setDays(Math.min(365, Math.max(0, val)));
  }, []);

  const handleDaysKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Block non-numeric keys (allow backspace, delete, arrows, tab)
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
  }, []);

  const handleConfirm = React.useCallback(async () => {
    try {
      await onConfirm(days);
      onClose(); // Close immediately on success
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (isUnmuting ? t`Failed to unmute user` : t`Failed to mute user`);
      showError(message);
      onClose(); // Close modal, error shown via toast
    }
  }, [onConfirm, onClose, isUnmuting, days]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnBackdropClick={true}
      closeOnEscape={true}
      title={isUnmuting ? t`Unmute User` : t`Mute User`}
      size="small"
      swipeToClose={true}
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
              {getAddressSuffix(userAddress)}
            </Text>
          </Container>
        </FlexRow>

        <Spacer size="lg" />

        {/* Duration input - only show when muting */}
        {!isUnmuting && (
          <>
            <FlexRow gap="sm" align="center" className="flex-nowrap">
              <Text typography="body" className="whitespace-nowrap">{t`Mute for`}</Text>
              <input
                type="text"
                inputMode="numeric"
                value={days.toString()}
                onChange={(e) => handleDaysChange(e.target.value)}
                onKeyDown={handleDaysKeyDown}
                className="w-12 h-8 px-2 text-center text-sm rounded-lg bg-[var(--color-field-bg)] text-[var(--color-field-text)] border border-transparent hover:bg-[var(--color-field-bg-focus)] focus:outline-none focus:bg-[var(--color-field-bg-focus)] focus:border-[var(--color-field-border-focus)] focus:shadow-[0_0_0_4px_var(--color-field-focus-shadow)]"
              />
              <Text typography="body">{t`days`}</Text>
            </FlexRow>
            <Text typography="small" variant="subtle" className="mt-1">
              {t`0 = forever`}
            </Text>
            <Spacer size="md" />
          </>
        )}

        <Text typography="body" variant="subtle">
          {isUnmuting
            ? t`This user will be able to send messages in this Space again.`
            : days === 0
              ? t`This user will no longer be able to send messages in this Space.`
              : t`This user will not be able to send messages for ${days} days.`}
        </Text>

        <Spacer size="lg" />

        <FlexRow gap="sm">
          <Button
            type="subtle"
            onClick={onClose}
            fullWidth={true}
          >
            {t`Cancel`}
          </Button>
          <Button
            type={isUnmuting ? 'primary' : 'danger'}
            onClick={handleConfirm}
            hapticFeedback={true}
            fullWidth={true}
          >
            {isUnmuting
              ? t`Unmute`
              : days === 0
                ? t`Mute Forever`
                : t`Mute for ${days} days`}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default MuteUserModal;
