import {
  faClipboard,
  faReply,
  faShieldAlt,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import Button from '../Button';
import Input from '../Input';
import UserOnlineStateIndicator from './UserOnlineStateIndicator';
import ClickToCopyContent from '../ClickToCopyContent';
import './UserProfile.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Role } from '../../api/quorumApi';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate } from 'react-router';
import { useRegistration } from '../../hooks';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../utils';

const UserProfile: React.FunctionComponent<{
  spaceId?: string;
  roles?: Role[];
  canEditRoles?: boolean;
  user: any;
  editMode?: boolean;
  dismiss?: () => void;
  onEditModeClick?: () => void;
  setUser?:
    | React.Dispatch<
        React.SetStateAction<
          | {
              displayName: string;
              state: string;
              status: string;
              userIcon: string;
              address: string;
            }
          | undefined
        >
      >
    | undefined;
  kickUserAddress?: string;
  setKickUserAddress?: React.Dispatch<React.SetStateAction<string | undefined>>;
}> = (props) => {
  let [status, setStatus] = React.useState<string>(props.user.status);
  let [displayName, setDisplayName] = React.useState<string>(
    props.user.displayName
  );
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const { updateSpace, messageDB, kickUser, keyset, updateUserProfile } =
    useMessageDB();
  const { data: selfRegistration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const navigate = useNavigate();

  const addRole = React.useCallback(
    async (roleId: string) => {
      const space = await messageDB.getSpace(props.spaceId!);
      updateSpace({
        ...space!,
        roles: space!.roles.map((r) => {
          return r.roleId == roleId
            ? {
                ...r,
                members: [
                  ...r.members.filter((m) => m !== props.user.address),
                  props.user.address,
                ],
              }
            : r;
        }),
      });
    },
    [messageDB, updateSpace]
  );

  const removeRole = React.useCallback(
    async (roleId: string) => {
      const space = await messageDB.getSpace(props.spaceId!);
      updateSpace({
        ...space!,
        roles: space!.roles.map((r) => {
          return r.roleId == roleId
            ? {
                ...r,
                members: [...r.members.filter((m) => m !== props.user.address)],
              }
            : r;
        }),
      });
    },
    [messageDB, updateSpace]
  );

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
    <div className="user-profile" onClick={(e) => e.stopPropagation()}>
      {props.dismiss && (
        <div
          className="absolute right-3 top-3 cursor-pointer text-subtle hover:text-main z-10"
          onClick={props.dismiss}
        >
          <FontAwesomeIcon icon={faTimes} />
        </div>
      )}
      <div className="user-profile-header">
        {props.editMode ? (
          <div
            className="user-profile-icon-editable"
            style={{
              backgroundImage:
                fileData !== undefined
                  ? `url(data:${acceptedFiles[0].type};base64,${Buffer.from(fileData).toString('base64')})`
                  : props.user.userIcon &&
                      !props.user.userIcon.includes(DefaultImages.UNKNOWN_USER)
                    ? `url(${props.user.userIcon})`
                    : 'var(--unknown-icon)',
            }}
            {...getRootProps()}
          >
            <input {...getInputProps()} />
          </div>
        ) : (
          <div
            className="user-profile-icon"
            style={{
              backgroundImage:
                props.user.userIcon &&
                !props.user.userIcon.includes(DefaultImages.UNKNOWN_USER)
                  ? `url(${props.user.userIcon})`
                  : 'var(--unknown-icon)',
            }}
          />
        )}
        <div className="user-profile-text">
          {props.editMode ? (
            <input
              className="w-[190px] quorum-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          ) : (
            <div className="user-profile-username break-words">
              {props.user.displayName}
            </div>
          )}
          <div className="flex flex-row py-1 text-subtle">
            <div className="text-xs w-[140px] truncate">
              {props.user.address}
            </div>
            <ClickToCopyContent
              className="ml-2"
              tooltipText={t`Copy address`}
              text={props.user.address}
              tooltipLocation="top"
              iconClassName="text-subtle hover:text-surface-7"
            >
              <></>
            </ClickToCopyContent>
          </div>
          <div className="user-profile-state">
            <UserOnlineStateIndicator user={props.user} />
          </div>
        </div>
      </div>

      {props.editMode ? (
        <div className="user-profile-content">
          <div className="user-profile-content-section-header small-caps">
            Status
          </div>
          <div className="user-profile-info">
            <Input
              placeholder={t`Status goes here`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
          <div className="user-profile-editor-actions">
            <Button
              type="primary"
              disabled={
                status == props.user.status &&
                displayName == props.user.display_name
              }
              onClick={() => {
                updateStoredPasskey(currentPasskeyInfo!.credentialId, {
                  credentialId: currentPasskeyInfo!.credentialId,
                  address: currentPasskeyInfo!.address,
                  publicKey: currentPasskeyInfo!.publicKey,
                  displayName: displayName,
                  pfpUrl:
                    acceptedFiles.length > 0 && fileData
                      ? 'data:' +
                        acceptedFiles[0].type +
                        ';base64,' +
                        Buffer.from(fileData).toString('base64')
                      : currentPasskeyInfo!.pfpUrl,
                  completedOnboarding: true,
                });
                props.setUser!({
                  displayName: displayName,
                  state: 'online',
                  status: '',
                  userIcon:
                    acceptedFiles.length > 0 && fileData
                      ? 'data:' +
                        acceptedFiles[0].type +
                        ';base64,' +
                        Buffer.from(fileData).toString('base64')
                      : (currentPasskeyInfo!.pfpUrl ??
                        DefaultImages.UNKNOWN_USER),
                  address: currentPasskeyInfo!.address,
                });
                updateUserProfile(
                  displayName,
                  acceptedFiles.length > 0 && fileData
                    ? 'data:' +
                        acceptedFiles[0].type +
                        ';base64,' +
                        Buffer.from(fileData).toString('base64')
                    : (currentPasskeyInfo!.pfpUrl ??
                        DefaultImages.UNKNOWN_USER),
                  currentPasskeyInfo!
                );
                if (props.dismiss !== undefined) {
                  props.dismiss();
                }
              }}
            >
              {t`Save Changes`}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div
            className={
              'p-2 pb-4 ' +
              (currentPasskeyInfo!.address !== props.user.address
                ? ''
                : 'rounded-b-xl')
            }
          >
            <div className="user-profile-content-section-header">Roles</div>
            <div className="user-profile-roles">
              {!props.canEditRoles &&
                props.roles
                  ?.filter((r) => r.members.includes(props.user.address))
                  .map((r) => (
                    <span
                      key={'user-profile-role-' + r.roleId}
                      className={'message-name-mentions-role'}
                    >
                      {r.displayName}
                    </span>
                  ))}
              {props.canEditRoles &&
                props.roles
                  ?.filter((r) => r.members.includes(props.user.address))
                  .map((r) => (
                    <span
                      key={'user-profile-role-' + r.roleId}
                      className={'message-name-mentions-role'}
                    >
                      <FontAwesomeIcon
                        icon={faTimes}
                        className="hover:bg-black hover:bg-opacity-30 rounded-full p-1 cursor-pointer mr-1 text-sm align-middle"
                        onClick={() => removeRole(r.roleId)}
                      />
                      <span className="text-xs">{r.displayName}</span>
                    </span>
                  ))}
              {props.canEditRoles &&
                props.roles
                  ?.filter((r) => !r.members.includes(props.user.address))
                  .map((r) => (
                    <div
                      key={'user-profile-add-role-' + r.roleId}
                      className="w-full sm:w-auto sm:inline-block mb-2"
                    >
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => {
                          addRole(r.roleId);
                        }}
                        type="secondary"
                        size="small"
                      >
                        + {r.roleTag}
                      </Button>
                    </div>
                  ))}
            </div>
          </div>
          {currentPasskeyInfo!.address !== props.user.address && (
            <div className="bg-surface-0 rounded-b-xl p-3">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
                <Button
                  size="small"
                  className="justify-center text-center hover:bg-surface-1 rounded text-main"
                  onClick={() => {
                    navigate('/messages/' + props.user.address);
                    props.dismiss && props.dismiss();
                  }}
                >
                  {t`Send Message`}
                </Button>
                {props.canEditRoles && (
                  <Button
                    type="danger"
                    size="small"
                    className="justify-center text-center hover:bg-surface-1 rounded text-main"
                    onClick={() => {
                      props.setKickUserAddress!(props.user.address);
                      props.dismiss && props.dismiss();
                    }}
                  >
                    {t`Kick User`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
