import { useOnboardingFlowLogic } from './useOnboardingFlowLogic';
import { usePasskeyAdapter } from '../../platform/user/usePasskeyAdapter';

export type { OnboardingStep } from './useOnboardingFlowLogic';

/**
 * Hook for managing the onboarding flow state machine and user profile data
 * Uses adapter pattern for cross-platform compatibility
 */
export const useOnboardingFlow = () => {
  const adapter = usePasskeyAdapter();
  return useOnboardingFlowLogic(adapter);
};
