import * as React from 'react';
import {
  Button,
  Modal,
  Callout,
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
} from '../../../hooks';
import General from './General';
import Privacy from './Privacy';
import Notifications from './Notifications';
import Appearance from './Appearance';
import Navigation from './Navigation';

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
  const saveChanges = React.useCallback(async () => {
    setSaveError('');

    await saveUntilComplete(async () => {
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
      // Modal will close automatically via onSaveComplete callback
    });
  }, [saveUntilComplete, saveUserChanges, fileData, currentFile, setUser, displayName, currentPasskeyInfo]);

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
        {/* Error/Success feedback */}
        {saveError && (
          <div className="p-4 border-b border-surface-6">
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
                        currentPasskeyInfo={currentPasskeyInfo}
                        fileData={fileData}
                        currentFile={currentFile}
                        userIconFileError={userIconFileError}
                        isUserIconUploading={isUserIconUploading}
                        isUserIconDragActive={isUserIconDragActive}
                        getRootProps={getRootProps}
                        getInputProps={getInputProps}
                        clearFileError={clearFileError}
                        getProfileImageUrl={getProfileImageUrl}
                        onSave={saveChanges}
                        isSaving={isSaving}
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
                        onSave={saveChanges}
                        isSaving={isSaving}
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
                  default:
                    return null;
                }
              })()}
            </div>
          </div>

          {/* Footer - Only show for categories that need save */}
          {categoryNeedsSave && (
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <div className="modal-complex-sidebar-footer"></div>
              <div className="modal-complex-footer">
                <Button
                  type="primary"
                  onClick={saveChanges}
                  disabled={isSaving}
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