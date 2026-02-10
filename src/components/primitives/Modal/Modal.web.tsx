import React, { useId } from 'react';
import { WebModalProps } from './types';
import { ModalContainer } from '../ModalContainer';
import { Icon } from '../Icon';
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
  noPadding = false,
  titleAlign = 'left',
}) => {
  const modalTitleId = useId();

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      closeOnBackdropClick={closeOnBackdropClick}
      closeOnEscape={closeOnEscape}
      animationDuration={300}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? modalTitleId : undefined}
        className={`quorum-modal text-subtle relative pointer-events-auto quorum-modal-${size} ${noPadding ? 'quorum-modal-no-padding' : ''} ${className}`}
      >
        {!hideClose && (
          <button
            type="button"
            aria-label="Close dialog"
            className="quorum-modal-close select-none cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              // Trigger ESC key event to use ModalContainer's animation
              const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
              document.dispatchEvent(escEvent);
            }}
          >
            <Icon name="close" size="md" />
          </button>
        )}

        {title && (
          <div
            id={modalTitleId}
            className={`quorum-modal-title select-none cursor-default ${titleAlign === 'center' ? 'quorum-modal-title-center' : ''}`}
          >
            {title}
          </div>
        )}

        <div className="quorum-modal-container">{children}</div>
      </div>
    </ModalContainer>
  );
};

export default Modal;
