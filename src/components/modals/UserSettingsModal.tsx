import * as React from 'react';
import {
  Button,
  Select,
  Modal,
  Switch,
  Input,
  Icon,
  Tooltip,
} from '../primitives';
import '../../styles/_modal_common.scss';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import ThemeRadioGroup from '../ThemeRadioGroup';
import AccentColorSwitcher from '../AccentColorSwitcher';
import { t } from '@lingui/core/macro';
import ClickToCopyContent from '../ClickToCopyContent';
import { DefaultImages } from '../../utils';
import {
  useUserSettings,
  useProfileImage,
  useLocaleSettings,
  useNotificationSettings,
} from '../../hooks';
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
  // Use our extracted hooks
  const {
    displayName,
    setDisplayName,
    selectedCategory,
    setSelectedCategory,
    allowSync,
    setAllowSync,
    nonRepudiable,
    setNonRepudiable,
    saveChanges: saveUserChanges,
    currentPasskeyInfo,
    stagedRegistration,
    setStagedRegistration,
    removeDevice,
    downloadKey,
    keyset,
  } = useUserSettings({
    onSave: dismiss,
  });

  const {
    fileData,
    currentFile,
    userIconFileError,
    isUserIconUploading,
    isDragActive: isUserIconDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
    getProfileImageUrl,
  } = useProfileImage();

  const { language, setLanguage, languageChanged, localeOptions, forceUpdate } =
    useLocaleSettings();

  const {
    notificationsEnabled,
    handleNotificationToggle,
    isNotificationSupported,
    permissionStatus,
    showRevokeMessage,
  } = useNotificationSettings();

  // Custom save handler that updates setUser callback
  const saveChanges = async () => {
    await saveUserChanges(fileData, currentFile);

    // Update parent component's user state
    setUser!({
      displayName: displayName,
      state: 'online',
      status: '',
      userIcon:
        fileData && currentFile
          ? 'data:' +
            currentFile.type +
            ';base64,' +
            Buffer.from(fileData).toString('base64')
          : (currentPasskeyInfo!.pfpUrl ?? DefaultImages.UNKNOWN_USER),
      address: currentPasskeyInfo!.address,
    });
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
      <div className="modal-complex-container-inner">
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
                      <div className="modal-content-header flex flex-col md:flex-row md:items-center md:justify-center md:gap-6">
                        <div className="flex justify-start md:mt-4">
                          {(fileData || (currentPasskeyInfo?.pfpUrl && !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER))) ? (
                            <div
                              id="user-icon-tooltip-target"
                              className="modal-icon-editable cursor-pointer"
                              style={{
                                backgroundImage: `url(${getProfileImageUrl()})`,
                              }}
                              {...getRootProps()}
                            >
                              <input {...getInputProps()} />
                            </div>
                          ) : (
                            <div
                              id="user-icon-tooltip-target"
                              className="attachment-drop cursor-pointer"
                              {...getRootProps()}
                            >
                              <span className="attachment-drop-icon justify-around w-20 h-20 flex flex-col">
                                <input {...getInputProps()} />
                                <Icon name="image" />
                              </span>
                            </div>
                          )}
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
                        <div className="modal-text-section md:mt-0 md:ml-0 flex flex-col items-start">
                          <div className="modal-text-label md:mt-4 mb-2">{t`Display Name`}</div>
                          <Input
                            className="w-full md:w-80 modal-input-text"
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
                                onClick={clearFileError}
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

                            <Switch value={allowSync} onChange={setAllowSync} />
                          </div>
                          <div className="flex flex-row justify-between">
                            <div className="text-sm flex flex-row">
                              <div className="text-sm flex flex-col justify-around">
                                {t`Always sign Direct Messages`}
                              </div>
                              <Tooltip
                                id="settings-non-repudiable-tooltip"
                                content={t`Always sign Direct Messages in  Conversations. This can be overridden for finer-grain control by clicking the lock icon found in each Conversation view.`}
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

                          {!isNotificationSupported && (
                            <div className="pt-2 text-sm text-amber-600">
                              {t`Desktop notifications are not supported in this browser.`}
                            </div>
                          )}

                          {permissionStatus === 'denied' && (
                            <div
                              className="pt-2 text-sm"
                              style={{ color: 'var(--color-text-danger)' }}
                            >
                              {t`Notifications are blocked. Please enable them in your browser settings.`}
                            </div>
                          )}

                          {showRevokeMessage && (
                            <div className="pt-2 text-sm text-amber-600">
                              {t`To disable notifications, please change the setting in your browser settings. Notifications cannot be disabled programmatically.`}
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
                            options={localeOptions}
                            onChange={(value) => {
                              setLanguage(value);
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
