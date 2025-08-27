import React, { useState } from 'react';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Modal.scss';

type ModalProps = {
  title: string;
  visible: boolean;
  onClose: () => void;
  hideClose?: boolean;
  children: React.ReactNode;
};

const Modal: React.FunctionComponent<ModalProps> = (props) => {
  const [closing, setClosing] = useState<boolean>(false);
  const [shouldRender, setShouldRender] = useState<boolean>(props.visible);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setShouldRender(false);
      setClosing(false);
      props.onClose();
    }, 300);
  };

  // Handle visibility changes
  React.useEffect(() => {
    if (props.visible) {
      setShouldRender(true);
    } else if (!closing) {
      // If props.visible becomes false but we're not in a closing animation,
      // immediately hide the modal
      setShouldRender(false);
    }
  }, [props.visible, closing]);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur"
      onClick={() => {
        if (!props.hideClose) close();
      }}
    >
      <div
        className={
          'quorum-modal text-subtle relative pointer-events-auto' +
          (closing ? ' quorum-modal-closing' : '')
        }
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      >
        {!props.hideClose && (
          <div
            className="quorum-modal-close select-none cursor-pointer"
            onClick={close}
          >
            <FontAwesomeIcon icon={faTimes} />
          </div>
        )}
        <div className="quorum-modal-title select-none cursor-default">
          {props.title}
        </div>
        <div className="quorum-modal-container">{props.children}</div>
      </div>
    </div>
  );
};

export default Modal;
