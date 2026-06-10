import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useConversations } from '../../../hooks';
import { useModalContext } from '../../../components/context/ModalProvider';
import { useAddressValidation } from '../validation';
import { useResolveQnsName } from '../qns';
import { t } from '@lingui/core/macro';

export const useDirectMessageCreation = () => {
  // `input` is what the user typed: a raw Qm… address, or an @username.
  const [input, setInput] = useState<string>('');
  const navigate = useNavigate();
  const { closeNewDirectMessage } = useModalContext();

  // Distinguish an address from a QNS username without requiring the user to
  // type a leading '@'. Addresses have a rigid shape (start with "Qm", base58),
  // so anything that does NOT start with "Qm" is treated as a username. An
  // explicit leading '@' is still accepted (and stripped) for users who type it.
  // Gating the username path on "doesn't start with Qm" also avoids firing a
  // doomed QNS lookup while a Qm… address is mid-paste.
  const looksLikeAddress = input.startsWith('Qm');
  const isUsername = input.length > 0 && !looksLikeAddress;
  const usernameQuery = isUsername
    ? (input.startsWith('@') ? input.slice(1) : input).trim()
    : '';
  const { data: qns, isFetching: isResolvingName } = useResolveQnsName(
    usernameQuery,
    { enabled: isUsername && usernameQuery.length >= 1 }
  );

  // The address used by everything downstream: the resolved Qm… for @usernames,
  // the raw input otherwise. Empty string until an @username resolves.
  const effectiveAddress = isUsername ? qns?.address ?? '' : input;

  // Get existing conversations
  const { data: conversations } = useConversations({ type: 'direct' });
  const conversationsList = useMemo(
    () => [...conversations.pages.flatMap((c: any) => c.conversations)],
    [conversations]
  );

  // Validate the (effective) address
  const validationResult = useAddressValidation(effectiveAddress);

  // Check if conversation already exists
  const existingConversation = useMemo(() => {
    if (!effectiveAddress) return null;
    return conversationsList.find((c: any) => c.address === effectiveAddress);
  }, [conversationsList, effectiveAddress]);

  // True when an @username was typed but did not resolve to an address.
  const usernameUnresolved =
    isUsername && !!usernameQuery && !isResolvingName && !qns?.address;

  // Determine button text based on state
  const buttonText = useMemo(() => {
    if (isResolvingName) {
      return t`Looking up @${usernameQuery}...`;
    }
    if (validationResult.isValidating) {
      return t`Looking up user...`;
    }
    if (existingConversation) {
      return t`Go to conversation`;
    }
    return t`Send`;
  }, [isResolvingName, usernameQuery, validationResult.isValidating, existingConversation]);

  // Handle input change
  const handleAddressChange = useCallback((value: string) => {
    setInput(value.trim());
  }, []);

  // Handle form submission
  // Allow navigation to existing conversations even if API lookup fails (e.g., offline)
  const handleSubmit = useCallback(() => {
    if (!effectiveAddress) return;
    if (!existingConversation && validationResult.error) return;

    closeNewDirectMessage();
    navigate('/messages/' + effectiveAddress);
  }, [effectiveAddress, existingConversation, validationResult.error, closeNewDirectMessage, navigate]);

  // Determine if button should be disabled
  // Allow navigation to existing conversations even if API lookup fails (e.g., offline)
  const isButtonDisabled =
    !input ||
    isResolvingName ||
    usernameUnresolved ||
    validationResult.isValidating ||
    (!existingConversation && !!validationResult.error);

  // Suppress error for existing conversations (user lookup may fail but navigation still works)
  const displayError = existingConversation
    ? null
    : usernameUnresolved
      ? t`No user found for @${usernameQuery}.`
      : validationResult.error;

  return {
    // `address` keeps the field controlled by what the user typed.
    address: input,
    handleAddressChange,
    handleSubmit,
    buttonText,
    isButtonDisabled,
    error: displayError,
    existingConversation,
  };
};
