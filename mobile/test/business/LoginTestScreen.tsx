import React, { useState } from 'react';
import { Login } from '@/components/onboarding/Login.native';

// Mock user type for testing
type User = {
  displayName: string;
  state: string;
  status: string;
  userIcon: string;
  address: string;
};

export const LoginTestScreen: React.FC = () => {
  const [user, setUser] = useState<User | undefined>();

  if (user) {
    return (
      <>
        <Login setUser={setUser} />
        {/* Add success overlay or navigation to next screen */}
      </>
    );
  }

  return <Login setUser={setUser} />;
};

// Updated: December 9, 2024 at 11:28 AM