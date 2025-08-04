import { useState, useEffect } from 'react';

/**
 * Custom hook for managing home screen visibility with localStorage persistence
 * Handles show/hide toggle states for the empty direct message home screen
 */
export const useShowHomeScreen = () => {
  const [showHomeScreen, setShowHomeScreen] = useState(() => {
    const saved = localStorage.getItem('quilibrium-show-home-screen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem(
      'quilibrium-show-home-screen',
      JSON.stringify(showHomeScreen)
    );
  }, [showHomeScreen]);

  const toggleHomeScreen = () => {
    setShowHomeScreen(!showHomeScreen);
  };

  const hideHomeScreen = () => {
    setShowHomeScreen(false);
  };

  const showHomeScreenView = () => {
    setShowHomeScreen(true);
  };

  return {
    showHomeScreen,
    setShowHomeScreen,
    toggleHomeScreen,
    hideHomeScreen,
    showHomeScreenView,
  };
};
