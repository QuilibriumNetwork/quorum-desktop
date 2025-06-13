import React, { useMemo, useState } from 'react';
import * as moment from 'moment-timezone';
import * as linkify from 'linkifyjs';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import {
  Emoji,
  Message as MessageType,
  Role,
  Sticker,
} from '../../api/quorumApi';
import EmojiPicker, {
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFaceSmileBeam,
  faReply,
  faTrash,
  faUnlock,
  faLink,
} from '@fortawesome/free-solid-svg-icons';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import UserProfile from '../user/UserProfile';
import { useParams } from 'react-router';
import { InviteLink } from './InviteLink';
import Modal from '../Modal';
import './Message.scss';

type MessageProps = {
  customEmoji?: Emoji[];
  stickers?: { [key: string]: Sticker };
  message: MessageType;
  messageList: MessageType[];
  senderRoles: Role[];
  canEditRoles?: boolean;
  canDeleteMessages?: boolean;
  mapSenderToUser: (senderId: string) => any;
  virtuosoRef?: any;
  emojiPickerOpen: string | undefined;
  setEmojiPickerOpen: React.Dispatch<React.SetStateAction<string | undefined>>;
  emojiPickerOpenDirection: string | undefined;
  setEmojiPickerOpenDirection: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  hoverTarget: string | undefined;
  setHoverTarget: React.Dispatch<React.SetStateAction<string | undefined>>;
  setInReplyTo: React.Dispatch<React.SetStateAction<MessageType | undefined>>;
  repudiability?: boolean;
  editorRef: any;
  height: number;
  submitMessage: (message: any) => Promise<void>;
  kickUserAddress?: string;
  setKickUserAddress?: React.Dispatch<React.SetStateAction<string | undefined>>;
};

