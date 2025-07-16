import * as React from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import Modal from '../Modal';
import Button from '../Button';
import { useRegistration } from '../../hooks';
import { getConfig } from '../../config/config';
import { useMessageDB } from '../context/MessageDB';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { t } from '@lingui/core/macro';

type KickUserModalProps = {
  visible: boolean;
  kickUserAddress?: string;
  onClose: () => void;
};

const KickUserModal: React.FunctionComponent<KickUserModalProps> = (props) => {
  const [kicking, setKicking] = React.useState(false);
  const { kickUser } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { spaceId } = useParams();

  return (
    <Modal visible={props.visible} onClose={props.onClose} title={t`Kick User`}>
      <div className="w-full max-w-[400px] mx-auto">
        <div className="mb-4 text-sm text-subtle text-center">
          {t`Use the below button to kick this user out of the Space`}
        </div>
        <div className="flex justify-center">
          <Button
            type="danger"
            disabled={kicking}
            onClick={async () => {
              setKicking(true);
              await kickUser(
                spaceId!,
                props.kickUserAddress!,
                keyset.userKeyset,
                keyset.deviceKeyset,
                registration.registration!
              );
              setKicking(false);
              props.onClose();
            }}
          >
            {t`Do it!`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default KickUserModal;
