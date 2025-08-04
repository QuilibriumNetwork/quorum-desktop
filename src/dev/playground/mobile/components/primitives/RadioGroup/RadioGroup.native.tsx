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
import { Icon } from '../Icon';
import { isValidIconName } from '../Icon/iconMapping';

export function RadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  direction = 'vertical',
  disabled = false,
  iconOnly = false,
  style,
  testID,
}: RadioGroupNativeProps<T>) {
  const theme = useTheme();
  
  // Use the colors directly from the theme provider (already resolved)
  const colors = theme.colors;
  

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
              direction === 'horizontal' && styles.itemHorizontal,
              iconOnly && styles.itemIconOnly,
              {
                borderColor: isSelected
                  ? colors.field.borderFocus
                  : colors.field.border,
                backgroundColor: isSelected
                  ? colors.field.bgFocus
                  : colors.field.bg, // Use theme background instead of hardcoded white
                ...(iconOnly ? {} : { minHeight: 50 }), // Only apply minHeight when not iconOnly
              },
              isDisabled && styles.itemDisabled,
            ]}
          >
            <View style={[styles.content, iconOnly && styles.contentIconOnly]}>
              {option.icon && (
                <View style={styles.iconContainer}>
                  {isValidIconName(option.icon) ? (
                    <Icon
                      name={option.icon}
                      size="sm"
                      color={colors.field.text} // Use theme text color
                    />
                  ) : (
                    <Text style={[styles.icon, { color: colors.field.text }]}>
                      {option.icon}
                    </Text>
                  )}
                </View>
              )}
              {!iconOnly && (
                <Text
                  style={[
                    styles.label,
                    { 
                      color: colors.field.text, // Use theme text color
                      fontSize: 16, // Force font size
                      fontWeight: '500', // Force font weight
                    },
                    isDisabled && styles.labelDisabled,
                  ]}
                >
                  {option.label || 'No Label'}
                </Text>
              )}
            </View>

            {/* Custom radio button - hidden in iconOnly mode */}
            {!iconOnly && (
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: isSelected 
                      ? colors.field.borderFocus 
                      : colors.field.border, // Use theme border colors
                    backgroundColor: colors.field.bg, // Use theme background
                  },
                ]}
              >
                {isSelected && (
                  <View
                    style={[
                      styles.radioInner,
                      { backgroundColor: colors.field.borderFocus }, // Use theme focus color
                    ]}
                  />
                )}
              </View>
            )}
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
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  itemHorizontal: {
    flex: 0,
    minWidth: 80,
  },
  itemIconOnly: {
    width: 50,
    height: 50,
    minWidth: 50, // Force exact width
    maxWidth: 50, // Force exact width
    minHeight: 50, // Force exact height
    maxHeight: 50, // Force exact height
    paddingHorizontal: 0, // Override base padding
    paddingVertical: 0, // Override base padding
    justifyContent: 'center', // Center the icon
    alignItems: 'center', // Center the icon
    borderRadius: 25, // Perfect circle (exactly half of width/height)
    borderWidth: 2, // Ensure border is visible
    overflow: 'hidden', // Ensure circular clipping
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
  contentIconOnly: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    width: '100%',
    height: '100%',
  },
  iconContainer: {
    // Container for icon alignment
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
