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
import { Channel } from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQueryClient } from '@tanstack/react-query';
import { buildSpaceMembersKey } from '../../../hooks';
import {
  useSpaceManagement,
  useRoleManagement,
  useSpaceFileUploads,
  useCustomAssets,
  useInviteManagement,
  useModalSaveState,
} from '../../../hooks';
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
  const [syncingKicks, setSyncingKicks] = React.useState<boolean>(false);
  const handleSyncKicked = React.useCallback(async () => {
    if (!space) return;
    setSyncingKicks(true);
    try {
      const count = await sendVerifyKickedStatuses(space.spaceId);
      if (count > 0) {
        // Optionally, request a members sync shortly after
        await requestSync(space.spaceId);
        if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
          (window as any).dispatchEvent(
            new CustomEvent('quorum:toast', {
              detail: {
                message: `Updated records for ${count} users that have been kicked.`,
                variant: 'success',
              },
            })
          );
        }
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

  // Default channel state
  const [defaultChannel, setDefaultChannel] = React.useState<Channel | undefined>(
    space?.groups
      ?.find((g) =>
        g.channels.find((c) => c.channelId === space.defaultChannelId)
      )
      ?.channels.find((c) => c.channelId === space.defaultChannelId)
  );

  // Space management hook
  const {
    spaceName,
    setSpaceName,
    selectedCategory,
    setSelectedCategory,
    isRepudiable,
    setIsRepudiable,
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
        iconUrl,
        bannerUrl,
        roles,
        emojis,
        stickers,
      });
    });
  }, [
    saveUntilComplete,
    updateSpace,
    space,
    spaceName,
    defaultChannel,
    isRepudiable,
    roles,
    emojis,
    stickers,
    iconData,
    currentIconFile,
    bannerData,
    currentBannerFile,
  ]);

  // Determine if current category needs save button
  const categoryNeedsSave = ['general', 'roles', 'emojis', 'stickers'].includes(selectedCategory);

  return (
    <>
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
                          space={space}
                          spaceName={spaceName}
                          setSpaceName={setSpaceName}
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
                          onSave={saveChanges}
                          isSaving={isSaving}
                          hasValidationError={!spaceName.trim()}
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
                    onClick={saveChanges}
                    disabled={isSaving || !spaceName.trim()}
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