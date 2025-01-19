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

  return props.visible ? (
    <>
      <div
        className="invisible-dismissal invisible-dark"
        onClick={() => (props.hideClose ? (() => {})() : close())}
      />
      <div>
        <div className="w-[100vw] h-[100vh] z-[2000] flex flex-col absolute top-0 left-0 justify-around">
          <div className="flex flex-row justify-around">
            <div
              className={
                'quorum-modal text-slate-300' +
                (closing ? ' quorum-modal-closing' : '')
              }
            >
              {!props.hideClose && (
                <div
                  className="quorum-modal-close select-none cursor-pointer"
                  onClick={() => close()}
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
        </div>
      </div>
    </>
  ) : (
    <></>
  );
};

export default Modal;
