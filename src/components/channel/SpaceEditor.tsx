import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  usePasskeysContext,
  channel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { useNavigate } from 'react-router';
import {
  faChevronDown,
  faTrash,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';

import { useMessageDB } from '../context/MessageDB';
import './SpaceEditor.scss';
import Button from '../Button';
import { useConversations, useRegistration, useSpace } from '../../hooks';
import {
  Channel,
  Emoji,
  Role,
  Sticker,
  Permission,
  Conversation,
} from '../../api/quorumApi';
import ToggleSwitch from '../ToggleSwitch';
import Tooltip from '../Tooltip';
import Input from '../Input';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { Loading } from '../Loading';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import ClickToCopyContent from '../ClickToCopyContent';
import ReactTooltip from '../ReactTooltip';

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
  const [bannerData, setBannerData] = React.useState<ArrayBuffer | undefined>();
  const [isDefaultChannelListExpanded, setIsDefaultChannelListExpanded] =
    React.useState<boolean>(false);
  const [isInviteListExpanded, setIsInviteListExpanded] =
    React.useState<boolean>(false);
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
  const [manualAddress, setManualAddress] = React.useState<string>();
  const [resolvedUser, setResolvedUser] =
    React.useState<channel.UserRegistration>();
  const [isRepudiable, setIsRepudiable] = React.useState<boolean>(
    space?.isRepudiable || false
  );
  const [repudiableTooltip, setRepudiableTooltip] = React.useState(false);
  const [publicInviteTooltip, setPublicInviteTooltip] = React.useState(false);
  const [publicInvite, setPublicInvite] = React.useState(
    space?.isPublic || false
  );
  const { data: conversations } = useConversations({ type: 'direct' });
  const { apiClient } = useQuorumApiClient();
  const navigate = useNavigate();

  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
  });

  const {
    getRootProps: getBannerRootProps,
    getInputProps: getBannerInputProps,
    acceptedFiles: bannerAcceptedFiles,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
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
    minSize: 0,
    maxSize: 256 * 1024,
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
    minSize: 0,
    maxSize: 256 * 1024,
  });

  React.useEffect(() => {
    if (acceptedFiles.length > 0) {
      (async () => {
        setFileData(await acceptedFiles[0].arrayBuffer());
      })();
    }
  }, [acceptedFiles]);

  React.useEffect(() => {
    if (bannerAcceptedFiles.length > 0) {
      (async () => {
        setBannerData(await bannerAcceptedFiles[0].arrayBuffer());
      })();
    }
  }, [bannerAcceptedFiles]);

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
    if (emojiAcceptedFiles.length > 0) {
      (async () => {
        const file = await emojiAcceptedFiles[0].arrayBuffer();
        setEmojis((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: emojiAcceptedFiles[0].name
              .split('.')[0]
              .toLowerCase()
              .replace(/[^a-z0-9\-]/gi, ''),
            imgUrl:
              'data:' +
              emojiAcceptedFiles[0].type +
              ';base64,' +
              Buffer.from(file).toString('base64'),
          },
        ]);
      })();
    }
  }, [emojiAcceptedFiles]);

  React.useEffect(() => {
    if (stickerAcceptedFiles.length > 0) {
      (async () => {
        const file = await stickerAcceptedFiles[0].arrayBuffer();
        setStickers((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: stickerAcceptedFiles[0].name
              .split('.')[0]
              .toLowerCase()
              .replace(/[^a-z0-9\-]/gi, ''),
            imgUrl:
              'data:' +
              stickerAcceptedFiles[0].type +
              ';base64,' +
              Buffer.from(file).toString('base64'),
          },
        ]);
      })();
    }
  }, [stickerAcceptedFiles]);

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
        fileData && acceptedFiles.length
          ? 'data:' +
            acceptedFiles[0].type +
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
    <div className="space-editor flex flex-row">
      <div className="px-4 py-2 text-main w-[200px]">
        <div className="small-caps text-subtle">Settings</div>
        <div
          onClick={() => setSelectedCategory('general')}
          className={
            (selectedCategory == 'general'
              ? 'bg-[rgba(235,200,255,0.1)] '
              : '') +
            'font-medium cursor-pointer hover:bg-[rgba(235,200,255,0.05)] px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          <Trans>General</Trans>
        </div>
        <div
          onClick={() => setSelectedCategory('roles')}
          className={
            (selectedCategory == 'roles' ? 'bg-[rgba(235,200,255,0.1)] ' : '') +
            'font-medium cursor-pointer hover:bg-[rgba(235,200,255,0.05)] px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          <Trans>Roles</Trans>
        </div>
        <div
          onClick={() => setSelectedCategory('emojis')}
          className={
            (selectedCategory == 'emoji' ? 'bg-[rgba(235,200,255,0.1)] ' : '') +
            'font-medium cursor-pointer hover:bg-[rgba(235,200,255,0.05)] px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          <Trans>Emojis</Trans>
        </div>
        <div
          onClick={() => setSelectedCategory('stickers')}
          className={
            (selectedCategory == 'stickers'
              ? 'bg-[rgba(235,200,255,0.1)] '
              : '') +
            'font-medium cursor-pointer hover:bg-[rgba(235,200,255,0.05)] px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          <Trans>Stickers</Trans>
        </div>
        <div
          onClick={() => setSelectedCategory('invites')}
          className={
            (selectedCategory == 'invites'
              ? 'bg-[rgba(235,200,255,0.1)] '
              : '') +
            'font-medium cursor-pointer hover:bg-[rgba(235,200,255,0.05)] px-2 mt-1 mx-[-.5rem] rounded-md py-1'
          }
        >
          <Trans>Invites</Trans>
        </div>
      </div>
      <div className="flex flex-col grow overflow-y-scroll rounded-xl">
        {(() => {
          switch (selectedCategory) {
            case 'general':
              return (
                <>
                  <div className="space-editor-header">
                    <div
                      className="space-editor-icon-editable cursor-pointer"
                      style={{
                        backgroundImage:
                          fileData != undefined && acceptedFiles.length != 0
                            ? 'url(data:' +
                              acceptedFiles[0].type +
                              ';base64,' +
                              Buffer.from(fileData).toString('base64') +
                              ')'
                            : `url(${space?.iconUrl})`,
                      }}
                      {...getRootProps()}
                    >
                      <input {...getInputProps()} />
                    </div>
                    <div className="space-editor-text flex flex-col grow pr-4">
                      <div className="small-caps">
                        <Trans>Space Name</Trans>
                      </div>
                      <input
                        className="w-full quorum-input"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-editor-content flex flex-col grow">
                    <div className="space-editor-content-section-header small-caps">
                      <Trans>Space Banner</Trans>
                    </div>
                    <div className="space-editor-info">
                      <div
                        className={
                          'space-editor-banner-editable cursor-pointer ' +
                          (space?.bannerUrl || bannerAcceptedFiles.length != 0
                            ? ''
                            : 'border-2 border-dashed border-primary-200')
                        }
                        style={{
                          backgroundImage:
                            bannerData != undefined &&
                            bannerAcceptedFiles.length != 0
                              ? 'url(data:' +
                                bannerAcceptedFiles[0].type +
                                ';base64,' +
                                Buffer.from(bannerData).toString('base64') +
                                ')'
                              : `url(${space?.bannerUrl})`,
                        }}
                        {...getBannerRootProps()}
                      >
                        <input {...getBannerInputProps()} />
                      </div>
                    </div>
                    <div className="space-editor-content-section-header small-caps">
                      <Trans>Default Channel</Trans>
                    </div>
                    <div className="space-editor-info">
                      <div
                        className="w-full quorum-input !font-bold flex flex-row justify-between cursor-pointer"
                        onClick={() =>
                          setIsDefaultChannelListExpanded((prev) => !prev)
                        }
                      >
                        <div className="flex flex-col justify-around w-[calc(100%-30px)]">
                          #{defaultChannel?.channelName}
                        </div>
                        <div className="space-context-menu-toggle-button">
                          <FontAwesomeIcon icon={faChevronDown} />
                        </div>
                      </div>
                      {isDefaultChannelListExpanded && (
                        <div className="absolute pr-[227px] w-full">
                          <div className="bg-input max-w-[350px] mt-1 max-h-[200px] rounded-xl overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {space?.groups.map((g, i) => {
                              return (
                                <React.Fragment key={'group-select-' + i}>
                                  <div className="small-caps py-2 px-3">
                                    {g.groupName}
                                  </div>
                                  {g.channels.map((c, j) => {
                                    return (
                                      <div
                                        onClick={() => {
                                          setDefaultChannel(c);
                                          setIsDefaultChannelListExpanded(
                                            false
                                          );
                                        }}
                                        className="py-2 px-2 mx-1 my-1 text-main hover:bg-surface-4 rounded-lg cursor-pointer !font-bold"
                                        key={
                                          'group-select-' + i + '-channel-' + i
                                        }
                                      >
                                        #{c.channelName}
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-editor-content-section-header small-caps">
                      <Trans>Privacy Settings</Trans>
                    </div>
                    <div className="space-editor-info">
                      <div className="flex flex-row justify-between">
                        <div className="text-sm flex flex-row">
                          <div className="text-sm flex flex-col justify-around">
                            <Trans>Repudiability</Trans>
                          </div>
                          <div className="text-sm flex flex-col justify-around ml-2">
                            <div
                              id="repudiability-tooltip-icon"
                              className="border rounded-full w-6 h-6 text-center leading-5 text-lg"
                              onMouseOut={() => setRepudiableTooltip(false)}
                              onMouseOver={() => setRepudiableTooltip(true)}
                            >
                              ℹ
                            </div>
                          </div>
                          <div className="absolute left-[340px]">
                            <ReactTooltip
                              id="repudiability-tooltip"
                              content={t`Repudiability is a setting that makes conversations in this Space unverifiable as originating from the named sender. This can be useful in sensitive situations, but it also means others may forge messages that appear to come from you.`}
                              place="bottom"
                              className="!w-[400px]"
                              anchorSelect="#repudiability-tooltip-icon"
                            />
                          </div>
                        </div>
                        <ToggleSwitch
                          onClick={() => setIsRepudiable((prev) => !prev)}
                          active={isRepudiable}
                        />
                      </div>
                    </div>
                    <div className="grow flex flex-col justify-end">
                      <div className="space-editor-editor-actions">
                        <Button type="primary" onClick={() => saveChanges()}>
                          <Trans>Save Changes</Trans>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            case 'roles':
              return (
                <>
                  <div className="space-editor-header pt-4 px-4 !min-h-[0px] flex flex-row justify-between">
                    <div className="">
                      <div className="text-xl font-bold">
                        <Trans>Roles</Trans>
                      </div>
                      <div className="pt-1 text-sm text-main">
                        <Trans>
                          Click on the role name and tag to edit them.
                        </Trans>
                      </div>
                    </div>
                    <div className="space-editor-editor-actions">
                      <div>
                        <Button
                          type="secondary"
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
                    </div>
                  </div>
                  <div className="space-editor-content flex flex-col grow">
                    {roles.map((r, i) => {
                      return (
                        <div
                          key={'space-editor-role-' + i}
                          className="space-editor-content-section-header text-main"
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
                          <span className="font-mono space-editor-role">
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
                            <FontAwesomeIcon
                              icon={faTrash}
                              title="Delete role"
                              className="cursor-pointer text-danger-hex hover:text-danger-hover-hex"
                              onClick={() =>
                                setRoles((prev) => [
                                  ...prev.filter((p, pi) => i !== pi),
                                ])
                              }
                            />
                          </span>
                          <span className="float-right pr-10 text-normal">
                            <Trans>Can delete messages?</Trans>{' '}
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
                    <div className="space-editor-info"></div>
                    <div className="grow flex flex-col justify-end">
                      <div className="space-editor-editor-actions">
                        <Button type="primary" onClick={() => saveChanges()}>
                          <Trans>Save Changes</Trans>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            case 'emojis':
              return (
                <>
                  <div className="space-editor-header pt-4 px-4 !min-h-[160px] flex flex-row">
                    <div className="">
                      <div className="text-xl font-bold">
                        <Trans>Emojis</Trans>
                      </div>
                      <div className="pt-1 text-sm text-main">
                        <Trans>
                          Add up to 50 custom emoji. Custom emojis can only be
                          used within a Space.
                        </Trans>
                        <br />
                        <br />
                        <Trans>Requirements:</Trans>
                        <ul>
                          <li>
                            <Trans>Supported types: PNG, JPG, GIF</Trans>
                          </li>
                          <li>
                            <Trans>Max file size: 256kB</Trans>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="space-editor-content flex flex-col grow">
                    <div className="flex">
                      {emojis.length < 50 && (
                        <div
                          className="px-4 py-2 rounded-full font-medium text-sm text-center select-none border-2 border-primary-300 text-primary-300 bg-transparent transition duration-300 cursor-pointer hover:bg-primary hover:border-primary hover:text-white"
                          {...getEmojiRootProps()}
                        >
                          <Trans>Upload Emoji</Trans>
                          <input {...getEmojiInputProps()} />
                        </div>
                      )}
                    </div>
                    <div className="pt-4">
                      {emojis.map((em, i) => {
                        return (
                          <div
                            key={'space-editor-emoji-' + i}
                            className="space-editor-content-section-header text-main flex flex-row"
                          >
                            <img width="24" height="24" src={em.imgUrl} />
                            <div className="flex flex-col justify-around font-mono font-medium mx-2">
                              <span>
                                :
                                <input
                                  className={'border-0 bg-[rgba(0,0,0,0)]'}
                                  style={{
                                    width:
                                      (emojis.find((_, pi) => i == pi)?.name
                                        .length ?? 0) *
                                        10 +
                                      10 +
                                      'px',
                                  }}
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
                                :
                              </span>
                            </div>
                            <div className="flex flex-col grow justify-around items-end">
                              <FontAwesomeIcon
                                icon={faTrash}
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
                    <div className="space-editor-info"></div>
                    <div className="grow flex flex-col justify-end">
                      <div className="space-editor-editor-actions">
                        <Button type="primary" onClick={() => saveChanges()}>
                          <Trans>Save Changes</Trans>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            case 'stickers':
              return (
                <>
                  <div className="space-editor-header pt-4 px-4 !min-h-[160px] flex flex-row">
                    <div className="">
                      <div className="text-xl font-bold">
                        <Trans>Stickers</Trans>
                      </div>
                      <div className="pt-1 text-sm text-main">
                        <Trans>
                          Add up to 50 custom stickers. Custom stickers can only
                          be used within a Space.
                        </Trans>
                        <br />
                        <br />
                        <Trans>Requirements:</Trans>
                        <ul>
                          <li>
                            <Trans>Supported types: PNG, JPG, GIF</Trans>
                          </li>
                          <li>
                            <Trans>Max file size: 256kB</Trans>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="space-editor-content flex flex-col grow">
                    <div className="flex">
                      {stickers.length < 50 && (
                        <div
                          className="px-4 py-2 rounded-full font-medium text-sm text-center select-none border-2 border-primary-300 text-primary-300 bg-transparent transition duration-300 cursor-pointer hover:bg-primary hover:border-primary hover:text-white"
                          {...getStickerRootProps()}
                        >
                          <Trans>Upload Sticker</Trans>
                          <input {...getStickerInputProps()} />
                        </div>
                      )}
                    </div>
                    <div className="pt-4">
                      {stickers.map((em, i) => {
                        return (
                          <div
                            key={'space-editor-sticker-' + i}
                            className="space-editor-content-section-header text-main flex flex-row"
                          >
                            <img width="24" height="24" src={em.imgUrl} />
                            <div className="flex flex-col justify-around font-mono font-medium mx-2">
                              <span>
                                :
                                <input
                                  className={'border-0 bg-[rgba(0,0,0,0)]'}
                                  style={{
                                    width:
                                      (stickers.find((_, pi) => i == pi)?.name
                                        .length ?? 0) *
                                        10 +
                                      10 +
                                      'px',
                                  }}
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
                                :
                              </span>
                            </div>
                            <div className="flex flex-col grow justify-around items-end">
                              <FontAwesomeIcon
                                icon={faTrash}
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
                    <div className="space-editor-info"></div>
                    <div className="grow flex flex-col justify-end">
                      <div className="space-editor-editor-actions">
                        <Button type="primary" onClick={() => saveChanges()}>
                          <Trans>Save Changes</Trans>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            case 'invites':
              return (
                <>
                  <div className="space-editor-header pt-4 px-4 flex flex-row">
                    <div>
                      <div className="text-xl font-bold">
                        <Trans>Invites</Trans>
                      </div>
                      <div className="pt-1 text-sm text-main">
                        <Trans>
                          Send invites to people you've previously had
                          conversations with. An invite button will appear in
                          their inbox.
                        </Trans>
                      </div>
                    </div>
                  </div>
                  <div className="space-editor-content flex flex-col grow">
                    <div className="flex"></div>
                    <div className=""></div>
                    <div className="space-editor-info">
                      <div className="small-caps">
                        <Trans>Existing Conversations</Trans>
                      </div>
                      <div
                        className="w-full quorum-input !font-bold flex flex-row justify-between cursor-pointer"
                        onClick={() => {
                          setSuccess(false);
                          setIsInviteListExpanded((prev) => !prev);
                        }}
                      >
                        {selectedUser && (
                          <div className="flex flex-row">
                            <div className="flex flex-col justify-around">
                              <div
                                className="rounded-full w-[24px] h-[24px] mt-[2px]"
                                style={{
                                  backgroundPosition: 'center',
                                  backgroundSize: 'cover',
                                  backgroundImage: `url(${selectedUser.icon})`,
                                }}
                              />
                            </div>
                            <div className="flex flex-col justify-around pl-2">
                              <div>
                                {selectedUser.displayName}{' '}
                                <span className="font-light">
                                  ({selectedUser.address})
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {!selectedUser && <div></div>}
                        <div className="space-context-menu-toggle-button">
                          <FontAwesomeIcon icon={faChevronDown} />
                        </div>
                      </div>
                      {isInviteListExpanded && (
                        <div className="absolute pr-[227px] w-full">
                          <div className="bg-input w-full mt-1 max-h-[200px] rounded-xl overflow-y-scroll [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {conversations.pages
                              .flatMap(
                                (c: any) => c.conversations as Conversation[]
                              )
                              .toReversed()
                              .map((c, i) => {
                                return (
                                  <div
                                    onClick={() => {
                                      setSelectedUser(c);
                                      setResolvedUser(undefined);
                                      setManualAddress('');
                                      setSuccess(false);
                                      setIsInviteListExpanded(false);
                                    }}
                                    className="py-2 px-2 mx-1 my-1 text-main hover:bg-surface-4 rounded-lg cursor-pointer !font-bold flex flex-row"
                                    key={'group-select-' + i + '-channel-' + i}
                                  >
                                    <div className="flex flex-col justify-around">
                                      <div
                                        className="rounded-full w-[24px] h-[24px] mt-[2px]"
                                        style={{
                                          backgroundPosition: 'center',
                                          backgroundSize: 'cover',
                                          backgroundImage: `url(${c.icon})`,
                                        }}
                                      />
                                    </div>
                                    <div className="flex flex-col justify-around pl-2">
                                      <div>
                                        {c.displayName}{' '}
                                        <span className="font-light">
                                          ({c.address})
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                      <div className="small-caps">
                        <Trans>Enter Address Manually</Trans>
                      </div>
                      <Input
                        value={manualAddress}
                        placeholder="Type the address of the user you want to send to"
                        onChange={(e) => {
                          setManualAddress(e.target.value);
                          setSuccess(false);
                          setIsInviteListExpanded(false);
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
                      <div className="border-t border-default mt-4 pt-4"></div>
                      <div className="flex flex-row justify-between">
                        <div className="text-sm flex flex-row justify-center">
                          <div className="text-lg flex flex-col justify-around">
                            <Trans>Public Invite Link</Trans>
                            <div className="text-sm flex flex-col justify-around pt-2 max-w-[500px]">
                              <Trans>
                                Public invite links allow anyone with access to
                                the link join your Space. Understand the risks
                                of enabling this, and to whom and where you
                                share the link.
                              </Trans>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col justify-center pt-2">
                          <ToggleSwitch
                            onClick={() => setPublicInvite((prev) => !prev)}
                            active={publicInvite}
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
                                    <FontAwesomeIcon
                                      id="current-invite-link-tooltip-icon"
                                      icon={faInfoCircle}
                                      className="ml-2"
                                    />
                                    <ReactTooltip
                                      id="current-invite-link-tooltip"
                                      anchorSelect="#current-invite-link-tooltip-icon"
                                      className="flex flex-col justify-around pt-3 pb-1 !w-[400px]"
                                      place="bottom"
                                      content={t`This link will not expire, but you can generate a new one at any time, which will invalidate the old link. Current Space members will not be removed from the Space.`}
                                    />
                                  </div>
                                </div>
                              </div>
                              <ClickToCopyContent
                                text={space.inviteUrl}
                                tooltipText={t`Copy invite link to clipboard`}
                                className="bg-input border border-default rounded-md px-3 py-2 text-sm w-full max-w-full overflow-x-auto whitespace-nowrap cursor-pointer transition hover:border-strong"
                                copyOnContentClick
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="truncate">
                                    {space.inviteUrl}
                                  </div>
                                </div>
                              </ClickToCopyContent>
                            </>
                          )}

                          <div className="mt-4 flex flex-row">
                            <Button
                              type="danger"
                              className="px-4"
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
                              <Trans>Generate New Invite Link</Trans>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="grow flex flex-col justify-end">
                      <div className="space-editor-editor-actions">
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
                  </div>
                </>
              );
          }
        })()}
      </div>
    </div>
  );
};

export default SpaceEditor;
