import * as React from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import Modal from '../Modal';
import Button from '../Button';
import { useLocalization, useRegistration } from '../../hooks';
import { getConfig } from '../../config/config';
import { useMessageDB } from '../context/MessageDB';
import { useRegistrationContext } from '../context/RegistrationPersister';
import './KickUserModal.scss';

type KickUserModalProps = {
  visible: boolean;
  kickUserAddress?: string;
  onClose: () => void;
};

const KickUserModal: React.FunctionComponent<KickUserModalProps> = (props) => {
  let { data: localization } = useLocalization({ langId: getConfig().langId });
  const [kicking, setKicking] = React.useState(false);
  const { kickUser } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { spaceId } = useParams();

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={localization.localizations['KICK_USER_TITLE']([])}
    >
      <div className="flex flex-row justify-around pb-4 select-none w-[400px] cursor-default">
        <div>{localization.localizations['KICK_USER_TEXT']([])}</div>
      </div>
      <div className="mt-4 pt-5 mx-[-26px] px-4 rounded-b-xl bg-surface-4 mb-[-26px] h-16 flex flex-row-reverse justify-between">
        <div>
          <Button
            type="primary"
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
            {localization.localizations['KICK_USER']([])}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default KickUserModal;
