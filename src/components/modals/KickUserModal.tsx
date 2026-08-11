import * as React from 'react';
import { useParams } from 'react-router';
import { Button, Modal, Flex, Spacer } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { useUserKicking } from '../../hooks';
import { useModalSaveState } from '../../hooks';
import ModalSaveOverlay from './ModalSaveOverlay';
import { t } from '@lingui/core/macro';
import { formatAddress } from '@quilibrium/quorum-shared';
import { useResolvedMemberName } from '../../identity';

type KickUserModalProps = {
  visible: boolean;
  onClose: () => void;
  userIcon?: string;
  userAddress: string;
};

const KickUserModal: React.FunctionComponent<KickUserModalProps> = (props) => {
  const { kicking, confirmationStep, handleKickClick, kickUserFromSpace, resetConfirmation } =
    useUserKicking();

  // `KickUserModal` is mounted by `ModalProvider` above any per-space
  // `<IdentityScopeProvider>` (see Router.web.tsx: ModalProvider wraps
  // <Space/>, not the reverse) — the ambient scope has no spaceId. Kick is
  // ALWAYS a Space-scoped action, so spaceId comes from the route, exactly
  // the same source `useUserKicking` itself already reads, so the name and
  // the action always agree on which space they're acting in. `enrich`: one
  // bounded address, this one confirmation.
  const { spaceId } = useParams();
  const resolvedName = useResolvedMemberName(props.userAddress, { spaceId, enrich: true });
  const resolvedNameText = resolvedName.isQnsVerified
    ? `${resolvedName.name}.q`
    : resolvedName.name;

  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 30000,         // 30s failsafe
    showOverlayDelay: 1000,    // Only show overlay if operation takes >1s
    onSaveComplete: props.onClose, // Auto-close modal on success
    onSaveError: (error) => {
      console.error('Kick failed:', error);
      // Keep modal open on error
    },
  });

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!props.visible) {
      resetConfirmation();
    }
  }, [props.visible, resetConfirmation]);

  const handleKickWithOverlay = React.useCallback(() => {
    if (confirmationStep === 0) {
      // First click - just advance to confirmation step
      handleKickClick(props.userAddress, () => {});
    } else {
      // Second click - execute kick (queued via ActionQueue)
      if (!props.userAddress) return;

      saveUntilComplete(async () => {
        await kickUserFromSpace(props.userAddress);
      });
    }
  }, [confirmationStep, handleKickClick, saveUntilComplete, kickUserFromSpace, props.userAddress]);

  return (
    <Modal
      visible={props.visible}
      onClose={isSaving ? undefined : props.onClose}
      closeOnBackdropClick={!isSaving}
      closeOnEscape={!isSaving}
      title={t`Kick User`}
      size="small"
      swipeToClose={!isSaving}
    >
      <ModalSaveOverlay visible={isSaving} message={t`Kicking...`} />

      <div>
        <Flex gap="md" align="center">
          <UserAvatar
            userIcon={props.userIcon}
            // BARE name (no ".q") — matches the initials to whatever the
            // label actually renders (recipe rule 4).
            displayName={resolvedName.name}
            address={props.userAddress}
            size={40}
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="text-body font-semibold truncate-user-name">
              {resolvedNameText}
            </span>
            <span className="text-small">
              {formatAddress(props.userAddress)}
            </span>
          </div>
        </Flex>

        <Spacer size="lg" />

        <p className="text-body text-subtle">
          {t`This user will be removed from the Space.`}
        </p>

        <Spacer size="lg" />

        <Flex gap="sm">
          <Button
            type="subtle"
            onClick={props.onClose}
            disabled={isSaving}
            fullWidth={true}
          >
            {t`Cancel`}
          </Button>
          <Button
            type="danger"
            disabled={isSaving || kicking}
            onClick={handleKickWithOverlay}
            hapticFeedback={true}
            fullWidth={true}
          >
            {confirmationStep === 0 ? t`Kick` : t`Click again to confirm`}
          </Button>
        </Flex>
      </div>
    </Modal>
  );
};

export default KickUserModal;
