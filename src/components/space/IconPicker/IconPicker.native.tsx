import React, { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { Button, Icon, FlexRow, ColorSwatch, ScrollContainer, Spacer, useTheme } from '../../primitives';
import { IconPickerProps, ICON_OPTIONS, ICON_COLORS, FILLED_ICONS, getIconColorHex, IconColor } from './types';
import { IconName, IconVariant } from '../../primitives/Icon/types';
import { createIconPickerStyles } from './IconPicker.native.styles';

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  selectedIconColor = 'default',
  selectedIconVariant = 'outline',
  onIconSelect,
  placeholder = 'Select icon',
  className = '',
  testID,
  defaultIcon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(selectedIconColor);
  const [selectedVariant, setSelectedVariant] = useState<IconVariant>(selectedIconVariant);
  const [animatedHeight] = useState(new Animated.Value(0));
  const theme = useTheme();

  // Sync selectedColor with prop changes
  useEffect(() => {
    setSelectedColor(selectedIconColor);
  }, [selectedIconColor]);

  // Sync selectedVariant with prop changes
  useEffect(() => {
    setSelectedVariant(selectedIconVariant);
  }, [selectedIconVariant]);

  // Filter icons based on selected variant
  const filteredIcons = useMemo(() => {
    if (selectedVariant === 'filled') {
      return ICON_OPTIONS.filter(icon => FILLED_ICONS.has(icon.name));
    }
    return ICON_OPTIONS;
  }, [selectedVariant]);

  // Animation for dropdown open/close
  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isOpen ? 300 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen, animatedHeight]);

  const handleIconClick = (iconName: IconName) => {
    onIconSelect(iconName, selectedColor, selectedVariant);
    setIsOpen(false);
  };

  const handleClearIcon = () => {
    onIconSelect(defaultIcon || null, 'default', 'outline');
    setSelectedColor('default'); // Reset color to default
    setSelectedVariant('outline'); // Reset variant to outline
    setIsOpen(false);
  };

  const handleColorChange = (color: IconColor) => {
    setSelectedColor(color);
    // Immediately notify parent of color change with current icon
    if (selectedIcon) {
      onIconSelect(selectedIcon, color, selectedVariant);
    }
  };

  const handleVariantChange = (variant: IconVariant) => {
    setSelectedVariant(variant);
    // Immediately notify parent of variant change with current icon
    if (selectedIcon) {
      onIconSelect(selectedIcon, selectedColor, variant);
    }
  };

  const handleButtonPress = () => {
    setIsOpen(!isOpen);
  };

  // Memoize color calculation and styles for performance
  const iconColorHex = useMemo(() => getIconColorHex(selectedColor), [selectedColor]);
  const styles = useMemo(() => createIconPickerStyles(theme.colors), [theme.colors]);

  return (
    <View testID={testID}>
      {/* Icon Button */}
      {selectedIcon ? (
        <TouchableOpacity
          onPress={handleButtonPress}
          style={styles.iconButton}
          accessibilityLabel={`Selected icon: ${selectedIcon}`}
        >
          <Icon
            name={selectedIcon}
            size="sm"
            color={iconColorHex}
            variant={selectedVariant}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={handleButtonPress}
          style={styles.iconButton}
          accessibilityLabel={placeholder}
        >
          <View style={styles.emptyIconPlaceholder} />
        </TouchableOpacity>
      )}

      {/* Animated dropdown panel */}
      <Animated.View
        style={[
          styles.dropdownContainer,
          {
            height: animatedHeight,
            borderWidth: isOpen ? 1 : 0,
          },
        ]}
      >
        {isOpen && (
          <ScrollContainer height={400} showBorder={false} borderRadius="lg">
            {/* Header with variant toggle, color swatches, and clear button */}
            <View style={styles.headerContainer}>
              {/* Top row: Variant toggle (left) and Clear button (right) */}
              <FlexRow justify="space-between" align="center" style={{ marginBottom: 12 }}>
                {/* Variant toggle - styled to match icon grid */}
                <FlexRow gap="xs">
                  <TouchableOpacity
                    onPress={() => handleVariantChange('outline')}
                    style={[
                      styles.variantButton,
                      selectedVariant === 'outline' && styles.variantButtonActive
                    ]}
                    accessibilityLabel="Outline icons"
                    accessibilityState={{ selected: selectedVariant === 'outline' }}
                  >
                    <Icon name="circle" size="sm" color={iconColorHex} variant="outline" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleVariantChange('filled')}
                    style={[
                      styles.variantButton,
                      selectedVariant === 'filled' && styles.variantButtonActive
                    ]}
                    accessibilityLabel="Filled icons"
                    accessibilityState={{ selected: selectedVariant === 'filled' }}
                  >
                    <Icon name="circle" size="sm" color={iconColorHex} variant="filled" />
                  </TouchableOpacity>
                </FlexRow>

                {/* Clear selection button */}
                <Button
                  type="subtle-outline"
                  onClick={handleClearIcon}
                  size="small"
                  iconName="close"
                >
                  Clear
                </Button>
              </FlexRow>

              {/* Color selection */}
              <FlexRow gap="md" justify="between" style={styles.colorRow}>
                {ICON_COLORS.map((colorOption) => (
                  <ColorSwatch
                    key={colorOption.value}
                    color={colorOption.value === 'default' ? 'gray' : colorOption.value}
                    isActive={selectedColor === colorOption.value}
                    onPress={() => handleColorChange(colorOption.value)}
                    size="small"
                    showCheckmark={false}
                    style={colorOption.value === 'default' ? { backgroundColor: colorOption.hex } : undefined}
                  />
                ))}
              </FlexRow>
            </View>

            {/* Custom spacer with theme-aware border */}
            <Spacer
              size="md"
              spaceBefore="sm"
              spaceAfter="md"
              border
              borderColor={theme.colors.border.default}
            />

            {/* Icon Grid */}
            <View style={styles.iconGridContainer}>
              <View style={styles.iconGrid}>
                {filteredIcons.map((iconOption) => (
                  <TouchableOpacity
                    key={iconOption.name}
                    onPress={() => handleIconClick(iconOption.name)}
                    style={[
                      styles.iconOption,
                      selectedIcon === iconOption.name ? styles.selectedOption : styles.unselectedOption
                    ]}
                    accessibilityLabel={`Select ${iconOption.name} icon for ${iconOption.category.toLowerCase()}`}
                    accessibilityHint={`Tap to select this icon`}
                    accessibilityState={{ selected: selectedIcon === iconOption.name }}
                  >
                    <Icon
                      name={iconOption.name}
                      size="md"
                      color={iconColorHex}
                      variant={selectedVariant}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollContainer>
        )}
      </Animated.View>
    </View>
  );
};