import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { NativeSelectProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';
import { Icon } from '../Icon';
import { isValidIconName } from '../Icon/iconMapping';

const Select: React.FC<NativeSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error = false,
  errorMessage,
  style,
  size = 'medium',
  variant = 'default',
  fullWidth = false,
  width,
  testID,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const theme = useTheme();
  const colors = getColors(theme.mode, theme.accentColor);

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  const handleSelect = (optionValue: string) => {
    if (!disabled) {
      setSelectedValue(optionValue);
      setIsOpen(false);
      onChange?.(optionValue);
    }
  };

  const selectedOption = options.find((opt) => opt.value === selectedValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 6,
          paddingHorizontal: 10,
          fontSize: 12,
        };
      case 'large':
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          fontSize: 16,
        };
      default:
        return {
          paddingVertical: 8,
          paddingHorizontal: 12,
          fontSize: 14,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const getVariantStyles = () => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: colors.surface[2],
          borderColor: 'transparent',
        };
      default:
        return {
          backgroundColor: colors.bg.input,
          borderColor: colors.border.default,
        };
    }
  };

  const variantStyles = getVariantStyles();

  // Build custom style with width override
  const customStyle = [
    styles.container,
    fullWidth && styles.fullWidth,
    width && { width },
    style,
  ];

  return (
    <View style={customStyle}>
      <TouchableOpacity
        testID={testID}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        style={[
          styles.trigger,
          variantStyles,
          {
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            borderColor: error
              ? colors.utilities.danger
              : variantStyles.borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.valueContainer}>
          {selectedOption?.icon && (
            isValidIconName(selectedOption.icon) ? (
              <Icon name={selectedOption.icon} size="sm" color={colors.text.subtle} />
            ) : (
              <Text
                style={[styles.icon, { fontSize: sizeStyles.fontSize * 1.25, color: colors.text.subtle }]}
              >
                {selectedOption.icon}
              </Text>
            )
          )}
          <Text
            style={[
              styles.text,
              {
                fontSize: sizeStyles.fontSize,
                color: selectedOption ? colors.text.main : colors.text.subtle,
              },
            ]}
            numberOfLines={1}
          >
            {displayText}
          </Text>
        </View>
        <Icon name="chevron-down" size="xs" color={colors.text.subtle} />
      </TouchableOpacity>

      {error && errorMessage && (
        <Text style={[styles.errorMessage, { color: colors.utilities.danger }]}>
          {errorMessage}
        </Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[styles.dropdown, { backgroundColor: colors.bg.modal }]}
              >
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                  style={styles.scrollView}
                >
                  {options.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() =>
                        !option.disabled && handleSelect(option.value)
                      }
                      disabled={option.disabled}
                      style={[
                        styles.option,
                        option.value === selectedValue && {
                          backgroundColor: colors.surface[2],
                        },
                        option.disabled && styles.disabledOption,
                      ]}
                    >
                      <View style={styles.optionContent}>
                        {option.icon && (
                          isValidIconName(option.icon) ? (
                            <Icon name={option.icon} size="sm" color={colors.text.subtle} />
                          ) : (
                            <Text style={[styles.optionIcon, { color: colors.text.subtle }]}>{option.icon}</Text>
                          )
                        )}
                        <Text
                          style={[
                            styles.optionText,
                            {
                              color:
                                option.value === selectedValue
                                  ? colors.accent.DEFAULT
                                  : colors.text.main,
                              fontWeight:
                                option.value === selectedValue ? '500' : '400',
                            },
                            option.disabled && { opacity: 0.5 },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </View>
                      {option.value === selectedValue && (
                        <Icon
                          name="check"
                          size="sm"
                          color={colors.accent.DEFAULT}
                          style={styles.checkmark}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    minWidth: 150,
    maxWidth: 280,
  },
  fullWidth: {
    width: '100%',
    maxWidth: undefined,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    flex: 1,
  },
  errorMessage: {
    marginTop: 4,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  scrollView: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  disabledOption: {
    opacity: 0.5,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  checkmark: {
    marginLeft: 8,
    flexShrink: 0,
  },
});

export default Select;
