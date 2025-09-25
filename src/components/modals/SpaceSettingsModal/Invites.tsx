import * as React from 'react';
import { Button, Select, Input, Icon, Tooltip, Spacer, Callout } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ClickToCopyContent } from '../../ui';

interface InvitesProps {
  space: any;
  selectedUser: any;
  setSelectedUser: (user: any) => void;
  manualAddress: string;
  setManualAddress: (address: string) => void;
  resolvedUser: any;
  getUserOptions: () => any[];
  sendingInvite: boolean;
  invite: (address: string) => void;
  success: boolean;
  membershipWarning: string | undefined;
  generating: boolean;
  generationSuccess: boolean;
  deleting: boolean;
  deletionSuccess: boolean;
  errorMessage: string;
  setShowGenerateModal: (show: boolean) => void;
  setShowDeleteModal: (show: boolean) => void;
}

const Invites: React.FunctionComponent<InvitesProps> = ({
  space,
  selectedUser,
  setSelectedUser,
  manualAddress,
  setManualAddress,
  resolvedUser,
  getUserOptions,
  sendingInvite,
  invite,
  success,
  membershipWarning,
  generating,
  generationSuccess,
  deleting,
  deletionSuccess,
  errorMessage,
  setShowGenerateModal,
  setShowDeleteModal,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-xl font-bold">
            <Trans>Invites</Trans>
          </div>
          <div className="pt-2 text-sm text-main">
            <Trans>
              Send invites to people you've previously had
              conversations with. An invite button will appear
              in their inbox.
            </Trans>
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="flex"></div>
        <div className=""></div>
        <div className="modal-content-info">
          <div className="input-style-label">
            <Trans>Existing Conversations</Trans>
          </div>
          <Select
            fullWidth
            options={getUserOptions()}
            value={selectedUser?.address || ''}
            onChange={(address: string) => {
              // Find conversation and set selected user
              const allConversations = getUserOptions();
              const conversation = allConversations.find(
                (c) => c.value === address
              );
              if (conversation) {
                setSelectedUser({
                  address: conversation.value,
                  displayName: conversation.label,
                  icon: conversation.avatar,
                } as any);
                setManualAddress('');
              }
            }}
            placeholder={t`Select conversation`}
          />
          <Spacer size="md"></Spacer>
          <Input
            className="w-full placeholder:text-sm"
            value={manualAddress}
            placeholder="Type the address of the user you want to send to"
            onChange={setManualAddress}
            label={t`Enter Address Manually`}
            labelType="static"
          />
          {success && (
            <>
              <Spacer size="sm"/>
              <Callout variant="success" layout="minimal" size="sm" autoClose={3}>
                <Trans>
                  Successfully sent invite to{' '}
                  {selectedUser?.displayName}
                </Trans>
              </Callout>
            </>
          )}
          {membershipWarning && (
            <>
              <Spacer size="sm"/>
              <Callout variant="warning" layout="minimal" size="sm" autoClose={5}>
                {membershipWarning}
              </Callout>
            </>
          )}
          <Spacer
            spaceBefore="lg"
            spaceAfter="md"
            border={true}
            direction="vertical"
          />
          <div>
            <div className="modal-text-label">
              <Trans>Public Invite Links</Trans>
            </div>

            {/* Callouts for operations */}
            {generating && (
              <Callout variant="warning" size="sm" className="mb-4 mt-4">
                <div className="flex items-center gap-2">
                  <Icon name="spinner" spin={true} className="text-warning" />
                  <span>Generating public invite link...</span>
                </div>
              </Callout>
            )}

            {generationSuccess && (
              <Callout variant="success" size="sm" className="mb-4 mt-4" autoClose={3}>
                <span>Public invite link generated successfully.</span>
              </Callout>
            )}

            {deleting && (
              <Callout variant="warning" size="sm" className="mb-4 mt-4">
                <div className="flex items-center gap-2">
                  <Icon name="spinner" spin={true} className="text-warning" />
                  <span>Deleting public invite link...</span>
                </div>
              </Callout>
            )}

            {deletionSuccess && (
              <Callout variant="success" size="sm" className="mb-4 mt-4" autoClose={3}>
                <span>Public invite link deleted successfully.</span>
              </Callout>
            )}

            {errorMessage && (
              <Callout variant="error" size="sm" className="mb-4 mt-4">
                <span>{errorMessage}</span>
              </Callout>
            )}

            {!space?.inviteUrl && !generating ? (
              // STATE 1: No link exists and not generating - Show generate button
              <div className="mt-4">
                <div className="text-sm text-subtle mb-4 max-w-[500px]">
                  <Trans>
                    Public invite links allow anyone with access to the link to join your Space.
                    Consider who you share the link with and where you post it.
                  </Trans>
                </div>
                <div className="flex">
                  <Button
                    type="secondary"
                    onClick={() => setShowGenerateModal(true)}
                    disabled={generating}
                  >
                    <Trans>Generate Public Invite Link</Trans>
                  </Button>
                </div>
              </div>
            ) : !space?.inviteUrl && generating ? (
              // STATE 1b: Generating first link - Only show callout
              null
            ) : space?.inviteUrl && generating ? (
              // STATE 2b: Regenerating link - Only show callout
              null
            ) : (
              // STATE 2: Link exists and not generating - Show link + action buttons
              <div className="mt-4">
                <div className="flex pt-2 pb-1 items-center">
                  <div className="input-style-label">
                    <Trans>Current Invite Link</Trans>
                  </div>
                  <Tooltip
                    id="current-invite-link-tooltip"
                    content={t`This link will not expire, but you can generate a new one at any time, which will invalidate the old link.`}
                    place="bottom"
                    className="!w-[400px]"
                    maxWidth={400}
                  >
                    <Icon
                      name="info-circle"
                      className="text-main hover:text-strong cursor-pointer ml-2"
                    />
                  </Tooltip>
                </div>

                <ClickToCopyContent
                  text={space?.inviteUrl || ''}
                  tooltipText={t`Copy invite link to clipboard`}
                  className="bg-input border-0 rounded-md px-3 py-1.5 text-sm w-full max-w-full overflow-hidden whitespace-nowrap cursor-pointer"
                  iconClassName="text-muted hover:text-main"
                  copyOnContentClick
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="truncate flex-1 text-subtle">
                      {space?.inviteUrl}
                    </div>
                  </div>
                </ClickToCopyContent>

                <div className="flex gap-2 mt-4">
                  <Button
                    type="danger-outline"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={generating || deleting}
                  >
                    <Trans>Delete Current Link</Trans>
                  </Button>
                  <Button
                    type="secondary"
                    onClick={() => setShowGenerateModal(true)}
                    disabled={generating || deleting}
                  >
                    <Trans>Generate New Link</Trans>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}></div>
        <div className="modal-content-actions">
          <Button
            type="secondary"
            disabled={
              sendingInvite || (!selectedUser && !resolvedUser)
            }
            onClick={() => {
              if (selectedUser) {
                invite(selectedUser.address);
              } else if (resolvedUser) {
                invite(resolvedUser.user_address);
              }
            }}
          >
            <Trans>Send Invite</Trans>
          </Button>
        </div>
      </div>
    </>
  );
};

export default Invites;