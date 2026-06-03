import './DirectMessage.scss';
// import { useShowHomeScreen } from '../../hooks';
import { t } from '@lingui/core/macro';
import { Button, Flex, Icon } from '../primitives';
import { useOptionalShellState } from '../shell/useShellState';

export const EmptyDirectMessage = () => {
  const shell = useOptionalShellState();
  const isPhone = shell?.viewport === 'phone';
  // Home screen feature commented out for now
  // const { showHomeScreen, hideHomeScreen, showHomeScreenView } =
  //   useShowHomeScreen();

  return (
    <div className="chat-container">
      <Flex direction="column">
        {/* Phone-only drawer trigger row — matches chat-header padding */}
        {isPhone && shell && (
          <div className="chat-header text-main">
            <Button
              type="unstyled"
              onClick={shell.openDrawer}
              className="header-icon-button"
              iconName="menu"
              iconSize="lg"
              iconOnly
              ariaLabel={t`Open navigation`}
            />
          </div>
        )}

        {/* Main content */}
        <div className="empty-state empty-state--fill">
          <Icon
            name="message-dots"
            size="5xl"
            className="empty-state__icon"
          />
          <p className="empty-state__title">{t`What's on your mind today?`}</p>
        </div>
      </Flex>
    </div>
  );
};
