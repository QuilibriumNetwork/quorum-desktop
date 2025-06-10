import {
  faClipboard,
  faReply,
  faShieldAlt,
} from '@fortawesome/free-solid-svg-icons';
import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import Button from '../Button';
import Input from '../Input';
import TooltipButton from '../TooltipButton';
import UserOnlineStateIndicator from './UserOnlineStateIndicator';
import './UserProfile.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Role } from '../../api/quorumApi';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate } from 'react-router';
import { useRegistration } from '../../hooks';

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
      <div className="user-profile-header">
        {props.editMode ? (
          <div
            className="user-profile-icon-editable"
            style={{
              backgroundImage:
                fileData != undefined
                  ? 'url(data:' +
                    acceptedFiles[0].type +
                    ';base64,' +
                    Buffer.from(fileData).toString('base64') +
                    ')'
                  : `url(${props.user.userIcon})`,
            }}
            {...getRootProps()}
          >
            <input {...getInputProps()} />
          </div>
        ) : (
          <div
            className="user-profile-icon"
            style={{ backgroundImage: `url(${props.user.userIcon})` }}
          />
        )}
        <div className="user-profile-text">
          {props.editMode ? (
            <input
              className="w-[180px] quorum-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          ) : (
            <div className="user-profile-username break-words">
              {props.user.displayName}
            </div>
          )}
          <div className="flex flex-row pb-1">
            <div className="text-xs w-[180px] truncate">
              {props.user.address}
            </div>
            <FontAwesomeIcon
              className="hover:text-text-base cursor-pointer"
              icon={faClipboard}
              onClick={() => {
                navigator.clipboard.writeText(props.user.address);
              }}
            />
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
              placeholder="Status goes here"
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
                      : (currentPasskeyInfo!.pfpUrl ?? '/unknown.png'),
                  address: currentPasskeyInfo!.address,
                });
                updateUserProfile(
                  displayName,
                  acceptedFiles.length > 0 && fileData
                    ? 'data:' +
                        acceptedFiles[0].type +
                        ';base64,' +
                        Buffer.from(fileData).toString('base64')
                    : (currentPasskeyInfo!.pfpUrl ?? '/unknown.png'),
                  currentPasskeyInfo!
                );
                if (props.dismiss !== undefined) {
                  props.dismiss();
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div
            className={
              'p-2 ' +
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
                      <span
                        className="hover:bg-[rgba(255,255,255,0.2)] rounded-full px-[.3rem] cursor-pointer ml-[-.25rem] font-thin"
                        onClick={() => removeRole(r.roleId)}
                      >
                        x
                      </span>{' '}
                      {r.displayName}
                    </span>
                  ))}
              {props.canEditRoles &&
                props.roles
                  ?.filter((r) => !r.members.includes(props.user.address))
                  .map((r) => (
                    <Button
                      key={'user-profile-add-role-' + r.roleId}
                      className="!py-0"
                      onClick={() => {
                        addRole(r.roleId);
                      }}
                      type="primary"
                    >
                      + {r.roleTag}
                    </Button>
                  ))}
            </div>
          </div>
          {currentPasskeyInfo!.address !== props.user.address && (
            <div className="bg-[var(--surface-0)] rounded-b-xl p-1">
              <div className="user-profile-actions">
                <TooltipButton
                  icon={faReply}
                  text="Send Message"
                  onClick={() => {
                    navigate('/messages/' + props.user.address);
                    props.dismiss && props.dismiss();
                  }}
                />
              </div>
              {props.canEditRoles && (
                <>
                  <div className="user-profile-content-section-header"></div>
                  <div className="user-profile-actions">
                    <TooltipButton
                      type="danger"
                      icon={faShieldAlt}
                      text="Kick User"
                      onClick={() => {
                        props.setKickUserAddress!(props.user.address);
                        props.dismiss && props.dismiss();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
