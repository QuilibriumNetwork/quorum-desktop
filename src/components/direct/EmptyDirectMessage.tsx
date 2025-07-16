import React from 'react';
import './DirectMessage.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots, faBars } from '@fortawesome/free-solid-svg-icons';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConversations } from '../../hooks';
import { t } from '@lingui/core/macro';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

export const EmptyDirectMessage = () => {
  const user = usePasskeysContext();
  const { data: conversations } = useConversations({ type: 'direct' });
  const { isMobile, toggleLeftSidebar } = useResponsiveLayoutContext();

  return (
    <div className="chat-container">
      <div className="flex flex-col">
        {/* Header with hamburger menu for mobile */}
        <div className="direct-message-name mt-[8px] pb-[8px] mx-[11px] text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <div className="flex flex-row items-center gap-2">
            {isMobile && (
              <FontAwesomeIcon
                onClick={toggleLeftSidebar}
                className="w-4 p-1 rounded-md cursor-pointer hover:bg-surface-6"
                icon={faBars}
              />
            )}
            <span className="font-semibold">{t`Direct Messages`}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex w-full flex-col justify-around flex-1">
          <div>
            <div className="flex flex-row justify-around">
              <FontAwesomeIcon
                icon={faCommentDots}
                size="6x"
                className="text-accent-300 dark:text-accent"
              />
            </div>
            <div className="flex flex-row justify-around text-lg pt-4">
              {conversations.pages.flatMap((p: any) => p.conversations)
                .length === 0
                ? t`Start with a message to a friend. Click on the add button next to the direct messages list.`
                : t`What's on your mind today?`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
