import * as React from 'react';
import {
  Input,
  Button,
  Modal,
  Container,
  FlexCenter,
  Text,
  Spacer,
  Callout,
  Icon,
} from '../primitives';
import SpaceIcon from '../navbar/SpaceIcon';
import ModalSaveOverlay from './ModalSaveOverlay';
import './JoinSpaceModal.scss';
import { t } from '@lingui/core/macro';
import { useSpaceJoining, useInviteValidation } from '../../hooks';
import { useSpaces } from '../../hooks';
import { useModalSaveState } from '../../hooks/business/ui/useModalSaveState';
import {
  getValidInvitePrefixes,
  parseInviteParams,
} from '@/utils/inviteDomain';

type AddSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreateSpace: () => void;
};

const AddSpaceModal: React.FunctionComponent<AddSpaceModalProps> = (props) => {
  const [lookup, setLookup] = React.useState<string>('');
  const [manualMode, setManualMode] = React.useState<boolean>(false);
  const [manualSpaceId, setManualSpaceId] = React.useState<string>('');
  const [manualConfigKey, setManualConfigKey] = React.useState<string>('');
  const [urlFormatError, setUrlFormatError] = React.useState<
    string | undefined
  >(undefined);

  // Extract business logic hooks for joining
  const { joinSpace, joining, joinError } = useSpaceJoining();
  const {
    validatedSpace,
    validationError,
    isValidating,
    validateInvite,
    clearValidation,
  } = useInviteValidation();
  const { data: spaces } = useSpaces({});

  // Modal save state for joining overlay
  const { isSaving, saveUntilComplete } = useModalSaveState({
    onSaveComplete: props.onClose,
    onSaveError: (error) => {
      console.error('Join space error:', error);
    },
  });

  // Validate invite URL format and trigger lookup validation if format is OK
  React.useEffect(() => {
    if (!lookup || lookup.trim().length === 0) {
      setUrlFormatError(undefined);
      return;
    }

    const prefixes = getValidInvitePrefixes();
    const hasValidPrefix = prefixes.some((p) => lookup.startsWith(p));
    const params = parseInviteParams(lookup);
    const hasParams = Boolean(params && params.spaceId && params.configKey);

    if (!hasValidPrefix || !hasParams) {
      setUrlFormatError(t`The invite link format is invalid.`);
      return;
    }

    setUrlFormatError(undefined);
    validateInvite(lookup);
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

  const isAlreadyMember = React.useMemo(() => {
    if (!validatedSpace) return false;
    return spaces?.some?.((s: any) => s.spaceId === validatedSpace.spaceId);
  }, [spaces, validatedSpace]);

  const error =
    validationError ||
    joinError ||
    (isAlreadyMember ? t`You are already a member of this Space.` : undefined);

  return (
    <Modal
      title={t`Add a Space`}
      visible={props.visible}
      onClose={isSaving ? undefined : props.onClose}
      closeOnBackdropClick={false}
      closeOnEscape={!isSaving}
      size="small"
    >
      <ModalSaveOverlay
        visible={isSaving}
        message={t`Joining Space...`}
        className="!z-[9999]"
      />

      <Container>
        <Container className="flex flex-col gap-3">
          {!manualMode && !validatedSpace && (
            <Input
              className="w-full !text-sm"
              value={lookup}
              onChange={(value: string) => setLookup(value)}
              placeholder={t`Paste an invite link`}
              clearable={true}
              error={!!(urlFormatError || error)}
              errorMessage={urlFormatError || error}
            />
          )}

          {!manualMode && !validatedSpace && (
            <Container className="flex justify-center">
              <Button
                type="unstyled"
                className="text-accent text-sm hover:text-accent-300"
                onClick={() => setManualMode(true)}
              >
                {t`Enter details manually`}
              </Button>
            </Container>
          )}

          {manualMode && !validatedSpace && (
            <>
              <Callout variant="info" size="sm">
                {t`Enter both Space ID and Config Key to validate`}
              </Callout>

              <Input
                className="w-full !text-sm"
                value={manualSpaceId}
                onChange={(value: string) => setManualSpaceId(value)}
                placeholder={t`Space ID`}
              />
              <Input
                className="w-full !text-sm"
                value={manualConfigKey}
                onChange={(value: string) => setManualConfigKey(value)}
                placeholder={t`Config Key`}
              />

              {manualSpaceId && manualConfigKey && isValidating && (
                <Callout variant="warning" size="sm">
                  <div className="flex items-center gap-2">
                    <Icon name="spinner" spin={true} className="text-warning" />
                    <span>{t`Validating invite...`}</span>
                  </div>
                </Callout>
              )}

              {manualSpaceId && manualConfigKey && error && !isValidating && (
                <Callout variant="error" size="sm">
                  {error}
                </Callout>
              )}
              <Spacer size="sm"></Spacer>
              <Container className="modal-join-space-actions !pt-0">
                <Button
                  className="w-full sm:w-auto sm:inline-block sm:px-8"
                  type="primary"
                  disabled={!manualSpaceId || !manualConfigKey || isValidating}
                  onClick={handleManualLookup}
                >
                  {t`Lookup`}
                </Button>
              </Container>
              <Spacer size="md"></Spacer>
              <Container className="flex justify-center">
                <Button
                  type="unstyled"
                  className="text-accent text-sm hover:text-accent-300"
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
                  disabled={joining || isSaving || isAlreadyMember}
                  onClick={handleJoin}
                >
                  {isAlreadyMember ? t`Already Joined` : t`Join Space`}
                </Button>
                <Button
                  className="w-full sm:w-auto sm:inline-block sm:px-8"
                  type="secondary"
                  onClick={resetManual}
                >
                  {t`Reset`}
                </Button>
              </>
            </Container>
          )}

          {!(
            manualMode ||
            lookup ||
            manualSpaceId ||
            manualConfigKey ||
            isValidating ||
            validatedSpace
          ) && (
            <>
              <Container className="relative flex items-center my-6">
                <div className="flex-grow border-t border-default"></div>
                <Text className="px-3 text-subtle text-sm">{t`OR`}</Text>
                <div className="flex-grow border-t border-default"></div>
              </Container>

              <Container className="modal-join-space-actions !pt-0">
                <Button
                  type="primary"
                  className="w-full sm:w-auto sm:inline-block sm:px-8"
                  onClick={() => props.onCreateSpace()}
                >
                  {t`Create a Space`}
                </Button>
              </Container>
            </>
          )}
        </Container>
      </Container>
    </Modal>
  );
};

export default AddSpaceModal;
