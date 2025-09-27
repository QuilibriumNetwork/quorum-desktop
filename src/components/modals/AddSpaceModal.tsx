import * as React from 'react';
import {
  Input,
  Button,
  Modal,
  Container,
  FlexCenter,
  Text,
  Spacer,
} from '../primitives';
import SpaceIcon from '../navbar/SpaceIcon';
import ModalSaveOverlay from './ModalSaveOverlay';
import './JoinSpaceModal.scss';
import { t } from '@lingui/core/macro';
import { useSpaceJoining, useInviteValidation } from '../../hooks';
import { useModalSaveState } from '../../hooks/business/ui/useModalSaveState';
import { getValidInvitePrefixes } from '@/utils/inviteDomain';

type AddSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreateSpace: () => void;
};

const AddSpaceModal: React.FunctionComponent<AddSpaceModalProps> = (
  props
) => {
  const [lookup, setLookup] = React.useState<string>('');
  const [manualMode, setManualMode] = React.useState<boolean>(false);
  const [manualSpaceId, setManualSpaceId] = React.useState<string>('');
  const [manualConfigKey, setManualConfigKey] = React.useState<string>('');

  // Extract business logic hooks for joining
  const { joinSpace, joining, joinError } = useSpaceJoining();
  const {
    validatedSpace,
    validationError,
    isValidating,
    validateInvite,
    clearValidation,
  } = useInviteValidation();

  // Modal save state for joining overlay
  const { isSaving, saveUntilComplete } = useModalSaveState({
    onSaveComplete: props.onClose,
    onSaveError: (error) => {
      console.error('Join space error:', error);
    },
  });

  // Validate invite link when lookup changes
  React.useEffect(() => {
    if (lookup) {
      console.log('validating invite', lookup);
      validateInvite(lookup);
    }
  }, [lookup, validateInvite]);

  // Manual lookup handler (constructs URL and triggers validation)
  const handleManualLookup = React.useCallback(() => {
    if (!manualSpaceId || !manualConfigKey) return;
    const prefixes = getValidInvitePrefixes();
    const base = prefixes && prefixes.length > 0 ? prefixes[0] : '';
    if (!base) return;
    const link = `${base}spaceId=${manualSpaceId}&configKey=${manualConfigKey}`;
    setLookup(link);
    // validateInvite will run via lookup effect
  }, [manualSpaceId, manualConfigKey]);


  const handleJoin = React.useCallback(async () => {
    if (validatedSpace && lookup) {
      await saveUntilComplete(async () => {
        const success = await joinSpace(lookup);
        if (!success) {
          throw new Error('Failed to join space');
        }
      });
    }
  }, [validatedSpace, lookup, joinSpace, saveUntilComplete]);

  const resetManual = React.useCallback(() => {
    setManualSpaceId('');
    setManualConfigKey('');
    setLookup('');
    clearValidation();
  }, [clearValidation]);

  const error = validationError || joinError;

  return (
    <Modal
      title={t`Add a Space`}
      visible={props.visible}
      onClose={isSaving ? undefined : props.onClose}
      closeOnBackdropClick={!isSaving}
      closeOnEscape={!isSaving}
      size="medium"
    >
      <ModalSaveOverlay
        visible={isSaving}
        message={t`Joining Space...`}
        className="!z-[9999]"
      />

      <Container className="modal-width-medium">
        <Container className="flex flex-col gap-3">
          {!manualMode && (
            <FlexCenter width="full">
              <Input
                className="w-full max-w-[500px] mx-auto !text-sm"
                value={lookup}
                onChange={(value: string) => setLookup(value)}
                placeholder={t`Paste an invite link`}
                error={!!error}
                errorMessage={error}
              />
            </FlexCenter>
          )}

          {!manualMode && (
            <Container className="flex justify-center">
              <Button
                type="unstyled"
                className="underline text-accent-500 text-sm"
                onClick={() => setManualMode(true)}
              >
                {t`Enter details manually`}
              </Button>
            </Container>
          )}

          {manualMode && !validatedSpace && (
            <>
              <FlexCenter width="full">
                <Input
                  className="w-full max-w-[500px] mx-auto !text-sm"
                  value={manualSpaceId}
                  onChange={(value: string) => setManualSpaceId(value)}
                  placeholder={t`Space ID`}
                />
              </FlexCenter>
              <FlexCenter width="full">
                <Input
                  className="w-full max-w-[500px] mx-auto !text-sm"
                  value={manualConfigKey}
                  onChange={(value: string) => setManualConfigKey(value)}
                  placeholder={t`Config Key`}
                />
              </FlexCenter>

              {/* Status for manual link building */}
              {!(manualSpaceId && manualConfigKey) && (
                <Text size="sm" align="center" className="opacity-80">
                  {t`Enter both Space ID and Config Key to validate`}
                </Text>
              )}

              {manualSpaceId && manualConfigKey && isValidating && (
                <Text size="sm" align="center" className="opacity-80">
                  {t`Validating invite...`}
                </Text>
              )}

              {manualSpaceId && manualConfigKey && error && !isValidating && (
                <Text size="sm" align="center" className="text-red-500">
                  {error}
                </Text>
              )}

              <Container className="modal-join-space-actions !pt-0">
                <Button
                  className="w-full sm:w-auto sm:inline-block sm:px-8"
                  type="secondary"
                  disabled={!manualSpaceId || !manualConfigKey || isValidating}
                  onClick={handleManualLookup}
                >
                  {t`Lookup`}
                </Button>
              </Container>
              <Container className="flex justify-center">
                <Button
                  type="unstyled"
                  className="underline text-accent-500 text-sm"
                  onClick={() => setManualMode(false)}
                >
                  {t`Back to invite link`}
                </Button>
              </Container>
            </>
          )}

          {validatedSpace && !isValidating && (
            <Container className="modal-join-space-icon justify-center">
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
                className="sm:text-xl block w-full text-center"
              >
                {validatedSpace.spaceName}
              </Text>
            </Container>
          )}

            {validatedSpace && !isValidating && (
                <Container className="modal-join-space-actions flex justify-center gap-3">
                    <>
                        <Button
                        className="w-full sm:w-auto sm:inline-block sm:px-8"
                        type="primary"
                        disabled={joining || isSaving}
                        onClick={handleJoin}
                        >
                        {t`Join Space`}
                        </Button>
                        {manualMode && (
                        <Button
                            className="w-full sm:w-auto sm:inline-block sm:px-8"
                            type="secondary"
                            onClick={resetManual}
                        >
                            {t`Reset`}
                        </Button>
                        )}
                    </>
                </Container>
            )}
        </Container>

        <Spacer spaceBefore="lg" spaceAfter="lg" border={true} direction="vertical" />

        <Container className="modal-join-space-actions !pt-0">
          <Button
            type="primary"
            className="w-full sm:w-auto sm:inline-block sm:px-8"
            onClick={() => props.onCreateSpace()}
          >
            {t`Create a Space`}
          </Button>
        </Container>
      </Container>
    </Modal>
  );
};

export default AddSpaceModal;


