import * as React from 'react';
import { Button, Icon, Tooltip, ScrollContainer, Callout } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface Emoji {
  name: string;
  imgUrl: string;
}

interface EmojisProps {
  emojis: Emoji[];
  canAddMoreEmojis: boolean;
  emojiFileError: string | null;
  getEmojiRootProps: () => any;
  getEmojiInputProps: () => any;
  clearEmojiFileError: () => void;
  updateEmoji: (index: number, emoji: Partial<Emoji>) => void;
  removeEmoji: (index: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

const Emojis: React.FunctionComponent<EmojisProps> = ({
  emojis,
  canAddMoreEmojis,
  emojiFileError,
  getEmojiRootProps,
  getEmojiInputProps,
  clearEmojiFileError,
  updateEmoji,
  removeEmoji,
  onSave,
  isSaving,
}) => {
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
              GIF, max 5MB (automatically optimized).
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
          <ScrollContainer height="md" className="mt-4 !border-subtle">
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
      </div>
    </>
  );
};

export default Emojis;