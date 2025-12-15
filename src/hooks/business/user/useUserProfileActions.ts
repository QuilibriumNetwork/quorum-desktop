import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export interface MuteUserTarget {
  address: string;
  displayName: string;
  userIcon?: string;
}

export interface UserProfileActionsOptions {
  dismiss?: () => void;
  setMuteUserTarget?: React.Dispatch<React.SetStateAction<MuteUserTarget | undefined>>;
}

export const useUserProfileActions = (
  options: UserProfileActionsOptions = {}
) => {
  const navigate = useNavigate();
  const { dismiss, setMuteUserTarget } = options;

  const sendMessage = useCallback(
    (userAddress: string) => {
      navigate('/messages/' + userAddress);
      dismiss?.();
    },
    [navigate, dismiss]
  );

  const openMuteModal = useCallback(
    (target: MuteUserTarget) => {
      if (setMuteUserTarget) {
        setMuteUserTarget(target);
        dismiss?.();
      }
    },
    [setMuteUserTarget, dismiss]
  );

  return {
    sendMessage,
    openMuteModal,
  };
};
