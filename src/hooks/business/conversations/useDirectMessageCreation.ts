import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useConversations } from '../../../hooks';
import { useModalContext } from '../../../components/context/ModalProvider';
import { useAddressValidation } from '../validation';
import { t } from '@lingui/core/macro';

export const useDirectMessageCreation = () => {
  const [address, setAddress] = useState<string>('');
  const navigate = useNavigate();
  const { closeNewDirectMessage } = useModalContext();

  // Get existing conversations
  const { data: conversations } = useConversations({ type: 'direct' });
  const conversationsList = useMemo(
    () => [...conversations.pages.flatMap((c: any) => c.conversations)],
    [conversations]
  );

  // Validate the address
  const validationResult = useAddressValidation(address);

  // Check if conversation already exists
  const existingConversation = useMemo(() => {
    if (!address) return null;
    return conversationsList.find((c: any) => c.address === address);
  }, [conversationsList, address]);

  // Determine button text based on state
  const buttonText = useMemo(() => {
    if (validationResult.isValidating) {
      return t`Looking up user...`;
    }
    if (existingConversation) {
      return t`Go to conversation`;
    }
    return t`Send`;
  }, [validationResult.isValidating, existingConversation]);

  // Handle address input change
  const handleAddressChange = useCallback((value: string) => {
    setAddress(value.trim());
  }, []);

  // Handle form submission
  // Allow navigation to existing conversations even if API lookup fails (e.g., offline)
  const handleSubmit = useCallback(() => {
    if (!address) return;
    if (!existingConversation && validationResult.error) return;

    closeNewDirectMessage();
    navigate('/messages/' + address);
  }, [address, existingConversation, validationResult.error, closeNewDirectMessage, navigate]);

  // Determine if button should be disabled
  // Allow navigation to existing conversations even if API lookup fails (e.g., offline)
  const isButtonDisabled =
    !address ||
    validationResult.isValidating ||
    (!existingConversation && !!validationResult.error);

  // Suppress error for existing conversations (user lookup may fail but navigation still works)
  const displayError = existingConversation ? null : validationResult.error;

  return {
    address,
    handleAddressChange,
    handleSubmit,
    buttonText,
    isButtonDisabled,
    error: displayError,
    existingConversation,
  };
};
