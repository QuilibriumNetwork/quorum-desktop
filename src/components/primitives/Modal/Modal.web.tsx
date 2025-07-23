import React from 'react';
import { WebModalProps } from './types';
import { ModalContainer } from '../ModalContainer';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Modal.scss';

const Modal: React.FC<WebModalProps> = ({
  title,
  visible,
  onClose,
  hideClose = false,
  children,
  size = 'medium',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = '',
}) => {
  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      closeOnBackdropClick={closeOnBackdropClick && !hideClose}
      closeOnEscape={closeOnEscape && !hideClose}
      animationDuration={300}
    >
      <div
        className={`quorum-modal text-subtle relative pointer-events-auto quorum-modal-${size} ${className}`}
      >
        {!hideClose && (
          <div
            className="quorum-modal-close select-none cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              // Trigger ESC key event to use ModalContainer's animation
              const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
              document.dispatchEvent(escEvent);
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </div>
        )}
        
        <div className="quorum-modal-title select-none cursor-default">
          {title}
        </div>
        
        <div className="quorum-modal-container">
          {children}
        </div>
      </div>
    </ModalContainer>
  );
};

export default Modal;