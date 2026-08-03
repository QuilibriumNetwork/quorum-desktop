import * as React from 'react';
import { Button, Callout, Icon } from '../../primitives';
import { Trans } from '@lingui/react/macro';

interface DangerProps {
  space: any;
  handleDeleteSpace: () => void;
  deleteError: string | null;
  clearDeleteError: () => void;
}

// Deleting a Space for real needs a server-side purge that does not exist yet: no
// endpoint removes a Space's registration, manifest, hub log or invite evals, and the
// existing ones cannot be composed into one.
//
// What this button actually calls is the LEAVE flow. SpaceService.deleteSpace
// broadcasts a `leave`, calls postHubDelete for the caller's own inbox, and erases the
// caller's local copy. Every other member keeps the Space, its channels and all its
// messages — so the old copy ("will permanently delete this Space and all of its
// channels and messages") was false for everyone except the clicker.
//
// It is worse than a mislabel for the owner, and this tab is owner-only (Navigation
// gates `danger` behind useSpaceOwner). Ownership is possession of the `owner` key
// slot, there is no transfer and no second copy, and the wipe takes it. An owner who
// used this kept the Space running for everyone while destroying their own ability to
// kick, rekey or ever delete it.
//
// So: release builds disable it and say why. Dev builds keep it, because a tester
// needs disposable Spaces gone, under a label that names what it does.
const IS_DEV = process.env.NODE_ENV === 'development';

const Danger: React.FunctionComponent<DangerProps> = ({
  space,
  handleDeleteSpace,
  deleteError,
  clearDeleteError,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title text-danger flex items-center gap-2">
            <Icon name="warning" size="lg" />
            {IS_DEV ? (
              <Trans>Leave this Space (dev build)</Trans>
            ) : (
              <Trans>Delete this Space</Trans>
            )}
          </div>
          <div className="pt-2 text-body">
            {IS_DEV ? (
              <Trans>
                Dev builds only. This does not delete the Space. It announces that you
                have left, removes your inbox from the hub, and erases your local copy.
                Every other member keeps the Space, its channels and all of its
                messages, and you lose the ability to manage it for good.
              </Trans>
            ) : (
              <Trans>
                Deleting a Space is not available yet. Today this would only remove your
                own copy: everyone else would keep the Space, its channels and all of
                its messages, and you would permanently lose the ability to manage it.
              </Trans>
            )}
          </div>

          {space && (
            <div className="mt-6 border border-default rounded-md">
              <div className="p-3 bg-chat rounded">
                <div className="text-label-strong font-bold">{space.spaceName}</div>
              </div>
            </div>
          )}

          {deleteError && (
            <div className="pt-4">
              <Callout
                variant="error"
                size="sm"
                dismissible
                onClose={clearDeleteError}
              >
                <Trans>An error occurred. Please try again.</Trans>
              </Callout>
            </div>
          )}

          {/* The type-to-confirm input and the channel/member counts were removed
              rather than disabled. Typing a keyword beside "N channels, N members" is
              the strongest "you are destroying something shared" signal this app has,
              and it sat on an action that only ever affected the person clicking it.
              A real delete needs a confirmation written against what that does. */}
          <div className="pt-6">
            <Button
              type="danger"
              className="!w-auto !inline-flex"
              disabled={!IS_DEV}
              onClick={handleDeleteSpace}
            >
              {IS_DEV ? <Trans>Leave Space</Trans> : <Trans>Delete Space</Trans>}
            </Button>
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="modal-content-info"></div>
      </div>
    </>
  );
};

export default Danger;
