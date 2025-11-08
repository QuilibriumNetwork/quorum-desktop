import * as React from 'react';
import {
  Button,
  Modal,
  Callout,
  Spacer,
} from '../../primitives';
import '../../../styles/_modal_common.scss';
import ConfirmationModal from '../ConfirmationModal';
import ModalSaveOverlay from '../ModalSaveOverlay';
import { useSpace } from '../../../hooks';
import { useMessageDB } from '../../context/useMessageDB';
import { useSpaceOwner } from '../../../hooks/queries/spaceOwner/useSpaceOwner';
import { Channel } from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQueryClient } from '@tanstack/react-query';
import { buildSpaceMembersKey } from '../../../hooks';
import { validateSpaceName, validateSpaceDescription } from '../../../hooks/business/validation';
import {
  useSpaceManagement,
  useRoleManagement,
  useSpaceFileUploads,
  useCustomAssets,
  useInviteManagement,
  useModalSaveState,
  useSpaceProfile,
} from '../../../hooks';
import { useMentionNotificationSettings } from '../../../hooks/business/mentions';
import { showSuccess, showInfo, showError } from '../../../utils/toast';
import Account from './Account';
import General from './General';
import Roles from './Roles';
import Emojis from './Emojis';
import Stickers from './Stickers';
import Invites from './Invites';
import Danger from './Danger';
import Navigation from './Navigation';

