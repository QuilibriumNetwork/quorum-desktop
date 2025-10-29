import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Button, Input, Icon } from '../primitives';
import './UserProfile.scss';
import { useMessageDB } from '../context/useMessageDB';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../utils';
import { UserAvatar } from './UserAvatar';

const UserProfileEdit: React.FunctionComponent<{
  user: any;
  dismiss?: () => void;
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
}> = (props) => {
  let [status, setStatus] = React.useState<string>(props.user.status);
  let [displayName, setDisplayName] = React.useState<string>(
    props.user.displayName
  );
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const { updateUserProfile } = useMessageDB();

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
          <Icon name="close" />
        </div>
      )}
      <div className="user-profile-header">
        <div
          className="user-profile-icon-editable"
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          <UserAvatar
            userIcon={
              fileData !== undefined
                ? `data:${acceptedFiles[0].type};base64,${Buffer.from(fileData).toString('base64')}`
                : props.user.userIcon
            }
            displayName={props.user.displayName}
            address={props.user.address}
            size={44}
          />
        </div>
        <div className="user-profile-text">
          <Input
            className="w-[190px]"
            value={displayName}
            onChange={setDisplayName}
          />
          <div className="flex flex-row py-1 text-subtle">
            <div className="text-xs w-[140px] truncate">
              {props.user.address}
            </div>
          </div>
        </div>
      </div>

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
                  : (currentPasskeyInfo!.pfpUrl ?? DefaultImages.UNKNOWN_USER),
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
    </div>
  );
};

export default UserProfileEdit;
