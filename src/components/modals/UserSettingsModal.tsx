import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import Button from '../Button';
import './UserSettingsModal.scss';
import { useConfig, useRegistration } from '../../hooks';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../context/MessageDB';
import ToggleSwitch from '../ToggleSwitch';
import Tooltip from '../Tooltip';
import { UserConfig } from '../../db/messages';
import ThemeRadioGroup from '../ThemeRadioGroup';

const UserSettingsModal: React.FunctionComponent<{
  dismiss: () => void;
  onEditModeClick?: () => void;
  setUser: React.Dispatch<
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
  >;
}> = ({ dismiss, setUser }) => {
  let { currentPasskeyInfo, updateStoredPasskey, exportKey } =
    usePasskeysContext();
  let [displayName, setDisplayName] = React.useState<string>(
    currentPasskeyInfo?.displayName || ''
  );
  let [selectedCategory, setSelectedCategory] =
    React.useState<string>('general');
  let { data: registration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const { keyset } = useRegistrationContext();
  const { saveConfig, getConfig, updateUserProfile } = useMessageDB();
  const [stagedRegistration, setStagedRegistration] = React.useState<
    secureChannel.UserRegistration | undefined
  >(registration.registration);
  const [init, setInit] = React.useState<boolean>(false);
  const existingConfig = React.useRef<UserConfig | null>(null);
  const [allowSync, setAllowSync] = React.useState<boolean>(false);
  const [allowSyncTooltip, setAllowSyncTooltip] =
    React.useState<boolean>(false);
  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);
  const [nonRepudiableTooltip, setNonRepudiableTooltip] =
    React.useState<boolean>(false);

  React.useEffect(() => {
    if (!init) {
      setInit(true);
      (async () => {
        const config = await getConfig({
          address: currentPasskeyInfo!.address,
          userKey: keyset.userKeyset,
        });
        existingConfig.current = config;
        setAllowSync(config.allowSync ?? allowSync);
        setNonRepudiable(config.nonRepudiable ?? nonRepudiable);
      })();
    }
  }, [init]);

  const downloadKey = async () => {
    let content = await exportKey(currentPasskeyInfo!.address);
    let fileName = currentPasskeyInfo!.address + '.key';
    const blob = new Blob([content], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
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

  const removeDevice = (identityKey: string) => {
    setStagedRegistration((reg: secureChannel.UserRegistration | undefined) => {
      return {
        ...reg!,
        device_registrations: reg!.device_registrations.filter(
          (d) => d.identity_public_key !== identityKey
        ),
      };
    });
  };

  const saveChanges = async () => {
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
    setUser!({
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
    await saveConfig({
      config: {
        ...existingConfig.current!,
        allowSync: allowSync,
        nonRepudiable: nonRepudiable,
      },
      keyset: keyset,
    });
    dismiss();
  };

  return (
    <div className="user-settings flex flex-row">
      <div className="px-4 py-2 text-text-base w-[200px]">
        <div className="small-caps text-subtle">Settings</div>
        <div
          onClick={() => setSelectedCategory('general')}
          className={
            (selectedCategory == 'general' ? 'bg-surface-5 ' : '') +
            'font-medium cursor-pointer hover:bg-surface-4 px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          General
        </div>
        <div
          onClick={() => setSelectedCategory('privacy')}
          className={
            (selectedCategory == 'privacy' ? 'bg-surface-5 ' : '') +
            'font-medium cursor-pointer hover:bg-surface-4 px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          Privacy/Security
        </div>
        <div
          onClick={() => setSelectedCategory('appearance')}
          className={
            (selectedCategory === 'appearance' ? 'bg-surface-5 ' : '') +
            'font-medium cursor-pointer hover:bg-surface-4 px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          Appearance
        </div>
      </div>
      <div className="flex flex-col grow overflow-y-scroll rounded-xl">
        {(() => {
          switch (selectedCategory) {
            case 'general':
              return (
                <>
                  <div className="user-settings-header">
                    <div
                      className="user-settings-icon-editable"
                      style={{
                        backgroundImage:
                          fileData !== undefined && acceptedFiles.length !== 0
                            ? `url(data:${acceptedFiles[0].type};base64,${Buffer.from(fileData).toString('base64')})`
                            : currentPasskeyInfo?.pfpUrl &&
                                !currentPasskeyInfo.pfpUrl.includes(
                                  'unknown.png'
                                )
                              ? `url(${currentPasskeyInfo.pfpUrl})`
                              : 'var(--unknown-icon)',
                      }}
                      {...getRootProps()}
                    >
                      <input {...getInputProps()} />
                    </div>
                    <div className="user-settings-text flex flex-col grow pr-4">
                      <div className="small-caps">Display Name</div>
                      <input
                        className="w-full quorum-input"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="user-settings-content flex flex-col !rounded-b-none">
                    <div className="user-settings-info">
                      <div className="small-caps">Account Address</div>
                      <div className="text-base">
                        {currentPasskeyInfo!.address}
                      </div>
                    </div>
                  </div>
                  <div className="user-settings-content flex flex-col grow">
                    <div className="grow flex flex-col justify-end">
                      <div className="user-settings-editor-actions">
                        <Button
                          type="primary"
                          onClick={() => {
                            saveChanges();
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            case 'privacy':
              return (
                <>
                  <div className="user-settings-header pt-4 px-4 !min-h-[0px] flex flex-row justify-between">
                    <div className="">
                      <div className="text-xl font-bold">Privacy/Security</div>
                      <div className="pt-1 text-sm text-text-base">
                        Manage devices, and privacy conditions for messaging and
                        synchronization.
                      </div>
                    </div>
                    <div className="user-settings-editor-actions">
                      {/* <div><Button type="primary" onClick={() => {setRoles(prev => [...prev, {roleId: crypto.randomUUID(), roleTag: "New Role"+(prev.length+1), displayName: "New Role", color: "#3e8914", members: [], permissions: []}])}}>Add Role</Button></div> */}
                    </div>
                  </div>
                  <div className="user-settings-content flex flex-col grow">
                    <div className="small-caps">Devices</div>
                    {stagedRegistration?.device_registrations.map(
                      (d: secureChannel.DeviceRegistration) => (
                        <div
                          key={d.inbox_registration.inbox_address}
                          className="user-settings-content-section-header flex flex-row justify-between"
                        >
                          <div className="flex flex-col justify-around font-light">
                            {d.inbox_registration.inbox_address}
                          </div>
                          {keyset.deviceKeyset.inbox_keyset.inbox_address !==
                            d.inbox_registration.inbox_address && (
                            <Button
                              onClick={() => {
                                removeDevice(d.identity_public_key);
                              }}
                              type="danger"
                            >
                              Remove
                            </Button>
                          )}
                          {keyset.deviceKeyset.inbox_keyset.inbox_address ===
                            d.inbox_registration.inbox_address && (
                            <div className="font-light">(this device)</div>
                          )}
                        </div>
                      )
                    )}
                    <div className="user-settings-content-section-header" />
                    <div className="user-settings-info">
                      <div className="user-settings-content-section-header small-caps !pt-4">
                        Key Export
                      </div>
                      <div className="pt-1 text-sm text-text-base">
                        Export your key to a file by clicking this button. Do
                        not share this file with anyone else or they can
                        impersonate you or steal your space's Apex earnings.
                      </div>
                      <div className="pt-4 pb-8 max-w-[100px]">
                        <Button
                          type="danger"
                          onClick={() => {
                            downloadKey();
                          }}
                        >
                          Export
                        </Button>
                      </div>
                    </div>
                    <div className="user-settings-content-section-header small-caps">
                      Security
                    </div>
                    <div className="pt-1 text-sm text-text-base">
                      Adjust security-related settings, which may impact user
                      experience but increase the security of your Quorum
                      account.
                    </div>
                    <div className="user-settings-info">
                      <div className="flex flex-row justify-between pb-2">
                        <div className="text-sm flex flex-row">
                          <div className="text-sm flex flex-col justify-around">
                            Enable sync
                          </div>
                          <div
                            className="relative ml-2 group"
                            onMouseEnter={() => setAllowSyncTooltip(true)}
                            onMouseLeave={() => setAllowSyncTooltip(false)}
                          >
                            <div className="border border-[var(--surface-6)] rounded-full w-6 h-6 text-center leading-5 text-lg mt-1">
                              ℹ
                            </div>

                            <div className="absolute left-[150%] top-0 z-50 w-[400px]">
                              <Tooltip
                                variant="dark"
                                arrow="{user} has left"
                                className="w-[400px] absolute"
                                visible={allowSyncTooltip}
                              >
                                When enabled, synchronizes your user data,
                                spaces, and space keys between devices. Enabling
                                this increases metadata visibility of your
                                account, which can reveal when you have joined
                                new spaces, although not the spaces you have
                                joined.
                              </Tooltip>
                            </div>
                          </div>
                        </div>

                        <ToggleSwitch
                          onClick={() => setAllowSync((prev) => !prev)}
                          active={allowSync}
                        />
                      </div>
                      <div className="flex flex-row justify-between">
                        <div className="text-sm flex flex-row">
                          <div className="text-sm flex flex-col justify-around">
                            Non-repudiability
                          </div>
                          <div
                            className="relative ml-2 group"
                            onMouseEnter={() => setNonRepudiableTooltip(true)}
                            onMouseLeave={() => setNonRepudiableTooltip(false)}
                          >
                            <div className="border border-[var(--surface-6)] rounded-full w-6 h-6 text-center leading-5 text-lg mt-1">
                              ℹ
                            </div>

                            <div className="absolute left-[150%] top-0 z-50 w-[400px]">
                              <Tooltip
                                variant="dark"
                                arrow="{user} has left"
                                className="w-[400px] absolute"
                                visible={nonRepudiableTooltip}
                              >
                                When enabled, direct messages are not signed by
                                your user key. This improves performance, but
                                can allow the user you are communicating with to
                                forge messages to you as if they came from you.
                                They cannot forge messages to other people as if
                                they came from you. This does not impact the
                                repudiability of spaces, as this is a
                                configuration option by the space owner.
                              </Tooltip>
                            </div>
                          </div>
                        </div>

                        <ToggleSwitch
                          onClick={() => setNonRepudiable((prev) => !prev)}
                          active={nonRepudiable}
                        />
                      </div>
                    </div>
                    <div className="grow flex flex-col justify-end">
                      <div className="user-settings-editor-actions">
                        <Button
                          type="primary"
                          onClick={() => {
                            saveChanges();
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            case 'appearance':
              return (
                <div className="user-settings-content px-4 py-6 flex flex-col gap-4">
                  <div className="text-xl font-bold">Appearance</div>
                  <div className="text-sm text-text-base">
                    Choose your preferred theme for Quorum.
                  </div>
                  <ThemeRadioGroup />
                </div>
              );
          }
        })()}
      </div>
    </div>
  );
};

export default UserSettingsModal;
