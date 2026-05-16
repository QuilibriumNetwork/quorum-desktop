import React from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@quilibrium/quorum-shared';
import { Icon } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { ClickToCopyContent } from '../ui';
import { getAddressSuffix } from '../../utils';
import { useMessageDB } from '../context/useMessageDB';
import { useUserNote, buildUserNoteKey } from '../../hooks/queries/userNotes';
import { validateUserNote, MAX_USER_NOTE_LENGTH } from '../../hooks/business/validation';
import './DMUserProfileSidebar.scss';

interface DMUserProfileSidebarProps {
  user: {
    address: string;
    displayName?: string;
    userIcon?: string;
    bio?: string;
  };
}

export const DMUserProfileSidebar: React.FC<DMUserProfileSidebarProps> = ({ user }) => {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();
  const { data: userNoteData } = useUserNote({ targetAddress: user.address });

  const [noteValue, setNoteValue] = React.useState('');
  const [noteCharCount, setNoteCharCount] = React.useState(0);
  const [isNoteFocused, setIsNoteFocused] = React.useState(false);
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);

  React.useEffect(() => {
    const existing = userNoteData?.note ?? '';
    setNoteValue(existing);
    setNoteCharCount(existing.length);
    if (existing) setIsNoteOpen(true);
  }, [userNoteData?.note]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_USER_NOTE_LENGTH) {
      setNoteValue(val);
      setNoteCharCount(val.length);
    }
  };

  const handleNoteBlur = async () => {
    setIsNoteFocused(false);
    const noteKey = buildUserNoteKey({ targetAddress: user.address });
    if (!noteValue.trim()) {
      setIsNoteOpen(false);
      try {
        await messageDB.deleteUserNote(user.address);
        queryClient.setQueryData(noteKey, null);
      } catch (err) {
        logger.error('Failed to delete user note', err);
      }
      return;
    }
    const errors = validateUserNote(noteValue);
    if (errors.length > 0) return;
    try {
      await messageDB.saveUserNote(user.address, noteValue);
      queryClient.setQueryData(noteKey, { targetAddress: user.address, note: noteValue.trim(), updatedAt: Date.now() });
    } catch (err) {
      logger.error('Failed to save user note', err);
    }
  };

  return (
    <div className="dm-profile-sidebar">
      {/* Identity block */}
      <div className="dm-profile-identity">
        <UserAvatar
          userIcon={user.userIcon}
          displayName={user.displayName ?? user.address}
          address={user.address}
          size={96}
        />
        <span className="dm-profile-name truncate text-main font-semibold text-base">
          {user.displayName ?? user.address}
        </span>
        <div className="dm-profile-address">
          <ClickToCopyContent
            text={user.address}
            tooltipText={t`Copy address`}
            tooltipLocation="right"
            className="text-subtle"
            iconPosition="right"
            iconClassName="text-subtle hover:text-surface-7"
            iconSize="xs"
            textSize="xs"
          >
            {getAddressSuffix(user.address)}
          </ClickToCopyContent>
        </div>
      </div>

      {/* Bio section */}
      <div className="dm-profile-section">
        <div className="dm-profile-section-label text-subtle">
          <Trans>Bio</Trans>
        </div>
        {user.bio ? (
          <p className="text-sm text-main">{user.bio}</p>
        ) : (
          <p className="text-sm text-subtle">{t`No bio yet.`}</p>
        )}
      </div>

      {/* Notes section */}
      <div className="dm-profile-section">
        {isNoteOpen ? (
          <div className="user-profile-note-section">
            <div className="user-profile-note-label">
              <strong>{t`Note`}</strong>{' '}<span className="font-normal">{t`(only visible to you)`}</span>
            </div>
            <textarea
              className="user-profile-note-textarea"
              placeholder={t`Add a personal note...`}
              value={noteValue}
              maxLength={MAX_USER_NOTE_LENGTH}
              onChange={handleNoteChange}
              onFocus={() => setIsNoteFocused(true)}
              onBlur={handleNoteBlur}
              autoFocus={!noteValue}
            />
            {isNoteFocused && (
              <div className="user-profile-note-char-count">
                {noteCharCount}/{MAX_USER_NOTE_LENGTH}
              </div>
            )}
          </div>
        ) : (
          <div className="user-profile-note-trigger">
            <span
              className="user-profile-note-add-link"
              onClick={() => setIsNoteOpen(true)}
            >
              <Icon name="notes" size="sm" />
              {t`Add a note`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
