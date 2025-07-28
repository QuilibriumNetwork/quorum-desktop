import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import {
  usePasskeysContext,
  channel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { useNavigate } from 'react-router';

import { useMessageDB } from '../context/MessageDB';
import '../../styles/_modal_common.scss';
import { Button, Select, Modal, Switch, Input, Icon, Tooltip } from '../primitives';
import { useConversations, useRegistration, useSpace } from '../../hooks';
import { useSpaceMembers } from '../../hooks/queries/spaceMembers/useSpaceMembers';
import {
  Channel,
  Emoji,
  Role,
  Sticker,
  Permission,
  Conversation,
} from '../../api/quorumApi';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { Loading } from '../Loading';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import ClickToCopyContent from '../ClickToCopyContent';
import ReactTooltip from '../ReactTooltip';
import { truncateAddress } from '../../utils';

const SpaceEditor: React.FunctionComponent<{
  spaceId: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, dismiss }) => {
  let { data: space } = useSpace({ spaceId });
  let [displayName, setDisplayName] = React.useState<string>(
    space?.spaceName || ''
  );
  let [selectedCategory, setSelectedCategory] =
    React.useState<string>('general');
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = React.useState<File | undefined>();
  const [bannerData, setBannerData] = React.useState<ArrayBuffer | undefined>();
  const [currentBannerFile, setCurrentBannerFile] = React.useState<File | undefined>();
  const [currentEmojiFile, setCurrentEmojiFile] = React.useState<File[] | undefined>();
  const [currentStickerFile, setCurrentStickerFile] = React.useState<File[] | undefined>();
  // Removed isDefaultChannelListExpanded - using Select primitive instead

  // Removed isInviteListExpanded - using Select primitive instead
  const [roles, setRoles] = React.useState<Role[]>(space?.roles || []);
  const [emojis, setEmojis] = React.useState<Emoji[]>(space?.emojis || []);
  const [stickers, setStickers] = React.useState<Sticker[]>(
    space?.stickers || []
  );
  const [defaultChannel, setDefaultChannel] = React.useState<Channel>(
    space?.groups
      .find((g) =>
        g.channels.find((c) => c.channelId === space.defaultChannelId)
      )
      ?.channels.find((c) => c.channelId === space.defaultChannelId)!
  );
  const { currentPasskeyInfo } = usePasskeysContext();
  const {
    updateSpace,
    ensureKeyForSpace,
    sendInviteToUser,
    generateNewInviteLink,
    deleteSpace,
  } = useMessageDB();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { keyset } = useRegistrationContext();
  const [selectedUser, setSelectedUser] = React.useState<Conversation>();
  const [success, setSuccess] = React.useState<boolean>(false);
  const [sendingInvite, setSendingInvite] = React.useState<boolean>(false);
  const [generating, setGenerating] = React.useState<boolean>(false);
  const [copied, setCopied] = React.useState(false);
  const [manualAddress, setManualAddress] = React.useState<string>('');
  const [resolvedUser, setResolvedUser] =
    React.useState<channel.UserRegistration>();
  const [isRepudiable, setIsRepudiable] = React.useState<boolean>(
    space?.isRepudiable || false
  );
  const { data: spaceMembers } = useSpaceMembers({ spaceId });
  const [deleteConfirmationStep, setDeleteConfirmationStep] = React.useState(0);
  const [iconFileError, setIconFileError] = React.useState<string | null>(null);
  const [bannerFileError, setBannerFileError] = React.useState<string | null>(
    null
  );
  const [isIconUploading, setIsIconUploading] = React.useState<boolean>(false);
  const [isBannerUploading, setIsBannerUploading] =
    React.useState<boolean>(false);
  const [emojiFileError, setEmojiFileError] = React.useState<string | null>(
    null
  );
  const [stickerFileError, setStickerFileError] = React.useState<string | null>(
    null
  );
  const [publicInvite, setPublicInvite] = React.useState(
    space?.isPublic || false
  );
  const { data: conversations } = useConversations({ type: 'direct' });
  const { apiClient } = useQuorumApiClient();
  const navigate = useNavigate();

  // Helper functions for Select primitive
  const getChannelGroups = React.useMemo(() => {
    if (!space?.groups) return [];
    return space.groups.map(group => ({
      groupLabel: group.groupName,
      options: group.channels.map(channel => ({
        value: channel.channelId,
        label: channel.channelName, // Channel name without # symbol
        icon: '#' // Just the # symbol as icon
      }))
    }));
  }, [space?.groups]);

  const getUserOptions = React.useMemo(() => {
    if (!conversations?.pages) return [];
    return conversations.pages
      .flatMap((c: any) => c.conversations as Conversation[])
      .toReversed()
      .map(conversation => ({
        value: conversation.address,
        label: conversation.displayName,
        avatar: conversation.icon,
        subtitle: conversation.address
      }));
  }, [conversations]);

  const {
    getRootProps,
    getInputProps,
    acceptedFiles,
    isDragActive: isIconDragActive,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      setIsIconUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setIconFileError(t`File cannot be larger than 1MB`);
        } else {
          setIconFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsIconUploading(true); // Keep uploading state during processing
      setIconFileError(null);
      // Clear previous file data immediately when new file is accepted
      setFileData(undefined);
      setCurrentFile(files[0]);
    },
    onDragEnter: () => {
      setIsIconUploading(true);
    },
    onDragLeave: () => {
      setIsIconUploading(false);
    },
    onFileDialogOpen: () => {
      setIsIconUploading(true);
    },
    onFileDialogCancel: () => {
      setIsIconUploading(false);
    },
  });

  const {
    getRootProps: getBannerRootProps,
    getInputProps: getBannerInputProps,
    acceptedFiles: bannerAcceptedFiles,
    isDragActive: isBannerDragActive,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      setIsBannerUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setBannerFileError(t`File cannot be larger than 1MB`);
        } else {
          setBannerFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsBannerUploading(true); // Keep uploading state during processing
      setBannerFileError(null);
      // Clear previous file data immediately when new file is accepted
      setBannerData(undefined);
      setCurrentBannerFile(files[0]);
    },
    onDragEnter: () => {
      setIsBannerUploading(true);
    },
    onDragLeave: () => {
      setIsBannerUploading(false);
    },
    onFileDialogOpen: () => {
      setIsBannerUploading(true);
    },
    onFileDialogCancel: () => {
      setIsBannerUploading(false);
    },
  });

  const {
    getRootProps: getEmojiRootProps,
    getInputProps: getEmojiInputProps,
    acceptedFiles: emojiAcceptedFiles,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    multiple: true,
    maxFiles: Math.min(10, 50 - emojis.length), // Allow up to 10 files, but not exceed 50 total
    minSize: 0,
    maxSize: 256 * 1024,
    disabled: emojis.length >= 50, // Disable when limit reached
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setEmojiFileError(t`File cannot be larger than 256KB`);
        } else if (rejection.errors.some((err) => err.code === 'too-many-files')) {
          const remaining = 50 - emojis.length;
          setEmojiFileError(t`Cannot upload more than ${Math.min(10, remaining)} files at once (${remaining} slots remaining)`);
        } else {
          setEmojiFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setEmojiFileError(null);
      // Double-check we don't exceed the limit
      const allowedFiles = files.slice(0, 50 - emojis.length);
      setCurrentEmojiFile(allowedFiles);
    },
  });

  const {
    getRootProps: getStickerRootProps,
    getInputProps: getStickerInputProps,
    acceptedFiles: stickerAcceptedFiles,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    multiple: true,
    maxFiles: Math.min(10, 50 - stickers.length), // Allow up to 10 files, but not exceed 50 total
    minSize: 0,
    maxSize: 256 * 1024,
    disabled: stickers.length >= 50, // Disable when limit reached
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setStickerFileError(t`File cannot be larger than 256KB`);
        } else if (rejection.errors.some((err) => err.code === 'too-many-files')) {
          const remaining = 50 - stickers.length;
          setStickerFileError(t`Cannot upload more than ${Math.min(10, remaining)} files at once (${remaining} slots remaining)`);
        } else {
          setStickerFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setStickerFileError(null);
      // Double-check we don't exceed the limit
      const allowedFiles = files.slice(0, 50 - stickers.length);
      setCurrentStickerFile(allowedFiles);
    },
  });

  React.useEffect(() => {
    if (currentFile) {
      (async () => {
        try {
          const arrayBuffer = await currentFile.arrayBuffer();
          setFileData(arrayBuffer);
          setIsIconUploading(false);
        } catch (error) {
          console.error('Error reading file:', error);
          setIconFileError(t`Error reading file`);
          setIsIconUploading(false);
        }
      })();
    }
  }, [currentFile]);

  React.useEffect(() => {
    if (currentBannerFile) {
      (async () => {
        try {
          const arrayBuffer = await currentBannerFile.arrayBuffer();
          setBannerData(arrayBuffer);
          setIsBannerUploading(false);
        } catch (error) {
          console.error('Error reading banner file:', error);
          setBannerFileError(t`Error reading file`);
          setIsBannerUploading(false);
        }
      })();
    }
  }, [currentBannerFile]);

  React.useEffect(() => {
    (async () => {
      if (manualAddress?.length === 46) {
        try {
          const reg = await apiClient.getUser(manualAddress);
          if (reg.data) {
            setResolvedUser(reg.data);
          }
        } catch {
          setResolvedUser(undefined);
        }
      } else {
        setResolvedUser(undefined);
      }
    })();
  }, [manualAddress]);

  React.useEffect(() => {
    if (currentEmojiFile && currentEmojiFile.length > 0) {
      (async () => {
        const newEmojis = await Promise.all(
          currentEmojiFile.map(async (file) => {
            const arrayBuffer = await file.arrayBuffer();
            return {
              id: crypto.randomUUID(),
              name: file.name
                .split('.')[0]
                .toLowerCase()
                .replace(/[^a-z0-9\-]/gi, ''),
              imgUrl:
                'data:' +
                file.type +
                ';base64,' +
                Buffer.from(arrayBuffer).toString('base64'),
            };
          })
        );
        setEmojis((prev) => [...prev, ...newEmojis]);
        setCurrentEmojiFile(undefined); // Clear after processing
      })();
    }
  }, [currentEmojiFile]);

  React.useEffect(() => {
    if (currentStickerFile && currentStickerFile.length > 0) {
      (async () => {
        const newStickers = await Promise.all(
          currentStickerFile.map(async (file) => {
            const arrayBuffer = await file.arrayBuffer();
            return {
              id: crypto.randomUUID(),
              name: file.name
                .split('.')[0]
                .toLowerCase()
                .replace(/[^a-z0-9\-]/gi, ''),
              imgUrl:
                'data:' +
                file.type +
                ';base64,' +
                Buffer.from(arrayBuffer).toString('base64'),
            };
          })
        );
        setStickers((prev) => [...prev, ...newStickers]);
        setCurrentStickerFile(undefined); // Clear after processing
      })();
    }
  }, [currentStickerFile]);

  const invite = React.useCallback(
    async (address: string) => {
      setSendingInvite(true);
      try {
        const spaceAddress = await ensureKeyForSpace(
          currentPasskeyInfo!.address,
          space!
        );
        if (spaceAddress != spaceId) {
          navigate('/spaces/' + spaceAddress + '/' + defaultChannel.channelId);
        }

        await sendInviteToUser(address, spaceAddress, currentPasskeyInfo!);
        setSuccess(true);
      } finally {
        setSendingInvite(false);
      }
    },
    [ensureKeyForSpace, currentPasskeyInfo, space]
  );

  const saveChanges = React.useCallback(() => {
    updateSpace({
      ...space!,
      spaceName: displayName,
      defaultChannelId: defaultChannel.channelId,
      isRepudiable: isRepudiable,
      iconUrl:
        fileData && currentFile
          ? 'data:' +
            currentFile.type +
            ';base64,' +
            Buffer.from(fileData).toString('base64')
          : space!.iconUrl,
      bannerUrl:
        bannerData && bannerAcceptedFiles.length
          ? 'data:' +
            bannerAcceptedFiles[0].type +
            ';base64,' +
            Buffer.from(bannerData).toString('base64')
          : space!.bannerUrl,
      roles: roles,
      emojis: emojis,
      stickers: stickers,
    });
    dismiss();
  }, [
    space,
    displayName,
    defaultChannel,
    fileData,
    acceptedFiles,
    bannerAcceptedFiles,
    bannerData,
    roles,
    emojis,
    stickers,
    spaceId,
    isRepudiable,
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
      <div 
        className="modal-complex-container-inner"
      >
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
          {spaceMembers && spaceMembers.length === 1 && (
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
          {spaceMembers && spaceMembers.length === 1 && (
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
                        className="modal-icon-editable cursor-pointer"
                        style={{
                          backgroundImage:
                            fileData != undefined && currentFile
                              ? 'url(data:' +
                                currentFile.type +
                                ';base64,' +
                                Buffer.from(fileData).toString('base64') +
                                ')'
                              : `url(${space?.iconUrl})`,
                        }}
                        {...getRootProps()}
                      >
                        <input {...getInputProps()} />
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
                          value={displayName}
                          onChange={setDisplayName}
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
                              bannerData != undefined &&
                              currentBannerFile
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
                                  onClick={() => setIconFileError(null)}
                                />
                              </div>
                            )}
                            {bannerFileError && (
                              <div className="error-label flex items-center justify-between">
                                <span>{bannerFileError}</span>
                                <Icon
                                  name="times"
                                  className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                                  onClick={() => setBannerFileError(null)}
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
                              .flatMap(g => g.channels)
                              .find(c => c.channelId === channelId);
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
                          <div className="text-sm flex flex-row">
                            <div className="text-sm flex flex-col justify-around">
                              <Trans>Repudiability</Trans>
                            </div>
                            <div className="text-sm flex flex-col justify-around ml-2">
                              <Tooltip
                                id="repudiability-tooltip"
                                content={t`Repudiability is a setting that makes conversations in this Space unverifiable as originating from the named sender. This can be useful in sensitive situations, but it also means others may forge messages that appear to come from you.`}
                                place="bottom"
                                className="!w-[400px]"
                                maxWidth={400}
                              >
                                <Icon
                                  name="info-circle"
                                  className="info-icon-tooltip"
                                />
                              </Tooltip>
                            </div>
                          </div>
                          <Switch
                            onChange={setIsRepudiable}
                            value={isRepudiable}
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
                          onClick={() => {
                            setRoles((prev) => [
                              ...prev,
                              {
                                roleId: crypto.randomUUID(),
                                roleTag: 'New Role' + (prev.length + 1),
                                displayName: 'New Role',
                                color: 'var(--success-hex)',
                                members: [],
                                permissions: [],
                              },
                            ]);
                          }}
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
                            @
                            <input
                              className="font-mono border-0 bg-[rgba(0,0,0,0)] pr-2"
                              style={{
                                width:
                                  (roles.find((_, pi) => i == pi)?.roleTag
                                    .length ?? 0) *
                                    11 +
                                  11 +
                                  'px',
                              }}
                              onChange={(e) =>
                                setRoles((prev) => [
                                  ...prev.map((p, pi) =>
                                    pi == i
                                      ? { ...p, roleTag: e.target.value }
                                      : p
                                  ),
                                ])
                              }
                              value={r.roleTag}
                            />
                            <span
                              className="font-mono modal-role"
                              style={{ backgroundColor: r.color }}
                            >
                              <input
                                className="border-0 bg-[rgba(0,0,0,0)] "
                                style={{
                                  width:
                                    (roles.find((_, pi) => i == pi)?.displayName
                                      .length ?? 0) *
                                      10 +
                                    10 +
                                    'px',
                                }}
                                onChange={(e) =>
                                  setRoles((prev) => [
                                    ...prev.map((p, pi) =>
                                      pi == i
                                        ? { ...p, displayName: e.target.value }
                                        : p
                                    ),
                                  ])
                                }
                                value={r.displayName}
                              />
                            </span>
                            <span className="float-right">
                              <Icon
                                name="trash"
                                title="Delete role"
                                className="cursor-pointer text-danger-hex hover:text-danger-hover-hex"
                                onClick={() =>
                                  setRoles((prev) => [
                                    ...prev.filter((p, pi) => i !== pi),
                                  ])
                                }
                              />
                            </span>
                            <span className="float-right pr-10 flex items-center">
                              <span className="text-sm font-normal pr-2">
                                <Trans>Can delete messages?</Trans>
                              </span>{' '}
                              <input
                                type="checkbox"
                                checked={roles
                                  .find((_, pi) => i == pi)
                                  ?.permissions.includes('message:delete')}
                                onChange={() =>
                                  setRoles((prev) => [
                                    ...prev.map((p, pi) =>
                                      pi == i
                                        ? {
                                            ...p,
                                            permissions: p.permissions.includes(
                                              'message:delete'
                                            )
                                              ? p.permissions.filter(
                                                  (pr: Permission) =>
                                                    pr !== 'message:delete'
                                                )
                                              : ([
                                                  ...p.permissions,
                                                  'message:delete',
                                                ] as Permission[]),
                                          }
                                        : p
                                    ),
                                  ])
                                }
                              />
                            </span>
                          </div>
                        );
                      })}
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
                            Add up to 50 custom emoji. Custom emojis can only be
                            used within a Space. You can upload PNG, JPG or GIF,
                            max 256kB.
                          </Trans>
                        </div>
                      </div>
                    </div>
                    <div className="modal-content-section">
                      <div className="flex">
                        {emojis.length < 50 && (
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
                              onClick={() => setEmojiFileError(null)}
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
                                    onChange={(e) =>
                                      setEmojis((prev) => [
                                        ...prev.map((p, pi) =>
                                          pi == i
                                            ? {
                                                ...p,
                                                name: e.target.value
                                                  .toLowerCase()
                                                  .replace(/[^a-z0-9\_]/gi, ''),
                                              }
                                            : p
                                        ),
                                      ])
                                    }
                                    value={em.name}
                                  />
                                </span>
                              </div>
                              <div className="flex flex-col grow justify-around items-end">
                                <Icon
                                  name="trash"
                                  className="cursor-pointer text-danger-hex hover:text-danger-hover-hex"
                                  onClick={() =>
                                    setEmojis((prev) => [
                                      ...prev.filter((p, pi) => i !== pi),
                                    ])
                                  }
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
                            only be used within a Space. You can upload PNG, JPG
                            or GIF, max 256kB.
                          </Trans>
                        </div>
                      </div>
                    </div>
                    <div className="modal-content-section">
                      <div className="flex">
                        {stickers.length < 50 && (
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
                              onClick={() => setStickerFileError(null)}
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
                                    onChange={(e) =>
                                      setStickers((prev) => [
                                        ...prev.map((p, pi) =>
                                          pi == i
                                            ? {
                                                ...p,
                                                name: e.target.value
                                                  .toLowerCase()
                                                  .replace(/[^a-z0-9\_]/gi, ''),
                                              }
                                            : p
                                        ),
                                      ])
                                    }
                                    value={em.name}
                                  />
                                </span>
                              </div>
                              <div className="flex flex-col grow justify-around items-end">
                                <Icon
                                  name="trash"
                                  className="cursor-pointer text-danger-hex hover:text-danger-hover-hex"
                                  onClick={() =>
                                    setStickers((prev) => [
                                      ...prev.filter((p, pi) => i !== pi),
                                    ])
                                  }
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
                            conversations with. An invite button will appear in
                            their inbox.
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
                          options={getUserOptions}
                          value={selectedUser?.address || ''}
                          onChange={(address) => {
                            const conversation = conversations?.pages
                              ?.flatMap((c: any) => c.conversations as Conversation[])
                              ?.find(c => c.address === address);
                            if (conversation) {
                              setSelectedUser(conversation);
                              setResolvedUser(undefined);
                              setManualAddress('');
                              setSuccess(false);
                            }
                          }}
                          placeholder={t`Select conversation`}
                        />
                        <div className="small-caps mt-2">
                          <Trans>Enter Address Manually</Trans>
                        </div>
                        <Input
                          className="w-full placeholder:text-subtle"
                          value={manualAddress}
                          placeholder="Type the address of the user you want to send to"
                          onChange={(value) => {
                            setManualAddress(value);
                            setSuccess(false);
                          }}
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
                                  risks of enabling this, and to whom and where
                                  you share the link.
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
                                  <div className="text-sm flex flex-row">
                                    <div className="small-caps text-lg flex flex-col justify-around">
                                      <Trans>Current Invite Link</Trans>
                                    </div>
                                    <div className="flex flex-col justify-around ml-2">
                                      <Tooltip
                                        id="current-invite-link-tooltip"
                                        content={t`This link will not expire, but you can generate a new one at any time, which will invalidate the old link. Current Space members will not be removed from the Space.`}
                                        place="bottom"
                                        className="flex flex-col justify-around pt-3 pb-1 !w-[400px] cursor-pointer"
                                        maxWidth={400}
                                      >
                                        <Icon
                                          name="info-circle"
                                          className="info-icon-tooltip"
                                        />
                                      </Tooltip>
                                    </div>
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
                                    className="bg-input border border-strong rounded-md px-3 py-1.5 text-sm w-full max-w-full overflow-hidden whitespace-nowrap cursor-pointer transition hover:border-stronger"
                                    iconClassName="text-muted hover:text-main"
                                    copyOnContentClick
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <div className="truncate flex-1">
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
                                onClick={async () => {
                                  setGenerating(true);
                                  try {
                                    await new Promise<void>((resolve) =>
                                      setTimeout(() => resolve(), 200)
                                    );
                                    await generateNewInviteLink(
                                      space.spaceId,
                                      keyset.userKeyset,
                                      keyset.deviceKeyset,
                                      registration.registration!
                                    );
                                  } finally {
                                    setGenerating(false);
                                  }
                                }}
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
                                deleteSpace(spaceId);
                                navigate('/messages');
                                dismiss();
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
