import * as React from 'react';
import {
  Input,
  Button,
  Modal,
  Container,
  FlexCenter,
  Text,
} from '../primitives';
import SpaceIcon from '../navbar/SpaceIcon';
import ModalSaveOverlay from './ModalSaveOverlay';
import './JoinSpaceModal.scss';
import { useLocation } from 'react-router';
import { t } from '@lingui/core/macro';
import { useSpaceJoining, useInviteValidation } from '../../hooks';
import { useModalSaveState } from '../../hooks/business/ui/useModalSaveState';
import { getInviteDisplayDomain } from '@/utils/inviteDomain';

type JoinSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
};

const JoinSpaceModal: React.FunctionComponent<JoinSpaceModalProps> = (
  props
) => {
  const { hash } = useLocation();
  const [init, setInit] = React.useState<boolean>(false);
  const [lookup, setLookup] = React.useState<string>('');

  // Extract business logic hooks
  const { joinSpace, joining, joinError } = useSpaceJoining();
  const { validatedSpace, validationError, validateInvite } =
    useInviteValidation();

  // Modal save state for joining overlay
  const { isSaving, saveUntilComplete } = useModalSaveState({
    onSaveComplete: props.onClose, // Close modal when joining completes
    onSaveError: (error) => {
      console.error('Join space error:', error);
      // Error handling is already managed by useSpaceJoining hook
    },
  });

  // Initialize with hash from URL if present
  React.useEffect(() => {
    if (!init) {
      setInit(true);
      if (hash.trim().length > 0) {
        setLookup(getInviteDisplayDomain() + '/' + hash);
      }
    }
  }, [init, hash]);

  // Validate invite link when lookup changes
  React.useEffect(() => {
    if (lookup) {
      validateInvite(lookup);
    }
  }, [lookup, validateInvite]);

  const handleJoin = React.useCallback(async () => {
    if (validatedSpace && lookup) {
      await saveUntilComplete(async () => {
        const success = await joinSpace(lookup);
        if (!success) {
          // If join failed, throw error to prevent modal from closing
          throw new Error('Failed to join space');
        }
      });
    }
  }, [validatedSpace, lookup, joinSpace, saveUntilComplete]);

  const error = validationError || joinError;

  return (
    <Modal
      title={t`Join Space`}
      visible={props.visible}
      onClose={isSaving ? undefined : props.onClose}
      closeOnBackdropClick={!isSaving}
      closeOnEscape={!isSaving}
      size="medium"
    >
      {/* Joining overlay - positioned to cover entire modal */}
      <ModalSaveOverlay
        visible={isSaving}
        message={t`Joining Space...`}
        className="!z-[9999]"
      />

      <Container className="modal-join-space modal-width-medium">
        <FlexCenter width="full">
          <Input
            className="w-full max-w-[500px] mx-auto !text-sm"
            value={lookup}
            onChange={(value: string) => setLookup(value)}
            placeholder={t`Join Space`}
            error={!!error}
            errorMessage={error}
          />
        </FlexCenter>
        <Container className="modal-join-space-icon">
          {!validatedSpace ? (
            <SpaceIcon
              noTooltip={true}
              notifs={false}
              spaceName={t`Unknown`}
              size="large"
              selected={false}
              iconUrl="/quorumicon.png"
              spaceId="unknown-space"
            />
          ) : (
            <>
              <SpaceIcon
                noToggle={true}
                noTooltip={true}
                notifs={false}
                spaceName={validatedSpace.spaceName}
                size="large"
                selected={true}
                iconUrl={validatedSpace.iconUrl}
                spaceId={validatedSpace.spaceId}
              />
              <Text
                variant="strong"
                size="lg"
                align="center"
                className="sm:text-xl"
              >
                {validatedSpace.spaceName}
              </Text>
            </>
          )}
        </Container>
        <Container className="modal-join-space-actions">
          <Button
            className="w-full sm:w-auto sm:inline-block sm:px-8"
            type="primary"
            disabled={!validatedSpace || joining || isSaving}
            onClick={handleJoin}
          >
            {t`Join Space`}
          </Button>
        </Container>
      </Container>
    </Modal>
  );
};

export default JoinSpaceModal;
