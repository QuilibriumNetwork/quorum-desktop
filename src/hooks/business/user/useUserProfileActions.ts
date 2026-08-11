import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export interface UserProfileActionsOptions {
  dismiss?: () => void;
}

export const useUserProfileActions = (
  options: UserProfileActionsOptions = {}
) => {
  const navigate = useNavigate();
  const { dismiss } = options;

  const sendMessage = useCallback(
    (userAddress: string) => {
      navigate('/messages/' + userAddress);
      dismiss?.();
    },
    [navigate, dismiss]
  );

  return {
    sendMessage,
  };
};
