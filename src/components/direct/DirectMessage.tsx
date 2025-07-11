import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faUsers, faX } from '@fortawesome/free-solid-svg-icons';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { EmbedMessage, Message as MessageType } from '../../api/quorumApi';
import './DirectMessage.scss';
import { useMessages, useRegistration } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { useConversation } from '../../hooks/queries/conversation/useConversation';
import { useInvalidateConversation } from '../../hooks/queries/conversation/useInvalidateConversation';
import { MessageList } from '../message/MessageList';
import { FileWithPath, useDropzone } from 'react-dropzone';
import Compressor from 'compressorjs';

import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import ReactTooltip from '../ReactTooltip';
import ClickToCopyContent from '../ClickToCopyContent';
import { DefaultImages } from '../../utils';
import CopyToClipboard from '../CopyToClipboard';

const DirectMessage: React.FC<{}> = (p: {}) => {
  const [fileError, setFileError] = useState<string | null>(null);
  let { address } = useParams<{ address: string }>();
  const conversationId = address! + '/' + address!;
  const [pendingMessage, setPendingMessage] = useState('');
  const user = usePasskeysContext();
  const editor = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const {
    data: messages,
    fetchNextPage,
    fetchPreviousPage,
  } = useMessages({ spaceId: address!, channelId: address! });
  const { data: registration } = useRegistration({ address: address! });
  const { data: self } = useRegistration({
    address: user.currentPasskeyInfo!.address,
  });
  const { messageDB, submitMessage, keyset } = useMessageDB();
  const { data: conversation } = useConversation({
    conversationId: conversationId,
  });
  const invalidateConversation = useInvalidateConversation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inReplyTo, setInReplyTo] = useState<MessageType>();
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const [fileType, setFileType] = React.useState<string>();
  const { getRootProps, getInputProps, acceptedFiles, isDragActive } =
    useDropzone({
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/gif': ['.gif'],
      },
      minSize: 0,
      maxSize: 2 * 1024 * 1024, // 2MB
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

  useEffect(() => {
    if ((messages.pages[0] as any)?.messages?.length === 0) {
      fetchNextPage();
      fetchPreviousPage();
    }
  }, []);

  const members = useMemo(() => {
    let m = {} as {
      [address: string]: {
        displayName?: string;
        userIcon?: string;
        address: string;
      };
    };
    if (conversation?.conversation) {
      m[address!] = {
        displayName: conversation.conversation!.displayName,
        userIcon: conversation.conversation!.icon,
        address: address!,
      };
    } else if (registration.registration) {
      m[registration.registration.user_address] = {
        displayName: t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
        address: registration.registration.user_address,
      };
    }
    m[user.currentPasskeyInfo!.address] = {
      address: user.currentPasskeyInfo!.address,
      userIcon: user.currentPasskeyInfo!.pfpUrl,
      displayName: user.currentPasskeyInfo!.displayName,
    };
    return m;
  }, [registration, conversation]);
  const [showUsers, setShowUsers] = React.useState(false);
  const [acceptChat, setAcceptChat] = React.useState(false);

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
  }, [messages]);

  useEffect(() => {
    messageDB.saveReadTime({
      conversationId,
      lastMessageTimestamp: Date.now(),
    });
    invalidateConversation({ conversationId });

    // determine if the user has sent any messages in this conversation
    const userMessages = messageList.filter(
      (m) => m.content.senderId === user.currentPasskeyInfo!.address
    );

    // if the user has sent any messages, do not show the accept chat message
    console.log(userMessages);
    if (userMessages.length > 0) {
      setAcceptChat(true);
    }
  }, [messageList]);

  const submit = async (message: any) => {
    await submitMessage(
      address!,
      message,
      self.registration!,
      registration.registration!,
      queryClient,
      user.currentPasskeyInfo!,
      keyset
    );
  };

  const rowCount = pendingMessage.split('').filter((c) => c == '\n').length + 1;

  const userIcon = mapSenderToUser(address ?? '').userIcon;
  const icon = userIcon?.includes(DefaultImages.UNKNOWN_USER)
    ? 'var(--unknown-icon)'
    : 'url(' + userIcon + ')';
  console.log('userIcon', icon);
  return (
    <div className="direct-message">
      <div className="flex flex-col">
        <div className="direct-message-name mt-[8px] pb-[8px] mx-[11px] text-main flex flex-row justify-between">
          <div className="flex flex-row">
            <div className="flex flex-col justify-around">
              <div
                className="w-[28px] h-[28px] bg-cover bg-center rounded-full"
                style={{
                  backgroundImage: `${icon}`,
                }}
              />
            </div>
            <div className="flex flex-row pl-2">
              <div className="flex flex-col justify-around font-semibold">
                <span>{mapSenderToUser(address ?? '').displayName} |</span>
              </div>
              <div className="flex flex-col justify-around pl-1">
                <div className="flex flex-row items-center">
                  <ClickToCopyContent
                    text={address ?? ''}
                    tooltipText={t`Copy address to clipboard`}
                    className="font-light text-sm text-subtle"
                    iconPosition="right"
                    iconClassName="text-subtle hover:text-surface-7"
                  >
                    {address}
                  </ClickToCopyContent>
                </div>
              </div>
            </div>
          </div>
          <span className="float-right h-4">
            <FontAwesomeIcon
              onClick={() => {
                setShowUsers((prev) => !prev);
              }}
              className="w-4 p-1 rounded-md cursor-pointer hover:bg-surface-6"
              icon={faUsers}
            />
          </span>
        </div>
        <div
          className={
            'message-list' + (!showUsers ? ' message-list-expanded' : '')
          }
        >
          <MessageList
            isRepudiable={true}
            roles={[]}
            canDeleteMessages={() => false}
            editor={editor}
            messageList={messageList}
            setInReplyTo={setInReplyTo}
            members={members}
            submitMessage={submit}
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
                className="rounded-t-lg px-4 cursor-pointer py-1 text-sm flex flex-row justify-between bg-surface-4"
              >
                {i18n._('Replying to {user}', {
                  user: mapSenderToUser(inReplyTo.content.senderId).displayName,
                })}
                <span
                  className="message-in-reply-dismiss"
                  onClick={() => setInReplyTo(undefined)}
                >
                  x
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

        {!acceptChat && (
          <div className="flex flex-row justify-center">
            <div className="flex flex-row justify-center">
              <div className="w-full px-3 py-2 mb-2 text-sm text-center rounded-lg bg-surface-4 text-subtle">
                {t`Until you reply, this sender will not see your display name or profile picture`}
              </div>
            </div>
          </div>
        )}

        <div {...getRootProps()} className="message-editor-container">
          <div
            className={
              'message-editor w-full flex items-center gap-2 ' +
              (inReplyTo ? 'message-editor-reply' : '')
            }
          >
            <div
              className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
              data-tooltip-id="attach-image-tooltip-dm"
            >
              <input {...getInputProps()} />
              <FontAwesomeIcon className="text-subtle" icon={faPlus} />
            </div>
            <textarea
              ref={editor}
              className="flex-1 bg-transparent border-0 outline-0 resize-none py-1"
              placeholder={i18n._('Send a message to {user}', {
                user: mapSenderToUser(address ?? '').displayName,
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
                      submitMessage(
                        address!,
                        pendingMessage,
                        self.registration!,
                        registration.registration!,
                        queryClient,
                        user.currentPasskeyInfo!,
                        keyset,
                        inReplyTo?.messageId
                      ).finally(() => {
                        setIsSubmitting(false);
                      });
                    }
                    if (fileData) {
                      submitMessage(
                        address!,
                        {
                          senderId: user.currentPasskeyInfo!.address,
                          type: 'embed',
                          imageUrl:
                            'data:' +
                            fileType +
                            ';base64,' +
                            Buffer.from(fileData).toString('base64'),
                        } as EmbedMessage,
                        self.registration!,
                        registration.registration!,
                        queryClient,
                        user.currentPasskeyInfo!,
                        keyset,
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
              className="hover:bg-accent-400 cursor-pointer w-8 h-8 rounded-full bg-accent bg-center bg-no-repeat bg-[url('/send.png')] bg-[length:60%] flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if ((pendingMessage || fileData) && !isSubmitting) {
                  setIsSubmitting(true);
                  setInReplyTo(undefined);
                  if (pendingMessage) {
                    submitMessage(
                      address!,
                      pendingMessage,
                      self.registration!,
                      registration.registration!,
                      queryClient,
                      user.currentPasskeyInfo!,
                      keyset,
                      inReplyTo?.messageId
                    ).finally(() => {
                      setIsSubmitting(false);
                    });
                  }
                  if (fileData) {
                    submitMessage(
                      address!,
                      {
                        senderId: user.currentPasskeyInfo!.address,
                        type: 'embed',
                        imageUrl:
                          'data:' +
                          fileType +
                          ';base64,' +
                          Buffer.from(fileData).toString('base64'),
                      } as EmbedMessage,
                      self.registration!,
                      registration.registration!,
                      queryClient,
                      user.currentPasskeyInfo!,
                      keyset,
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
      <div
        className={
          'w-[260px] bg-sidebar p-3 ' + // removed overflow-scroll
          (showUsers ? '' : 'hidden')
        }
      >
        <div className="flex flex-col">
          {Object.keys(members).map((s) => (
            <div key={s} className="w-full flex flex-row mb-2">
              <div
                className="rounded-full w-[40px] h-[40px] mt-[2px]"
                style={{
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundImage: `url(${members[s].userIcon})`,
                }}
              />
              <div className="flex flex-col ml-2">
                <span className="text-md font-bold truncate w-[190px] text-main/90">
                  {members[s].displayName}{' '}
                  {members[s].address === user.currentPasskeyInfo!.address && (
                    <span className="text-xs text-subtle">({t`You`})</span>
                  )}
                </span>
                <span className="text-xs truncate w-[190px] text-surface-9 dark:text-surface-8">
                  <ClickToCopyContent
                    text={members[s].address}
                    tooltipText={t`Copy address to clipboard`}
                    tooltipLocation="left-start"
                    iconClassName="text-surface-9 hover:text-surface-10 dark:text-surface-8 dark:hover:text-surface-9"
                  >
                    {members[s].address}
                  </ClickToCopyContent>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ReactTooltip
        id="attach-image-tooltip-dm"
        content={t`attach image`}
        place="top"
      />
    </div>
  );
};

export default DirectMessage;
