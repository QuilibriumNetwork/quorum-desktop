import * as React from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import SimpleModal from '../SimpleModal';
import Button from '../Button';
import { useRegistration } from '../../hooks';
import { getConfig } from '../../config/config';
import { useMessageDB } from '../context/MessageDB';
import { useRegistrationContext } from '../context/RegistrationPersister';
import './KickUserModal.scss';
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
    <SimpleModal
      visible={props.visible}
      onClose={props.onClose}
      title={t`Kick User`}
    >
      <div className="flex flex-row justify-around pb-4 select-none w-[350px] cursor-default">
        <div>{t`Use the below button to kick this user out of the Space`}</div>
      </div>
      <div className="mt-4 pt-5 mx-[-26px] px-4 rounded-b-xl bg-surface-4 mb-[-26px] h-20 flex flex-row-reverse justify-between">
        <div>
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
    </SimpleModal>
  );
};

export default KickUserModal;
