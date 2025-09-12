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
import { useSpace } from '../../hooks';
import { useSpaceMembers } from '../../hooks/queries/spaceMembers/useSpaceMembers';
import { useMessageDB } from '../context/useMessageDB';
import { Channel } from '../../api/quorumApi';
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

  // Custom save function that integrates all hooks
  const saveChanges = React.useCallback(() => {
    if (!space) return;

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
    updateSpace({
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

    dismiss();
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
                          <div className="small-caps">
                            <Trans>Space Name</Trans>
                          </div>
                          <Input
                            className="w-full"
                            value={spaceName}
                            onChange={setSpaceName}
                          />
                        </div>
                      </div>
                      <div className="modal-content-section">
                        <div className="modal-content-section-header small-caps">
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
                        <div className="modal-content-section-header small-caps">
                          <Trans>Default Channel</Trans>
                        </div>
                        <div className="modal-content-info">
                          <Select
                            fullWidth
                            groups={getChannelGroups}
                            value={defaultChannel?.channelId || ''}
                            onChange={(channelId) => {
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
                        <div className="modal-content-section-header small-caps">
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
                          <Button type="primary" onClick={() => saveChanges()}>
                            <Trans>Save Changes</Trans>
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
                        {roles.map((r, i) => {
                          return (
                            <div
                              key={'space-editor-role-' + i}
                              className="modal-content-section-header text-main"
                            >
                              <div
                                className="grid gap-4 py-4"
                                style={{ gridTemplateColumns: '1fr 1fr auto' }}
                              >
                                {/* Cell 1: Role tag and name */}
                                <div className="flex flex-col">
                                  <div>
                                    @
                                    <input
                                      className="border-0 bg-[rgba(0,0,0,0)] pr-2 outline-none focus:bg-surface-1 focus:px-2 focus:py-1 focus:rounded transition-all"
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
                                      value={
                                        roles.find((_, pi) => i == pi)
                                          ?.permissions || []
                                      }
                                      onChange={(selectedPermissions) =>
                                        updateRolePermissions(
                                          i,
                                          selectedPermissions as string[]
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
                                  <div className="flex justify-end">
                                    <Tooltip
                                      id={`delete-role-${i}`}
                                      content={t`Delete Role`}
                                      place="left"
                                      showOnTouch={false}
                                    >
                                      <Icon
                                        name="trash"
                                        className="cursor-pointer text-danger-hex hover:text-danger-hover-hex"
                                        onClick={() => deleteRole(i)}
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
                          <Button type="primary" onClick={() => saveChanges()}>
                            <Trans>Save Changes</Trans>
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
                          <div className="mt-2">
                            <div className="error-label flex items-center justify-between">
                              <span>{emojiFileError}</span>
                              <Icon
                                name="times"
                                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                                onClick={clearEmojiFileError}
                              />
                            </div>
                          </div>
                        )}
                        <div className="pt-4">
                          {emojis.map((em, i) => {
                            return (
                              <div
                                key={'space-editor-emoji-' + i}
                                className="modal-content-section-header text-main flex flex-row"
                              >
                                <img width="24" height="24" src={em.imgUrl} />
                                <div className="flex flex-col justify-around font-mono font-medium mx-2">
                                  <span>
                                    <input
                                      className={
                                        'border-0 bg-[rgba(0,0,0,0)] max-w-48 truncate'
                                      }
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
                                  <Icon
                                    name="trash"
                                    className="cursor-pointer text-danger-hex hover:text-danger-hover-hex"
                                    onClick={() => removeEmoji(i)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="modal-content-info"></div>
                        <div className="modal-content-actions">
                          <Button type="primary" onClick={() => saveChanges()}>
                            <Trans>Save Changes</Trans>
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
                          <div className="mt-2">
                            <div className="error-label flex items-center justify-between">
                              <span>{stickerFileError}</span>
                              <Icon
                                name="times"
                                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                                onClick={clearStickerFileError}
                              />
                            </div>
                          </div>
                        )}
                        <div className="pt-4">
                          {stickers.map((em, i) => {
                            return (
                              <div
                                key={'space-editor-sticker-' + i}
                                className="modal-content-section-header text-main flex flex-row"
                              >
                                <img width="24" height="24" src={em.imgUrl} />
                                <div className="flex flex-col justify-around font-mono font-medium mx-2">
                                  <span>
                                    <input
                                      className={
                                        'border-0 bg-[rgba(0,0,0,0)] max-w-48 truncate'
                                      }
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
                                  <Icon
                                    name="trash"
                                    className="cursor-pointer text-danger-hex hover:text-danger-hover-hex"
                                    onClick={() => removeSticker(i)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="modal-content-info"></div>
                        <div className="modal-content-actions">
                          <Button type="primary" onClick={() => saveChanges()}>
                            <Trans>Save Changes</Trans>
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
                          <div className="small-caps">
                            <Trans>Existing Conversations</Trans>
                          </div>
                          <Select
                            fullWidth
                            options={getUserOptions()}
                            value={selectedUser?.address || ''}
                            onChange={(address) => {
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
                          <div className="small-caps mt-2">
                            <Trans>Enter Address Manually</Trans>
                          </div>
                          <Input
                            className="w-full"
                            value={manualAddress}
                            placeholder="Type the address of the user you want to send to"
                            onChange={setManualAddress}
                          />
                          {success && (
                            <div className="text-success-hex">
                              <Trans>
                                Successfully sent invite to{' '}
                                {selectedUser?.displayName}
                              </Trans>
                            </div>
                          )}
                          <div className="border-t border-strong mt-4 pt-4"></div>
                          <div className="flex flex-row justify-between">
                            <div className="text-sm flex flex-row justify-center">
                              <div className="text-lg flex flex-col justify-around">
                                <Trans>Public Invite Link</Trans>
                                <div className="text-sm flex flex-col justify-around pt-2 max-w-[500px]">
                                  <Trans>
                                    Public invite links allow anyone with access
                                    to the link join your Space. Understand the
                                    risks of enabling this, and to whom and
                                    where you share the link.
                                  </Trans>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col justify-center pt-2">
                              <Switch
                                onChange={setPublicInvite}
                                value={publicInvite}
                              />
                            </div>
                          </div>
                          {space?.isPublic && publicInvite && (
                            <div>
                              {space.inviteUrl && (
                                <>
                                  <div className="flex pt-2 pb-1 items-center">
                                    <div className="flex flex-row items-center">
                                      <div className="small-caps text-lg text-main">
                                        <Trans>Current Invite Link</Trans>
                                      </div>
                                      <Tooltip
                                        id="current-invite-link-tooltip"
                                        content={t`This link will not expire, but you can generate a new one at any time, which will invalidate the old link. Current Space members will not be removed from the Space.`}
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
                                  </div>
                                  {generating ? (
                                    <div className="bg-input border border-strong rounded-md px-3 py-1.5 text-sm w-full text-subtle">
                                      {t`Be patient, this can take a few seconds...`}
                                    </div>
                                  ) : (
                                    <ClickToCopyContent
                                      text={space.inviteUrl}
                                      tooltipText={t`Copy invite link to clipboard`}
                                      className="bg-input border-0 rounded-md px-3 py-1.5 text-sm w-full max-w-full overflow-hidden whitespace-nowrap cursor-pointer"
                                      iconClassName="text-muted hover:text-main"
                                      copyOnContentClick
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <div className="truncate flex-1 text-subtle">
                                          {space.inviteUrl}
                                        </div>
                                      </div>
                                    </ClickToCopyContent>
                                  )}
                                </>
                              )}

                              <div className="mt-4 flex flex-row">
                                <Button
                                  type="danger"
                                  disabled={generating}
                                  onClick={generateNewInviteLink}
                                >
                                  {generating ? (
                                    t`Generating link...`
                                  ) : (
                                    <Trans>Generate New Invite Link</Trans>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ marginBottom: '20px' }}></div>
                        <div className="modal-content-actions">
                          <Button
                            type="primary"
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
                              type="danger"
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
                        <div className="modal-content-actions"></div>
                      </div>
                    </>
                  );
              }
            })()}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SpaceEditor;
