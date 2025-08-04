import './DirectMessage.scss';
import { useShowHomeScreen } from '../../hooks';
import { t } from '@lingui/core/macro';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { Container, FlexRow, FlexColumn, Text, Icon } from '../primitives';

export const EmptyDirectMessage = () => {
  const { isDesktop, toggleLeftSidebar } = useResponsiveLayoutContext();
  const { showHomeScreen, hideHomeScreen, showHomeScreenView } =
    useShowHomeScreen();

  return (
    <Container className="chat-container">
      <FlexColumn>
        {/* Header with hamburger menu for mobile */}
        <Container className="mt-[8px] pb-[8px] mx-[11px] text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <FlexRow className="items-center gap-2">
            {!isDesktop && (
              <Icon
                name="bars"
                onClick={toggleLeftSidebar}
                className="w-4 p-1 rounded-md cursor-pointer hover:bg-surface-6"
              />
            )}
          </FlexRow>
        </Container>

        {/* Main content */}
        <Container className="flex w-full flex-col justify-around flex-1">
          <Container>
            {showHomeScreen ? (
              <>
                <FlexRow className="justify-around">
                  <img
                    src="/stay-connected-stay-invisible.gif"
                    alt="Stay connected, stay invisible"
                    className="w-[250px] sm:w-[300px] md:w-[400px] lg:w-[500px] max-w-full"
                  />
                </FlexRow>
                <FlexRow className="justify-center text-lg sm:text-2xl pt-4">
                  <Container className="max-w-[500px] text-center mt-8">
                    <Text className="text-lg sm:text-2xl">{t`Stay Connected, Stay Invisible`}</Text>
                  </Container>
                </FlexRow>
                <FlexRow className="justify-center pt-8">
                  <FlexRow
                    onClick={hideHomeScreen}
                    className="items-center gap-2 cursor-pointer"
                  >
                    <Icon
                      name="eye-slash"
                      className="text-subtle hover:text-main dark:text-muted dark:hover:text-subtle transition-colors text-sm"
                    />
                    <Text className="text-subtle hover:text-main dark:text-muted dark:hover:text-subtle transition-colors text-sm">{t`hide home screen`}</Text>
                  </FlexRow>
                </FlexRow>
              </>
            ) : (
              <>
                <FlexColumn className="items-center justify-center pt-8">
                  <Icon
                    name="comment-dots"
                    size={96}
                    className="text-accent opacity-70 dark:text-accent mb-4"
                  />
                  <Container className="text-lg sm:text-2xl text-center mb-8">
                    <Text className="text-lg sm:text-2xl">{t`What's on your mind today?`}</Text>
                  </Container>
                  <FlexRow className="justify-center">
                    <FlexRow
                      onClick={showHomeScreenView}
                      className="items-center gap-2 cursor-pointer"
                    >
                      <Icon
                        name="eye"
                        className="text-subtle hover:text-main dark:text-muted dark:hover:text-subtle transition-colors text-sm"
                      />
                      <Text className="text-subtle hover:text-main dark:text-muted dark:hover:text-subtle transition-colors text-sm">{t`show home screen`}</Text>
                    </FlexRow>
                  </FlexRow>
                </FlexColumn>
              </>
            )}
          </Container>
        </Container>
      </FlexColumn>
    </Container>
  );
};
