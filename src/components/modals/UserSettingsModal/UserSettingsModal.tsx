import * as React from 'react';
import {
  Button,
  Modal,
  Callout,
  Spacer,
} from '../../primitives';
import '../../../styles/_modal_common.scss';
import ModalSaveOverlay from '../ModalSaveOverlay';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import {
  useUserSettings,
  useProfileImage,
  useLocaleSettings,
  useNotificationSettings,
  useModalSaveState,
  useSpaceRecovery,
} from '../../../hooks';
import { validateDisplayName, validateUserBio } from '../../../hooks/business/validation';
import General from './General';
import Privacy from './Privacy';
import Notifications from './Notifications';
import Appearance from './Appearance';
import Help from './Help';
import Navigation from './Navigation';
import DangerZone from './DangerZone';

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
  // Modal save state hook - close only when operation completes
  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 30000, // 30 second failsafe
    onSaveComplete: dismiss,
    onSaveError: (error) => {
      console.error('Save failed:', error);
      setSaveError(error.message);
    },
  });

  const [saveError, setSaveError] = React.useState<string>('');

  // Use our extracted hooks
  const {
    displayName,
    setDisplayName,
    bio,
    setBio,
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
    getPrivateKeyHex,
    keyset,
    removedDevices,
    isConfigLoaded,
  } = useUserSettings();

  const {
    fileData,
    currentFile,
    userIconFileError,
    isUserIconUploading,
    isDragActive: isUserIconDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
    markedForDeletion,
    markForDeletion,
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

  const { restoreMissingSpaces, isRestoring } = useSpaceRecovery();

  const displayNameError = validateDisplayName(displayName);
  const bioErrors = validateUserBio(bio);

  // Custom save handler that updates setUser callback
  const saveChanges = React.useCallback(async () => {
    setSaveError('');

    await saveUntilComplete(async () => {
      // Pass markedForDeletion to saveUserChanges so it knows to clear the icon
      await saveUserChanges(
        markedForDeletion ? undefined : fileData,
        markedForDeletion ? undefined : currentFile,
        markedForDeletion
      );

      // Determine user icon for parent state update
      let userIcon: string;
      if (markedForDeletion) {
        userIcon = DefaultImages.UNKNOWN_USER;
      } else if (fileData && currentFile) {
        userIcon =
          'data:' +
          currentFile.type +
          ';base64,' +
          Buffer.from(fileData).toString('base64');
      } else {
        userIcon = currentPasskeyInfo!.pfpUrl ?? DefaultImages.UNKNOWN_USER;
      }

      // Update parent component's user state
      setUser!({
        displayName: displayName,
        state: 'online',
        status: '',
        userIcon,
        address: currentPasskeyInfo!.address,
      });
      // Modal will close automatically via onSaveComplete callback
    });
  }, [saveUntilComplete, saveUserChanges, fileData, currentFile, setUser, displayName, currentPasskeyInfo, markedForDeletion]);

  // Determine if current category needs save button
  const categoryNeedsSave = selectedCategory === 'general' || selectedCategory === 'privacy';

  return (
    <Modal
      title=""
      visible={true}
      onClose={isSaving ? undefined : dismiss}
      size="large"
      className="modal-complex-wrapper"
      hideClose={false}
      noPadding={true}
      closeOnBackdropClick={!isSaving}
      closeOnEscape={!isSaving}
    >
      <div className="modal-complex-container-inner relative">
        {/* Loading overlay for saving */}
        <ModalSaveOverlay visible={isSaving} />

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="modal-complex-layout-with-footer">
            <Navigation
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />

            <div className="modal-complex-content-with-footer">
              {(() => {
                switch (selectedCategory) {
                  case 'general':
                    return (
                      <General
                        displayName={displayName}
                        setDisplayName={setDisplayName}
                        bio={bio}
                        setBio={setBio}
                        bioErrors={bioErrors}
                        currentPasskeyInfo={currentPasskeyInfo}
                        fileData={fileData}
                        currentFile={currentFile}
                        userIconFileError={userIconFileError}
                        isUserIconUploading={isUserIconUploading}
                        isUserIconDragActive={isUserIconDragActive}
                        getRootProps={getRootProps}
                        getInputProps={getInputProps}
                        clearFileError={clearFileError}
                        markedForDeletion={markedForDeletion}
                        markForDeletion={markForDeletion}
                        getProfileImageUrl={getProfileImageUrl}
                        onSave={saveChanges}
                        isSaving={isSaving}
                        validationError={displayNameError}
                      />
                    );
                  case 'privacy':
                    return (
                      <Privacy
                        allowSync={allowSync}
                        setAllowSync={setAllowSync}
                        nonRepudiable={nonRepudiable}
                        setNonRepudiable={setNonRepudiable}
                        stagedRegistration={stagedRegistration}
                        keyset={keyset}
                        removeDevice={removeDevice}
                        downloadKey={downloadKey}
                        getPrivateKeyHex={getPrivateKeyHex}
                        onSave={saveChanges}
                        isSaving={isSaving}
                        removedDevices={removedDevices}
                        isConfigLoaded={isConfigLoaded}
                      />
                    );
                  case 'notifications':
                    return (
                      <Notifications
                        notificationsEnabled={notificationsEnabled}
                        handleNotificationToggle={handleNotificationToggle}
                        isNotificationSupported={isNotificationSupported}
                        permissionStatus={permissionStatus}
                        showRevokeMessage={showRevokeMessage}
                      />
                    );
                  case 'appearance':
                    return (
                      <Appearance
                        language={language}
                        setLanguage={setLanguage}
                        languageChanged={languageChanged}
                        localeOptions={localeOptions}
                        forceUpdate={forceUpdate}
                      />
                    );
                  case 'help':
                    return (
                      <Help
                        isRestoring={isRestoring}
                        onRestoreMissingSpaces={restoreMissingSpaces}
                      />
                    );
                  case 'danger':
                    return <DangerZone />;
                  default:
                    return null;
                }
              })()}
            </div>
          </div>

          {/* Footer - Only show for categories that need save */}
          {categoryNeedsSave && (
            <div className="flex flex-row">
              <div className="modal-complex-sidebar-footer"></div>
              <div className="modal-complex-footer">
                {/* Error/Success feedback above Save button */}
                {saveError && (
                  <div className="mb-4">
                    <Callout
                      variant="error"
                      size="sm"
                      dismissible
                      onClose={() => setSaveError('')}
                    >
                      <div>
                        <div className="font-medium">{t`Save Failed`}</div>
                        <div className="text-sm opacity-90 mt-1">{saveError}</div>
                      </div>
                    </Callout>
                  </div>
                )}
                <Button
                  type="primary"
                  onClick={saveChanges}
                  disabled={isSaving || !!displayNameError || bioErrors.length > 0}
                >
                  {t`Save Changes`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default UserSettingsModal;