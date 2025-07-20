import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faSmile,
  faUsers,
  faX,
  faBars,
} from '@fortawesome/free-solid-svg-icons';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import './Channel.scss';
import {
  EmbedMessage,
  Message as MessageType,
  StickerMessage,
} from '../../api/quorumApi';
import { useMessages, useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { useSpaceMembers } from '../../hooks/queries/spaceMembers/useSpaceMembers';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';
import { MessageList } from '../message/MessageList';
import { FileWithPath, useDropzone } from 'react-dropzone';
import Compressor from 'compressorjs';
import { t } from '@lingui/core/macro';
import ReactTooltip from '../ReactTooltip';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../utils';
import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useModalContext } from '../AppWithSearch';

type ChannelProps = {
  spaceId: string;
  channelId: string;
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
};

const Channel: React.FC<ChannelProps> = ({
  spaceId,
  channelId,
  kickUserAddress,
  setKickUserAddress,
}) => {
  const { isDesktop, toggleLeftSidebar } = useResponsiveLayoutContext();
  const [state, setState] = React.useState<{
    pendingMessage: string;
    messages: MessageType[];
  }>({
    pendingMessage: '',
    messages: [],
  });
  const { data: space } = useSpace({ spaceId });
  const { data: messages, fetchPreviousPage } = useMessages({
    spaceId: spaceId,
    channelId: channelId,
  });
  const queryClient = useQueryClient();
  const user = usePasskeysContext();
  const [pendingMessage, setPendingMessage] = useState('');
  const {
    showRightSidebar: showUsers,
    setShowRightSidebar: setShowUsers,
    setRightSidebarContent,
  } = useModalContext();
  const [init, setInit] = useState(false);

  // Clean up sidebar content when component unmounts
  React.useEffect(() => {
    return () => {
      setRightSidebarContent(null);
    };
  }, [setRightSidebarContent]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [inReplyTo, setInReplyTo] = useState<MessageType>();
  const editor = useRef<HTMLTextAreaElement>(null);
  const { submitChannelMessage } = useMessageDB();
  const { data: spaceMembers } = useSpaceMembers({ spaceId });
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const [fileType, setFileType] = React.useState<string>();
  const [fileError, setFileError] = useState<string | null>(null);
  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    minSize: 0,
    maxSize: 2 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setFileError(t`File cannot be larger than 2MB`);
        } else {
          setFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: () => {
      setFileError(null);
    },
  });

  const compressImage = async function (file: FileWithPath) {
    return new Promise<File>((resolve, reject) => {
      if (acceptedFiles[0].type == 'image/gif') {
        resolve(acceptedFiles[0] as File);
      } else {
        new Compressor(file, {
          quality: 0.8,
          convertSize: Infinity,
          retainExif: false,
          mimeType: file.type,
          success(result: Blob) {
            let newFile = new File([result], acceptedFiles[0].name, {
              type: result.type,
            });

            resolve(newFile);
          },
          error(err) {
            reject(err);
          },
        });
      }
    });
  };

  React.useEffect(() => {
    if (acceptedFiles.length > 0) {
      (async () => {
        const file = await compressImage(acceptedFiles[0]);
        setFileData(await file.arrayBuffer());
        setFileType(file.type);
      })();
    }
  }, [acceptedFiles]);

  const members = useMemo(() => {
    return spaceMembers.reduce(
      (prev, curr) =>
        Object.assign(prev, {
          [curr.user_address]: {
            address: curr.user_address,
            userIcon: curr.user_icon,
            displayName: curr.display_name,
          },
        }),
      {} as {
        [address: string]: {
          address: string;
          userIcon?: string;
          displayName?: string;
        };
      }
    );
  }, [spaceMembers]);

  const activeMembers = useMemo(() => {
    return spaceMembers.reduce(
      (prev, curr) =>
        Object.assign(prev, {
          [curr.user_address]: {
            address: curr.user_address,
            userIcon: curr.user_icon,
            displayName: curr.display_name,
            left: curr.inbox_address === '',
          },
        }),
      {} as {
        [address: string]: {
          address: string;
          userIcon?: string;
          displayName?: string;
          left: boolean;
        };
      }
    );
  }, [spaceMembers]);

  const roles = useMemo(() => {
    return space?.roles ?? [];
  }, [space]);

  const noRoleMembers = useMemo(() => {
    return Object.keys(activeMembers)
      .filter((s) => !roles.flatMap((r) => r.members).includes(s))
      .filter((r) => !activeMembers[r].left);
  }, [roles, activeMembers]);

  // Set sidebar content in context
  React.useEffect(() => {
    const sidebarContent = (
      <>
        {roles
          .filter((r) => r.members.length != 0)
          .map((r) => {
            const role = r;
            const roleMembers = Object.keys(activeMembers).filter((s) =>
              role.members.includes(s)
            );
            return (
              <div className="flex flex-col mb-2" key={'role-' + r}>
                <div className="font-semibold ml-[1pt] mb-1 text-xs">
                  {i18n._('{role} - {count}', {
                    role: role.displayName.toUpperCase(),
                    count: roleMembers.length,
                  })}
                </div>
                {roleMembers.map((s) => (
                  <div key={s} className="w-full flex flex-row mb-2">
                    <div
                      className="rounded-full w-[40px] h-[40px] mt-[2px]"
                      style={{
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                        backgroundImage: `url(${
                          members[s]?.userIcon?.includes(
                            DefaultImages.UNKNOWN_USER
                          )
                            ? 'var(--unknown-icon)'
                            : `url(${members[s]?.userIcon})`
                        })`,
                      }}
                    />
                    <div className="flex flex-col ml-2 text-main">
                      <span className="text-md font-bold">
                        {members[s]?.displayName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        <div className="flex flex-col">
          <div className="font-semibold ml-[1pt] mb-1 text-xs">
            {i18n._('No Role - {count}', { count: noRoleMembers.length })}
          </div>
          {noRoleMembers.map((s) => (
            <div key={s} className="w-full flex flex-row mb-2">
              <div
                className="rounded-full w-[40px] h-[40px] mt-[2px]"
                style={{
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundImage: `url(${members[s].userIcon})`,
                }}
              />
              <div className="flex flex-col ml-2 text-main">
                <span className="text-md font-bold">
                  {members[s].displayName}
                </span>
              </div>
            </div>
          ))}
        </div>
      </>
    );
    setRightSidebarContent(sidebarContent);
  }, [roles, activeMembers, members, noRoleMembers, setRightSidebarContent]);

  const channel = useMemo(() => {
    return space?.groups
      .find((g) => g.channels.find((c) => c.channelId == channelId))
      ?.channels.find((c) => c.channelId == channelId);
  }, [space, channelId]);

  const mapSenderToUser = (senderId: string) => {
    return (
      members[senderId] || {
        displayName: t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
      }
    );
  };

  const messageList = React.useMemo(() => {
    return messages.pages.flatMap(
      (p) => (p as { messages: MessageType[] }).messages as MessageType[]
    );
  }, [messages, fetchPreviousPage]);

  useEffect(() => {
    if (!init) {
      setTimeout(() => setInit(true), 200);
    }
  }, []);

  const submit = async (message: string | object) => {
    await submitChannelMessage(
      spaceId,
      channelId,
      message,
      queryClient,
      user.currentPasskeyInfo!
    );
  };

  const canDeleteMessages = (message: MessageType) => {
    return !!roles.find(
      (r) =>
        r.permissions.includes('message:delete') &&
        r.members.includes(user.currentPasskeyInfo!.address)
    );
  };

  const stickers = useMemo(() => {
    return (space?.stickers ?? []).reduce(
      (prev, curr) => Object.assign(prev, { [curr.id]: curr }),
      {}
    );
  }, [space]);

  const sendSticker = async (stickerId: string) => {
    console.log('Sending sticker:', stickerId);
    setIsSubmitting(true);
    submitChannelMessage(
      spaceId,
      channelId,
      {
        senderId: user.currentPasskeyInfo?.address,
        type: 'sticker',
        stickerId: stickerId,
      } as StickerMessage,
      queryClient,
      user.currentPasskeyInfo!,
      inReplyTo?.messageId
    ).finally(() => {
      setIsSubmitting(false);
    });
    setInReplyTo(undefined);
    setShowStickers(false);
  };

  const rowCount =
    state.pendingMessage.split('').filter((c) => c == '\n').length + 1;

  return (
    <div className="chat-container">
      <div className="flex flex-col">
        <div className="channel-name border-b mt-[8px] pb-[8px] mx-[11px] lg:mx-4 text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <div className="flex flex-row items-center gap-2 lg:order-2 justify-between lg:justify-start mb-2 lg:mb-0">
            <div className="flex flex-row items-center gap-2">
              {!isDesktop && (
                <FontAwesomeIcon
                  onClick={toggleLeftSidebar}
                  className="w-4 p-1 rounded-md cursor-pointer hover:bg-[rgba(255,255,255,0.2)]"
                  icon={faBars}
                />
              )}
              <GlobalSearch className="channel-search flex-1 lg:flex-none max-w-xs lg:max-w-none" />
            </div>
            <FontAwesomeIcon
              onClick={() => {
                setShowUsers((prev) => !prev);
              }}
              className="w-4 p-1 rounded-md cursor-pointer hover:bg-[rgba(255,255,255,0.2)]"
              icon={faUsers}
            />
          </div>
          <div className="flex-1 min-w-0 lg:order-1">
            <div className="truncate">
              <span>
                #{channel?.channelName}
                {channel?.channelTopic && ' | '}
              </span>
              <span className="font-light text-sm">
                {channel?.channelTopic}
              </span>
            </div>
          </div>
        </div>
        <div
          className={
            'message-list' + (!showUsers ? ' message-list-expanded' : '')
          }
        >
          <MessageList
            isRepudiable={space?.isRepudiable}
            stickers={stickers}
            roles={roles}
            canDeleteMessages={canDeleteMessages}
            isSpaceOwner={isSpaceOwner}
            editor={editor}
            messageList={messageList}
            setInReplyTo={setInReplyTo}
            customEmoji={space?.emojis}
            members={members}
            submitMessage={submit}
            kickUserAddress={kickUserAddress}
            setKickUserAddress={setKickUserAddress}
            fetchPreviousPage={() => {
              fetchPreviousPage();
            }}
          />
        </div>
        {(fileError || inReplyTo) && (
          <div className="flex flex-col w-full px-[11px]">
            {fileError && (
              <div className="text-sm text-danger ml-1 mt-3 mb-1">
                {fileError}
              </div>
            )}
            {inReplyTo && (
              <div
                onClick={() => setInReplyTo(undefined)}
                className="rounded-t-lg px-4 cursor-pointer py-1 text-sm flex flex-row justify-between bg-[var(--surface-4)]"
              >
                {i18n._('Replying to {user}', {
                  user: mapSenderToUser(inReplyTo.content.senderId).displayName,
                })}
                <span
                  className="message-in-reply-dismiss"
                  onClick={() => setInReplyTo(undefined)}
                >
                  ×
                </span>
              </div>
            )}
          </div>
        )}

        {fileData && (
          <div className="mx-3 mt-2">
            <div className="p-2 relative rounded-lg bg-[rgba(0,0,0,0.2)] inline-block">
              <FontAwesomeIcon
                className="absolute p-1 px-2 m-1 bg-[rgba(0,0,0,0.6)] cursor-pointer rounded-full"
                size={'xs'}
                icon={faX}
                onClick={() => {
                  setFileData(undefined);
                  setFileType(undefined);
                }}
              />
              <img
                style={{ maxWidth: 140, maxHeight: 140 }}
                src={
                  'data:' +
                  fileType +
                  ';base64,' +
                  Buffer.from(fileData).toString('base64')
                }
              />
            </div>
          </div>
        )}
        <div {...getRootProps()} className="message-editor-container pr-6 lg:pr-8">
          <div
            className={
              'message-editor w-full flex items-center gap-2 ' +
              (inReplyTo ? 'message-editor-reply' : '')
            }
          >
            <div
              className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
              data-tooltip-id="attach-image-tooltip"
            >
              <input {...getInputProps()} />
              <FontAwesomeIcon className="text-subtle" icon={faPlus} />
            </div>
            <textarea
              ref={editor}
              className="flex-1 bg-transparent border-0 outline-0 resize-none py-1 placeholder:text-ellipsis placeholder:overflow-hidden placeholder:whitespace-nowrap"
              placeholder={i18n._('Send a message to #{channel_name}', {
                channel_name: channel?.channelName ?? '',
              })}
              rows={
                rowCount > 4
                  ? 4
                  : pendingMessage == ''
                    ? 1
                    : Math.min(
                        4,
                        Math.max(
                          rowCount,
                          Math.round(editor.current!.scrollHeight / 28)
                        )
                      )
              }
              value={pendingMessage}
              onChange={(e) => setPendingMessage(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if ((pendingMessage || fileData) && !isSubmitting) {
                    setIsSubmitting(true);
                    setInReplyTo(undefined);
                    if (pendingMessage) {
                      submitChannelMessage(
                        spaceId,
                        channelId,
                        pendingMessage,
                        queryClient,
                        user.currentPasskeyInfo!,
                        inReplyTo?.messageId
                      ).finally(() => {
                        setIsSubmitting(false);
                      });
                    }
                    if (fileData) {
                      submitChannelMessage(
                        spaceId,
                        channelId,
                        {
                          senderId: user.currentPasskeyInfo!.address,
                          type: 'embed',
                          imageUrl:
                            'data:' +
                            fileType +
                            ';base64,' +
                            Buffer.from(fileData).toString('base64'),
                        } as EmbedMessage,
                        queryClient,
                        user.currentPasskeyInfo!,
                        inReplyTo?.messageId
                      ).finally(() => {
                        setIsSubmitting(false);
                      });
                    }
                    setPendingMessage('');
                    setFileData(undefined);
                    setFileType(undefined);
                  }
                  e.preventDefault();
                }
              }}
            />
            <div
              className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setShowStickers(true);
              }}
              data-tooltip-id="add-sticker-tooltip"
            >
              <FontAwesomeIcon className="text-subtle" icon={faSmile} />
            </div>
            <div
              className="hover:bg-accent-400 cursor-pointer w-8 h-8 rounded-full bg-accent bg-center bg-no-repeat bg-[url('/send.png')] bg-[length:60%] flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if ((pendingMessage || fileData) && !isSubmitting) {
                  setIsSubmitting(true);
                  setInReplyTo(undefined);
                  if (pendingMessage) {
                    submitChannelMessage(
                      spaceId,
                      channelId,
                      pendingMessage,
                      queryClient,
                      user.currentPasskeyInfo!,
                      inReplyTo?.messageId
                    ).finally(() => {
                      setIsSubmitting(false);
                    });
                  }
                  if (fileData) {
                    submitChannelMessage(
                      spaceId,
                      channelId,
                      {
                        senderId: user.currentPasskeyInfo!.address,
                        type: 'embed',
                        imageUrl:
                          'data:' +
                          fileType +
                          ';base64,' +
                          Buffer.from(fileData).toString('base64'),
                      } as EmbedMessage,
                      queryClient,
                      user.currentPasskeyInfo!,
                      inReplyTo?.messageId
                    ).finally(() => {
                      setIsSubmitting(false);
                    });
                  }
                  setPendingMessage('');
                  setFileData(undefined);
                  setFileType(undefined);
                }
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar - only visible on lg+ screens */}
      <div
        className={
          'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-y-auto ' +
          'transition-transform duration-300 ease-in-out ' +
          (showUsers
            ? 'hidden lg:block translate-x-0 fixed top-0 right-0 h-full z-[10000] lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto'
            : 'hidden')
        }
      >
        {roles
          .filter((r) => r.members.length != 0)
          .map((r) => {
            const role = r;
            const roleMembers = Object.keys(activeMembers).filter((s) =>
              role.members.includes(s)
            );
            return (
              <div className="flex flex-col mb-2" key={'role-' + r}>
                <div className="font-semibold ml-[1pt] mb-1 text-xs">
                  {i18n._('{role} - {count}', {
                    role: role.displayName.toUpperCase(),
                    count: roleMembers.length,
                  })}
                </div>
                {roleMembers.map((s) => (
                  <div key={s} className="w-full flex flex-row mb-2">
                    <div
                      className="rounded-full w-[40px] h-[40px] mt-[2px]"
                      style={{
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                        backgroundImage: `url(${
                          members[s]?.userIcon?.includes(
                            DefaultImages.UNKNOWN_USER
                          )
                            ? 'var(--unknown-icon)'
                            : `url(${members[s]?.userIcon})`
                        })`,
                      }}
                    />
                    <div className="flex flex-col ml-2 text-main">
                      <span className="text-md font-bold">
                        {members[s]?.displayName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        <div className="flex flex-col">
          <div className="font-semibold ml-[1pt] mb-1 text-xs">
            {i18n._('No Role - {count}', { count: noRoleMembers.length })}
          </div>
          {noRoleMembers.map((s) => (
            <div key={s} className="w-full flex flex-row mb-2">
              <div
                className="rounded-full w-[40px] h-[40px] mt-[2px]"
                style={{
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundImage: `url(${members[s].userIcon})`,
                }}
              />
              <div className="flex flex-col ml-2 text-main">
                <span className="text-md font-bold">
                  {members[s].displayName}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ReactTooltip
        id="attach-image-tooltip"
        content={t`attach image`}
        place="top"
      />
      <ReactTooltip
        id="add-sticker-tooltip"
        content={t`add sticker`}
        place="top"
      />

      {/* Stickers panel - positioned at top level to avoid stacking context issues */}
      {showStickers && (
        <>
          <div
            className="fixed inset-0 top-16 z-[9990]"
            onClick={() => setShowStickers(false)}
          />
          <div className={`fixed bottom-20 z-[9999] pointer-events-none ${showUsers ? 'right-[300px]' : 'right-6'} transition-all duration-300`}>
            <div className="flex flex-col border border-[var(--surface-5)] shadow-2xl w-[300px] h-[400px] rounded-lg bg-surface-4 pointer-events-auto">
              <div className="font-bold p-2 h-[40px] border-b border-b-[#272026]">
                Stickers
              </div>
              <div className="grid grid-cols-3 auto-rows-min gap-1 w-[300px] p-4 overflow-y-auto max-h-[359px]">
                {space?.stickers.map((s) => {
                  return (
                    <div
                      key={'sticker-' + s.id}
                      className="flex justify-center items-center w-[80px] h-[80px] cursor-pointer hover:bg-surface-6 hover:scale-105 transition-all duration-200 rounded-lg p-1 bg-surface-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        sendSticker(s.id);
                      }}
                    >
                      <img 
                        src={s.imgUrl} 
                        className="max-w-full max-h-full object-contain rounded-md" 
                        alt="sticker"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Channel;
