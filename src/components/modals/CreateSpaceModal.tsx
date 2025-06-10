import * as React from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImage } from '@fortawesome/free-solid-svg-icons';
import './CreateSpaceModal.scss';
import { useLocalization, useRegistration } from '../../hooks';
import { getConfig } from '../../config/config';
import ToggleSwitch from '../ToggleSwitch';
import { useDropzone } from 'react-dropzone';
import SpaceIcon from '../navbar/SpaceIcon';
import Tooltip from '../Tooltip';
import { useMessageDB } from '../context/MessageDB';
import { useRegistrationContext } from '../context/RegistrationPersister';

type CreateSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
};

const CreateSpaceModal: React.FunctionComponent<CreateSpaceModalProps> = (
  props
) => {
  let { data: localization } = useLocalization({ langId: getConfig().langId });
  const [advancedMode, setAdvancedMode] = React.useState(false);
  const [repudiable, setRepudiable] = React.useState(false);
  const [pub, setPublic] = React.useState(true);
  const [repudiableTooltip, setRepudiableTooltip] = React.useState(false);
  const [pubTooltip, setPublicTooltip] = React.useState(false);
  const [spaceName, setSpaceName] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const { createSpace } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const navigate = useNavigate();

  const { getRootProps, getInputProps, acceptedFiles, isDragActive } =
    useDropzone({
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
      },
      minSize: 0,
      maxSize: 1 * 1024 * 1024,
    });

  React.useEffect(() => {
    if (acceptedFiles.length > 0) {
      (async () => {
        setFileData(await acceptedFiles[0].arrayBuffer());
      })();
    }
  }, [acceptedFiles]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={localization.localizations['CREATE_SPACE_TITLE']([])}
    >
      <div className="flex flex-row justify-around pb-4 select-none cursor-default">
        <div>{localization.localizations['SPACE_ICON_ATTACHMENT']([])}</div>
      </div>

      <div className="flex flex-row justify-around pb-4">
        {acceptedFiles.length != 0 ? (
          <div className="cursor-pointer" {...getRootProps()}>
            <input {...getInputProps()} />
            <SpaceIcon
              noTooltip={true}
              notifs={false}
              spaceName={'Unknown'}
              size="large"
              selected={false}
              iconData={acceptedFiles[0].arrayBuffer()}
            />
          </div>
        ) : (
          <div className="attachment-drop cursor-pointer" {...getRootProps()}>
            <span className="attachment-drop-icon inline-block justify-around w-20 h-20 flex flex-col">
              <input {...getInputProps()} />
              <FontAwesomeIcon icon={faFileImage} />
            </span>
          </div>
        )}
      </div>

      <div className="select-none cursor-default">
        <Input
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          placeholder={localization.localizations['CREATE_SPACE_PROMPT']([])}
          className="w-full"
        />
        <div className="mt-4 text-xs text-subtle w-[320pt]">
          Default space settings provide the most typical chat experience, but
          for higher privacy guarantees, review Advanced Settings.
        </div>
      </div>
      {advancedMode && (
        <div className="mt-4 pt-5 select-none cursor-default">
          <div className="flex flex-row justify-between pb-2">
            <div className="text-sm flex flex-row">
              <div className="text-sm flex flex-col justify-around">
                Repudiability
              </div>
              <div className="text-sm flex flex-col justify-around ml-2">
                <div
                  className="border border-[var(--surface-6)] rounded-full w-6 h-6 text-center leading-5 text-lg"
                  onMouseOut={() => setRepudiableTooltip(false)}
                  onMouseOver={() => setRepudiableTooltip(true)}
                >
                  ℹ
                </div>
              </div>
              <div className="absolute left-[147px]">
                <Tooltip
                  arrow="left"
                  className="w-[300px]"
                  visible={repudiableTooltip}
                >
                  Repudiability is a setting which makes conversations in this
                  space unable to be proven they originated by the named sender.
                  This can be useful in sensitive situations, but also means
                  others forge messages that appear as if they originated from
                  you.
                </Tooltip>
              </div>
            </div>
            <ToggleSwitch
              onClick={() => setRepudiable((prev) => !prev)}
              active={repudiable}
            />
          </div>
          <div className="flex flex-row justify-between pb-2">
            <div className="text-sm flex flex-row">
              <div className="text-sm flex flex-col justify-around">
                Directly joinable by link
              </div>
              <div className="text-sm flex flex-col justify-around ml-2">
                <div
                  className="border border-[var(--surface-6)] rounded-full w-6 h-6 text-center leading-5 text-lg"
                  onMouseOut={() => setPublicTooltip(false)}
                  onMouseOver={() => setPublicTooltip(true)}
                >
                  ℹ
                </div>
              </div>
              <div className="absolute left-[216px]">
                <Tooltip
                  arrow="left"
                  className="w-[400px]"
                  visible={pubTooltip}
                >
                  When this setting is enabled, invite links will automatically
                  allow a user to join your space. When it is not enabled, users
                  following an invite link will send you a request to join your
                  space that you must manually approve. Public links require
                  some key material to be present in the link – be aware that
                  possession of a public space link can allow anyone with the
                  link to read messages on the space for the duration of the
                  link being valid.
                </Tooltip>
              </div>
            </div>
            <ToggleSwitch
              onClick={() => setPublic((prev) => !prev)}
              active={pub}
            />
          </div>
        </div>
      )}
      {/* <div className="mt-4 py-5 mx-[-26px] px-4 rounded-b-xl bg-surface-4 mb-[-26px] h-16 flex flex-row-reverse justify-between"> Issues with bottom space*/}
      <div className="mt-6 pt-6 rounded-b-xl border-t border-t-surface-1 flex flex-row-reverse justify-between">
        <div>
          <Button
            type="primary"
            disabled={creating || !fileData || !spaceName}
            onClick={async () => {
              setCreating(true);
              const { spaceId, channelId } = await createSpace(
                spaceName,
                fileData != undefined
                  ? 'data:' +
                      acceptedFiles[0].type +
                      ';base64,' +
                      Buffer.from(fileData).toString('base64')
                  : '/unknown.png',
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
            {localization.localizations['CREATE_SPACE']([])}
          </Button>
        </div>
        {!advancedMode && (
          <div>
            <Button
              type="secondary"
              onClick={() => {
                setAdvancedMode(true);
              }}
            >
              {localization.localizations['ADVANCED_SETTINGS']([])}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CreateSpaceModal;
