import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button, Icon, FlexRow, ColorSwatch, useTheme } from '../../primitives';
import { DropdownPanel } from '../../ui';
import {
  IconPickerProps,
  ICON_OPTIONS,
  ICON_COLORS,
  FOLDER_COLORS,
  FILLED_ICONS,
  getIconColorHex,
  getFolderColorHex,
  IconColor,
} from './types';
import { IconName, IconVariant } from '../../primitives/Icon/types';
import { Trans } from '@lingui/react/macro';
import './IconPicker.scss';

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  selectedIconColor = 'default',
  selectedIconVariant = 'outline',
  onIconSelect,
  placeholder = 'Select icon',
  className = '',
  testID,
  defaultIcon,
  mode = 'icon-color',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(selectedIconColor);
  const [selectedVariant, setSelectedVariant] = useState<IconVariant>(selectedIconVariant);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  // In background-color mode, icons are always white, color is used for backgrounds
  const isBackgroundColorMode = mode === 'background-color';

  // Memoize color calculations for performance
  // Use dimmed folder colors in background-color mode
  const iconColorHex = useMemo(
    () => isBackgroundColorMode ? getFolderColorHex(selectedColor, isDarkTheme) : getIconColorHex(selectedColor),
    [selectedColor, isBackgroundColorMode, isDarkTheme]
  );
  const displayIconColor = isBackgroundColorMode ? '#ffffff' : iconColorHex;

  // Filter icons based on selected variant
  const filteredIcons = useMemo(() => {
    if (selectedVariant === 'filled') {
      return ICON_OPTIONS.filter(icon => FILLED_ICONS.has(icon.name));
    }
    return ICON_OPTIONS;
  }, [selectedVariant]);

  // Sync selectedColor with prop changes
  useEffect(() => {
    setSelectedColor(selectedIconColor);
  }, [selectedIconColor]);

  // Sync selectedVariant with prop changes
  useEffect(() => {
    setSelectedVariant(selectedIconVariant);
  }, [selectedIconVariant]);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px below button
        left: rect.left, // Align with button left edge
      });
    }
  }, [isOpen]);


  const handleIconClick = (iconName: IconName) => {
    onIconSelect(iconName, selectedColor, selectedVariant);
    setIsOpen(false);
  };

  const handleButtonClick = () => {
    setIsOpen(!isOpen);
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


  return (
    <>
      <div
        ref={buttonRef}
        className={`${className} relative`}
        data-testid={testID}
      >
        {selectedIcon ? (
          <span
            onClick={handleButtonClick}
            className="icon-picker-button cursor-pointer w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: isBackgroundColorMode ? iconColorHex : 'var(--color-field-bg)',
            }}
            onMouseEnter={(e) => {
              if (!isBackgroundColorMode) {
                e.currentTarget.style.backgroundColor = 'var(--color-field-bg-focus)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isBackgroundColorMode) {
                e.currentTarget.style.backgroundColor = 'var(--color-field-bg)';
              }
            }}
            aria-label={`Selected icon: ${selectedIcon}`}
          >
            <Icon
              name={selectedIcon}
              size="sm"
              color={displayIconColor}
              variant={selectedVariant}
            />
          </span>
        ) : (
          <span
            onClick={handleButtonClick}
            className="icon-picker-button cursor-pointer w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'var(--color-field-bg)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-field-bg-focus)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-field-bg)';
            }}
            aria-label={placeholder}
          >
            <div className="w-5 h-5 border border-dashed border-surface-9 rounded-xl" />
          </span>
        )}
      </div>

      <DropdownPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position="fixed"
        maxWidth={320}
        maxHeight={340}
        showCloseButton={false}
        useMobileBottomSheet={false}
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          zIndex: 15000, // Higher than modal z-index (3000)
          backgroundColor: 'var(--color-bg-sidebar)',
        }}
      >
        {/* Header with variant toggle and clear button */}
        <div className="p-3 border-b border-surface-3">
          {/* Top row: Variant toggle (left) and Clear button (right) */}
          <div className="flex justify-between items-center mb-3">
            {/* Variant toggle - styled to match icon grid */}
            <FlexRow gap={1}>
              <button
                onClick={() => handleVariantChange('outline')}
                className={`icon-picker-variant-btn ${selectedVariant === 'outline' ? 'icon-picker-variant-btn--active' : ''}`}
                aria-label="Outline icons"
                aria-pressed={selectedVariant === 'outline'}
              >
                <Icon name="circle" size="sm" color={displayIconColor} variant="outline" />
              </button>
              <button
                onClick={() => handleVariantChange('filled')}
                className={`icon-picker-variant-btn ${selectedVariant === 'filled' ? 'icon-picker-variant-btn--active' : ''}`}
                aria-label="Filled icons"
                aria-pressed={selectedVariant === 'filled'}
              >
                <Icon name="circle" size="sm" color={displayIconColor} variant="filled" />
              </button>
            </FlexRow>

            {/* Clear selection button */}
            <Button
              type="unstyled"
              onClick={handleClearIcon}
              className="flex items-center gap-1 hover:text-main ml-auto"
              size="small"
            >
              <Icon name="close" size="sm" />
              <Trans>Clear</Trans>
            </Button>
          </div>

          {/* Color swatches row */}
          <FlexRow gap={3} justify="between">
            {isBackgroundColorMode ? (
              // Background-color mode: show colored circles with white icon inside (using dimmed folder colors)
              FOLDER_COLORS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  onClick={() => handleColorChange(colorOption.value)}
                  className={`icon-picker-bg-swatch ${selectedColor === colorOption.value ? 'icon-picker-bg-swatch--active' : ''}`}
                  style={{
                    backgroundColor: colorOption.value === 'default'
                      ? getFolderColorHex('default', isDarkTheme)
                      : colorOption.hex
                  }}
                  aria-label={`Select ${colorOption.label} background color`}
                  aria-pressed={selectedColor === colorOption.value}
                >
                  <Icon
                    name={selectedIcon || 'folder'}
                    size="xs"
                    color="#ffffff"
                    variant={selectedVariant}
                  />
                </button>
              ))
            ) : (
              // Icon-color mode: standard color swatches
              ICON_COLORS.map((colorOption) => (
                <ColorSwatch
                  key={colorOption.value}
                  color={colorOption.value === 'default' ? 'gray' : colorOption.value}
                  isActive={selectedColor === colorOption.value}
                  onPress={() => handleColorChange(colorOption.value)}
                  size="small"
                  showCheckmark={false}
                  className="icon-picker-color-swatch"
                  style={colorOption.value === 'default' ? { backgroundColor: colorOption.hex } : undefined}
                />
              ))
            )}
          </FlexRow>
        </div>

        {/* Scrollable Icon Grid */}
        <div className="p-2 mt-2">
          <div className="grid grid-cols-8 gap-1">
            {filteredIcons.map((iconOption) => (
              <button
                key={iconOption.name}
                onClick={() => handleIconClick(iconOption.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleIconClick(iconOption.name);
                  }
                }}
                className={`icon-picker-icon-btn ${selectedIcon === iconOption.name ? 'icon-picker-icon-btn--active' : ''} ${isBackgroundColorMode ? 'icon-picker-icon-btn--bg-mode' : ''}`}
                style={isBackgroundColorMode ? { backgroundColor: iconColorHex } : undefined}
                aria-label={`Select ${iconOption.name} icon for ${iconOption.category.toLowerCase()}`}
                aria-pressed={selectedIcon === iconOption.name}
              >
                <Icon
                  name={iconOption.name}
                  size="sm"
                  color={displayIconColor}
                  variant={selectedVariant}
                  style={{ pointerEvents: 'none' }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      </DropdownPanel>
    </>
  );
};
