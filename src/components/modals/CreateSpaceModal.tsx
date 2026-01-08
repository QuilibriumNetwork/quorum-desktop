import * as React from 'react';
import { Input, Button, Modal, Switch, Icon, Tooltip, Spacer, Callout, TextArea } from '../primitives';
import './CreateSpaceModal.scss';
import { useSpaceCreation, useFileUpload, useSpaceSettings, useModalSaveState } from '../../hooks';
import { validateSpaceName } from '../../hooks/business/validation';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import ModalSaveOverlay from './ModalSaveOverlay';
import { useActionQueue } from '../context/ActionQueueContext';
import { ReactTooltip } from '../ui';

type CreateSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
};

const CreateSpaceModal: React.FunctionComponent<CreateSpaceModalProps> = (
  props
) => {
  // Error state for displaying creation errors
  const [createError, setCreateError] = React.useState<string | undefined>(undefined);

  // Modal save state hook with timeout protection
  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 30000, // 30 second timeout for space creation
    onSaveComplete: props.onClose,
    onSaveError: (error) => {
      console.error('Create space error:', error);
      setCreateError(error.message || t`Failed to create space. Please try again.`);
    },
    onTimeout: () => {
      setCreateError(t`Operation timed out. Please try again.`);
    },
  });

  // Use our extracted hooks
  const { spaceName, setSpaceName, createSpace, canCreate } =
    useSpaceCreation({
      onSuccess: props.onClose,
    });

  const [description, setDescription] = React.useState<string>('');
  const MAX_DESCRIPTION_LENGTH = 300;
  const descriptionError = description.length > MAX_DESCRIPTION_LENGTH;

  const {
    fileData,
    currentFile,
    fileError,
    isUploading,
    isDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
    clearFile,
  } = useFileUpload();

  const {
    advancedMode,
    setAdvancedMode,
    repudiable,
    setRepudiable,
    pub,
    setPublic,
  } = useSpaceSettings();

  const { isOnline } = useActionQueue();

  // Handler that wraps createSpace with timeout protection
  const handleCreateSpace = React.useCallback(async () => {
    setCreateError(undefined); // Clear any previous errors
    await saveUntilComplete(async () => {
      await createSpace(spaceName, fileData, currentFile, repudiable, pub, description);
    });
  }, [saveUntilComplete, createSpace, spaceName, fileData, currentFile, repudiable, pub, description]);

  return (
    <Modal
      visible={props.visible}
      onClose={isSaving ? undefined : props.onClose}
      closeOnBackdropClick={false}
      closeOnEscape={!isSaving}
      title={t`Create a Space`}
    >
      <div>
        {!isOnline && (
          <Callout variant="warning" size="sm" className="mb-4">
            <Trans>You're offline. Creating a Space requires an internet connection.</Trans>
          </Callout>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-center md:gap-6">
          <div className="flex justify-center">
            <div
              id="space-icon-tooltip-target"
              className={`avatar-upload ${!fileData ? 'empty' : ''}`}
              style={
                fileData && currentFile
                  ? {
                      backgroundImage: `url(data:${currentFile.type};base64,${Buffer.from(fileData).toString('base64')})`,
                    }
                  : {}
              }
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              {!fileData && <Icon name="image" size="2xl" className="icon" />}
              {fileData && (
                <Tooltip id="create-space-icon-delete" content={t`Delete this image`} place="bottom">
                  <button
                    type="button"
                    className="image-upload-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    aria-label={t`Delete this image`}
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </Tooltip>
              )}
            </div>
            {!isUploading && !isDragActive && !fileData && (
              <ReactTooltip
                id="space-icon-tooltip"
                content={t`Upload an icon for your Space - PNG or JPG - Optimal ratio 1:1`}
                place="bottom"
                className="!w-[400px]"
                anchorSelect="#space-icon-tooltip-target"
              />
            )}
          </div>
          <div className="flex flex-col flex-1 mt-4 md:mt-0">
            <Input
              value={spaceName}
              onChange={(value: string) => setSpaceName(value)}
              placeholder={t`Enter a name for your Space`}
              className="w-full"
              labelType="static"
              error={!!validateSpaceName(spaceName)}
              errorMessage={validateSpaceName(spaceName)}
            />
            {fileError && (
              <Callout
                variant="error"
                size="sm"
                className="mt-2"
                dismissible
                onClose={clearFileError}
              >
                {fileError}
              </Callout>
            )}
            {createError && (
              <Callout
                variant="error"
                size="sm"
                className="mt-2"
                dismissible
                onClose={() => setCreateError(undefined)}
              >
                {createError}
              </Callout>
            )}
          </div>
        </div>
        <div className="mt-6">
          <TextArea
            value={description}
            onChange={setDescription}
            placeholder={t`Enter a description for your Space (optional)`}
            rows={3}
            variant="filled"
            className="w-full"
            error={descriptionError}
            errorMessage={
              descriptionError
                ? t`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
                : undefined
            }
          />
          <div className="text-label mt-2 max-w-[500px]">
            <Trans>
              This description will be visible on invites and shown to people when they look up or join your Space using an invite link.
            </Trans>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <div className="mt-4">
          <Button
            type="unstyled"
            onClick={() => setAdvancedMode(!advancedMode)}
            className="link flex items-center gap-2 p-0"
          >
            <span><Trans>Advanced Settings</Trans></span>
            <Icon
              name={advancedMode ? "chevron-down" : "chevron-right"}
              size="sm"
            />
          </Button>
        </div>

        {/* Advanced Settings Content */}
        {advancedMode && (
          <div className="mt-4 select-none cursor-default">
            <div className="text-label mb-4 max-w-[500px]">
              <Trans>
                Default Space settings provide the most typical chat experience, but for higher privacy guarantees, review these advanced settings.
              </Trans>
            </div>

            <div className="flex flex-row items-center gap-3 mb-3">
              <Switch
                onChange={() => setRepudiable(!repudiable)}
                value={!repudiable}
              />
              <div className="flex flex-row items-center">
                <div className="text-label-strong">
                  <Trans>Require Message Signing</Trans>
                </div>
                <Tooltip
                  id="repudiability-tooltip"
                  content={t`Require messages sent in this Space to be signed by the sender. Technically speaking, this makes the messages in this Space non-repudiable.`}
                  place="bottom"
                  className="!w-[400px]"
                  maxWidth={400}
                >
                  <Icon
                    name="info-circle"
                    className="text-main hover:text-strong cursor-pointer ml-2"
                    size="sm"
                  />
                </Tooltip>
              </div>
            </div>
            {/* TODO: isPublic approval flow not implemented yet.
                Currently this flag is stored but doesn't enforce any approval flow.
                Both public and private spaces can generate public invite links in Settings. */}
            <div className="hidden flex-row items-center gap-3">
              <Switch onChange={setPublic} value={pub} />
              <div className="flex flex-row items-center">
                <div className="text-label-strong">
                  Directly joinable by link
                </div>
                <Tooltip
                  id="public-tooltip"
                  content={t`Turn this on to let anyone with the invite link join automatically. Turn it off to preview and approve each person before they can join. Note: Public links give full read access to your Space while the link is active.`}
                  place="bottom"
                  className="!w-[400px]"
                  maxWidth={400}
                >
                  <Icon
                    name="info-circle"
                    className="text-main hover:text-strong cursor-pointer ml-2"
                    size="sm"
                  />
                </Tooltip>
              </div>
            </div>
          </div>
        )}
        {/* <div className="mt-4 py-5 mx-[-26px] px-4 rounded-b-xl bg-surface-4 mb-[-26px] h-16 flex flex-row-reverse justify-between"> Issues with bottom space*/}
        <Spacer spaceBefore="lg" spaceAfter="lg" border={true} direction="vertical" />
        <div className="rounded-b-xl flex flex-col gap-3 sm:flex-row sm:justify-end sm:items-center">
          <Button
            type="primary"
            className="w-full sm:w-auto"
            disabled={!canCreate || descriptionError || isSaving || !isOnline}
            onClick={handleCreateSpace}
          >
            {t`Create Space`}
          </Button>
        </div>
      </div>
      <ModalSaveOverlay visible={isSaving} message={t`Creating Space...`} />
    </Modal>
  );
};

export default CreateSpaceModal;
