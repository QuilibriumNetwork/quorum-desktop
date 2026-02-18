import * as React from 'react';
import { Icon, Callout, ColorSwatch, Spacer, useTheme } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { SpaceTag } from '../../space/SpaceTag';
import { BroadcastSpaceTag } from '../../../api/quorumApi';
import { SPACE_TAG_COLORS_LIGHT, SPACE_TAG_COLORS_DARK, getSpaceTagColorHex, IconColor } from '../../space/IconPicker/types';
import { validateSpaceTagLetters } from '../../../utils/validation';

interface SpaceTagSettingsProps {
  spaceId: string;
  letters: string;
  setLetters: (letters: string) => void;
  backgroundColor: IconColor;
  setBackgroundColor: (color: IconColor) => void;
  tagImageUrl: string;
  tagImageError: string | null;
  isTagImageUploading: boolean;
  isTagImageDragActive: boolean;
  getTagImageRootProps: () => any;
  getTagImageInputProps: () => any;
  clearTagImageError: () => void;
  removeTagImage: () => void;
}

const SpaceTagSettings: React.FunctionComponent<SpaceTagSettingsProps> = ({
  spaceId,
  letters,
  setLetters,
  backgroundColor,
  setBackgroundColor,
  tagImageUrl,
  tagImageError,
  isTagImageUploading,
  isTagImageDragActive,
  getTagImageRootProps,
  getTagImageInputProps,
  clearTagImageError,
  removeTagImage,
}) => {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const lettersValid = validateSpaceTagLetters(letters);

  const previewTag: BroadcastSpaceTag | null =
    lettersValid
      ? { letters, url: tagImageUrl, backgroundColor, spaceId }
      : null;

  const handleLettersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setLetters(value.slice(0, 4));
  };

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">
            <Trans>Space Tag</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>
              Create a tag that members can display next to their username in messages.
              Upload an image and set a 4-character code to identify your Space.
            </Trans>
          </div>
        </div>
      </div>

      <div className="modal-content-section">
        {/* Preview */}
        {previewTag && (
          <>
            <div className="text-subtitle-2 mb-2">
              <Trans>Preview</Trans>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <SpaceTag tag={previewTag} size="lg" />
              <SpaceTag tag={previewTag} size="md" />
              <SpaceTag tag={previewTag} size="sm" />
            </div>
            <Spacer size="md" direction="vertical" borderTop={true} />
          </>
        )}

        {/* Image upload */}
        <div className="text-subtitle-2 mb-2">
          <Trans>Tag Image</Trans>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div
            {...getTagImageRootProps()}
            className={`btn-secondary cursor-pointer ${isTagImageDragActive ? 'opacity-70' : ''}`}
          >
            {isTagImageUploading ? (
              <span><Trans>Processing...</Trans></span>
            ) : (
              <span><Trans>Upload Image</Trans></span>
            )}
            <input {...getTagImageInputProps()} />
          </div>
          {tagImageUrl && (
            <>
              <div
                className="rounded-full overflow-hidden flex-shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: getSpaceTagColorHex(backgroundColor, isDarkTheme),
                }}
              >
                <img
                  src={tagImageUrl}
                  alt=""
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <button
                className="btn-ghost text-danger hover:text-danger-hover p-2 -ml-2"
                onClick={removeTagImage}
                type="button"
                aria-label="Remove image"
              >
                <Icon name="trash" size="sm" />
              </button>
            </>
          )}
        </div>
        {tagImageError && (
          <Callout variant="error" size="sm" className="mt-2">
            <div className="flex items-center justify-between">
              <span>{tagImageError}</span>
              <Icon
                name="close"
                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                onClick={clearTagImageError}
              />
            </div>
          </Callout>
        )}

        <Spacer size="md" direction="vertical" borderTop={true} />

        {/* 4-letter code */}
        <div className="text-subtitle-2 mb-2">
          <Trans>4-Character Code</Trans>
        </div>
        <input
          type="text"
          className="quorum-input font-mono uppercase tracking-widest"
          placeholder="GAME"
          value={letters}
          onChange={handleLettersChange}
          maxLength={4}
          style={{ width: 140 }}
        />
        {letters.length > 0 && letters.length < 4 && (
          <p className="text-sm sm:text-xs text-warning mt-1">
            <Trans>Must be exactly 4 characters</Trans>
          </p>
        )}
        {letters.length > 0 && letters.length === 4 && (
          <p className="text-sm sm:text-xs text-success mt-1">
            <Trans>Valid code</Trans>
          </p>
        )}
        <p className="text-label mt-2 mb-4">
          <Trans>Letters A–Z and numbers 0–9 only. Auto-uppercase.</Trans>
        </p>

        <Spacer size="md" direction="vertical" borderTop={true} />

        {/* Background color */}
        <div className="text-subtitle-2 mb-2">
          <Trans>Background Color</Trans>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isDarkTheme ? SPACE_TAG_COLORS_DARK : SPACE_TAG_COLORS_LIGHT).map((colorOption) => (
            <ColorSwatch
              key={colorOption.value}
              color={colorOption.value === 'default' ? 'gray' : colorOption.value as any}
              isActive={backgroundColor === colorOption.value}
              onPress={() => setBackgroundColor(colorOption.value as IconColor)}
              size="medium"
              showCheckmark={true}
              style={{ backgroundColor: colorOption.hex }}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default SpaceTagSettings;
