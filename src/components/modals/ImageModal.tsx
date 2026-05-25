import React from 'react';
import { Modal, Flex, Icon } from '../primitives';

interface ImageModalProps {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

const getExtensionFromDataUrl = (url: string): string => {
  const match = url.match(/^data:image\/([a-zA-Z0-9.+-]+)[;,]/);
  if (!match) return 'png';
  const subtype = match[1].toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'svg+xml') return 'svg';
  return subtype;
};

const ImageModal: React.FC<ImageModalProps> = ({
  visible,
  imageUrl,
  onClose
}) => {
  if (!imageUrl) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ext = getExtensionFromDataUrl(imageUrl);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `quorum-image-${ts}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      <Flex justify="center" align="center" className="relative h-full w-full">
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
          onClick={handleDownload}
          aria-label="Download image"
          className="fixed top-4 right-16 w-9 h-9 bg-white/15 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors duration-150 z-[10000] cursor-pointer"
        >
          <Icon name="download" size="md" />
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          className="fixed top-4 right-4 w-9 h-9 bg-white/15 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors duration-150 z-[10000] cursor-pointer"
        >
          <Icon name="close" size="md" />
        </button>
      </Flex>
    </Modal>
  );
};

export default ImageModal;
