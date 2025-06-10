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

const DirectMessage: React.FC<{}> = (p: {}) => {
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
      maxSize: 2 * 1024 * 1024,
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
        displayName: 'Unknown User',
        userIcon: '/unknown.png',
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

  const mapSenderToUser = (senderId: string) => {
    return (
      members[senderId] || {
        displayName: 'Unknown User',
        userIcon: '/unknown.png',
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

  return (
    <div className="direct-message">
      <div className="flex flex-col">
        <div className="direct-message-name mt-[8px] pb-[8px] mx-[11px] text-text-base flex flex-row justify-between">
          <div className="flex flex-row">
            <div className="flex flex-col justify-around">
              <div
                className="w-[28px] h-[28px] bg-cover bg-center rounded-full"
                style={{
                  backgroundImage: `url(${mapSenderToUser(address ?? '').userIcon ?? '/unknown.png'})`,
                }}
              />
            </div>
            <div className="flex flex-row pl-2">
              <div className="flex flex-col justify-around font-semibold">
                <span>{mapSenderToUser(address ?? '').displayName} |</span>
              </div>
              <div className="flex flex-col justify-around pl-1">
                <span className="font-light text-sm">{address}</span>
              </div>
            </div>
          </div>
          <span className="float-right h-4">
            <FontAwesomeIcon
              onClick={() => {
                setShowUsers((prev) => !prev);
              }}
              className="w-4 p-1 rounded-md cursor-pointer hover:bg-[rgba(255,255,255,0.2)]"
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
        {(() => {
          if (inReplyTo) {
            return (
              <div
                onClick={() => setInReplyTo(undefined)}
                className="rounded-t-lg px-4 cursor-pointer py-1 text-sm flex flex-row justify-between bg-[var(--surface-3)] ml-[11px] mr-[11px]"
              >
                Replying to{' '}
                {mapSenderToUser(inReplyTo.content.senderId).displayName}{' '}
                <span
                  className="message-in-reply-dismiss"
                  onClick={() => setInReplyTo(undefined)}
                >
                  ×
                </span>
              </div>
            );
          } else {
            return <></>;
          }
        })()}
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
        <div {...getRootProps()} className="flex flex-row relative">
          <div
            className={
              'absolute hover:bg-surface-6 flex flex-col justify-around cursor-pointer left-4 w-8 h-8 rounded-full bg-[length:60%] bg-surface-5 ' +
              (inReplyTo ? 'top-1' : 'top-3')
            }
          >
            <input {...getInputProps()} />
            <FontAwesomeIcon className="text-text-base" icon={faPlus} />
          </div>
          <textarea
            ref={editor}
            className={
              'message-editor w-full !pl-11 !pr-11' +
              (inReplyTo ? 'message-editor-reply' : '')
            }
            placeholder={
              'Send a message to ' + mapSenderToUser(address ?? '').displayName
            }
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
            className={
              "absolute hover:bg-primary-400 cursor-pointer right-4 w-8 h-8 rounded-full bg-[length:50%] bg-primary bg-center bg-no-repeat bg-[url('/send.png')] " +
              (inReplyTo ? 'top-1' : 'top-3')
            }
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
      <div
        className={
          'w-[260px] bg-surface-4 p-3 overflow-scroll ' +
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
              <div className="flex flex-col ml-2 text-text-base">
                <span className="text-md font-bold truncate w-[190px]">
                  {members[s].displayName}
                </span>
                <span className="text-sm truncate w-[190px]">
                  {members[s].address}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DirectMessage;
