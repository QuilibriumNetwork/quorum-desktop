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
  Image,
} from 'react-native';
import { NativeSelectProps } from './types';
import { useTheme } from '../theme';
import { Icon } from '../Icon';
import { isValidIconName } from '../Icon/iconMapping';
import { t } from '@lingui/core/macro';

const Select: React.FC<NativeSelectProps> = ({
  value,
  options,
  groups,
  onChange,
  placeholder = t`Select an option`,
  disabled = false,
  error = false,
  errorMessage,
  style,
  size = 'medium',
  variant = 'filled',
  fullWidth = false,
  width,
  testID,
  multiple = false,
  renderSelectedValue,
  selectAllLabel = t`All`,
  clearAllLabel = t`Clear`,
  maxHeight,
  showSelectAllOption = true,
  maxDisplayedChips = 3,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | string[]>(
    multiple ? (Array.isArray(value) ? value : []) : (value || '')
  );
  const theme = useTheme();
  const colors = theme.colors;

  useEffect(() => {
    if (value !== undefined) {
      if (multiple) {
        setSelectedValue(Array.isArray(value) ? value : []);
      } else {
        setSelectedValue(value);
      }
    }
  }, [value, multiple]);

  // Helper function to get all options (flattened from groups or direct options)
  const getAllOptions = () => {
    if (groups) {
      return groups.flatMap((group) => group.options);
    }
    return options || [];
  };

  const handleSelect = (optionValue: string) => {
    if (!disabled) {
      if (multiple) {
        const currentValues = selectedValue as string[];
        let newValues: string[];
        
        if (currentValues.includes(optionValue)) {
          newValues = currentValues.filter(v => v !== optionValue);
        } else {
          newValues = [...currentValues, optionValue];
        }
        
        setSelectedValue(newValues);
        onChange?.(newValues);
        // Keep modal open for multiselect
      } else {
        setSelectedValue(optionValue);
        setIsOpen(false);
        onChange?.(optionValue);
      }
    }
  };

  const handleSelectAll = () => {
    if (!disabled && multiple) {
      const allValues = allOptions.filter(opt => !opt.disabled).map(opt => opt.value);
      setSelectedValue(allValues);
      onChange?.(allValues);
    }
  };

  const handleClearAll = () => {
    if (!disabled && multiple) {
      setSelectedValue([]);
      onChange?.([]);
    }
  };

  const allOptions = getAllOptions();
  
  // Helper to get display content
  const getDisplayContent = () => {
    if (multiple) {
      const selectedValues = selectedValue as string[];
      
      if (selectedValues.length === 0) {
        return { text: placeholder, isPlaceholder: true };
      }
      
      if (renderSelectedValue) {
        return { element: renderSelectedValue(selectedValues, allOptions) };
      }
      
      const selectedOptions = allOptions.filter(opt => selectedValues.includes(opt.value));
      const displayedOptions = selectedOptions.slice(0, maxDisplayedChips);
      const remainingCount = selectedOptions.length - maxDisplayedChips;
      
      const chipText = displayedOptions.map(opt => opt.label).join(', ');
      const displayText = remainingCount > 0 
        ? `${chipText} +${remainingCount} more`
        : chipText;
      
      return { text: displayText, isPlaceholder: false };
    } else {
      const selectedOption = allOptions.find((opt) => opt.value === selectedValue);
      return {
        text: selectedOption ? selectedOption.label : placeholder,
        isPlaceholder: !selectedOption,
        icon: selectedOption?.icon,
        avatar: selectedOption?.avatar,
        subtitle: selectedOption?.subtitle
      };
    }
  };
  
  const displayData = getDisplayContent();

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
      case 'bordered':
        return {
          backgroundColor: colors.field.bg,
          borderColor: colors.field.border,
          borderWidth: 1,
        };
      case 'filled':
      default:
        return {
          backgroundColor: colors.field.bg,
          borderColor: 'transparent',
          borderWidth: 1,
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
              ? colors.field.borderError
              : variantStyles.borderColor,
            borderWidth: error ? 2 : variantStyles.borderWidth || 1,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.valueContainer}>
          {displayData.element ? (
            displayData.element
          ) : (
            <>
              {displayData.avatar && (
                <Image
                  source={{ uri: displayData.avatar }}
                  style={styles.selectedAvatar}
                />
              )}
              {displayData.icon && !displayData.avatar && (
                <View style={styles.icon}>
                  {isValidIconName(displayData.icon) ? (
                    <Icon
                      name={displayData.icon}
                      size="sm"
                      color={colors.text.subtle}
                    />
                  ) : (
                    <Text
                      style={{
                        fontSize: sizeStyles.fontSize * 1.25,
                        color: colors.text.subtle,
                      }}
                    >
                      {displayData.icon}
                    </Text>
                  )}
                </View>
              )}
              <View style={multiple ? styles.chipsContainer : styles.textContainer}>
                {multiple && !displayData.isPlaceholder ? (
                  <View style={styles.chips}>
                    <Text
                      style={[
                        styles.chipText,
                        {
                          fontSize: sizeStyles.fontSize,
                          color: colors.field.text,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {displayData.text}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.text,
                        {
                          fontSize: sizeStyles.fontSize,
                          color: displayData.isPlaceholder
                            ? colors.field.placeholder
                            : colors.field.text,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {displayData.text}
                    </Text>
                    {displayData.subtitle && (
                      <Text
                        style={[
                          styles.subtitleText,
                          {
                            fontSize: sizeStyles.fontSize * 0.85,
                            color: colors.text.subtle,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {displayData.subtitle}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </View>
        <Icon name="chevron-down" size="xs" color={colors.field.placeholder} />
      </TouchableOpacity>

      {error && errorMessage && (
        <Text style={[styles.errorMessage, { color: colors.text.danger }]}>
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
                style={[
                  styles.dropdown,
                  { backgroundColor: colors.field.optionsBg },
                ]}
              >
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                  style={[styles.scrollView, maxHeight && { maxHeight }]}
                >
                  {/* Select All / Clear All for multiselect */}
                  {multiple && showSelectAllOption && allOptions.length > 0 && (
                    <View style={[styles.actions, { borderBottomColor: colors.border.default }]}>
                      <TouchableOpacity
                        onPress={handleSelectAll}
                        style={styles.action}
                      >
                        <Icon name="check-square" size="sm" color={colors.text.subtle} />
                        <Text style={[styles.actionText, { color: colors.text.main }]}>
                          {selectAllLabel}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleClearAll}
                        style={styles.action}
                      >
                        <Icon name="square" size="sm" color={colors.text.subtle} />
                        <Text style={[styles.actionText, { color: colors.text.main }]}>
                          {clearAllLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {groups && groups.length > 0
                    ? // Render grouped options
                      groups.map((group, groupIndex) => (
                        <View key={groupIndex} style={styles.group}>
                          <View
                            style={[
                              styles.groupLabel,
                              { backgroundColor: colors.field.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.groupLabelText,
                                { color: colors.text.subtle },
                              ]}
                            >
                              {group.groupLabel}
                            </Text>
                          </View>
                          {group.options.map((option) => {
                            const isSelected = multiple
                              ? (selectedValue as string[]).includes(option.value)
                              : option.value === selectedValue;
                            
                            return (
                              <TouchableOpacity
                                key={option.value}
                                onPress={() =>
                                  !option.disabled && handleSelect(option.value)
                                }
                                disabled={option.disabled}
                                style={[
                                  styles.option,
                                  styles.groupedOption,
                                  isSelected && {
                                    backgroundColor: colors.field.optionSelected,
                                  },
                                  option.disabled && styles.disabledOption,
                                ]}
                              >
                                <View style={styles.optionContent}>
                                  {/* Show checkbox for multiselect */}
                                  {multiple && (
                                    <Icon
                                      name={isSelected ? 'check-square' : 'square'}
                                      size="sm"
                                      color={isSelected ? colors.field.optionTextSelected : colors.text.subtle}
                                      style={styles.checkbox}
                                    />
                                  )}
                                  {option.avatar && (
                                  <Image
                                    source={{ uri: option.avatar }}
                                    style={styles.optionAvatar}
                                  />
                                )}
                                {option.icon && !option.avatar && (
                                  <View style={styles.optionIcon}>
                                    {isValidIconName(option.icon) ? (
                                      <Icon
                                        name={option.icon}
                                        size="sm"
                                        color={colors.text.subtle}
                                      />
                                    ) : (
                                      <Text
                                        style={{
                                          color: colors.text.subtle,
                                          fontSize: 18,
                                        }}
                                      >
                                        {option.icon}
                                      </Text>
                                    )}
                                  </View>
                                )}
                                <View style={styles.optionTextContainer}>
                                  <Text
                                    style={[
                                      styles.optionText,
                                      {
                                        color:
                                          option.value === selectedValue
                                            ? colors.field.optionTextSelected
                                            : colors.field.optionText,
                                        fontWeight:
                                          option.value === selectedValue
                                            ? '500'
                                            : '400',
                                      },
                                      option.disabled && { opacity: 0.5 },
                                    ]}
                                  >
                                    {option.label}
                                  </Text>
                                  {option.subtitle && (
                                    <Text
                                      style={[
                                        styles.optionSubtitle,
                                        { color: colors.text.subtle },
                                        option.disabled && { opacity: 0.5 },
                                      ]}
                                    >
                                      {option.subtitle}
                                    </Text>
                                  )}
                                  </View>
                                </View>
                                {/* Show checkmark for all selected items (consistent with single select) */}
                                {isSelected && (
                                  <Icon
                                    name="check"
                                    size="sm"
                                    color={colors.field.optionTextSelected}
                                    style={styles.checkmark}
                                  />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))
                    : // Render simple options
                      allOptions.map((option) => {
                        const isSelected = multiple
                          ? (selectedValue as string[]).includes(option.value)
                          : option.value === selectedValue;
                        
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() =>
                              !option.disabled && handleSelect(option.value)
                            }
                            disabled={option.disabled}
                            style={[
                              styles.option,
                              isSelected && {
                                backgroundColor: colors.field.optionSelected,
                              },
                              option.disabled && styles.disabledOption,
                            ]}
                          >
                            <View style={styles.optionContent}>
                              {/* Show checkbox for multiselect */}
                              {multiple && (
                                <Icon
                                  name={isSelected ? 'check-square' : 'square'}
                                  size="sm"
                                  color={isSelected ? colors.field.optionTextSelected : colors.text.subtle}
                                  style={styles.checkbox}
                                />
                              )}
                              {option.avatar && (
                              <Image
                                source={{ uri: option.avatar }}
                                style={styles.optionAvatar}
                              />
                            )}
                            {option.icon && !option.avatar && (
                              <View style={styles.optionIcon}>
                                {isValidIconName(option.icon) ? (
                                  <Icon
                                    name={option.icon}
                                    size="sm"
                                    color={colors.text.subtle}
                                  />
                                ) : (
                                  <Text
                                    style={{
                                      color: colors.text.subtle,
                                      fontSize: 18,
                                    }}
                                  >
                                    {option.icon}
                                  </Text>
                                )}
                              </View>
                            )}
                            <View style={styles.optionTextContainer}>
                              <Text
                                style={[
                                  styles.optionText,
                                  {
                                    color:
                                      option.value === selectedValue
                                        ? colors.field.optionTextSelected
                                        : colors.field.optionText,
                                    fontWeight:
                                      option.value === selectedValue
                                        ? '500'
                                        : '400',
                                  },
                                  option.disabled && { opacity: 0.5 },
                                ]}
                              >
                                {option.label}
                              </Text>
                              {option.subtitle && (
                                <Text
                                  style={[
                                    styles.optionSubtitle,
                                    { color: colors.text.subtle },
                                    option.disabled && { opacity: 0.5 },
                                  ]}
                                >
                                  {option.subtitle}
                                </Text>
                              )}
                              </View>
                            </View>
                            {/* Show checkmark for all selected items (consistent with single select) */}
                            {isSelected && (
                              <Icon
                                name="check"
                                size="sm"
                                color={colors.field.optionTextSelected}
                                style={styles.checkmark}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
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
  selectedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  icon: {
    marginRight: 4, // Smaller gap (0.25rem equivalent) like web version
  },
  textContainer: {
    flexShrink: 1, // Allow shrinking but don't expand to fill space
  },
  text: {
    flexShrink: 1, // Allow shrinking but don't expand to fill space
  },
  subtitleText: {
    marginTop: 2,
  },
  arrow: {
    fontSize: 10,
  },
  errorMessage: {
    marginTop: 4,
    marginBottom: 8,
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
  group: {
    marginBottom: 8,
  },
  groupLabel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  groupLabelText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  groupedOption: {
    paddingLeft: 24, // Indent grouped options
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  disabledOption: {
    opacity: 0.5,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Multiselect styles
  checkbox: {
    marginRight: 12,
  },
  chipsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  chipText: {
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Select;
