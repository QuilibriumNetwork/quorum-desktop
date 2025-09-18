import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Button, Icon, FlexRow, ColorSwatch } from '../../primitives';
import { IconPickerProps, ICON_OPTIONS, ICON_COLORS, getIconColorClass, IconColor } from './types';
import { IconName } from '../../primitives/Icon/types';

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  selectedIconColor = 'default',
  onIconSelect,
  buttonVariant = 'subtle',
  placeholder = 'Select icon',
  disabled = false,
  className = '',
  testID,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedColor, setSelectedColor] = useState(selectedIconColor);

  const handleIconClick = (iconName: IconName) => {
    onIconSelect(iconName, selectedColor);
    setIsExpanded(false);
  };

  const handleClearIcon = () => {
    onIconSelect(null, 'default');
    setIsExpanded(false);
  };

  const handleColorChange = (color: IconColor) => {
    setSelectedColor(color);
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Trigger Button */}
      <Button
        variant={buttonVariant}
        onPress={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
        className={className}
        accessibilityLabel={selectedIcon ? `Selected icon: ${selectedIcon}` : placeholder}
      >
        {selectedIcon ? (
          <Icon
            name={selectedIcon}
            size="sm"
            className={getIconColorClass(selectedIconColor)}
          />
        ) : (
          <View style={styles.placeholderIcon} />
        )}
      </Button>

      {/* Expandable Grid */}
      {isExpanded && (
        <View style={styles.expandedContainer}>
          <ScrollView
            style={styles.scrollView}
            stickyHeaderIndices={[0]}
            showsVerticalScrollIndicator={true}
          >
            {/* Sticky Color Swatch Header */}
            <View style={styles.stickyHeader}>
              <FlexRow style={styles.colorRow}>
                {ICON_COLORS.map((colorOption) => (
                  <ColorSwatch
                    key={colorOption.value}
                    color={colorOption.value === 'default' ? 'gray' : colorOption.value}
                    isActive={selectedColor === colorOption.value}
                    onPress={() => handleColorChange(colorOption.value)}
                    size="small"
                    style={colorOption.value === 'default' ? {
                      backgroundColor: colorOption.hex,
                      borderWidth: 2,
                      borderColor: '#d1d5db'
                    } : undefined}
                  />
                ))}
              </FlexRow>

              {/* Clear selection button */}
              <Button
                variant="subtle"
                onPress={handleClearIcon}
                style={styles.clearButton}
              >
                Clear Selection
              </Button>
            </View>

            {/* Icon Grid - 6 columns for mobile */}
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((iconOption) => (
                <TouchableOpacity
                  key={iconOption.name}
                  onPress={() => handleIconClick(iconOption.name)}
                  style={[
                    styles.iconOption,
                    selectedIcon === iconOption.name && styles.selectedOption
                  ]}
                  accessibilityLabel={`Select ${iconOption.name} icon`}
                  accessibilityHint={`${iconOption.category} category`}
                >
                  <Icon
                    name={iconOption.name}
                    size="md"
                    className={getIconColorClass(selectedColor)}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  placeholderIcon: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#9ca3af',
    borderRadius: 4,
  },
  expandedContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 320,
  },
  scrollView: {
    maxHeight: 300,
  },
  stickyHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  colorRow: {
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  clearButton: {
    alignSelf: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    justifyContent: 'space-between',
  },
  iconOption: {
    width: '15%', // 6 columns: 100% / 6 ≈ 15%
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: '#3b82f6',
    backgroundColor: '#f1f5f9',
  },
});