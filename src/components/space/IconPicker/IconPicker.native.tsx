import React, { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { Button, Icon, FlexRow, ColorSwatch, ScrollContainer, Spacer, useTheme } from '../../primitives';
import { IconPickerProps, ICON_OPTIONS, ICON_COLORS, getIconColorHex, IconColor } from './types';
import { IconName } from '../../primitives/Icon/types';
import { createIconPickerStyles } from './IconPicker.native.styles';

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  selectedIconColor = 'default',
  onIconSelect,
  placeholder = 'Select icon',
  className = '',
  testID,
  defaultIcon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(selectedIconColor);
  const [animatedHeight] = useState(new Animated.Value(0));
  const theme = useTheme();

  // Sync selectedColor with prop changes
  useEffect(() => {
    setSelectedColor(selectedIconColor);
  }, [selectedIconColor]);

  // Animation for dropdown open/close
  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isOpen ? 300 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen, animatedHeight]);

  const handleIconClick = (iconName: IconName) => {
    onIconSelect(iconName, selectedColor);
    setIsOpen(false);
  };

  const handleClearIcon = () => {
    onIconSelect(defaultIcon || null, 'default');
    setSelectedColor('default'); // Reset color to default
    setIsOpen(false);
  };

  const handleColorChange = (color: IconColor) => {
    setSelectedColor(color);
    // Immediately notify parent of color change with current icon
    if (selectedIcon) {
      onIconSelect(selectedIcon, color);
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
            {/* Header with color swatches and clear button */}
            <View style={styles.headerContainer}>
              {/* Clear selection button */}
              <View style={styles.clearButtonContainer}>
                <Button
                  type="subtle-outline"
                  onClick={handleClearIcon}
                  size="small"
                  iconName="times"
                >
                  Clear
                </Button>
              </View>

              <Spacer size={36} />

              {/* Color selection */}
              <FlexRow gap="md" justify="center" style={styles.colorRow}>
                {ICON_COLORS.map((colorOption) => (
                  <ColorSwatch
                    key={colorOption.value}
                    color={colorOption.value === 'default' ? 'gray' : colorOption.value}
                    isActive={selectedColor === colorOption.value}
                    onPress={() => handleColorChange(colorOption.value)}
                    size="small"
                    style={colorOption.value === 'default' ? {
                      backgroundColor: colorOption.hex,
                      borderWidth: 1,
                      borderColor: theme.colors.surface[5] || theme.colors.border.default
                    } : undefined}
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
                {ICON_OPTIONS.map((iconOption) => (
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