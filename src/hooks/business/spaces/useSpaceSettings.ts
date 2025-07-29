import { useState } from 'react';

export interface UseSpaceSettingsOptions {
  defaultAdvancedMode?: boolean;
  defaultRepudiable?: boolean;
  defaultPublic?: boolean;
}

export interface UseSpaceSettingsReturn {
  advancedMode: boolean;
  setAdvancedMode: (mode: boolean) => void;
  toggleAdvancedMode: () => void;
  repudiable: boolean;
  setRepudiable: (repudiable: boolean) => void;
  pub: boolean;
  setPublic: (pub: boolean) => void;
  resetSettings: () => void;
}

export const useSpaceSettings = (
  options: UseSpaceSettingsOptions = {}
): UseSpaceSettingsReturn => {
  const {
    defaultAdvancedMode = false,
    defaultRepudiable = false,
    defaultPublic = true,
  } = options;

  const [advancedMode, setAdvancedMode] = useState(defaultAdvancedMode);
  const [repudiable, setRepudiable] = useState(defaultRepudiable);
  const [pub, setPublic] = useState(defaultPublic);

  const toggleAdvancedMode = () => setAdvancedMode(prev => !prev);

  const resetSettings = () => {
    setAdvancedMode(defaultAdvancedMode);
    setRepudiable(defaultRepudiable);
    setPublic(defaultPublic);
  };

  return {
    advancedMode,
    setAdvancedMode,
    toggleAdvancedMode,
    repudiable,
    setRepudiable,
    pub,
    setPublic,
    resetSettings,
  };
};