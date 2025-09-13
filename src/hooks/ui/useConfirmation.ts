import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseConfirmationOptions {
  type: 'inline' | 'modal';
  
  // Smart escalation (Channel/Group deletion only)
  escalateWhen?: () => boolean; // When to escalate from inline to modal
  blockedWhen?: () => boolean;  // When to block with inline error
  
  // Modal configuration (when type='modal' or escalating)
  modalConfig?: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
  };
  
  // Blocking error (Pattern C)
  blockedError?: string;
  
  // Enable shift+click bypass for desktop (Pattern B)
  enableShiftBypass?: boolean;
  
  // Double-click timeout in ms (Pattern A)
  doubleClickTimeout?: number;
}

export interface UseConfirmationResult {
  handleClick: (e: React.MouseEvent, onConfirm: () => void | Promise<void>) => void;
  confirmationStep: number;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  blockedError: string;
  modalConfig?: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
  };
  reset: () => void;
}

export function useConfirmation(options: UseConfirmationOptions): UseConfirmationResult {
  const [confirmationStep, setConfirmationStep] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [blockedError, setBlockedError] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const onConfirmRef = useRef<(() => void | Promise<void>) | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setConfirmationStep(0);
    setShowModal(false);
    setBlockedError('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent, onConfirm: () => void | Promise<void>) => {
    // Check if operation should be blocked
    if (options.blockedWhen?.()) {
      setBlockedError(options.blockedError || 'Operation not allowed');
      return;
    }
    
    // Clear any previous errors
    setBlockedError('');
    
    // Store the onConfirm callback
    onConfirmRef.current = onConfirm;
    
    // Check for Shift+click bypass (desktop only, Pattern B)
    if (options.enableShiftBypass && e.shiftKey && (options.type === 'modal' || options.escalateWhen?.())) {
      onConfirm();
      reset();
      return;
    }
    
    // Smart escalation logic
    if (options.type === 'inline' && options.escalateWhen?.()) {
      setShowModal(true);
      return;
    }
    
    // Handle based on type
    if (options.type === 'modal') {
      setShowModal(true);
    } else {
      // Pattern A: Double-click confirmation
      if (confirmationStep === 0) {
        setConfirmationStep(1);
        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        // Set new timeout
        timeoutRef.current = setTimeout(() => {
          setConfirmationStep(0);
        }, options.doubleClickTimeout || 5000);
      } else {
        // Second click - execute action
        onConfirm();
        reset();
      }
    }
  }, [confirmationStep, options, reset]);

  // Execute the stored onConfirm when modal confirms
  const modalConfig = options.modalConfig ? {
    ...options.modalConfig,
    onConfirm: () => {
      if (onConfirmRef.current) {
        onConfirmRef.current();
        reset();
      }
    },
    onCancel: () => {
      reset();
    }
  } : undefined;

  return {
    handleClick,
    confirmationStep,
    showModal,
    setShowModal: (show: boolean) => {
      setShowModal(show);
      if (!show) {
        reset();
      }
    },
    blockedError,
    modalConfig,
    reset
  };
}