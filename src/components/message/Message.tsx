import React, { useMemo, useState } from 'react';
import * as moment from 'moment-timezone';
import * as linkify from "linkifyjs";
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Emoji, Message as MessageType, Role } from '../../api/quorumApi';
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
} from '@fortawesome/free-solid-svg-icons';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import UserProfile from '../user/UserProfile';
import { useParams } from 'react-router';
import { InviteLink } from './InviteLink';

type MessageProps = {
  customEmoji?: Emoji[];
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
};

const YTRegex = new RegExp(
  /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu\.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]{11})((?:\?|\&)\S+)?$/
);
const InviteRegex = new RegExp(
  /^((?:https?:)?\/\/?)?((?:www\.)?(?:qm\.one|app\.quorummessenger\.com))(\/#(.*))$/
);

export const Message = ({
  customEmoji,
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
  const time = moment.tz(
    message.createdDate,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const fromNow = time.fromNow();
  const timeFormatted = time.format('h:mm a');
  const [showUserProfile, setShowUserProfile] = useState<boolean>(false);
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
      className={
        'text-white relative hover:bg-[rgba(0,0,0,.05)] flex flex-col ' +
        (message.mentions?.memberIds.includes(user.currentPasskeyInfo!.address)
          ? ' message-mentions-you'
          : '')
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
              className="absolute flex flex-row right-[20px] top-[-10px] p-1 bg-[#4f454c] select-none border border-slate-50/10 shadow-lg rounded-lg"
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
                className="w-5 text-center hover:bg-[rgba(255,255,255,0.05)] rounded-md flex flex-col justify-around cursor-pointer"
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
                className="w-5 text-center hover:bg-[rgba(255,255,255,0.05)] rounded-md flex flex-col justify-around cursor-pointer"
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
                      reaction: '🫡',
                    });
                  }
                }}
                className="w-5 text-center hover:bg-[rgba(255,255,255,0.05)] rounded-md flex flex-col justify-around cursor-pointer"
              >
                🫡
              </div>
              <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-[rgba(255,255,255,0.05)]"></div>
              <div
                onClick={(e) => {
                  setEmojiPickerOpen(message.messageId);
                  setEmojiPickerOpenDirection(
                    e.clientY / height > 0.5 ? 'upwards' : 'downwards'
                  );
                }}
                className="w-5 text-center hover:bg-[rgba(255,255,255,0.05)] rounded-md flex flex-col justify-around cursor-pointer"
              >
                <FontAwesomeIcon icon={faFaceSmileBeam} />
              </div>
              <div
                onClick={() => {
                  setInReplyTo(message);
                  editorRef?.focus();
                }}
                className="w-5 text-center hover:bg-[rgba(255,255,255,0.05)] rounded-md flex flex-col justify-around cursor-pointer"
              >
                <FontAwesomeIcon icon={faReply} />
              </div>
              {canUserDelete && (
                <>
                  <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-[rgba(255,255,255,0.05)]"></div>
                  <div
                    onClick={() => {
                      submitMessage({
                        type: 'remove-message',
                        removeMessageId: message.messageId,
                      });
                    }}
                    className="w-5 text-center hover:bg-[rgba(255,255,255,0.05)] rounded-md flex flex-col justify-around cursor-pointer"
                  >
                    <FontAwesomeIcon className="text-red-400" icon={faTrash} />
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
            style={{ backgroundImage: `url(${sender.userIcon})` }}
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
                            {linkify.test(t) ? <a href={linkify.find(t)[0].href} className="text-[#f3dfc1] hover:text-[#f3dfc1] hover:underline" target="_blank" referrerPolicy="no-referrer">{t}</a> : <>{t}</>}{' '}
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
                      ></iframe>
                    )}
                    {content.imageUrl && (
                      <img
                        src={content.imageUrl}
                        style={{ maxWidth: 300, maxHeight: 300 }}
                      />
                    )}
                  </div>
                );
              }
            })()}
            <div className="flex flex-row pt-1">
              {message.reactions?.map((r) => (
                <div
                  key={message.messageId + '-reactions-' + r.emojiId}
                  className={
                    'cursor-pointer flex flex-row mr-1 border hover:border-[rgba(255,255,255,0.1)] rounded-lg py-[1pt] px-2 bg-[#3f353c]' +
                    (r.memberIds.includes(user.currentPasskeyInfo!.address)
                      ? ' border-[#ffce82]'
                      : ' border-[rgba(0,0,0,0)]')
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
    </div>
  );
};
