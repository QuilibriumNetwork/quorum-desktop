import React from 'react';
import { Modal, FlexCenter, Icon } from '../primitives';

interface ImageModalProps {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  visible,
  imageUrl,
  onClose
}) => {
  if (!imageUrl) return null;

  return (
    <Modal
      title=""
      visible={visible}
      onClose={onClose}
      hideClose={true}
      className="bg-transparent overflow-hidden"
      noPadding={true}
      size="full"
    >
      <FlexCenter className="relative h-full w-full">
        <img
          src={imageUrl}
          style={{
            maxHeight: '90vh',
            maxWidth: '90vw',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
          }}
          className="rounded-lg"
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors z-10"
        >
          <Icon name="times" size="sm" />
        </button>
      </FlexCenter>
    </Modal>
  );
};

export default ImageModal;