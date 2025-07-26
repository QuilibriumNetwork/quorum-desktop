import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { RadioGroupNativeProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';

export function RadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  direction = 'vertical',
  disabled = false,
  style,
  testID,
}: RadioGroupNativeProps<T>) {
  const theme = useTheme();
  const colors = getColors(theme.mode, theme.accentColor);

  const handlePress = (optionValue: T) => {
    if (!disabled) {
      onChange(optionValue);
    }
  };

  const containerStyle: ViewStyle[] = [
    styles.container,
    direction === 'horizontal' ? styles.horizontal : styles.vertical,
    style,
  ];

  return (
    <View style={containerStyle} testID={testID}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const isDisabled = disabled || option.disabled;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => handlePress(option.value)}
            disabled={isDisabled}
            activeOpacity={0.7}
            style={[
              styles.item,
              {
                borderColor: isSelected ? colors.field.borderFocus : colors.field.border,
                backgroundColor: isSelected ? colors.field.bgFocus : colors.field.bg,
              },
              isDisabled && styles.itemDisabled,
            ]}
          >
            <View style={styles.content}>
              {option.icon && (
                <Text style={[styles.icon, { color: colors.surface[9] }]}>
                  {option.icon}
                </Text>
              )}
              <Text
                style={[
                  styles.label,
                  { color: colors.text.main },
                  isDisabled && styles.labelDisabled,
                ]}
              >
                {option.label}
              </Text>
            </View>

            {/* Custom radio button */}
            <View
              style={[
                styles.radio,
                {
                  borderColor: colors.field.border,
                },
              ]}
            >
              {isSelected && (
                <View
                  style={[
                    styles.radioInner,
                    { backgroundColor: colors.accent.DEFAULT },
                  ]}
                />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Base container styles
  },
  horizontal: {
    flexDirection: 'row',
    gap: 12,
  },
  vertical: {
    flexDirection: 'column',
    gap: 12,
    maxWidth: 300,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  itemDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 16,
    textTransform: 'capitalize',
    marginRight: 12,
  },
  labelDisabled: {
    opacity: 0.7,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});