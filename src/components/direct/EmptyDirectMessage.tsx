import React from 'react';
import './DirectMessage.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConversations } from '../../hooks';
import { t } from '@lingui/core/macro';

export const EmptyDirectMessage = () => {
  const user = usePasskeysContext();
  const { data: conversations } = useConversations({ type: 'direct' });

  return (
    <div className="direct-message">
      <div className="flex w-full flex-col justify-around">
        <div>
          <div className="flex flex-row justify-around">
            <FontAwesomeIcon icon={faCommentDots} size="6x" className='text-accent-300 dark:text-accent' />
          </div>
          <div className="flex flex-row justify-around text-lg pt-4">
            {conversations.pages.flatMap((p: any) => p.conversations).length ===
            0
              ? t`Start with a message to a friend. Click on the add button next to the direct messages list.`
              : t`What's on your mind today?`}
          </div>
        </div>
      </div>
    </div>
  );
};
