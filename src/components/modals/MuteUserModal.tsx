import * as React from 'react';
import { useParams } from 'react-router';
import { Button, Modal, Flex, Spacer } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { t } from '@lingui/core/macro';
import { formatAddress } from '@quilibrium/quorum-shared';
import { showError } from '../../utils/toast';
import { useResolvedMemberName } from '../../identity';

interface MuteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (days: number) => Promise<void>;
  userIcon?: string;
  userAddress: string;
  isUnmuting?: boolean;
}

const MuteUserModal: React.FunctionComponent<MuteUserModalProps> = ({
  visible,
  onClose,
  onConfirm,
  userIcon,
  userAddress,
  isUnmuting = false,
}) => {
  const [days, setDays] = React.useState(1); // Default to 1 day

  // `MuteUserModal` is mounted by `ModalProvider` above any per-space
  // `<IdentityScopeProvider>` — same reasoning as `KickUserModal`. Mute is
  // ALWAYS a Space-scoped action, and the underlying `useUserMuting` hook
  // (called by ModalProvider to build `onConfirm`) already sources spaceId
  // from the route, not a prop — mirrored here so the name and the action
  // agree on which space. `enrich`: one bounded address, this one
  // confirmation.
  const { spaceId } = useParams();
  const resolvedName = useResolvedMemberName(userAddress, {
    spaceId,
    enrich: true,
    surface: 'MuteUserModal',
  });
  const resolvedNameText = resolvedName.isQnsVerified
    ? `${resolvedName.name}.q`
    : resolvedName.name;

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
      <div>
        <Flex gap="md" align="center">
          <UserAvatar
            userIcon={userIcon}
            // BARE name (no ".q") — matches the initials to whatever the
            // label actually renders (recipe rule 4).
            displayName={resolvedName.name}
            address={userAddress}
            size={40}
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="text-body font-semibold truncate-user-name">
              {resolvedNameText}
            </span>
            <span className="text-small">
              {formatAddress(userAddress)}
            </span>
          </div>
        </Flex>

        <Spacer size="lg" />

        {/* Duration input - only show when muting */}
        {!isUnmuting && (
          <>
            <Flex gap="sm" align="center" className="flex-nowrap">
              <span className="text-body whitespace-nowrap">{t`Mute for`}</span>
              <input
                type="text"
                inputMode="numeric"
                value={days.toString()}
                onChange={(e) => handleDaysChange(e.target.value)}
                onKeyDown={handleDaysKeyDown}
                className="w-12 h-8 px-2 text-center text-sm rounded-lg bg-[var(--color-field-bg)] text-[var(--color-field-text)] border border-transparent hover:bg-[var(--color-field-bg-focus)] focus:outline-none focus:bg-[var(--color-field-bg-focus)] focus:border-[var(--color-field-border-focus)] focus:shadow-[0_0_0_4px_var(--color-field-focus-shadow)]"
              />
              <span className="text-body">{t`days`}</span>
            </Flex>
            <span className="text-small text-subtle mt-1">
              {t`0 = forever`}
            </span>
            <Spacer size="md" />
          </>
        )}

        <p className="text-body text-subtle">
          {isUnmuting
            ? t`This user will be able to send messages in this Space again.`
            : days === 0
              ? t`This user will no longer be able to send messages in this Space.`
              : t`This user will not be able to send messages for ${days} days.`}
        </p>

        <Spacer size="lg" />

        <Flex gap="sm">
          <Button
            type="subtle"
            onClick={onClose}
            fullWidth={true}
          >
            {t`Cancel`}
          </Button>
          <Button
            type={isUnmuting ? 'primary' : 'secondary'}
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
        </Flex>
      </div>
    </Modal>
  );
};

export default MuteUserModal;