const YTRegex = new RegExp(
  /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu\.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]{11})((?:\?|\&)\S+)?$/
);
const InviteRegex = new RegExp(
  /^((?:https?:)?\/\/?)?((?:www\.)?(?:qm\.one|app\.quorummessenger\.com))(\/(invite\/)?#(.*))$/
);

export const Message = ({
  customEmoji,
  stickers,
  message,
  messageList,
  senderRoles,
  canEditRoles,
  canDeleteMessages,
  mapSenderToUser,
  virtuosoRef,
  emojiPickerOpen,
  setEmojiPickerOpen,
  emojiPickerOpenDirection,
  setEmojiPickerOpenDirection,
  hoverTarget,
  setHoverTarget,
  setInReplyTo,
  repudiability,
  editorRef,
  height,
  submitMessage,
  kickUserAddress,
  setKickUserAddress,
}: MessageProps) => {
  const user = usePasskeysContext();
  const { spaceId } = useParams();
  const customEmojis = useMemo(() => {
    if (!customEmoji) return [];

    return customEmoji.map((c) => {
      return {
        names: [c.name],
        id: c.id,
        imgUrl: c.imgUrl,
      } as CustomEmoji;
    });
  }, [customEmoji]);
  let sender = mapSenderToUser(message.content?.senderId);
  const isHashTarget = useMemo(() => {
    return window.location.hash === `#msg-${message.messageId}`;
  }, [message.messageId]);
  const time = moment.tz(
    message.createdDate,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const fromNow = time.fromNow();
  const timeFormatted = time.format('h:mm a');
  const [showUserProfile, setShowUserProfile] = useState<boolean>(false);
  const [openImage, setOpenImage] = useState<string | null>(null);
  const canUserDelete = useMemo(() => {
    return (
      message.content.senderId == user.currentPasskeyInfo!.address ||
      canDeleteMessages
    );
  }, []);

  const displayedTimestmap = time.calendar(null, {
    sameDay: function () {
      return `[Today at ${timeFormatted}]`;
    },
    lastWeek: 'dddd',
    lastDay: `[Yesterday at ${timeFormatted}]`,
    sameElse: function () {
      return `[${fromNow}]`;
    },
  });

  const formatEventMessage = (type: string) => {
    switch (type) {
      case 'join':
        return 'joined';
      case 'leave':
        return 'left';
      case 'kick':
        return 'been kicked';
    }
  };

  return (
    <div
      id={`msg-${message.messageId}`}
      className={
        'text-base relative hover:bg-surface-3 flex flex-col ' +
        (message.mentions?.memberIds.includes(user.currentPasskeyInfo!.address)
          ? ' message-mentions-you'
          : '') +
        (isHashTarget ? ' message-highlighted' : '')
      }
      onMouseOver={() => setHoverTarget(message.messageId)}
      onMouseOut={() => setHoverTarget(undefined)}
      onClick={() => {
        setShowUserProfile(false);
        setEmojiPickerOpen(undefined);
      }}
    >
      {(() => {
        if (message.content.type == 'post') {
          let replyIndex = !message.content.repliesToMessageId
            ? undefined
            : messageList.findIndex(
                (c) =>
                  c.messageId === (message.content as any).repliesToMessageId
              );
          let reply =
            replyIndex !== undefined ? messageList[replyIndex] : undefined;
          if (reply) {
            return (
              <div
                key={reply.messageId + 'rplyhd'}
                className="message-reply-heading"
                onClick={() =>
                  virtuosoRef?.scrollToIndex({
                    index: replyIndex,
                    align: 'start',
                    behavior: 'smooth',
                  })
                }
              >
                <div className="message-reply-curve" />
                <div
                  className="message-reply-sender-icon"
                  style={{
                    backgroundImage: `url(${mapSenderToUser(reply.content.senderId).userIcon})`,
                  }}
                />
                <div className="message-reply-sender-name">
                  {mapSenderToUser(reply.content.senderId).displayName}
                </div>
                <div className="message-reply-text">
                  {reply.content.type == 'post' && reply.content.text}
                </div>
              </div>
            );
          } else {
            return <></>;
          }
        }
      })()}
      {['join', 'leave', 'kick'].includes(message.content.type) && (
        <div className="flex flex-row font-[11px] px-[11px] py-[8px] italic">
          {sender.displayName} has {formatEventMessage(message.content.type)}
        </div>
      )}
      {!['join', 'leave', 'kick'].includes(message.content.type) && (
        <div
          className={
            'flex flex-row font-[11pt] px-[11px] pb-[8px] ' +
            ((
              !(message.content as any).repliesToMessageId
                ? undefined
                : messageList.findIndex(
                    (c) => c.messageId === message.messageId
                  )
            )
              ? ''
              : 'pt-[8px]')
          }
        >
          {emojiPickerOpen === message.messageId && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={
                'absolute right-0 z-[1000] flex flex-row-reverse ' +
                (emojiPickerOpenDirection == 'upwards' ? 'top-[-420px]' : '')
              }
            >
              <EmojiPicker
                suggestedEmojisMode={SuggestionMode.FREQUENT}
                customEmojis={customEmojis}
                getEmojiUrl={(unified, style) => {
                  return '/apple/64/' + unified + '.png';
                }}
                skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                theme={Theme.DARK}
                className={'right-0 absolute'}
                onEmojiClick={(e) => {
                  if (
                    !message.reactions
                      ?.find((r) => r.emojiId == e.emoji)
                      ?.memberIds.includes(user.currentPasskeyInfo!.address)
                  ) {
                    submitMessage({
                      type: 'reaction',
                      messageId: message.messageId,
                      reaction: e.emoji,
                    });
                  } else {
                    submitMessage({
                      type: 'remove-reaction',
                      messageId: message.messageId,
                      reaction: e.emoji,
                    });
                  }
                  setEmojiPickerOpen(undefined);
                }}
              />
            </div>
          )}
          {hoverTarget === message.messageId && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                return false;
              }}
              className="absolute flex flex-row right-[20px] top-[-10px] p-1 bg-surface-0 select-none shadow-lg rounded-lg"
            >
              <div
                onClick={() => {
                  if (
                    !message.reactions
                      ?.find((r) => r.emojiId == '❤️')
                      ?.memberIds.includes(user.currentPasskeyInfo!.address)
                  ) {
                    submitMessage({
                      type: 'reaction',
                      messageId: message.messageId,
                      reaction: '❤️',
                    });
                  }
                }}
                className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125  transition duration-200"
              >
                ❤️
              </div>
              <div
                onClick={() => {
                  if (
                    !message.reactions
                      ?.find((r) => r.emojiId == '👍')
                      ?.memberIds.includes(user.currentPasskeyInfo!.address)
                  ) {
                    submitMessage({
                      type: 'reaction',
                      messageId: message.messageId,
                      reaction: '👍',
                    });
                  }
                }}
                className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125  transition duration-200"
              >
                👍
              </div>
              <div
                onClick={() => {
                  if (
                    !message.reactions
                      ?.find((r) => r.emojiId == '🫡')
                      ?.memberIds.includes(user.currentPasskeyInfo!.address)
                  ) {
                    submitMessage({
                      type: 'reaction',
                      messageId: message.messageId,
                      reaction: '🔥',
                    });
                  }
                }}
                className="w-5 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125  transition duration-200"
              >
                🔥
              </div>
              <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>
              <div
                onClick={(e) => {
                  setEmojiPickerOpen(message.messageId);
                  setEmojiPickerOpenDirection(
                    e.clientY / height > 0.5 ? 'upwards' : 'downwards'
                  );
                }}
                title="More reactions"
                className="w-5 mr-2 text-center hover:scale-125 text-surface-9 hover:text-surface-10 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
              >
                <FontAwesomeIcon icon={faFaceSmileBeam} />
              </div>
              <div
                onClick={() => {
                  setInReplyTo(message);
                  editorRef?.focus();
                }}
                title="Reply"
                className="w-5 mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
              >
                <FontAwesomeIcon icon={faReply} />
              </div>
              <div
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}#msg-${message.messageId}`;
                  navigator.clipboard.writeText(url);
                }}
                title="Copy message link"
                className="w-5 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
              >
                <FontAwesomeIcon icon={faLink} />
              </div>

              {canUserDelete && (
                <>
                  <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>
                  <div
                    onClick={() => {
                      submitMessage({
                        type: 'remove-message',
                        removeMessageId: message.messageId,
                      });
                    }}
                    title="Delete message"
                    className="w-5 text-center transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faTrash} className='text-[rgb(var(--danger))] hover:text-[rgb(var(--danger-hover))] hover:scale-125 ' />
                  </div>
                </>
              )}
            </div>
          )}
          {showUserProfile && spaceId && (
            <div
              onClick={(e) => setShowUserProfile(false)}
              className={
                'absolute left-0 top-0 w-full mt-[-1000px] pb-[200px] pt-[1000px] z-[1000] flex flex-row'
              }
            >
              <div
                className={
                  emojiPickerOpenDirection == 'upwards'
                    ? 'ml-[10px] mt-[-220px]'
                    : 'ml-[10px]'
                }
              >
                <UserProfile
                  spaceId={message.spaceId}
                  canEditRoles={canEditRoles}
                  kickUserAddress={kickUserAddress}
                  setKickUserAddress={setKickUserAddress}
                  roles={senderRoles}
                  user={sender}
                  editMode={false}
                  dismiss={() => {
                    setShowUserProfile(false);
                  }}
                />
              </div>
            </div>
          )}
          <div
            onClick={(e) => {
              setShowUserProfile(true);
              setEmojiPickerOpenDirection(
                e.clientY / height > 0.5 ? 'upwards' : 'downwards'
              );
              e.stopPropagation();
            }}
            className="message-sender-icon"
            style={{
              backgroundImage:
                sender.userIcon === '/unknown.png'
                  ? 'var(--unknown-icon)'
                  : `url(${sender.userIcon})`,
            }}
          />
          <div className="message-content">
            <span className="message-sender-name">{sender.displayName}</span>
            <span className="pl-2">
              {!repudiability && !message.signature && (
                <FontAwesomeIcon
                  title="Message does not have a valid signature, this may not be from the sender"
                  size={'2xs'}
                  icon={faUnlock}
                />
              )}
            </span>
            <span className="message-timestamp">{displayedTimestmap}</span>
            {(() => {
              if (message.content.type == 'post') {
                let content = Array.isArray(message.content.text)
                  ? message.content.text
                  : message.content.text.split('\n');
                return content.map((c, i) => {
                  return (
                    <div
                      key={message.messageId + '-' + i}
                      className="message-post-content break-words"
                    >
                      {c.split(' ').map((t, j) => {
                        if (t.match(new RegExp(`^@<Qm[a-zA-Z0-9]+>$`))) {
                          const mention = mapSenderToUser(
                            t.substring(2, t.length - 1)
                          );
                          return (
                            <React.Fragment
                              key={message.messageId + '-' + i + '-' + j}
                            >
                              <span className={'message-name-mentions-you'}>
                                {mention.displayName}
                              </span>{' '}
                            </React.Fragment>
                          );
                        }

                        if (t.match(YTRegex)) {
                          const group = t.match(YTRegex)![6];
                          return (
                            <div
                              key={message.messageId + '-' + i + '-' + j}
                              className="message-post-content"
                            >
                              <iframe
                                width={'560'}
                                height={'400'}
                                src={'https://www.youtube.com/embed/' + group}
                                allow="autoplay; encrypted-media"
                                className="rounded-lg"
                              ></iframe>
                            </div>
                          );
                        }

                        if (t.match(InviteRegex)) {
                          return (
                            <InviteLink
                              key={message.messageId + '-' + j}
                              inviteLink={t}
                            />
                          );
                        }

                        return (
                          <React.Fragment
                            key={message.messageId + '-' + i + '-' + j}
                          >
                            {linkify.test(t) ? (
                              <a
                                href={linkify.find(t)[0].href}
                                className="text-primary-300 hover:text-primary-400 hover:underline"
                                target="_blank"
                                referrerPolicy="no-referrer"
                              >
                                {t}
                              </a>
                            ) : (
                              <>{t}</>
                            )}{' '}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  );
                });
              } else if (message.content.type == 'embed') {
                let content = message.content as {
                  imageUrl?: string;
                  videoUrl?: string;
                  width?: string;
                  height?: string;
                };
                return (
                  <div key={message.messageId} className="message-post-content">
                    {content.videoUrl?.startsWith(
                      'https://www.youtube.com/embed'
                    ) && (
                      <iframe
                        width={content.width || '560'}
                        height={content.height || '400'}
                        src={content.videoUrl}
                        allow="autoplay; encrypted-media"
                        className="rounded-lg"
                      ></iframe>
                    )}
                    {content.imageUrl && (
                      <img
                        src={content.imageUrl}
                        style={{
                          maxWidth: 300,
                          maxHeight: 300,
                          cursor: 'pointer',
                        }}
                        className="rounded-lg hover:opacity-0 transition-opacity duration-200 cursor-pointer"
                        onClick={(e) => {
                          const img = e.currentTarget;
                          if (
                            (img.naturalWidth > 300 ||
                              img.naturalHeight > 300) &&
                            content.imageUrl
                          ) {
                            setOpenImage(content.imageUrl);
                          }
                        }}
                      />
                    )}
                  </div>
                );
              } else if (message.content.type == 'sticker') {
                const sticker = (stickers ?? {})[message.content.stickerId];
                return (
                  <img
                    src={sticker?.imgUrl}
                    style={{ maxWidth: 300, maxHeight: 300 }}
                    className="rounded-lg"
                  />
                );
              }
            })()}
            <div className="flex flex-row pt-1">
              {message.reactions?.map((r) => (
                <div
                  key={message.messageId + '-reactions-' + r.emojiId}
                  className={
                    'cursor-pointer flex flex-row mr-1 border hover:border-surface-7 rounded-lg py-[1pt] px-2 bg-[var(--surface-0)]' +
                    (r.memberIds.includes(user.currentPasskeyInfo!.address)
                      ? ' bg-highlight border border-transparent hover:bg-highlight-hover hover:border-transparent'
                      : ' bg-surface-0 border border-transparent hover:bg-surface-5 hover:border-transparent')
                  }
                  onClick={() => {
                    if (
                      !r.memberIds.includes(user.currentPasskeyInfo!.address)
                    ) {
                      submitMessage({
                        type: 'reaction',
                        messageId: message.messageId,
                        reaction: r.emojiId,
                      });
                    } else {
                      submitMessage({
                        type: 'remove-reaction',
                        messageId: message.messageId,
                        reaction: r.emojiId,
                      });
                    }
                  }}
                >
                  {customEmojis.find((e) => e.id === r.emojiName) ? (
                    <img
                      width="24"
                      className="mr-2"
                      src={
                        customEmojis.find((e) => e.id === r.emojiName)?.imgUrl
                      }
                    />
                  ) : (
                    r.emojiName
                  )}{' '}
                  {r.count}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {openImage && (
        <Modal
          title=""
          visible={true}
          onClose={() => setOpenImage(null)}
          hideClose={false}
        >
          <div className="flex justify-center items-center">
            <img
              src={openImage}
              style={{
                maxHeight: '80vh',
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
              }}
              className="rounded-lg"
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
