import * as React from 'react';
import { Input, Button, Modal, Switch, Icon, Tooltip, Spacer, Callout } from '../primitives';
import './CreateSpaceModal.scss';
import SpaceIcon from '../navbar/SpaceIcon';
import { useSpaceCreation, useFileUpload, useSpaceSettings } from '../../hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import ReactTooltip from '../ReactTooltip';

type CreateSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
};

const CreateSpaceModal: React.FunctionComponent<CreateSpaceModalProps> = (
  props
) => {
  // Use our extracted hooks
  const { spaceName, setSpaceName, creating, createSpace, canCreate } =
    useSpaceCreation({
      onSuccess: props.onClose,
    });

  const {
    fileData,
    currentFile,
    fileError,
    isUploading,
    isDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
  } = useFileUpload();

  const {
    advancedMode,
    setAdvancedMode,
    repudiable,
    setRepudiable,
    pub,
    setPublic,
  } = useSpaceSettings();

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`Create a Space`}
    >
      <div>
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
              {!fileData && <Icon name="image" className="icon" />}
            </div>
            {!isUploading && !isDragActive && (
              /* Keep ReactTooltip for file upload area - Tooltip primitive conflicts with react-dropzone */
              <ReactTooltip
                id="space-icon-tooltip"
                content="Upload an avatar for this Space - PNG or JPG - Optimal ratio 1:1"
                place="bottom"
                className="!w-[400px]"
                anchorSelect="#space-icon-tooltip-target"
              />
            )}
          </div>
          <div className="flex flex-col flex-1 mt-4 md:mt-0">
            <Input
              value={spaceName}
              onChange={(value) => setSpaceName(value)}
              placeholder={t`Enter a name for your new Space`}
              className="w-full"
              label={t`Space Name`}
              labelType="static"
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
          </div>
        </div>
        <div className="mt-4 text-sm text-subtle">
          <Trans>
            Upload an image and choose a name for your Space.
          </Trans>
        </div>
                <div className="mt-4 text-sm text-subtle">
          <Trans> Default Space settings provide the most typical chat experience, but for higher privacy guarantees, review the Advanced Settings.
          </Trans>
        </div>
        {advancedMode && (
          <div className="mt-4 pt-5 select-none cursor-default">
            <div className="flex flex-row justify-between pb-2">
              <div className="flex flex-row items-center">
                <div className="modal-text-small text-main">
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
                  />
                </Tooltip>
              </div>
              <Switch
                onChange={() => setRepudiable(!repudiable)}
                value={!repudiable}
              />
            </div>
            <div className="flex flex-row justify-between pb-2">
              <div className="flex flex-row items-center">
                <div className="modal-text-small text-main">
                  Directly joinable by link
                </div>
                <Tooltip
                  id="public-tooltip"
                  content={t`When this setting is enabled, invite links will automatically allow a user to join your Space. When it is not enabled, users following an invite link will send you a request to join your Space that you must manually approve. Public links require some key material to be present in the link – be aware that possession of a public Space link can allow anyone with the link to read messages on the Space for the duration of the link being valid.`}
                  place="bottom"
                  className="!w-[400px]"
                  maxWidth={400}
                >
                  <Icon
                    name="info-circle"
                    className="text-main hover:text-strong cursor-pointer ml-2"
                  />
                </Tooltip>
              </div>
              <Switch onChange={setPublic} value={pub} />
            </div>
          </div>
        )}
        {/* <div className="mt-4 py-5 mx-[-26px] px-4 rounded-b-xl bg-surface-4 mb-[-26px] h-16 flex flex-row-reverse justify-between"> Issues with bottom space*/}
        <Spacer spaceBefore="lg" spaceAfter="lg" border={true} direction="vertical" />
        <div className="rounded-b-xl flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          {!advancedMode && (
            <Button
              type="secondary"
              className="w-full sm:w-auto"
              onClick={() => setAdvancedMode(true)}
            >
              {t`Advanced Settings`}
            </Button>
          )}
          <Button
            type="primary"
            className="w-full sm:w-auto"
            disabled={!canCreate || !fileData}
            onClick={() =>
              createSpace(spaceName, fileData, currentFile, repudiable, pub)
            }
          >
            {creating ? t`Creating Space...` : t`Create Space`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateSpaceModal;
