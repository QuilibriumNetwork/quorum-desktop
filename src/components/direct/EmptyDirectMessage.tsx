import React, { useState, useEffect } from 'react';
import './DirectMessage.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCommentDots,
  faBars,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConversations } from '../../hooks';
import { t } from '@lingui/core/macro';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

export const EmptyDirectMessage = () => {
  const user = usePasskeysContext();
  const { data: conversations } = useConversations({ type: 'direct' });
  const { isDesktop, toggleLeftSidebar } = useResponsiveLayoutContext();
  const [showHomeScreen, setShowHomeScreen] = useState(() => {
    const saved = localStorage.getItem('quilibrium-show-home-screen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem(
      'quilibrium-show-home-screen',
      JSON.stringify(showHomeScreen)
    );
  }, [showHomeScreen]);

  return (
    <div className="chat-container">
      <div className="flex flex-col">
        {/* Header with hamburger menu for mobile */}
        <div className="mt-[8px] pb-[8px] mx-[11px] text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <div className="flex flex-row items-center gap-2">
            {!isDesktop && (
              <FontAwesomeIcon
                onClick={toggleLeftSidebar}
                className="w-4 p-1 rounded-md cursor-pointer hover:bg-surface-6"
                icon={faBars}
              />
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex w-full flex-col justify-around flex-1">
          <div>
            {showHomeScreen ? (
              <>
                <div className="flex flex-row justify-around">
                  <img
                    src="/stay-connected-stay-invisible.gif"
                    alt="Stay connected, stay invisible"
                    className="w-[250px] sm:w-[300px] md:w-[400px] lg:w-[500px] max-w-full "
                  />
                </div>
                <div className="flex flex-row justify-center text-lg lg:text-2xl pt-4">
                  <div className="max-w-[500px] text-center mt-8">
                    {t`Stay Connected, Stay Invisible`}
                  </div>
                </div>
                <div className="flex flex-row justify-center pt-8 ">
                  <div
                    onClick={() => setShowHomeScreen(false)}
                    className="flex items-center gap-2 text-subtle hover:text-main dark:text-muted dark:hover:text-subtle transition-colors cursor-pointer text-sm"
                  >
                    <FontAwesomeIcon icon={faEyeSlash} />
                    <span>{t`hide home screen`}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center justify-center pt-8">
                  <FontAwesomeIcon
                    icon={faCommentDots}
                    size="6x"
                    className="text-accent opacity-70 dark:text-accent mb-4"
                  />
                  <div className="text-lg lg:text-2xl text-center mb-8">
                    {t`What's on your mind today?`}
                  </div>
                  <div
                    onClick={() => setShowHomeScreen(true)}
                    className="flex items-center gap-2 text-subtle hover:text-main dark:text-muted dark:hover:text-subtle transition-colors cursor-pointer text-sm"
                  >
                    <FontAwesomeIcon icon={faEye} />
                    <span>{t`show home screen`}</span>
                  </div>
                </div>
              </>
            )}
            {/* 
            <div className="flex flex-row justify-center text-lg pt-4">
              <div className="max-w-[500px] text-center">
                {conversations.pages.flatMap((p: any) => p.conversations)
                  .length === 0
                  ? t`Stay Connected, Stay Invisible`
                  : t`What's on your mind today?`}
              </div>
            </div>
            */}
          </div>
        </div>
      </div>
    </div>
  );
};
