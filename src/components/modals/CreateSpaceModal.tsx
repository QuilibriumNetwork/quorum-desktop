import * as React from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Input, Button, Modal, Switch, Icon, Tooltip } from '../primitives';
import './CreateSpaceModal.scss';
import { useDropzone } from 'react-dropzone';
import SpaceIcon from '../navbar/SpaceIcon';
import { useMessageDB } from '../context/MessageDB';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { useRegistration } from '../../hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../utils';
import ReactTooltip from '../ReactTooltip';

type CreateSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
};

const CreateSpaceModal: React.FunctionComponent<CreateSpaceModalProps> = (
  props
) => {
  const [advancedMode, setAdvancedMode] = React.useState(false);
  const [repudiable, setRepudiable] = React.useState(false);
  const [pub, setPublic] = React.useState(true);
  const [spaceName, setSpaceName] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const { createSpace } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = React.useState<File | undefined>();
  const navigate = useNavigate();

  const { getRootProps, getInputProps, acceptedFiles, isDragActive } =
    useDropzone({
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
      },
      multiple: false,
      minSize: 0,
      maxSize: 1 * 1024 * 1024,
      onDropRejected: (fileRejections) => {
        setIsUploading(false);
        for (const rejection of fileRejections) {
          if (rejection.errors.some((err) => err.code === 'file-too-large')) {
            setFileError(t`File cannot be larger than 1MB`);
          } else {
            setFileError(t`File rejected`);
          }
        }
      },
      onDropAccepted: (files) => {
        setIsUploading(true);
        setFileError(null);
        // Clear previous file data immediately when new file is accepted
        setFileData(undefined);
        setCurrentFile(files[0]);
      },
      onDragEnter: () => {
        setIsUploading(true);
      },
      onDragLeave: () => {
        setIsUploading(false);
      },
      onFileDialogOpen: () => {
        setIsUploading(true);
      },
      onFileDialogCancel: () => {
        setIsUploading(false);
      },
    });

  React.useEffect(() => {
    if (currentFile) {
      (async () => {
        try {
          const arrayBuffer = await currentFile.arrayBuffer();
          setFileData(arrayBuffer);
          setIsUploading(false);
        } catch (error) {
          console.error('Error reading file:', error);
          setFileError(t`Error reading file`);
          setIsUploading(false);
        }
      })();
    }
  }, [currentFile]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`Create a Space`}
    >
      <div className="modal-width-large">
        <div className="flex flex-row justify-around pb-4">
          {fileData ? (
            <div
              id="space-icon-tooltip-target"
              className="cursor-pointer"
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              <SpaceIcon
                noTooltip={true}
                notifs={false}
                spaceName={'Unknown'}
                size="large"
                selected={false}
                iconData={Promise.resolve(fileData)}
                spaceId="create-space-preview"
                key={currentFile?.name + currentFile?.lastModified} // Force re-render when file changes
              />
            </div>
          ) : (
            <div
              id="space-icon-tooltip-target"
              className="attachment-drop cursor-pointer"
              {...getRootProps()}
            >
              <span className="attachment-drop-icon inline-block justify-around w-20 h-20 flex flex-col">
                <input {...getInputProps()} />
                <Icon name="image" />
              </span>
            </div>
          )}
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
                onClick={() => setFileError(null)}
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
                  <Trans>Repudiability</Trans>
                </div>
                <div className="text-sm flex flex-col justify-around ml-2">
                  <Tooltip
                    id="repudiability-tooltip"
                    content={t`Repudiability is a setting that makes conversations in this Space unverifiable as originating from the named sender. This can be useful in sensitive situations, but it also means others may forge messages that appear to come from you.`}
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
              <Switch
                onChange={setRepudiable}
                value={repudiable}
              />
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
              <Switch
                onChange={setPublic}
                value={pub}
              />
            </div>
          </div>
        )}
        {/* <div className="mt-4 py-5 mx-[-26px] px-4 rounded-b-xl bg-surface-4 mb-[-26px] h-16 flex flex-row-reverse justify-between"> Issues with bottom space*/}
        <div className="mt-6 pt-6 rounded-b-xl border-t border-t-surface-1 modal-buttons-responsive">
          <Button
            type="primary"
            disabled={creating || !fileData || !spaceName}
            onClick={async () => {
              setCreating(true);
              const { spaceId, channelId } = await createSpace(
                spaceName,
                fileData != undefined && currentFile
                  ? 'data:' +
                      currentFile.type +
                      ';base64,' +
                      Buffer.from(fileData).toString('base64')
                  : DefaultImages.UNKNOWN_USER,
                keyset,
                registration.registration!,
                repudiable,
                pub,
                currentPasskeyInfo?.pfpUrl!,
                currentPasskeyInfo?.displayName!
              );
              navigate(`/spaces/${spaceId}/${channelId}`);
              props.onClose();
              setCreating(false);
            }}
          >
            {creating ? t`Creating Space...` : t`Create Space`}
          </Button>
          {!advancedMode && (
            <Button
              type="secondary"
              onClick={() => {
                setAdvancedMode(true);
              }}
            >
              {t`Advanced Settings`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CreateSpaceModal;
