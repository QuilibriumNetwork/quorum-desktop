import * as React from 'react';
import {
  Button,
  Select,
  Modal,
  Switch,
  Input,
  Icon,
  Tooltip,
  Spacer,
  ScrollContainer,
  Callout,
} from '../primitives';
import ConfirmationModal from '../modals/ConfirmationModal';
import { useSpace } from '../../hooks';
import { useSpaceMembers } from '../../hooks/queries/spaceMembers/useSpaceMembers';
import { useMessageDB } from '../context/useMessageDB';
import { Channel, Permission } from '../../api/quorumApi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import ClickToCopyContent from '../ClickToCopyContent';
import ReactTooltip from '../ReactTooltip';
import {
  useSpaceManagement,
  useRoleManagement,
  useSpaceFileUploads,
  useCustomAssets,
  useInviteManagement,
} from '../../hooks';
import '../../styles/_modal_common.scss';

const SpaceEditor: React.FunctionComponent<{
  spaceId: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, dismiss }) => {
  const { data: space } = useSpace({ spaceId });
  const { data: spaceMembers } = useSpaceMembers({ spaceId });
  const { updateSpace } = useMessageDB();

  // Default channel state
  const [defaultChannel, setDefaultChannel] = React.useState<Channel>(
    space?.groups
      .find((g) =>
        g.channels.find((c) => c.channelId === space.defaultChannelId)
      )
      ?.channels.find((c) => c.channelId === space.defaultChannelId)!
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

  // Space name and repudiability are now synced in useSpaceManagement hook

  // Delete confirmation state - kept local as it's UI-specific
  const [deleteConfirmationStep, setDeleteConfirmationStep] = React.useState(0);

  // Role validation error state
  const [roleValidationError, setRoleValidationError] =
    React.useState<string>('');

  // Saving state for loading indicator
  const [isSaving, setIsSaving] = React.useState(false);

  // Public invite link state management (simplified approach)
  const [generationSuccess, setGenerationSuccess] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deletionSuccess, setDeletionSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [showGenerateModal, setShowGenerateModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);

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

  // Handler for generating public invite link (with modal)
  const handleGenerateLink = React.useCallback(async () => {
    setShowGenerateModal(false); // Close modal first

    try {
      setErrorMessage('');
      setGenerationSuccess(false);
      await generateNewInviteLink();

      // Show success
      setGenerationSuccess(true);
      setTimeout(() => setGenerationSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      setErrorMessage('Failed to generate public invite link. Please try again.');
    }
  }, [generateNewInviteLink]);

  // Handler for regenerating link (with modal confirmation)
  const handleRegenerateLink = React.useCallback(async () => {
    setShowGenerateModal(false);

    try {
      setErrorMessage('');
      setGenerationSuccess(false);
      await generateNewInviteLink();

      // Show success
      setGenerationSuccess(true);
      setTimeout(() => setGenerationSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      setErrorMessage('Failed to generate public invite link. Please try again.');
    }
  }, [generateNewInviteLink]);

  // Handler for deleting public invite link
  const handleDeleteLink = React.useCallback(async () => {
    setShowDeleteModal(false);

    if (!space) {
      setErrorMessage('Space not found. Please try again.');
      return;
    }

    try {
      setErrorMessage('');
      setDeleting(true);

      await updateSpace({
        ...space,
        inviteUrl: '',
        isPublic: false,
      });
      // Show success
      setDeletionSuccess(true);
      setTimeout(() => setDeletionSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to delete invite link:', error);
      setErrorMessage('Failed to delete public invite link. Please try again.');
    } finally {
      setDeleting(false);
    }
  }, [space, updateSpace]);

  // Custom save function that integrates all hooks
  const saveChanges = React.useCallback(async () => {
    if (!space) return;

    setIsSaving(true);
    // Clear previous validation errors
    setRoleValidationError('');

    // Validate roles before saving
    const emptyRoles = roles.filter(
      (role) => !role.roleTag.trim() || !role.displayName.trim()
    );

    if (emptyRoles.length > 0) {
      setRoleValidationError(
        t`All roles must have both a tag name and display name.`
      );
      setIsSaving(false);
      return;
    }

    // Prepare all the data from our hooks
    const iconUrl =
      iconData && currentIconFile
        ? 'data:' +
          currentIconFile.type +
          ';base64,' +
          Buffer.from(iconData).toString('base64')
        : space.iconUrl;

    const bannerUrl =
      bannerData && currentBannerFile
        ? 'data:' +
          currentBannerFile.type +
          ';base64,' +
          Buffer.from(bannerData).toString('base64')
        : space.bannerUrl;

    // Use the original updateSpace call with all our hook data
    try {
      await updateSpace({
        ...space,
        spaceName,
        defaultChannelId: defaultChannel.channelId,
        isRepudiable,
        iconUrl,
        bannerUrl,
        roles,
        emojis,
        stickers,
      });
      setIsSaving(false);
      dismiss();
    } catch (error) {
      console.error('Failed to save space changes:', error);
      setIsSaving(false);
      // Don't dismiss the modal if save failed
    }
  }, [
    space,
    spaceName,
    defaultChannel,
    isRepudiable,
    iconData,
    currentIconFile,
    bannerData,
    currentBannerFile,
    roles,
    emojis,
    stickers,
    updateSpace,
    dismiss,
    setIsSaving,
  ]);

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
        {/* Loading overlay for saving */}
        {isSaving && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-lg" />
            <div className="relative flex items-center gap-3">
              <Icon name="spinner" size={24} spin className="text-accent" />
              <div className="text-lg font-medium text-white">{t`Saving...`}</div>
            </div>
          </div>
        )}
        <div className="modal-complex-layout">
          <div className="modal-complex-sidebar">
            <div className="modal-nav-title">Settings</div>
            <div
              onClick={() => setSelectedCategory('general')}
              className={`modal-nav-category ${selectedCategory === 'general' ? 'active' : ''}`}
            >
              <Icon name="cog" className="mr-2 text-accent" />
              <Trans>General</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('roles')}
              className={`modal-nav-category ${selectedCategory === 'roles' ? 'active' : ''}`}
            >
              <Icon name="users" className="mr-2 text-accent" />
              <Trans>Roles</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('emojis')}
              className={`modal-nav-category ${selectedCategory === 'emojis' ? 'active' : ''}`}
            >
              <Icon name="smile" className="mr-2 text-accent" />
              <Trans>Emojis</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('stickers')}
              className={`modal-nav-category ${selectedCategory === 'stickers' ? 'active' : ''}`}
            >
              <Icon name="image" className="mr-2 text-accent" />
              <Trans>Stickers</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('invites')}
              className={`modal-nav-category ${selectedCategory === 'invites' ? 'active' : ''}`}
            >
              <Icon name="envelope" className="mr-2 text-accent" />
              <Trans>Invites</Trans>
            </div>
            {((spaceMembers && spaceMembers.length === 1) ||
              space?.groups?.length === 0) && (
              <div
                onClick={() => setSelectedCategory('danger')}
                className={`modal-nav-category text-danger ${selectedCategory === 'danger' ? 'active' : ''}`}
              >
                <Icon
                  name="exclamation-triangle"
                  className="mr-2 text-accent"
                />
                <Trans>Delete Space</Trans>
              </div>
            )}
          </div>

          {/* Mobile 2-Column Menu */}
          <div className="modal-nav-mobile-2col">
            <div
              onClick={() => setSelectedCategory('general')}
              className={`modal-nav-category ${selectedCategory === 'general' ? 'active' : ''}`}
            >
              <Icon name="cog" className="mr-2 text-accent" />
              <Trans>General</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('stickers')}
              className={`modal-nav-category ${selectedCategory === 'stickers' ? 'active' : ''}`}
            >
              <Icon name="image" className="mr-2 text-accent" />
              <Trans>Stickers</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('roles')}
              className={`modal-nav-category ${selectedCategory === 'roles' ? 'active' : ''}`}
            >
              <Icon name="users" className="mr-2 text-accent" />
              <Trans>Roles</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('invites')}
              className={`modal-nav-category ${selectedCategory === 'invites' ? 'active' : ''}`}
            >
              <Icon name="envelope" className="mr-2 text-accent" />
              <Trans>Invites</Trans>
            </div>
            <div
              onClick={() => setSelectedCategory('emojis')}
              className={`modal-nav-category ${selectedCategory === 'emojis' ? 'active' : ''}`}
            >
              <Icon name="smile" className="mr-2 text-accent" />
              <Trans>Emojis</Trans>
            </div>
            {((spaceMembers && spaceMembers.length === 1) ||
              space?.groups?.length === 0) && (
              <div
                onClick={() => setSelectedCategory('danger')}
                className={`modal-nav-category text-danger ${selectedCategory === 'danger' ? 'active' : ''}`}
              >
                <Icon
                  name="exclamation-triangle"
                  className="mr-2 text-accent"
                />
                <Trans>Delete Space</Trans>
              </div>
            )}
          </div>
          <div className="modal-complex-content">
            {(() => {
              switch (selectedCategory) {
                case 'general':
                  return (
                    <>
                      <div className="modal-content-header">
                        <div
                          id="space-icon-tooltip-target"
                          className={`avatar-upload ${!iconData && !space?.iconUrl ? 'empty' : ''}`}
                          style={
                            (iconData && currentIconFile) || space?.iconUrl
                              ? {
                                  backgroundImage:
                                    iconData != undefined && currentIconFile
                                      ? 'url(data:' +
                                        currentIconFile.type +
                                        ';base64,' +
                                        Buffer.from(iconData).toString(
                                          'base64'
                                        ) +
                                        ')'
                                      : `url(${space?.iconUrl})`,
                                }
                              : {}
                          }
                          {...getIconRootProps()}
                        >
                          <input {...getIconInputProps()} />
                          {!iconData && !space?.iconUrl && (
                            <Icon name="image" className="icon" />
                          )}
                        </div>
                        {!isIconUploading && !isIconDragActive && (
                          /* Keep ReactTooltip for file upload area - Tooltip primitive conflicts with react-dropzone */
                          <ReactTooltip
                            id="space-icon-tooltip"
                            content="Upload an avatar for this Space - PNG or JPG, Max 1MB, Optimal size 123×123px"
                            place="bottom"
                            className="!w-[400px]"
                            anchorSelect="#space-icon-tooltip-target"
                          />
                        )}
                        <div className="modal-text-section mt-4">
                          <Input
                            className="w-full md:w-80 modal-input-text"
                            value={spaceName}
                            onChange={setSpaceName}
                            label={t`Space Name`}
                            labelType="static"
                          />
                        </div>
                      </div>
                      <div className="modal-content-section">
                        <Spacer size="md" direction="vertical" borderTop={true} />
                        <div className="modal-text-label">
                          <Trans>Space Banner</Trans>
                        </div>
                        <div className="modal-content-info">
                          <div
                            id="space-banner-tooltip-target"
                            className={
                              'modal-banner-editable ' +
                              (space?.bannerUrl || currentBannerFile
                                ? ''
                                : 'border-2 border-dashed border-accent-200')
                            }
                            style={{
                              backgroundImage:
                                bannerData != undefined && currentBannerFile
                                  ? 'url(data:' +
                                    currentBannerFile.type +
                                    ';base64,' +
                                    Buffer.from(bannerData).toString('base64') +
                                    ')'
                                  : `url(${space?.bannerUrl})`,
                            }}
                            {...getBannerRootProps()}
                          >
                            <input {...getBannerInputProps()} />
                          </div>
                          {!isBannerUploading && !isBannerDragActive && (
                            /* Keep ReactTooltip for file upload area - Tooltip primitive conflicts with react-dropzone */
                            <ReactTooltip
                              id="space-banner-tooltip"
                              content="Upload a banner for this Space - PNG or JPG, Max 1MB, Optimal size 450×180px"
                              place="bottom"
                              className="!w-[400px]"
                              anchorSelect="#space-banner-tooltip-target"
                            />
                          )}
                          {(iconFileError || bannerFileError) && (
                            <div className="mt-4 space-y-2">
                              {iconFileError && (
                                <div className="error-label flex items-center justify-between">
                                  <span>{iconFileError}</span>
                                  <Icon
                                    name="times"
                                    className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                                    onClick={clearIconFileError}
                                  />
                                </div>
                              )}
                              {bannerFileError && (
                                <div className="error-label flex items-center justify-between">
                                  <span>{bannerFileError}</span>
                                  <Icon
                                    name="times"
                                    className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                                    onClick={clearBannerFileError}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Spacer size="md" direction="vertical" borderTop={true} />
                        <div className="modal-text-label">
                          <Trans>Default Channel</Trans>
                        </div>
                        <div className="modal-content-info">
                          <Select
                            fullWidth
                            groups={getChannelGroups}
                            value={defaultChannel?.channelId || ''}
                            onChange={(channelId: string) => {
                              const channel = space?.groups
                                .flatMap((g) => g.channels)
                                .find((c) => c.channelId === channelId);
                              if (channel) {
                                setDefaultChannel(channel);
                              }
                            }}
                            placeholder={t`Select default channel`}
                            style={{ textAlign: 'left' }}
                          />
                        </div>
                        <Spacer size="md" direction="vertical" borderTop={true} />
                        <div className="modal-text-label">
                          <Trans>Privacy Settings</Trans>
                        </div>
                        <div className="modal-content-info">
                          <div className="flex flex-row justify-between">
                            <div className="flex flex-row items-center">
                              <div className="modal-text-small text-main">
                                <Trans>Require Message Signing</Trans>
                              </div>
                              <Tooltip
                                id="repudiability-tooltip"
                                content={t`Require messages sent in this Space to be signed by the sender. Technically speaking, this makes the messages in this Space non-repudiable.`}
                                place="bottom"
                                className="!w-[400px]"
                                maxWidth={400}
                              >
                                <Icon
                                  name="info-circle"
                                  className="text-main hover:text-strong cursor-pointer ml-2"
                                />
                              </Tooltip>
                            </div>
                            <Switch
                              onChange={() => setIsRepudiable(!isRepudiable)}
                              value={!isRepudiable}
                            />
                          </div>
                        </div>
                        <div className="modal-content-actions">
                          <Button
                            type="primary"
                            onClick={() => saveChanges()}
                            disabled={isSaving}
                          >
                            <Trans>Save All Changes</Trans>
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                case 'roles':
                  return (
                    <>
                      <div className="modal-content-header">
                        <div className="modal-text-section">
                          <div className="text-xl font-bold">
                            <Trans>Roles</Trans>
                          </div>
                          <div className="pt-2 text-sm text-main">
                            <Trans>
                              Click on the role name and tag to edit them.
                            </Trans>
                          </div>
                        </div>
                      </div>
                      <div className="modal-content-section">
                        <div className="flex mb-4">
                          <Button
                            type="secondary"
                            className="!w-auto !inline-flex"
                            onClick={addRole}
                          >
                            <Trans>Add Role</Trans>
                          </Button>
                        </div>
                        {roles.length > 0 && (
                          <ScrollContainer height="md">
                            {roles.map((r, i) => {
                            return (
                              <div
                                key={'space-editor-role-' + i}
                                className="modal-list-item text-main px-3"
                              >
                                <div
                                  className="flex flex-col gap-4 py-4 sm:grid sm:grid-cols-[1fr_1fr_auto]"
                                >
                                  {/* Cell 1: Role tag and name */}
                                  <div className="flex flex-col">
                                    <div>
                                      @
                                      <input
                                        className="border-0 bg-[rgba(0,0,0,0)] pr-2 outline-none focus:bg-surface-1 focus:px-2 focus:py-1 focus:rounded transition-all font-mono"
                                        style={{
                                          width:
                                            (roles.find((_, pi) => i == pi)
                                              ?.roleTag.length ?? 0) *
                                              11 +
                                            11 +
                                            'px',
                                        }}
                                        onChange={(e) =>
                                          updateRoleTag(i, e.target.value)
                                        }
                                        value={r.roleTag}
                                      />
                                    </div>
                                    <div className="mt-1">
                                      <span
                                        className="font-mono modal-role"
                                        style={{ backgroundColor: r.color }}
                                      >
                                        <input
                                          className="border-0 bg-[rgba(0,0,0,0)] outline-none focus:bg-[rgba(0,0,0,0.1)] focus:px-2 focus:py-1 focus:rounded transition-all"
                                          style={{
                                            width:
                                              Math.max(
                                                (r.displayName.length || 3) * 8,
                                                60
                                              ) + 'px',
                                          }}
                                          onChange={(e) =>
                                            updateRoleDisplayName(
                                              i,
                                              e.target.value
                                            )
                                          }
                                          value={r.displayName}
                                        />
                                      </span>
                                    </div>
                                  </div>

                                  {/* Cell 2: Permissions */}
                                  <div className="flex flex-col">
                                    <div className="text-sm font-normal">
                                      <Trans>Permissions:</Trans>
                                    </div>
                                    <div className="mt-1">
                                      <Select
                                        multiple
                                        variant="bordered"
                                        value={
                                          roles.find((_, pi) => i == pi)
                                            ?.permissions || []
                                        }
                                        onChange={(selectedPermissions: string | string[]) =>
                                          updateRolePermissions(
                                            i,
                                            selectedPermissions as Permission[]
                                          )
                                        }
                                        placeholder={t`Select permissions`}
                                        width="200px"
                                        options={[
                                          {
                                            value: 'message:delete',
                                            label: t`Delete Messages`,
                                          },
                                          {
                                            value: 'message:pin',
                                            label: t`Pin Messages`,
                                          },
                                          {
                                            value: 'user:kick',
                                            label: t`Kick Users`,
                                          },
                                        ]}
                                      />
                                    </div>
                                  </div>

                                  {/* Cell 3: Delete button */}
                                  <div className="flex flex-col">
                                    <div className="flex justify-start sm:justify-end">
                                      <Tooltip
                                        id={`delete-role-${i}`}
                                        content={t`Delete Role`}
                                        place="left"
                                        showOnTouch={false}
                                      >
                                        <Icon
                                          name="trash"
                                          className="cursor-pointer text-danger hover:text-danger-hover"
                                          onClick={(e) => deleteRole(e, i)}
                                        />
                                      </Tooltip>
                                    </div>
                                    <div className="mt-1">
                                      {/* Empty space for alignment */}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                          </ScrollContainer>
                        )}
                        {roleValidationError && (
                          <div
                            className="mt-4 text-sm"
                            style={{ color: 'var(--color-text-danger)' }}
                          >
                            {roleValidationError}
                          </div>
                        )}
                        <div className="modal-content-info"></div>
                        <div className="modal-content-actions">
                          <Button
                            type="primary"
                            onClick={() => saveChanges()}
                            disabled={isSaving}
                          >
                            <Trans>Save All Changes</Trans>
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                case 'emojis':
                  return (
                    <>
                      <div className="modal-content-header">
                        <div className="modal-text-section">
                          <div className="text-xl font-bold">
                            <Trans>Emojis</Trans>
                          </div>
                          <div className="pt-2 text-sm text-main">
                            <Trans>
                              Add up to 50 custom emoji. Custom emojis can only
                              be used within a Space. You can upload PNG, JPG or
                              GIF, max 256kB.
                            </Trans>
                          </div>
                        </div>
                      </div>
                      <div className="modal-content-section">
                        <div className="flex">
                          {canAddMoreEmojis && (
                            <div
                              className="btn-secondary"
                              {...getEmojiRootProps()}
                            >
                              <Trans>Upload Emoji</Trans>
                              <input {...getEmojiInputProps()} />
                            </div>
                          )}
                        </div>
                        {emojiFileError && (
                          <Callout variant="error" size="sm" className="mt-2">
                            <div className="flex items-center justify-between">
                              <span>{emojiFileError}</span>
                              <Icon
                                name="times"
                                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                                onClick={clearEmojiFileError}
                              />
                            </div>
                          </Callout>
                        )}
                        {emojis.length > 0 && (
                          <ScrollContainer height="md" className="mt-4">
                            {emojis.map((em, i) => {
                            return (
                              <div
                                key={'space-editor-emoji-' + i}
                                className="modal-list-item text-main flex flex-row px-3 py-2 items-center"
                              >
                                <img width="24" height="24" src={em.imgUrl} className="rounded-md" />
                                <div className="flex flex-col justify-around font-mono font-medium mx-2">
                                  <span>
                                    <input
                                      className="border-0 bg-[rgba(0,0,0,0)] max-w-48 truncate outline-none focus:bg-surface-1 focus:px-2 focus:py-1 focus:rounded transition-all"
                                      title={em.name}
                                      onChange={(e) => {
                                        const sanitizedName = e.target.value
                                          .toLowerCase()
                                          .replace(/[^a-z0-9\_]/gi, '');
                                        updateEmoji(i, { name: sanitizedName });
                                      }}
                                      value={em.name}
                                    />
                                  </span>
                                </div>
                                <div className="flex flex-col grow justify-around items-end">
                                  <Tooltip
                                    id={`delete-emoji-${i}`}
                                    content={t`Delete`}
                                    place="left"
                                    showOnTouch={false}
                                  >
                                    <Icon
                                      name="trash"
                                      className="cursor-pointer text-danger hover:text-danger-hover"
                                      onClick={() => removeEmoji(i)}
                                    />
                                  </Tooltip>
                                </div>
                              </div>
                              );
                            })}
                          </ScrollContainer>
                        )}
                        <div className="modal-content-info"></div>
                        <div className="modal-content-actions">
                          <Button
                            type="primary"
                            onClick={() => saveChanges()}
                            disabled={isSaving}
                          >
                            <Trans>Save All Changes</Trans>
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                case 'stickers':
                  return (
                    <>
                      <div className="modal-content-header">
                        <div className="modal-text-section">
                          <div className="text-xl font-bold">
                            <Trans>Stickers</Trans>
                          </div>
                          <div className="pt-2 text-sm text-main">
                            <Trans>
                              Add up to 50 custom stickers. Custom stickers can
                              only be used within a Space. You can upload PNG,
                              JPG or GIF, max 256kB.
                            </Trans>
                          </div>
                        </div>
                      </div>
                      <div className="modal-content-section">
                        <div className="flex">
                          {canAddMoreStickers && (
                            <div
                              className="btn-secondary"
                              {...getStickerRootProps()}
                            >
                              <Trans>Upload Sticker</Trans>
                              <input {...getStickerInputProps()} />
                            </div>
                          )}
                        </div>
                        {stickerFileError && (
                          <Callout variant="error" size="sm" className="mt-2">
                            <div className="flex items-center justify-between">
                              <span>{stickerFileError}</span>
                              <Icon
                                name="times"
                                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                                onClick={clearStickerFileError}
                              />
                            </div>
                          </Callout>
                        )}
                        {stickers.length > 0 && (
                          <ScrollContainer height="md" className="mt-4">
                            {stickers.map((em, i) => {
                            return (
                              <div
                                key={'space-editor-sticker-' + i}
                                className="modal-list-item text-main flex flex-row px-3 py-2 items-center"
                              >
                                <img width="72" height="72" src={em.imgUrl} className="rounded-md" />
                                <div className="flex flex-col justify-around font-mono font-medium mx-2">
                                  <span>
                                    <input
                                      className="border-0 bg-[rgba(0,0,0,0)] max-w-48 truncate outline-none focus:bg-surface-1 focus:px-2 focus:py-1 focus:rounded transition-all"
                                      title={em.name}
                                      onChange={(e) => {
                                        const sanitizedName = e.target.value
                                          .toLowerCase()
                                          .replace(/[^a-z0-9\_]/gi, '');
                                        updateSticker(i, {
                                          name: sanitizedName,
                                        });
                                      }}
                                      value={em.name}
                                    />
                                  </span>
                                </div>
                                <div className="flex flex-col grow justify-around items-end">
                                  <Tooltip
                                    id={`delete-sticker-${i}`}
                                    content={t`Delete`}
                                    place="left"
                                    showOnTouch={false}
                                  >
                                    <Icon
                                      name="trash"
                                      className="cursor-pointer text-danger hover:text-danger-hover"
                                      onClick={() => removeSticker(i)}
                                    />
                                  </Tooltip>
                                </div>
                              </div>
                              );
                            })}
                          </ScrollContainer>
                        )}
                        <div className="modal-content-info"></div>
                        <div className="modal-content-actions">
                          <Button
                            type="primary"
                            onClick={() => saveChanges()}
                            disabled={isSaving}
                          >
                            <Trans>Save All Changes</Trans>
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                case 'invites':
                  return (
                    <>
                      <div className="modal-content-header">
                        <div className="modal-text-section">
                          <div className="text-xl font-bold">
                            <Trans>Invites</Trans>
                          </div>
                          <div className="pt-2 text-sm text-main">
                            <Trans>
                              Send invites to people you've previously had
                              conversations with. An invite button will appear
                              in their inbox.
                            </Trans>
                          </div>
                        </div>
                      </div>
                      <div className="modal-content-section">
                        <div className="flex"></div>
                        <div className=""></div>
                        <div className="modal-content-info">
                          <div className="input-style-label">
                            <Trans>Existing Conversations</Trans>
                          </div>
                          <Select
                            fullWidth
                            options={getUserOptions()}
                            value={selectedUser?.address || ''}
                            onChange={(address: string) => {
                              // Find conversation and set selected user
                              const allConversations = getUserOptions();
                              const conversation = allConversations.find(
                                (c) => c.value === address
                              );
                              if (conversation) {
                                setSelectedUser({
                                  address: conversation.value,
                                  displayName: conversation.label,
                                  icon: conversation.avatar,
                                } as any);
                                setManualAddress('');
                              }
                            }}
                            placeholder={t`Select conversation`}
                          />
                          <Spacer size="md"></Spacer>
                          <Input
                            className="w-full placeholder:text-sm"
                            value={manualAddress}
                            placeholder="Type the address of the user you want to send to"
                            onChange={setManualAddress}
                            label={t`Enter Address Manually`}
                            labelType="static"
                          />
                          {success && (
                            <div className="text-success">
                              <Trans>
                                Successfully sent invite to{' '}
                                {selectedUser?.displayName}
                              </Trans>
                            </div>
                          )}
                          <Spacer 
                            spaceBefore="lg" 
                            spaceAfter="md" 
                            border={true} 
                            direction="vertical" 
                          />
                          <div>
                            <div className="modal-text-label">
                              <Trans>Public Invite Links</Trans>
                            </div>

                            {/* Callouts for operations */}
                            {generating && (
                              <Callout variant="warning" size="sm" className="mb-4 mt-4">
                                <div className="flex items-center gap-2">
                                  <Icon name="spinner" spin={true} className="text-warning" />
                                  <span>Generating public invite link...</span>
                                </div>
                              </Callout>
                            )}

                            {generationSuccess && (
                              <Callout variant="success" size="sm" className="mb-4 mt-4" autoClose={3}>
                                <span>Public invite link generated successfully.</span>
                              </Callout>
                            )}

                            {deleting && (
                              <Callout variant="warning" size="sm" className="mb-4 mt-4">
                                <div className="flex items-center gap-2">
                                  <Icon name="spinner" spin={true} className="text-warning" />
                                  <span>Deleting public invite link...</span>
                                </div>
                              </Callout>
                            )}

                            {deletionSuccess && (
                              <Callout variant="success" size="sm" className="mb-4 mt-4" autoClose={3}>
                                <span>Public invite link deleted successfully.</span>
                              </Callout>
                            )}

                            {errorMessage && (
                              <Callout variant="error" size="sm" className="mb-4 mt-4">
                                <span>{errorMessage}</span>
                              </Callout>
                            )}

                            {!space?.inviteUrl && !generating ? (
                              // STATE 1: No link exists and not generating - Show generate button
                              <div className="mt-4">
                                <div className="text-sm text-subtle mb-4 max-w-[500px]">
                                  <Trans>
                                    Public invite links allow anyone with access to the link to join your Space.
                                    Consider who you share the link with and where you post it.
                                  </Trans>
                                </div>
                                <div className="flex">
                                  <Button
                                    type="secondary"
                                    onClick={() => setShowGenerateModal(true)}
                                    disabled={generating}
                                  >
                                    <Trans>Generate Public Invite Link</Trans>
                                  </Button>
                                </div>
                              </div>
                            ) : !space?.inviteUrl && generating ? (
                              // STATE 1b: Generating first link - Only show callout
                              null
                            ) : space?.inviteUrl && generating ? (
                              // STATE 2b: Regenerating link - Only show callout
                              null
                            ) : (
                              // STATE 2: Link exists and not generating - Show link + action buttons
                              <div className="mt-4">
                                <div className="flex pt-2 pb-1 items-center">
                                  <div className="input-style-label">
                                    <Trans>Current Invite Link</Trans>
                                  </div>
                                  <Tooltip
                                    id="current-invite-link-tooltip"
                                    content={t`This link will not expire, but you can generate a new one at any time, which will invalidate the old link.`}
                                    place="bottom"
                                    className="!w-[400px]"
                                    maxWidth={400}
                                  >
                                    <Icon
                                      name="info-circle"
                                      className="text-main hover:text-strong cursor-pointer ml-2"
                                    />
                                  </Tooltip>
                                </div>

                                <ClickToCopyContent
                                  text={space?.inviteUrl || ''}
                                  tooltipText={t`Copy invite link to clipboard`}
                                  className="bg-input border-0 rounded-md px-3 py-1.5 text-sm w-full max-w-full overflow-hidden whitespace-nowrap cursor-pointer"
                                  iconClassName="text-muted hover:text-main"
                                  copyOnContentClick
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <div className="truncate flex-1 text-subtle">
                                      {space?.inviteUrl}
                                    </div>
                                  </div>
                                </ClickToCopyContent>

                                <div className="flex gap-2 mt-4">
                                  <Button
                                    type="danger-outline"
                                    onClick={() => setShowDeleteModal(true)}
                                    disabled={generating || deleting}
                                  >
                                    <Trans>Delete Current Link</Trans>
                                  </Button>
                                  <Button
                                    type="secondary"
                                    onClick={() => setShowGenerateModal(true)}
                                    disabled={generating || deleting}
                                  >
                                    <Trans>Generate New Link</Trans>
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ marginBottom: '20px' }}></div>
                        <div className="modal-content-actions">
                          <Button
                            type="secondary"
                            disabled={
                              sendingInvite || (!selectedUser && !resolvedUser)
                            }
                            onClick={() => {
                              if (selectedUser) {
                                invite(selectedUser.address);
                              } else if (resolvedUser) {
                                invite(resolvedUser.user_address);
                              }
                            }}
                          >
                            <Trans>Send Invite</Trans>
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                case 'danger':
                  return (
                    <>
                      <div className="modal-content-header">
                        <div className="modal-text-section">
                          <div className="text-xl font-bold text-danger">
                            <Trans>Delete this space</Trans>
                          </div>
                          <div className="pt-2 text-sm text-main">
                            Are you sure you want to delete your '
                            {space?.spaceName}' space? This action cannot be
                            undone and will permanently remove all messages,
                            channels, and settings associated with this space.
                          </div>
                          <div className="pt-6">
                            <Button
                              type="danger-outline"
                              className="!w-auto !inline-flex"
                              onClick={() => {
                                if (deleteConfirmationStep === 0) {
                                  setDeleteConfirmationStep(1);
                                  // Reset confirmation after 5 seconds
                                  setTimeout(
                                    () => setDeleteConfirmationStep(0),
                                    5000
                                  );
                                } else {
                                  handleDeleteSpace();
                                }
                              }}
                            >
                              {deleteConfirmationStep === 0 ? (
                                <Trans>Delete Space</Trans>
                              ) : (
                                <Trans>Click again to confirm</Trans>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="modal-content-section">
                        <div className="modal-content-info"></div>
                      </div>
                    </>
                  );
              }
            })()}
          </div>
        </div>

      </div>

      {/* Role delete confirmation modal */}
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

      {/* Generate/Regenerate Modal */}
      <ConfirmationModal
        visible={showGenerateModal}
        title={!space?.inviteUrl ? t`Generate Public Invite Link` : t`Generate New Public Invite Link`}
        message={
          !space?.inviteUrl
            ? t`Are you sure you want to generate a public invite link?\nThis will permanently invalidate ALL previously sent private invite links.`
            : t`Are you sure you want to generate a new public invite link? Anyone with your old public invite link won't be able to join your Space anymore.`
        }
        confirmText={t`Confirm`}
        variant="danger"
        showProtip={false}
        onConfirm={!space?.inviteUrl ? handleGenerateLink : handleRegenerateLink}
        onCancel={() => setShowGenerateModal(false)}
      />

      {/* Delete Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title={t`Delete Public Invite Link`}
        message={t`Are you sure you want to delete the public invite link? Anyone with your current public invite link won't be able to join your Space anymore.`}
        confirmText={t`Delete`}
        variant="danger"
        showProtip={false}
        onConfirm={handleDeleteLink}
        onCancel={() => setShowDeleteModal(false)}
      />
    </Modal>
  );
};

export default SpaceEditor;
