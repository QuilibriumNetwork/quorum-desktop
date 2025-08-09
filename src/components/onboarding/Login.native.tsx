// TEMPORARILY DISABLED - Logic conflicts need to be resolved
// Re-enable after Onboarding styling is finalized

import React from 'react';
// import { Image } from 'expo-image';
// import { Button } from '@/components/primitives';
// import { useAuthenticationFlow } from '@/hooks';
// import { t } from '@lingui/core/macro';
// import {
//   AuthScreenWrapper,
//   AuthTitle,
//   AuthContent,
//   AuthSpacer,
// } from '../OnboardingStyles.native';

interface LoginProps {
  setUser: React.Dispatch<
    React.SetStateAction<
      | {
          displayName: string;
          state: string;
          status: string;
          userIcon: string;
          address: string;
        }
      | undefined
    >
  >;
}

export const Login: React.FC<LoginProps> = ({ setUser }) => {
  // TEMPORARILY DISABLED - Return placeholder component
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      backgroundColor: '#1e40af',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div>
        <h2>Login Component</h2>
        <p>Temporarily disabled due to logic conflicts</p>
        <p>Will be re-enabled after Onboarding styling is finalized</p>
      </div>
    </div>
  );
};

// Updated: December 9, 2024 at 11:28 AM