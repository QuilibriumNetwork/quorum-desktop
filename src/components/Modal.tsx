import { createPortal } from 'react-dom';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useState } from 'react';
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
  const close = () => {
    setClosing(true);
    setTimeout(() => {
      props.onClose();
      setClosing(false);
    }, 300);
  };

  if (!props.visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur"
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
    </div>,
    document.body
  );
};

export default Modal;
