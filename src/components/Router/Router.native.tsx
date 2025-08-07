/**
 * Placeholder for React Native router implementation
 * This will be implemented when mobile development begins
 */

interface RouterProps {
  user: {
    displayName: string;
    state: string;
    status: string;
    userIcon: string;
    address: string;
  };
  setUser: (user: any) => void;
}

export function Router({ user, setUser }: RouterProps) {
  // Placeholder implementation for mobile
  // Will be implemented with React Navigation
  return null;
}