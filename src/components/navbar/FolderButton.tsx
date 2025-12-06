import * as React from 'react';
import { Icon, Tooltip } from '../primitives';
import { getIconColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import { formatMentionCount } from '../../utils/formatMentionCount';
import './Folder.scss';

interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  hasUnread: boolean;
  unreadCount: number;
  mentionCount?: number;
  size?: 'small' | 'regular';
}

const FolderButton: React.FC<FolderButtonProps> = ({
  folder,
  hasUnread,
  unreadCount,
  mentionCount = 0,
  size = 'regular',
}) => {
  const isTouch = isTouchDevice();
  const backgroundColor = getIconColorHex(folder.color);
  const sizeClass = size === 'small' ? 'folder-button--small' : '';

  const buttonElement = (
    <div
      className={`folder-button ${sizeClass} ${hasUnread ? 'folder-button--has-unread' : ''}`}
      style={{ backgroundColor }}
    >
      <Icon
        name={folder.icon || 'folder'}
        color="#ffffff"
        size={size === 'small' ? 'sm' : 'md'}
      />
      {mentionCount > 0 && (
        <span className="folder-button-mention-bubble">
          {formatMentionCount(mentionCount, 9)}
        </span>
      )}
    </div>
  );

  // Don't show tooltip on touch devices
  if (isTouch) {
    return buttonElement;
  }

  return (
    <Tooltip
      id={`folder-${folder.id}`}
      content={folder.name}
      place="right"
      highlighted={true}
      showOnTouch={false}
    >
      {buttonElement}
    </Tooltip>
  );
};

export default FolderButton;
