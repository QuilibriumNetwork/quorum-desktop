import * as React from 'react';
import { Button, Modal, Flex, Spacer } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { t } from '@lingui/core/macro';
import { formatAddress } from '@quilibrium/quorum-shared';
import { showError } from '../../utils/toast';
import { useResolvedMemberName } from '../../identity';

interface BlockUserModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  userIcon?: string;
  userAddress: string;
  /** Block is always per-space; every caller already has this (see
   *  `BlockUserTarget`), so it's a genuine prop rather than a route read. */
  spaceId: string;
  isUnblocking?: boolean;
}

/**
 * Confirmation modal for the personal "Block user" action (viewer-side hide).
 *
 * Block is per-space and viewer-side only: it hides the target's messages from
 * YOUR own stream, in this space, for you alone. The copy spells out those three
 * facts so the action is never confused with the role-gated moderation mute.
 */
const BlockUserModal: React.FunctionComponent<BlockUserModalProps> = ({
  visible,
  onClose,
  onConfirm,
  userIcon,
  userAddress,
  spaceId,
  isUnblocking = false,
}) => {
  // `BlockUserModal` is mounted by `ModalProvider` above any per-space
  // `<IdentityScopeProvider>` — same reasoning as Kick/Mute, but `spaceId`
  // arrives as a genuine prop here since the caller already has it.
  // `enrich`: one bounded address, this one confirmation.
  const resolvedName = useResolvedMemberName(userAddress, { spaceId, enrich: true });
  const resolvedNameText = resolvedName.isQnsVerified
    ? `${resolvedName.name}.q`
    : resolvedName.name;

  const handleConfirm = React.useCallback(async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : isUnblocking
            ? t`Failed to unblock user`
            : t`Failed to block user`;
      showError(message);
      onClose();
    }
  }, [onConfirm, onClose, isUnblocking]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnBackdropClick={true}
      closeOnEscape={true}
      title={isUnblocking ? t`Unblock User` : t`Block User`}
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
            <span className="text-small">{formatAddress(userAddress)}</span>
          </div>
        </Flex>

        <Spacer size="lg" />

        <p className="text-body text-subtle">
          {isUnblocking
            ? t`You'll see ${resolvedNameText}'s messages in this Space again.`
            : t`You won't see any of ${resolvedNameText}'s messages in this Space. This only affects your view, and only in this Space. You can unblock anytime.`}
        </p>

        <Spacer size="lg" />

        <Flex gap="sm">
          <Button type="subtle" onClick={onClose} fullWidth={true}>
            {t`Cancel`}
          </Button>
          <Button
            type={isUnblocking ? 'primary' : 'secondary'}
            onClick={handleConfirm}
            hapticFeedback={true}
            fullWidth={true}
          >
            {isUnblocking ? t`Unblock` : t`Block`}
          </Button>
        </Flex>
      </div>
    </Modal>
  );
};

export default BlockUserModal;
