import * as React from 'react';
import { Switch, Icon, Tooltip } from '../../primitives';
import { t } from '@lingui/core/macro';
import ConfirmationModal from '../ConfirmationModal';

interface PrivacyProps {
  allowSync: boolean;
  setAllowSync: (value: boolean) => void;
  nonRepudiable: boolean;
  setNonRepudiable: (value: boolean) => void;
  isConfigLoaded?: boolean;
  deliveryReceipts: boolean;
  setDeliveryReceipts: (value: boolean) => void;
  readReceipts: boolean;
  setReadReceipts: (value: boolean) => void;
  typingIndicatorsDM: boolean;
  setTypingIndicatorsDM: (value: boolean) => void;
  typingIndicatorsSpaces: boolean;
  setTypingIndicatorsSpaces: (value: boolean) => void;
  generateYouTubePreviews: boolean;
  setGenerateYouTubePreviews: (value: boolean) => void;
  isProfilePublic: boolean;
  setIsProfilePublic: (value: boolean) => void;
}

const Privacy: React.FunctionComponent<PrivacyProps> = ({
  allowSync,
  setAllowSync,
  nonRepudiable,
  setNonRepudiable,
  isConfigLoaded = true,
  deliveryReceipts,
  setDeliveryReceipts,
  readReceipts,
  setReadReceipts,
  typingIndicatorsDM,
  setTypingIndicatorsDM,
  typingIndicatorsSpaces,
  setTypingIndicatorsSpaces,
  generateYouTubePreviews,
  setGenerateYouTubePreviews,
  isProfilePublic,
  setIsProfilePublic,
}) => {
  // Public-profile confirmation. Local state because the global
  // ConfirmationModalProvider lives below UserSettingsModal in the tree
  // (it's a child of Layout, while UserSettingsModal renders from a
  // sibling ModalProvider). Using ConfirmationModal directly avoids the
  // out-of-scope context error.
  const [isPublicProfileConfirmOpen, setIsPublicProfileConfirmOpen] = React.useState(false);

  // Turning ON publishes your name/avatar/bio to a public endpoint, so
  // require explicit confirmation the first time. Turning OFF unpublishes
  // silently — the user is reducing exposure, no confirmation needed.
  const handleTogglePublicProfile = React.useCallback(
    (next: boolean) => {
      if (!next) {
        setIsProfilePublic(false);
        return;
      }
      if (isProfilePublic) return; // Already on; no-op.
      setIsPublicProfileConfirmOpen(true);
    },
    [isProfilePublic, setIsProfilePublic]
  );

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title flex items-center gap-2">
            <Icon name="eye" size="lg" />
            {t`Privacy`}
          </div>
          <div className="pt-2 text-body">
            {t`Control what others can see about you and how your behaviour is shared.`}
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="modal-content-info">
          <div className="flex flex-row items-center gap-3 mb-3">
            <Switch value={allowSync} onChange={setAllowSync} disabled={!isConfigLoaded} />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Enable sync`}
              </div>
              <Tooltip
                id="settings-allow-sync-tooltip"
                content={t`When enabled, synchronizes your user data, Spaces, and Space keys between devices. Enabling this increases metadata visibility of your account, which can reveal when you have joined new Spaces, although not the Spaces you have joined.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 mb-3">
            <Switch value={nonRepudiable} onChange={setNonRepudiable} />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Always sign Direct Messages`}
              </div>
              <Tooltip
                id="settings-non-repudiable-tooltip"
                content={t`When you sign a message, you are confirming that it comes from your key. When you don't sign a message, you have plausible deniability. You can control this setting for each conversation and message individually.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3">
            <Switch
              value={isProfilePublic}
              onChange={handleTogglePublicProfile}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Public profile`}
              </div>
              <Tooltip
                id="settings-public-profile-tooltip"
                content={t`When on, anyone with your Quorum address can see your display name, avatar, and bio, even outside the Spaces you share. Useful when someone DMs you and you want them to recognize who you are. Off by default.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="border-t border-dashed border-surface-7 my-5" />
          <div className="flex flex-row items-center gap-3">
            <Switch value={false} onChange={() => {}} disabled={true} />
            <div className="flex flex-row items-center">
              <div className="text-label-strong text-muted">
                {t`Show Online Status`}
              </div>
              <Tooltip
                id="settings-show-online-status-tooltip"
                content={t`When enabled, other users can see when you are active. This feature is not yet available.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 mt-3">
            <Switch
              value={deliveryReceipts}
              onChange={(value: boolean) => {
                setDeliveryReceipts(value);
                // Cascade: turning delivery OFF also turns read OFF
                if (!value) setReadReceipts(false);
              }}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Delivery receipts`}
              </div>
              <Tooltip
                id="settings-delivery-receipts-tooltip"
                content={t`When on, senders see when their messages reach your device, and you see when yours reach theirs.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          {deliveryReceipts && (
          <div className="flex flex-row items-center gap-3 mt-3 ml-6">
            <Switch
              value={readReceipts}
              onChange={setReadReceipts}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Read receipts`}
              </div>
              <Tooltip
                id="settings-read-receipts-tooltip"
                content={t`When on, senders see when you've read their messages, and you see when yours are read.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          )}
          <div className="flex flex-row items-center gap-3 mt-3">
            <Switch
              value={typingIndicatorsDM}
              onChange={setTypingIndicatorsDM}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Typing indicators in DMs`}
              </div>
              <Tooltip
                id="settings-typing-indicators-dm-tooltip"
                content={t`When on, your DM contacts see when you're typing, and you see when they're typing.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 mt-3">
            <Switch
              value={typingIndicatorsSpaces}
              onChange={setTypingIndicatorsSpaces}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Typing indicators in Spaces`}
              </div>
              <Tooltip
                id="settings-typing-indicators-spaces-tooltip"
                content={t`When on, everyone in a Space channel sees when you're typing, and you see when they're typing.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 mt-3">
            <Switch
              value={generateYouTubePreviews}
              onChange={setGenerateYouTubePreviews}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Generate YouTube previews`}
              </div>
              <Tooltip
                id="settings-generate-youtube-previews-tooltip"
                content={t`When on, your device fetches thumbnails from YouTube for the links you send, which reveals your IP to Google. When off, recipients see a plain link instead.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        visible={isPublicProfileConfirmOpen}
        title={t`Make profile public?`}
        message={t`Your display name, profile picture, and bio will be readable by anyone with your Quorum address, including people outside the Spaces you share with them. Existing Space members will see your latest profile even if they joined before you set it. You can turn this off at any time.`}
        variant="danger"
        confirmText={t`Make Public`}
        cancelText={t`Cancel`}
        showProtip={false}
        onConfirm={() => {
          setIsProfilePublic(true);
          setIsPublicProfileConfirmOpen(false);
        }}
        onCancel={() => setIsPublicProfileConfirmOpen(false)}
      />
    </>
  );
};

export default Privacy;
