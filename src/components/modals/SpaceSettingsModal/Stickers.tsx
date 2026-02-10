import * as React from 'react';
import { Button, Icon, Tooltip, ScrollContainer, Callout } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface Sticker {
  name: string;
  imgUrl: string;
}

interface StickersProps {
  stickers: Sticker[];
  canAddMoreStickers: boolean;
  stickerFileError: string | null;
  getStickerRootProps: () => any;
  getStickerInputProps: () => any;
  clearStickerFileError: () => void;
  updateSticker: (index: number, sticker: Partial<Sticker>) => void;
  removeSticker: (index: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

const Stickers: React.FunctionComponent<StickersProps> = ({
  stickers,
  canAddMoreStickers,
  stickerFileError,
  getStickerRootProps,
  getStickerInputProps,
  clearStickerFileError,
  updateSticker,
  removeSticker,
  onSave,
  isSaving,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">
            <Trans>Stickers</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>
              Add up to 50 custom stickers. Custom stickers can
              only be used within a Space. You can upload PNG,
              JPG or GIF, max 25MB (automatically optimized).
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
                name="close"
                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                onClick={clearStickerFileError}
              />
            </div>
          </Callout>
        )}
        {stickers.length > 0 && (
          <ScrollContainer height="md" className="mt-4 !border-subtle">
            {stickers.map((em, i) => {
            return (
              <div
                key={'space-editor-sticker-' + i}
                className="modal-list-item text-main flex flex-row px-3 py-2 items-center"
              >
                <img width="72" height="72" src={em.imgUrl} alt={em.name} className="rounded-md" />
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
      </div>
    </>
  );
};

export default Stickers;