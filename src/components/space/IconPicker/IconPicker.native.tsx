import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Button, Icon, FlexRow, ColorSwatch, ScrollContainer, useTheme } from '../../primitives';
import { IconPickerProps, ICON_OPTIONS, ICON_COLORS, getIconColorHex, IconColor } from './types';
import { IconName } from '../../primitives/Icon/types';

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  selectedIconColor = 'default',
  onIconSelect,
  placeholder = 'Select icon',
  className = '',
  testID,
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
    onIconSelect(null, 'default');
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

  const iconColorHex = getIconColorHex(selectedColor);

  const styles = StyleSheet.create({
    iconButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.bg.field || theme.colors.surface[2],
      borderWidth: 1,
      borderColor: theme.colors.border.field || theme.colors.border.default,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyIconPlaceholder: {
      width: 20,
      height: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.border.default,
      borderRadius: 6,
    },
    dropdownContainer: {
      overflow: 'hidden',
      marginTop: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.bg.card || theme.colors.surface[1],
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    headerContainer: {
      backgroundColor: theme.colors.bg.card || theme.colors.surface[1],
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.default,
      position: 'relative',
    },
    clearButtonContainer: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 1,
    },
    colorRow: {
      justifyContent: 'center',
      paddingTop: 32,
      gap: 12,
    },
    iconGridContainer: {
      padding: 16,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-around',
    },
    iconOption: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      backgroundColor: theme.colors.surface[2] || '#f3f4f6',
      borderWidth: 1,
      borderColor: theme.colors.border.subtle || theme.colors.border.default,
    },
    selectedOption: {
      borderWidth: 2,
      borderColor: theme.colors.accent.DEFAULT,
      backgroundColor: theme.colors.surface[3] || '#e5e7eb',
    },
  });

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
            style={{
              color: iconColorHex,
            }}
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
          },
        ]}
      >
        {isOpen && (
          <ScrollContainer height={300} showBorder={false} borderRadius="lg">
            {/* Header with color swatches and clear button */}
            <View style={styles.headerContainer}>
              {/* Clear selection button */}
              <View style={styles.clearButtonContainer}>
                <Button
                  type="subtle-outline"
                  onPress={handleClearIcon}
                  size="small"
                  iconName="times"
                >
                  Clear
                </Button>
              </View>

              {/* Color selection */}
              <FlexRow gap="md" style={styles.colorRow}>
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
                      borderColor: '#d1d5db'
                    } : undefined}
                  />
                ))}
              </FlexRow>
            </View>

            {/* Icon Grid */}
            <View style={styles.iconGridContainer}>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((iconOption) => (
                  <TouchableOpacity
                    key={iconOption.name}
                    onPress={() => handleIconClick(iconOption.name)}
                    style={[
                      styles.iconOption,
                      selectedIcon === iconOption.name && styles.selectedOption
                    ]}
                    accessibilityLabel={`Select ${iconOption.name} icon for ${iconOption.category.toLowerCase()}`}
                    accessibilityHint={`Tap to select this icon`}
                    accessibilityState={{ selected: selectedIcon === iconOption.name }}
                  >
                    <Icon
                      name={iconOption.name}
                      size="md"
                      style={{ color: iconColorHex }}
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