const SpaceSettingsModal: React.FunctionComponent<{
  spaceId: string;
  dismiss: () => void;
}> = ({ spaceId, dismiss }) => {
  const { data: space } = useSpace({ spaceId });
  const { updateSpace, requestSync, messageDB, sendVerifyKickedStatuses } = useMessageDB();
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  const [syncingKicks, setSyncingKicks] = React.useState<boolean>(false);
  const handleSyncKicked = React.useCallback(async () => {
    if (!space) return;
    setSyncingKicks(true);
    try {
      const count = await sendVerifyKickedStatuses(space.spaceId);
      if (count > 0) {
        // Optionally, request a members sync shortly after
        await requestSync(space.spaceId);
        showSuccess(`Updated records for ${count} users that have been kicked.`);
      } else {
        // No updates needed
        showInfo(t`All kick records are up to date.`);
      }
    } finally {
      setSyncingKicks(false);
    }
  }, [space, sendVerifyKickedStatuses, requestSync]);
  const user = usePasskeysContext();
  const queryClient = useQueryClient();

  // Legacy owner membership check
  const [checkingOwnerMembership, setCheckingOwnerMembership] = React.useState<boolean>(false);
  const [missingOwnerMembership, setMissingOwnerMembership] = React.useState<boolean>(false);
  const [addingOwner, setAddingOwner] = React.useState<boolean>(false);

  React.useEffect(() => {
    (async () => {
      if (!space || !user?.currentPasskeyInfo?.address) return;
      setCheckingOwnerMembership(true);
      try {
        const existing = await messageDB.getSpaceMember(spaceId, user.currentPasskeyInfo.address);
        const isMissing = !existing || !existing.inbox_address || existing.inbox_address === '';
        setMissingOwnerMembership(isMissing);
      } finally {
        setCheckingOwnerMembership(false);
      }
    })();
  }, [spaceId, space, user?.currentPasskeyInfo?.address, messageDB]);

  const addOwnerToMembers = React.useCallback(async () => {
    if (!user?.currentPasskeyInfo) return;
    setAddingOwner(true);
    try {
      const inboxKey = await messageDB.getSpaceKey(spaceId, 'inbox');
      const inboxAddress = inboxKey?.address || '';
      await messageDB.saveSpaceMember(spaceId, {
        user_address: user.currentPasskeyInfo.address,
        user_icon: user.currentPasskeyInfo.pfpUrl || '',
        display_name: user.currentPasskeyInfo.displayName || '',
        inbox_address: inboxAddress,
      } as any);
      setMissingOwnerMembership(false);
      await queryClient.invalidateQueries({ queryKey: buildSpaceMembersKey({ spaceId }) });
    } finally {
      setAddingOwner(false);
    }
  }, [messageDB, queryClient, spaceId, user?.currentPasskeyInfo]);

  // Set default tab based on ownership
  React.useEffect(() => {
    if (selectedCategory === 'general' && isSpaceOwner === false) {
      setSelectedCategory('account');
    }
  }, [isSpaceOwner]);

  // Default channel state
  const [defaultChannel, setDefaultChannel] = React.useState<Channel | undefined>(
    space?.groups
      ?.find((g) =>
        g.channels.find((c) => c.channelId === space.defaultChannelId)
      )
      ?.channels.find((c) => c.channelId === space.defaultChannelId)
  );

  // Description state
  const [description, setDescription] = React.useState<string>(
    space?.description || ''
  );
  const MAX_DESCRIPTION_LENGTH = 300;
  const descriptionErrors = validateSpaceDescription(description, MAX_DESCRIPTION_LENGTH);

  // Update description when space changes
  React.useEffect(() => {
    if (space?.description !== undefined) {
      setDescription(space.description || '');
    }
  }, [space?.description]);

  // Space management hook
  const {
    spaceName,
    setSpaceName,
    selectedCategory,
    setSelectedCategory,
    isRepudiable,
    setIsRepudiable,
    saveEditHistory,
    setSaveEditHistory,
    handleDeleteSpace,
    deleteError,
    clearDeleteError,
  } = useSpaceManagement({
    spaceId,
    onClose: dismiss,
  });

  // Role management hook
  const {
    roles,
    addRole,
    deleteRole,
    updateRoleTag,
    updateRoleDisplayName,
    toggleRolePermission,
    updateRolePermissions,
    toggleRolePublic,
    deleteConfirmation,
  } = useRoleManagement({
    initialRoles: space?.roles || [],
  });

  // File uploads hook
  const {
    iconData,
    currentIconFile,
    iconFileError,
    isIconUploading,
    isIconDragActive,
    getIconRootProps,
    getIconInputProps,
    clearIconFileError,

    bannerData,
    currentBannerFile,
    bannerFileError,
    isBannerUploading,
    isBannerDragActive,
    getBannerRootProps,
    getBannerInputProps,
    clearBannerFileError,
  } = useSpaceFileUploads();

  // Custom assets hook
  const {
    emojis,
    emojiFileError,
    getEmojiRootProps,
    getEmojiInputProps,
    clearEmojiFileError,
    removeEmoji,
    updateEmoji,
    canAddMoreEmojis,

    stickers,
    stickerFileError,
    getStickerRootProps,
    getStickerInputProps,
    clearStickerFileError,
    removeSticker,
    updateSticker,
    canAddMoreStickers,
  } = useCustomAssets({
    initialEmojis: space?.emojis || [],
    initialStickers: space?.stickers || [],
  });

  // Invite management hook
  const {
    selectedUser,
    setSelectedUser,
    manualAddress,
    setManualAddress,
    resolvedUser,
    getUserOptions,
    sendingInvite,
    success,
    membershipWarning,
    invite,
    publicInvite,
    setPublicInvite,
    generating,
    generateNewInviteLink,
  } = useInviteManagement({
    spaceId,
    space,
    defaultChannel,
  });

  // Space profile hook (for Account tab)
  const spaceProfile = useSpaceProfile({
    spaceId,
    onSave: dismiss,
  });

  // Mention notification settings (for Account tab)
  const mentionSettings = useMentionNotificationSettings({ spaceId });

  // Wrapped save handler for Account tab (saves both profile and mention settings)
  const handleAccountSave = React.useCallback(async () => {
    // Note: spaceProfile.onSave() already has its own isSaving state and manages the overlay
    // But we need to also save mention settings, so we wrap both operations
    // to show a unified saving state

    try {
      // Save mention settings first
      await mentionSettings.saveSettings();

      // Invalidate notification count queries to recalculate with new settings
      await queryClient.invalidateQueries({
        queryKey: ['mention-counts', 'channel', spaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['reply-counts', 'channel', spaceId],
      });

      // Then save profile changes (which dismisses the modal)
      await spaceProfile.onSave();
    } catch (error) {
      console.error('[SpaceSettings] Error saving account settings:', error);
      // spaceProfile.onSave already shows error toasts, so we don't need to duplicate
      // But if mention settings fail, we should show an error
      if (error instanceof Error && error.message.includes('mention')) {
        showError(t`Failed to save notification settings`);
      }
      throw error; // Re-throw to prevent modal from closing
    }
  }, [mentionSettings, spaceProfile, queryClient, spaceId]);

  // Delete confirmation state - kept local as it's UI-specific
  const [deleteConfirmationStep, setDeleteConfirmationStep] = React.useState(0);

  // Role validation error state
  const [roleValidationError, setRoleValidationError] =
    React.useState<string>('');

  // Save error state
  const [saveError, setSaveError] = React.useState<string>('');

  // Modal save state hook - close only when operation completes
  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 30000, // 30 second failsafe
    onSaveComplete: dismiss,
    onSaveError: (error) => {
      console.error('Save failed:', error);
      setSaveError(error.message);
    },
  });

  // Public invite link state management
  const [generationSuccess, setGenerationSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [showGenerateModal, setShowGenerateModal] = React.useState(false);

  // Helper functions for Select primitive
  const getChannelGroups = React.useMemo(() => {
    if (!space?.groups) return [];
    return space.groups.map((group) => ({
      groupLabel: group.groupName,
      options: group.channels.map((channel) => ({
        value: channel.channelId,
        label: channel.channelName, // Channel name without # symbol
        icon: '#', // Just the # symbol as icon
      })),
    }));
  }, [space?.groups]);

  // Save changes function
  const saveChanges = React.useCallback(async () => {
    if (!space) return;

    setSaveError('');

    await saveUntilComplete(async () => {
      // Convert file data to URLs similar to original SpaceEditor
      const iconUrl =
        currentIconFile && iconData
          ? 'data:' +
            currentIconFile.type +
            ';base64,' +
            Buffer.from(iconData).toString('base64')
          : space.iconUrl;

      const bannerUrl =
        currentBannerFile && bannerData
          ? 'data:' +
            currentBannerFile.type +
            ';base64,' +
            Buffer.from(bannerData).toString('base64')
          : space.bannerUrl;

      // Use the original updateSpace call with all our hook data
      await updateSpace({
        ...space,
        spaceName,
        defaultChannelId: defaultChannel?.channelId || space.defaultChannelId,
        isRepudiable,
        saveEditHistory,
        iconUrl,
        bannerUrl,
        roles,
        emojis,
        stickers,
        description,
      });
    });
  }, [
    saveUntilComplete,
    updateSpace,
    space,
    spaceName,
    defaultChannel,
    isRepudiable,
    saveEditHistory,
    roles,
    emojis,
    stickers,
    iconData,
    currentIconFile,
    bannerData,
    currentBannerFile,
    description,
  ]);

  // Determine if current category needs save button
  const categoryNeedsSave = ['account', 'general', 'roles', 'emojis', 'stickers'].includes(selectedCategory);

  return (
    <>
      <Modal
        title=""
        visible={true}
        onClose={(isSaving || spaceProfile.isSaving || mentionSettings.isSaving) ? undefined : dismiss}
        size="large"
        className="modal-complex-wrapper"
        hideClose={false}
        noPadding={true}
        closeOnBackdropClick={!(isSaving || spaceProfile.isSaving || mentionSettings.isSaving)}
        closeOnEscape={!(isSaving || spaceProfile.isSaving || mentionSettings.isSaving)}
      >
        <div className="modal-complex-container-inner relative">
          {/* Loading overlay for saving */}
          <ModalSaveOverlay visible={isSaving || (selectedCategory === 'account' && (spaceProfile.isSaving || mentionSettings.isSaving))} />

          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="modal-complex-layout-with-footer">
              <Navigation
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                spaceId={spaceId}
              />

              <div className="modal-complex-content-with-footer">
                {(() => {
                  switch (selectedCategory) {
                    case 'account':
                      return (
                        <Account
                          spaceId={spaceId}
                          displayName={spaceProfile.displayName}
                          setDisplayName={spaceProfile.setDisplayName}
                          currentPasskeyInfo={user?.currentPasskeyInfo || null}
                          fileData={spaceProfile.fileData}
                          currentFile={spaceProfile.currentFile}
                          avatarFileError={spaceProfile.avatarFileError}
                          isAvatarUploading={spaceProfile.isAvatarUploading}
                          isAvatarDragActive={spaceProfile.isAvatarDragActive}
                          getRootProps={spaceProfile.getRootProps}
                          getInputProps={spaceProfile.getInputProps}
                          clearFileError={spaceProfile.clearFileError}
                          getProfileImageUrl={spaceProfile.getProfileImageUrl}
                          onSave={spaceProfile.onSave}
                          isSaving={spaceProfile.isSaving}
                          hasValidationError={spaceProfile.hasValidationError}
                          onClose={dismiss}
                          roles={roles}
                          selectedMentionTypes={mentionSettings.selectedTypes}
                          setSelectedMentionTypes={mentionSettings.setSelectedTypes}
                          isMentionSettingsLoading={mentionSettings.isLoading}
                        />
                      );
                    case 'general':
                      return (
                        <General
                          space={space}
                          spaceName={spaceName}
                          setSpaceName={setSpaceName}
                          description={description}
                          setDescription={setDescription}
                          descriptionErrors={descriptionErrors}
                          maxDescriptionLength={MAX_DESCRIPTION_LENGTH}
                          // set 'owner-membership' to 'true' to see in frontend
                          fixes={(missingOwnerMembership ? [{
                            id: 'owner-membership',
                            message: t`You're not listed in this Space's members. Correcting this will add you to the Space Members list (stores your profile locally with your inbox address).`,
                            actionLabel: t`Fix`,
                            onFix: addOwnerToMembers,
                            loading: addingOwner,
                          }] : []).concat([{ id: 'sync-kicked', message: t`Update kick records for all members. Use this if kicked users still appear active to some members.`, actionLabel: t`Sync Kick Status`, onFix: handleSyncKicked, loading: syncingKicks }])}
                          iconData={iconData}
                          currentIconFile={currentIconFile}
                          iconFileError={iconFileError}
                          isIconUploading={isIconUploading}
                          isIconDragActive={isIconDragActive}
                          getIconRootProps={getIconRootProps}
                          getIconInputProps={getIconInputProps}
                          clearIconFileError={clearIconFileError}
                          bannerData={bannerData}
                          currentBannerFile={currentBannerFile}
                          bannerFileError={bannerFileError}
                          isBannerUploading={isBannerUploading}
                          isBannerDragActive={isBannerDragActive}
                          getBannerRootProps={getBannerRootProps}
                          getBannerInputProps={getBannerInputProps}
                          clearBannerFileError={clearBannerFileError}
                          defaultChannel={defaultChannel}
                          setDefaultChannel={setDefaultChannel}
                          getChannelGroups={getChannelGroups}
                          isRepudiable={isRepudiable}
                          setIsRepudiable={setIsRepudiable}
                          saveEditHistory={saveEditHistory}
                          setSaveEditHistory={setSaveEditHistory}
                          onSave={saveChanges}
                          isSaving={isSaving}
                          hasValidationError={!!validateSpaceName(spaceName)}
                        />
                      );
                    case 'roles':
                      return (
                        <Roles
                          roles={roles}
                          addRole={addRole}
                          deleteRole={deleteRole}
                          updateRoleTag={updateRoleTag}
                          updateRoleDisplayName={updateRoleDisplayName}
                          updateRolePermissions={updateRolePermissions}
                          toggleRolePublic={toggleRolePublic}
                          roleValidationError={roleValidationError}
                          onSave={saveChanges}
                          isSaving={isSaving}
                        />
                      );
                    case 'emojis':
                      return (
                        <Emojis
                          emojis={emojis}
                          canAddMoreEmojis={canAddMoreEmojis}
                          emojiFileError={emojiFileError}
                          getEmojiRootProps={getEmojiRootProps}
                          getEmojiInputProps={getEmojiInputProps}
                          clearEmojiFileError={clearEmojiFileError}
                          updateEmoji={updateEmoji}
                          removeEmoji={removeEmoji}
                          onSave={saveChanges}
                          isSaving={isSaving}
                        />
                      );
                    case 'stickers':
                      return (
                        <Stickers
                          stickers={stickers}
                          canAddMoreStickers={canAddMoreStickers}
                          stickerFileError={stickerFileError}
                          getStickerRootProps={getStickerRootProps}
                          getStickerInputProps={getStickerInputProps}
                          clearStickerFileError={clearStickerFileError}
                          updateSticker={updateSticker}
                          removeSticker={removeSticker}
                          onSave={saveChanges}
                          isSaving={isSaving}
                        />
                      );
                    case 'invites':
                      return (
                        <Invites
                          space={space}
                          selectedUser={selectedUser}
                          setSelectedUser={setSelectedUser}
                          manualAddress={manualAddress}
                          setManualAddress={setManualAddress}
                          resolvedUser={resolvedUser}
                          getUserOptions={getUserOptions}
                          sendingInvite={sendingInvite}
                          invite={invite}
                          success={success}
                          membershipWarning={membershipWarning}
                          generating={generating}
                          generationSuccess={generationSuccess}
                          errorMessage={errorMessage}
                          setShowGenerateModal={setShowGenerateModal}
                        />
                      );
                    case 'danger':
                      return (
                        <Danger
                          space={space}
                          handleDeleteSpace={handleDeleteSpace}
                          deleteConfirmationStep={deleteConfirmationStep}
                          setDeleteConfirmationStep={setDeleteConfirmationStep}
                          deleteError={deleteError}
                          clearDeleteError={clearDeleteError}
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
                        autoClose={5}
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
                    onClick={selectedCategory === 'account' ? handleAccountSave : saveChanges}
                    disabled={
                      selectedCategory === 'account'
                        ? spaceProfile.isSaving || spaceProfile.hasValidationError || mentionSettings.isSaving
                        : isSaving || (!!validateSpaceName(spaceName) && selectedCategory === 'general') || (descriptionErrors.length > 0 && selectedCategory === 'general')
                    }
                  >
                    {t`Save Changes`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Confirmation modals for invite management */}
      {showGenerateModal && (
        <ConfirmationModal
          visible={showGenerateModal}
          title={t`Generate Public Invite Link`}
          message={
            space?.inviteUrl
              ? t`This will generate a new public invite link and invalidate the current one. Anyone with the old link will no longer be able to use it.`
              : t`This will create a public invite link that anyone can use to join your Space. Consider who you share this link with.`
          }
          confirmText={space?.inviteUrl ? t`Generate New Link` : t`Generate Link`}
          onConfirm={async () => {
            setShowGenerateModal(false);
            setErrorMessage('');
            try {
              await generateNewInviteLink();
              setGenerationSuccess(true);
              setTimeout(() => setGenerationSuccess(false), 3000);
            } catch (error) {
              setErrorMessage(t`Failed to generate invite link. Please try again.`);
            }
          }}
          onCancel={() => setShowGenerateModal(false)}
        />
      )}

      {/* Role deletion confirmation modal */}
      {deleteConfirmation?.modalConfig && (
        <ConfirmationModal
          visible={deleteConfirmation.showModal}
          title={deleteConfirmation.modalConfig.title}
          message={deleteConfirmation.modalConfig.message}
          preview={deleteConfirmation.modalConfig.preview}
          confirmText={deleteConfirmation.modalConfig.confirmText}
          cancelText={deleteConfirmation.modalConfig.cancelText}
          variant={deleteConfirmation.modalConfig.variant}
          onConfirm={deleteConfirmation.modalConfig.onConfirm}
          onCancel={deleteConfirmation.modalConfig.onCancel}
        />
      )}
    </>
  );
};

export default SpaceSettingsModal;