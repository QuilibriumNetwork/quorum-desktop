import * as React from 'react';
import { Input, Button, Modal, Switch, Icon, Tooltip } from '../primitives';
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
      <div className="modal-width-large">
        <div className="flex flex-row justify-around pb-4">
          <div
            id="space-icon-tooltip-target"
            className={`avatar-upload ${!fileData ? 'empty' : ''}`}
            style={fileData && currentFile ? {
              backgroundImage: `url(data:${currentFile.type};base64,${Buffer.from(fileData).toString('base64')})`
            } : {}}
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            {!fileData && <Icon name="image" className="icon" />}
          </div>
          {!isUploading && !isDragActive && (
            /* Keep ReactTooltip for file upload area - Tooltip primitive conflicts with react-dropzone */
            <ReactTooltip
              id="space-icon-tooltip"
              content="Upload an avatar for this Space - PNG or JPG, Max 1MB, Optimal size 123×123px"
              place="bottom"
              className="!w-[400px]"
              anchorSelect="#space-icon-tooltip-target"
            />
          )}
        </div>
        <div className="flex flex-col justify-around pb-4 select-none cursor-default">
          <div className="mb-1 text-center">{t`Space Icon Attachment`}</div>
          {fileError && (
            <div className="error-label flex items-center justify-between">
              <span>{fileError}</span>
              <Icon
                name="times"
                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                onClick={clearFileError}
              />
            </div>
          )}
        </div>

        <div className="select-none cursor-default">
          <Input
            value={spaceName}
            onChange={(value) => setSpaceName(value)}
            placeholder={t`Enter a name for your new Space`}
            className="w-full"
          />
          <div className="mt-4 text-xs text-subtle">
            <Trans>
              Default Space settings provide the most typical chat experience,
              but for higher privacy guarantees, review Advanced Settings.
            </Trans>
          </div>
        </div>
        {advancedMode && (
          <div className="mt-4 pt-5 select-none cursor-default">
            <div className="flex flex-row justify-between pb-2">
              <div className="text-sm flex flex-row">
                <div className="text-sm flex flex-col justify-around">
                  <Trans>Require Message Signing</Trans>
                </div>
                <div className="text-sm flex flex-col justify-around ml-2">
                  <Tooltip
                    id="repudiability-tooltip"
                    content={t`Require messages sent in this Space to be signed by the sender. Technically speaking, this makes the messages in this Space non-repudiable.`}
                    place="top"
                    className="!w-[400px]"
                    maxWidth={400}
                  >
                    <Icon
                      name="info-circle"
                      className="info-icon-tooltip hover:text-main cursor-pointer"
                    />
                  </Tooltip>
                </div>
              </div>
              <Switch onChange={() => setRepudiable(!repudiable)} value={!repudiable} />
            </div>
            <div className="flex flex-row justify-between pb-2">
              <div className="text-sm flex flex-row">
                <div className="text-sm flex flex-col justify-around">
                  Directly joinable by link
                </div>
                <div className="text-sm flex flex-col justify-around ml-2">
                  <Tooltip
                    id="public-tooltip"
                    content={t`When this setting is enabled, invite links will automatically allow a user to join your Space. When it is not enabled, users following an invite link will send you a request to join your Space that you must manually approve. Public links require some key material to be present in the link – be aware that possession of a public Space link can allow anyone with the link to read messages on the Space for the duration of the link being valid.`}
                    place="bottom"
                    className="!w-[400px]"
                    maxWidth={400}
                  >
                    <Icon
                      name="info-circle"
                      className="info-icon-tooltip hover:text-main cursor-pointer"
                    />
                  </Tooltip>
                </div>
              </div>
              <Switch onChange={setPublic} value={pub} />
            </div>
          </div>
        )}
        {/* <div className="mt-4 py-5 mx-[-26px] px-4 rounded-b-xl bg-surface-4 mb-[-26px] h-16 flex flex-row-reverse justify-between"> Issues with bottom space*/}
        <div className="mt-6 pt-6 rounded-b-xl border-t border-strong flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
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
