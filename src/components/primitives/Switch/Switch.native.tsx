import React from 'react';
import { Switch as RNSwitch, Platform } from 'react-native';
import { NativeSwitchProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';

export const Switch: React.FC<NativeSwitchProps> = ({
  value,
  onChange,
  disabled = false,
  hapticFeedback = false,
  trackColorFalse,
  trackColorTrue,
  thumbColor,
  accessibilityLabel,
  style,
  testID,
}) => {
  const theme = useTheme();
  const colors = getColors('light', 'blue'); // Use default theme

  const handleValueChange = (newValue: boolean) => {
    if (!disabled) {
      // Add haptic feedback on iOS if enabled
      if (hapticFeedback && Platform.OS === 'ios') {
        // Note: Would require expo-haptics for actual implementation
        // HapticFeedback.impactAsync(HapticFeedback.ImpactFeedbackStyle.Light);
      }
      onChange(newValue);
    }
  };

  // Platform-specific colors
  const getTrackColor = () => {
    if (Platform.OS === 'ios') {
      // iOS uses a single trackColor
      return undefined;
    } else {
      // Android uses separate colors for true/false states
      return {
        false: trackColorFalse || colors.surface[4],
        true: trackColorTrue || colors.accent.DEFAULT,
      };
    }
  };

  const getThumbColor = () => {
    if (Platform.OS === 'ios') {
      // iOS thumb is always white
      return thumbColor || 'white';
    } else {
      // Android thumb color
      return thumbColor || 'white';
    }
  };

  const getIOSBackgroundColor = () => {
    if (Platform.OS === 'ios') {
      return value
        ? trackColorTrue || colors.accent.DEFAULT
        : trackColorFalse || colors.surface[4];
    }
    return undefined;
  };

  return (
    <RNSwitch
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
      trackColor={getTrackColor()}
      thumbColor={getThumbColor()}
      ios_backgroundColor={getIOSBackgroundColor()}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        {
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    />
  );
};
