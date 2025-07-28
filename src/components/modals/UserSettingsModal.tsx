import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Button, Select, Modal, Switch, Input, Icon, Tooltip } from '../primitives';
import '../../styles/_modal_common.scss';
import { useRegistration } from '../../hooks';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../context/MessageDB';
import { UserConfig } from '../../db/messages';
import ThemeRadioGroup from '../ThemeRadioGroup';
import AccentColorSwitcher from '../AccentColorSwitcher';
import { t } from '@lingui/core/macro';
import ClickToCopyContent from '../ClickToCopyContent';
import { DefaultImages } from '../../utils';
import {
  dynamicActivate,
  getUserLocale,
  saveUserLocale,
} from '../../i18n/i18n.ts';
import locales from '../../i18n/locales';
import useForceUpdate from '../hooks/forceUpdate';
import { notificationService } from '../../services/notificationService';
import ReactTooltip from '../ReactTooltip';

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
  const [currentFile, setCurrentFile] = React.useState<File | undefined>();
  const { keyset } = useRegistrationContext();
  const { saveConfig, getConfig, updateUserProfile } = useMessageDB();
  const [stagedRegistration, setStagedRegistration] = React.useState<
    secureChannel.UserRegistration | undefined
  >(registration.registration);
  const [init, setInit] = React.useState<boolean>(false);
  const existingConfig = React.useRef<UserConfig | null>(null);
  const [allowSync, setAllowSync] = React.useState<boolean>(false);
  const [language, setLanguage] = React.useState(getUserLocale());
  const [languageChanged, setLanguageChanged] = React.useState<boolean>(false);
  const [userIconFileError, setUserIconFileError] = React.useState<
    string | null
  >(null);
  const [isUserIconUploading, setIsUserIconUploading] =
    React.useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] =
    React.useState<boolean>(
      notificationService.getPermissionStatus() === 'granted'
    );

  const forceUpdate = useForceUpdate();


  const handleNotificationToggle = async () => {
    if (!notificationService.isNotificationSupported()) {
      // Show some feedback that notifications aren't supported
      return;
    }

    const currentStatus = notificationService.getPermissionStatus();

    if (currentStatus === 'granted') {
      // Can't revoke permission programmatically, inform user
      // Just show the message below, don't use alert
      return;
    }

    // For 'default' or 'denied' status, try to request permission
    // Some browsers allow re-requesting even after denial
    const permission = await notificationService.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    
    // The error messages will be shown by the conditional rendering below
    // No need for alerts that interrupt the UX
  };

  React.useEffect(() => {
    console.log('Language changed to:', language);
    dynamicActivate(language);
    setLanguageChanged(true);
    saveUserLocale(language);
    forceUpdate();
  }, [language]);

  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!init) {
      setInit(true);
      (async () => {
        const config = await getConfig({
          address: currentPasskeyInfo!.address,
          userKey: keyset.userKeyset,
        });
        existingConfig.current = config;
        setAllowSync(config?.allowSync ?? allowSync);
        setNonRepudiable(config?.nonRepudiable ?? nonRepudiable);
      })();
    }
  }, [init]);

  // Refresh notification permission status when modal opens or focus returns
  React.useEffect(() => {
    const checkNotificationStatus = () => {
      const currentStatus = notificationService.getPermissionStatus();
      setNotificationsEnabled(currentStatus === 'granted');
    };

    // Check immediately when component mounts
    checkNotificationStatus();

    // Check when focus returns to the page (in case user changed browser settings)
    window.addEventListener('focus', checkNotificationStatus);
    document.addEventListener('visibilitychange', checkNotificationStatus);

    return () => {
      window.removeEventListener('focus', checkNotificationStatus);
      document.removeEventListener('visibilitychange', checkNotificationStatus);
    };
  }, []);

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

  const {
    getRootProps,
    getInputProps,
    acceptedFiles,
    isDragActive: isUserIconDragActive,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      setIsUserIconUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setUserIconFileError(t`File cannot be larger than 1MB`);
        } else {
          setUserIconFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsUserIconUploading(true); // Keep uploading state during processing
      setUserIconFileError(null);
      // Clear previous file data immediately when new file is accepted
      setFileData(undefined);
      setCurrentFile(files[0]);
    },
    onDragEnter: () => {
      setIsUserIconUploading(true);
    },
    onDragLeave: () => {
      setIsUserIconUploading(false);
    },
    onFileDialogOpen: () => {
      setIsUserIconUploading(true);
    },
    onFileDialogCancel: () => {
      setIsUserIconUploading(false);
    },
  });

  React.useEffect(() => {
    if (currentFile) {
      (async () => {
        try {
          const arrayBuffer = await currentFile.arrayBuffer();
          setFileData(arrayBuffer);
          setIsUserIconUploading(false);
        } catch (error) {
          console.error('Error reading file:', error);
          setUserIconFileError(t`Error reading file`);
          setIsUserIconUploading(false);
        }
      })();
    }
  }, [currentFile]);

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
        currentFile && fileData
          ? 'data:' +
            currentFile.type +
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
        currentFile && fileData
          ? 'data:' +
            currentFile.type +
            ';base64,' +
            Buffer.from(fileData).toString('base64')
          : (currentPasskeyInfo!.pfpUrl ?? DefaultImages.UNKNOWN_USER),
      address: currentPasskeyInfo!.address,
    });
    updateUserProfile(
      displayName,
      currentFile && fileData
        ? 'data:' +
            currentFile.type +
            ';base64,' +
            Buffer.from(fileData).toString('base64')
        : (currentPasskeyInfo!.pfpUrl ?? DefaultImages.UNKNOWN_USER),
      currentPasskeyInfo!
    );
    await saveConfig({
      config: {
        ...existingConfig.current!,
        allowSync,
        nonRepudiable: nonRepudiable,
      },
      keyset: keyset,
    });
    dismiss();
  };

  return (
    <Modal
      title=""
      visible={true}
      onClose={dismiss}
      size="large"
      className="modal-complex-wrapper"
      hideClose={false}
      noPadding={true}
      closeOnBackdropClick={true}
      closeOnEscape={true}
    >
      <div 
        className="modal-complex-container-inner"
      >
        <div className="modal-complex-layout">
        {/* Desktop/Tablet Sidebar */}
        <div className="modal-complex-sidebar">
          <div className="modal-nav-title">{t`Settings`}</div>
          <div
            onClick={() => setSelectedCategory('general')}
            className={`modal-nav-category ${selectedCategory === 'general' ? 'active' : ''}`}
          >
            <Icon name="user" className="mr-2 text-accent" />
            {t`General`}
          </div>
          <div
            onClick={() => setSelectedCategory('privacy')}
            className={`modal-nav-category ${selectedCategory === 'privacy' ? 'active' : ''}`}
          >
            <Icon name="shield" className="mr-2 text-accent" />
            {t`Privacy/Security`}
          </div>
          <div
            onClick={() => setSelectedCategory('notifications')}
            className={`modal-nav-category ${selectedCategory === 'notifications' ? 'active' : ''}`}
          >
            <Icon name="bell" className="mr-2 text-accent" />
            {t`Notifications`}
          </div>
          <div
            onClick={() => setSelectedCategory('appearance')}
            className={`modal-nav-category ${selectedCategory === 'appearance' ? 'active' : ''}`}
          >
            <Icon name="palette" className="mr-2 text-accent" />
            {t`Appearance`}
          </div>
        </div>

        {/* Mobile Stacked Menu */}
        <div className="modal-nav-mobile-single">
          <div
            onClick={() => setSelectedCategory('general')}
            className={`modal-nav-category ${selectedCategory === 'general' ? 'active' : ''}`}
          >
            <Icon name="user" className="mr-2 text-accent" />
            {t`General`}
          </div>
          <div
            onClick={() => setSelectedCategory('privacy')}
            className={`modal-nav-category ${selectedCategory === 'privacy' ? 'active' : ''}`}
          >
            <Icon name="shield" className="mr-2 text-accent" />
            {t`Privacy/Security`}
          </div>
          <div
            onClick={() => setSelectedCategory('notifications')}
            className={`modal-nav-category ${selectedCategory === 'notifications' ? 'active' : ''}`}
          >
            <Icon name="bell" className="mr-2 text-accent" />
            {t`Notifications`}
          </div>
          <div
            onClick={() => setSelectedCategory('appearance')}
            className={`modal-nav-category ${selectedCategory === 'appearance' ? 'active' : ''}`}
          >
            <Icon name="palette" className="mr-2 text-accent" />
            {t`Appearance`}
          </div>
        </div>
        <div className="modal-complex-content">
          {(() => {
            switch (selectedCategory) {
              case 'general':
                return (
                  <>
                    <div className="modal-content-header">
                      <div
                        id="user-icon-tooltip-target"
                        className="modal-icon-editable"
                        style={{
                          backgroundImage:
                            fileData !== undefined && currentFile
                              ? `url(data:${currentFile.type};base64,${Buffer.from(fileData).toString('base64')})`
                              : currentPasskeyInfo?.pfpUrl &&
                                  !currentPasskeyInfo.pfpUrl.includes(
                                    DefaultImages.UNKNOWN_USER
                                  )
                                ? `url(${currentPasskeyInfo.pfpUrl})`
                                : 'var(--unknown-icon)',
                        }}
                        {...getRootProps()}
                      >
                        <input {...getInputProps()} />
                      </div>
                      {!isUserIconUploading && !isUserIconDragActive && (
                        <ReactTooltip
                          id="user-icon-tooltip"
                          content="Upload an avatar for your profile - PNG or JPG, Max 1MB, Optimal size 123×123px"
                          place="bottom"
                          className="!w-[400px]"
                          anchorSelect="#user-icon-tooltip-target"
                        />
                      )}
                      <div className="modal-text-section sm:mt-6">
                        <div className="modal-text-label">{t`Display Name`}</div>
                        <Input
                          className="w-full modal-input-text"
                          value={displayName}
                          onChange={setDisplayName}
                        />
                      </div>
                    </div>
                    <div className="modal-content-section">
                      {userIconFileError && (
                        <div className="mb-4">
                          <div className="error-label flex items-center justify-between">
                            <span>{userIconFileError}</span>
                            <Icon
                              name="times"
                              className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                              onClick={() => setUserIconFileError(null)}
                            />
                          </div>
                        </div>
                      )}
                      <div className="modal-content-info">
                        <div className="modal-text-label">{t`Account Address`}</div>
                        <div className="pt-2 mb-4 modal-text-small text-main">
                          {t`This is your public address and is safe to share with anyone you want to interact with.`}
                        </div>
                        <div className="modal-input-display text-sm lg:text-base">
                          <div className="break-all flex-1 mr-2">
                            {currentPasskeyInfo!.address}
                          </div>
                          <ClickToCopyContent
                            className="flex-shrink-0"
                            tooltipText={t`Copy address`}
                            text={currentPasskeyInfo!.address}
                            tooltipLocation="top"
                            iconClassName="text-surface-10"
                          >
                            <></>
                          </ClickToCopyContent>
                        </div>
                      </div>
                      {/* <div className="modal-content-info">
                        <div className="modal-text-label">{t`Status`}</div>
                        <div className="pt-2 mb-4 modal-text-small text-main">
                          {t`Set a custom status message that others can see.`}
                        </div>
                        <Input
                          className="w-full modal-input-text"
                          style={{ background: 'var(--color-bg-input)' }}
                          value={status}
                          onChange={(value) => setStatus(value.slice(0, 100))}
                          placeholder={t`What's on your mind?`}
                          maxLength={100}
                        />
                        <div className="text-xs text-subtle mt-1">
                          {status.length}/100 {t`characters`}
                        </div>
                      </div> */}
                      <div className="modal-content-actions">
                        <Button
                          type="primary"
                          onClick={() => {
                            saveChanges();
                          }}
                        >
                          {t`Save Changes`}
                        </Button>
                      </div>
                    </div>
                  </>
                );
              case 'privacy':
                return (
                  <>
                    <div className="modal-content-header">
                      <div className="modal-text-section">
                        <div className="modal-text-section-header">{t`Privacy/Security`}</div>
                        <div className="pt-2 modal-text-small text-main">
                          {t`Manage devices, and privacy conditions for messaging and synchronization.`}
                        </div>
                      </div>
                    </div>
                    <div className="modal-content-section">
                      <div className="modal-content-section-header" />
                      <div className="modal-text-label pb-2">Devices</div>
                      {stagedRegistration?.device_registrations.map(
                        (
                          d: secureChannel.DeviceRegistration,
                          index: number
                        ) => (
                          <div
                            key={d.inbox_registration.inbox_address}
                            className={`flex flex-row justify-between items-center py-3 ${
                              index > 0
                                ? 'border-t border-dashed border-surface-7'
                                : ''
                            }`}
                          >
                            <div className="flex flex-col justify-around font-light break-all flex-1 mr-2 text-sm">
                              {d.inbox_registration.inbox_address}
                            </div>
                            <div className="flex-shrink-0">
                              {keyset.deviceKeyset?.inbox_keyset
                                ?.inbox_address !==
                                d.inbox_registration.inbox_address && (
                                <Button
                                  onClick={() => {
                                    removeDevice(d.identity_public_key);
                                  }}
                                  type="danger"
                                  size="small"
                                >
                                  {t`Remove`}
                                </Button>
                              )}
                              {keyset.deviceKeyset.inbox_keyset
                                .inbox_address ===
                                d.inbox_registration.inbox_address && (
                                <Button
                                  size="small"
                                  disabled={true}
                                  onClick={() => {}}
                                >
                                  {t`This device`}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      <div className="modal-content-info !pt-4">
                        <div className="modal-content-section-header" />
                        <div className="modal-text-label">{t`Key Export`}</div>

                        <div className="pt-2 modal-text-small text-main">
                          {t`Export your key to a file by clicking this button. Do not share this file with anyone else or they can impersonate you or steal your Space's Apex earnings.`}
                        </div>
                        <div className="pt-4 pb-8 max-w-[100px]">
                          <Button
                            type="danger"
                            onClick={() => {
                              downloadKey();
                            }}
                          >
                            {t`Export`}
                          </Button>
                        </div>
                      </div>
                      <div className="modal-content-section-header" />
                      <div className="modal-text-label">{t`Security`}</div>

                      <div className="pt-2 modal-text-small text-main">
                        {t`Adjust security-related settings, which may impact user  experience but increase the security of your Quorum account.`}
                      </div>
                      <div className="modal-content-info">
                        <div className="flex flex-row justify-between pb-2">
                          <div className="text-sm flex flex-row">
                            <div className="text-sm flex flex-col justify-around">
                              {t`Enable sync`}
                            </div>
                            <Tooltip
                              id="settings-allow-sync-tooltip"
                              content={t`When enabled, synchronizes your user data, Spaces, and Space keys between devices. Enabling this increases metadata visibility of your account, which can reveal when you have joined new Spaces, although not the Spaces you have joined.`}
                              place="right"
                            >
                              <Icon
                                name="info-circle"
                                className="info-icon-tooltip mt-2 ml-2"
                              />
                            </Tooltip>
                          </div>

                          <Switch
                            value={allowSync}
                            onChange={setAllowSync}
                          />
                        </div>
                        <div className="flex flex-row justify-between">
                          <div className="text-sm flex flex-row">
                            <div className="text-sm flex flex-col justify-around">
                              {t`Non-repudiability`}
                            </div>
                            <Tooltip
                              id="settings-non-repudiable-tooltip"
                              content={t`When enabled, direct messages are not signed by your user key...`}
                              place="right"
                            >
                              <Icon
                                name="info-circle"
                                className="info-icon-tooltip mt-2 ml-2"
                              />
                            </Tooltip>
                          </div>

                          <Switch
                            value={nonRepudiable}
                            onChange={setNonRepudiable}
                          />
                        </div>
                      </div>
                      <div className="modal-content-actions">
                        <Button
                          type="primary"
                          onClick={() => {
                            saveChanges();
                          }}
                        >
                          {t`Save Changes`}
                        </Button>
                      </div>
                    </div>
                  </>
                );
              case 'notifications':
                return (
                  <>
                    <div className="modal-content-header">
                      <div className="modal-text-section">
                        <div className="modal-text-section-header">{t`Notifications`}</div>
                        <div className="pt-2 modal-text-small text-main">
                          {t`Manage desktop notification preferences for new messages.`}
                        </div>
                      </div>
                    </div>
                    <div className="modal-content-section">
                      <div className="modal-content-info">
                        <div className="flex flex-row justify-between pb-2">
                          <div className="text-sm flex flex-row">
                            <div className="text-sm flex flex-col justify-around">
                              {t`Desktop Notifications`}
                            </div>
                            <Tooltip
                              id="settings-notifications-tooltip"
                              content={t`Show desktop notifications when you receive new messages while Quorum is in the background. Your browser will ask for permission when you enable this feature.`}
                              place="right"
                            >
                              <Icon
                                name="info-circle"
                                className="info-icon-tooltip mt-2 ml-2"
                              />
                            </Tooltip>
                          </div>

                          <Switch
                            value={notificationsEnabled}
                            onChange={handleNotificationToggle}
                          />
                        </div>

                        {!notificationService.isNotificationSupported() && (
                          <div className="pt-2 text-sm text-amber-600">
                            {t`Desktop notifications are not supported in this browser.`}
                          </div>
                        )}

                        {notificationService.getPermissionStatus() ===
                          'denied' && (
                          <div className="pt-2 text-sm" style={{ color: 'var(--color-text-danger)' }}>
                            {t`Notifications are blocked. Please enable them in your browser settings.`}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              case 'appearance':
                return (
                  <div className="modal-content-section">
                    <div className="modal-text-section-header">{t`Appearance`}</div>
                    <div className="modal-text-small text-main pt-2">
                      {t`Choose your preferred theme for Quorum.`}
                    </div>
                    <ThemeRadioGroup />

                    <div className="pt-4">
                      <AccentColorSwitcher />
                    </div>

                    <div className="pt-6">
                      <div className="modal-content-section-header" />
                      <div className="modal-text-label pb-2">{t`Language`}</div>
                      <div className="flex flex-row gap-2 items-center">
                        <Select
                          value={language}
                          options={Object.entries(locales).map(([code, label]) => ({
                            value: code,
                            label: label,
                          }))}
                          onChange={(value) => {
                            const selected = value as keyof typeof locales;
                            setLanguage(selected);
                          }}
                          width="300px"
                          dropdownPlacement="bottom"
                        />
                        <Tooltip
                          id="settings-language-refresh-tooltip"
                          content={t`Changes are made automatically, but the active page may not be updated. Refresh the page to apply the new language.`}
                          place="top"
                        >
                          <Button
                            type="secondary"
                            disabled={!languageChanged}
                            onClick={forceUpdate}
                          >
                            {t`Refresh`}
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
            }
          })()}
        </div>
      </div>
      </div>
    </Modal>
  );
};

export default UserSettingsModal;
