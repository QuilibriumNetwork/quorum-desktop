import * as React from 'react';
import { Icon, Tooltip, useTheme } from '../primitives';
import { getFolderColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import { useDragStateContext } from '../../context/DragStateContext';
import { formatMentionCount } from '@quilibrium/quorum-shared';
import './Folder.scss';
import './SpaceIcon.scss';

interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  hasUnread?: boolean;
  mentionCount?: number;
  size?: 'small' | 'regular';
  isExpanded?: boolean;
  noTooltip?: boolean;
  /**
   * Suppresses the corner mention bubble on the button itself. Used in row
   * layout where the bubble lives on the far right of the row instead.
   */
  hideMentionBubble?: boolean;
}

const FolderButton: React.FC<FolderButtonProps> = ({
  folder,
  hasUnread = false,
  mentionCount = 0,
  size = 'regular',
  isExpanded = false,
  noTooltip = false,
  hideMentionBubble = false,
}) => {
  const isTouch = isTouchDevice();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const backgroundColor = getFolderColorHex(folder.color, isDarkTheme);
  const sizeClass = size === 'small' ? 'folder-button--small' : '';

  let shouldHideTooltip = false;
  try {
    const dragContext = useDragStateContext();
    shouldHideTooltip = dragContext.isDragging || dragContext.isContextMenuOpen;
  } catch {}

  const showIndicators = !isExpanded;

  const buttonElement = (
    <div className="relative">
      {!shouldHideTooltip && showIndicators && (
        <div
          className={`space-icon-toggle ${hasUnread ? 'space-icon-toggle--unread' : ''}`}
        />
      )}
      <div
        className={`folder-button ${sizeClass}`}
        style={{ backgroundColor }}
      >
        <Icon
          name={folder.icon || 'folder'}
          color="#ffffff"
          size={size === 'small' ? 'lg' : 'xl'}
          variant={folder.iconVariant || 'outline'}
        />
        {showIndicators && !hideMentionBubble && mentionCount > 0 && (
          <span
            className="folder-button-mention-bubble"
            style={{ backgroundColor }}
          >
            {formatMentionCount(mentionCount, 9)}
          </span>
        )}
      </div>
    </div>
  );

  if (isTouch || shouldHideTooltip || noTooltip) {
    return buttonElement;
  }

  return (
    <Tooltip
      id={`folder-${folder.id}`}
      content={folder.name}
      place="right"
      showOnTouch={false}
      className="tooltip-text-large"
    >
      {buttonElement}
    </Tooltip>
  );
};

export default FolderButton;
