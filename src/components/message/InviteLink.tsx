import { Button, Container, Flex, Callout } from '../primitives';
import {
  useInviteProcessing,
  useInviteJoining,
  useInviteUI,
} from '../../hooks';
import { Trans } from '@lingui/react/macro';

export const InviteLink = ({
  inviteLink,
  messageSenderId,
  currentUserAddress,
}: {
  inviteLink: string;
  messageSenderId?: string;
  currentUserAddress?: string;
}) => {
  // Extract business logic into focused hooks
  const { space, error, isProcessing } = useInviteProcessing(inviteLink);
  const { joining, joinSpace, joinError } = useInviteJoining(inviteLink);
  const { buttonText, isButtonDisabled } = useInviteUI(
    space,
    joining,
    messageSenderId,
    currentUserAddress
  );

  // Combine and map errors for display
  const rawError = error || joinError;
  const displayError = (() => {
    if (!rawError) return undefined;
    const msg = String(rawError);
    if (/invalid link/i.test(msg)) {
      return <Trans>The invite link format is invalid.</Trans>;
    }
    if (/invalid response/i.test(msg)) {
      return (
        <Trans>
          Could not fetch the Space details. Please try again.
        </Trans>
      );
    }
    if (/invite\/eval\s*404/i.test(msg) || /public invite link is no longer valid/i.test(msg)) {
      return <Trans>This public invite link is no longer valid.</Trans>;
    }
    return <Trans>The invite link has expired or is invalid.</Trans>;
  })();

  return (
    <Container className="w-full !max-w-[250px] sm:!max-w-[400px] lg:!max-w-[500px] lg:min-w-[500px] rounded-md p-2 sm:p-3 bg-surface-5 border border-surface-6">
      {displayError && (
        <Callout variant="error" size="sm" className="mb-2">
          {displayError}
        </Callout>
      )}
      {!displayError && isProcessing && (
        <Container className="font-bold flex flex-col items-center sm:items-start">
          <Container className="mb-2 text-center sm:text-left">
            <span>
              <Trans>You've been invited to join a Space</Trans>
            </span>
          </Container>
          <Flex className="flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full">
            <Flex className="items-center bg-surface-4 rounded-lg px-1 sm:px-2 py-1 sm:py-2 gap-1 sm:gap-2 lg:gap-3 w-full lg:flex-1 overflow-hidden">
              <Container
                className="w-8 sm:w-10 lg:w-12 h-8 sm:h-10 lg:h-12 rounded-md sm:rounded-lg overflow-hidden flex-shrink-0 bg-surface-3"
              />
              <Container className="flex-1 min-w-0 overflow-hidden">
                <Container className="h-4 bg-surface-3 rounded w-3/4 sm:w-1/2" />
              </Container>
            </Flex>
            <Container className="flex justify-center w-full lg:w-auto lg:flex-shrink-0">
              <Container className="h-9 sm:h-10 bg-surface-4 rounded w-full lg:w-[110px]" />
            </Container>
          </Flex>
        </Container>
      )}
      {space && (
        <Container className="font-bold flex flex-col items-center sm:items-start">
          <Container className="mb-2 text-center sm:text-left">
            <span>
              <Trans>You've been invited to join a Space</Trans>
            </span>
          </Container>
          <Flex className="flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full">
            <Flex className="items-center bg-surface-4 rounded-lg px-1 sm:px-2 py-1 sm:py-2 gap-1 sm:gap-2 lg:gap-3 w-full lg:flex-1 overflow-hidden">
              <Container
                className="w-8 sm:w-10 lg:w-12 h-8 sm:h-10 lg:h-12 rounded-md sm:rounded-lg overflow-hidden flex-shrink-0"
                style={{
                  backgroundImage: space.iconUrl ? `url(${space.iconUrl})` : '',
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundColor: 'var(--surface-2)',
                }}
              />
              <Container className="flex-1 min-w-0 overflow-hidden">
                <span className="block truncate font-medium text-sm lg:text-base">
                  {space?.spaceName}
                </span>
                {space?.description && (
                  <span className="block text-xs lg:text-sm text-subtle mt-1 break-words line-clamp-2">
                    {space.description.length > 100
                      ? space.description.substring(0, 100) + '...'
                      : space.description}
                  </span>
                )}
              </Container>
            </Flex>
            <Container className="flex justify-center w-full lg:w-auto lg:flex-shrink-0">
              <Button
                className="px-4 sm:px-6 whitespace-nowrap text-sm w-full lg:w-auto"
                onClick={joinSpace}
                type="primary"
                disabled={isButtonDisabled}
              >
                {buttonText}
              </Button>
            </Container>
          </Flex>
        </Container>
      )}
    </Container>
  );
};
