import * as React from 'react';
import { Button, Modal, Flex, Spacer, Callout } from '../primitives';
import { useSpace, useSpaceLeaving } from '../../hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

type LeaveSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

const LeaveSpaceModal: React.FunctionComponent<LeaveSpaceModalProps> = ({
  spaceId,
  visible,
  onClose,
}) => {
  const { data: space } = useSpace({ spaceId });
  const { confirmationStep, handleLeaveClick, resetConfirmation, error } =
    useSpaceLeaving();

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!visible) {
      resetConfirmation();
    }
  }, [visible, resetConfirmation]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t`Leave ${space?.spaceName || 'Space'}`}
      size="small"
      swipeToClose={true}
    >
      <div>
        <p className="text-body text-subtle">
          {/*
            Was "You won't be able to rejoin unless you are re-invited", which is
            false whenever the Space has a public invite link: that link is
            deterministic per Space and keeps working, so an old copy of it still
            gets you back in. Verified by rejoining with a previously-used link.
            Mobile's confirmation carried the same wrong claim and was corrected
            to match.
          */}
          <Trans>
            Are you sure you want to leave this Space? You'll need an invite to
            rejoin, though a public invite link will still work if this Space has
            one.
          </Trans>
        </p>
        {error && (
          <>
            <Spacer size="md"></Spacer>
            <Callout variant="error">
              {error}
            </Callout>
          </>
        )}
        <Spacer size="lg"></Spacer>
        <Flex>
          <Button
            type="danger"
            onClick={() => handleLeaveClick(spaceId, onClose)}
            hapticFeedback={true}
          >
            {confirmationStep === 0 ? (
              <Trans>Leave Space</Trans>
            ) : (
              <Trans>Click again to confirm</Trans>
            )}
          </Button>
        </Flex>
      </div>
    </Modal>
  );
};

export default LeaveSpaceModal;
