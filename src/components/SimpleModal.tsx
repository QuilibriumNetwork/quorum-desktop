import React from 'react';

interface SimpleModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const SimpleModal: React.FC<SimpleModalProps> = ({ 
  children, 
  onClose, 
  className = "" 
}) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center backdrop-blur">
      {children}
      {onClose && (
        <div
          className="fixed inset-0 -z-10"
          onClick={onClose}
        />
      )}
    </div>
  );
};

export default SimpleModal;