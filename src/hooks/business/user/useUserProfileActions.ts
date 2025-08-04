import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export interface UserProfileActionsOptions {
  dismiss?: () => void;
  setKickUserAddress?: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const useUserProfileActions = (
  options: UserProfileActionsOptions = {}
) => {
  const navigate = useNavigate();
  const { dismiss, setKickUserAddress } = options;

  const sendMessage = useCallback(
    (userAddress: string) => {
      navigate('/messages/' + userAddress);
      dismiss?.();
    },
    [navigate, dismiss]
  );

  const kickUser = useCallback(
    (userAddress: string) => {
      if (setKickUserAddress) {
        setKickUserAddress(userAddress);
        dismiss?.();
      }
    },
    [setKickUserAddress, dismiss]
  );

  return {
    sendMessage,
    kickUser,
  };
};
