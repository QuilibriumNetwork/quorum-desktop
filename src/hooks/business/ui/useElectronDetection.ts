import { useMemo } from 'react';

interface UseElectronDetectionReturn {
  isElectron: boolean;
}

export const useElectronDetection = (): UseElectronDetectionReturn => {
  const isElectron = useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    return (
      typeof window.process === 'object' &&
      Object.keys(window.process).includes('type')
    );
  }, []);

  return {
    isElectron,
  };
};