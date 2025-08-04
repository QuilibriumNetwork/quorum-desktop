import React from 'react';
import { Pressable, View, Animated, Platform } from 'react-native';
import { NativeSwitchProps } from './types';
import { useTheme } from '../theme';

export const Switch: React.FC<NativeSwitchProps> = ({
  value,
  onChange,
  disabled = false,
  hapticFeedback = false,
  accessibilityLabel,
  style,
  testID,
}) => {
  const theme = useTheme();
  const colors = theme.colors;

  // Animation value for thumb position
  const animatedValue = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  const handlePress = () => {
    if (!disabled) {
      // Add haptic feedback on iOS if enabled
      if (hapticFeedback && Platform.OS === 'ios') {
        // Note: Would require expo-haptics for actual implementation
        // HapticFeedback.impactAsync(HapticFeedback.ImpactFeedbackStyle.Light);
      }
      onChange(!value);
    }
  };

  // Mobile uses single size that matches platform standards (closest to iOS/Android native)
  // This matches the "large" size from web which you already use there
  const sizes = { width: 52, height: 28, thumbSize: 24, padding: 2 };

  const thumbLeftPosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [sizes.padding, sizes.width - sizes.thumbSize - sizes.padding],
  });

  const backgroundColor = value ? colors.accent.DEFAULT : colors.surface[4];

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: sizes.width,
          height: sizes.height,
          borderRadius: sizes.height / 2,
          backgroundColor,
          padding: sizes.padding,
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: sizes.thumbSize,
          height: sizes.thumbSize,
          borderRadius: sizes.thumbSize / 2,
          backgroundColor: 'white',
          position: 'absolute',
          left: thumbLeftPosition,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 2,
        }}
      />
    </Pressable>
  );
};
