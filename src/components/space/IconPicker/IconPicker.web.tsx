import React, { useState, useRef, useEffect } from 'react';
import { Button, Icon, FlexRow, ColorSwatch } from '../../primitives';
import { DropdownPanel } from '../../DropdownPanel';
import {
  IconPickerProps,
  ICON_OPTIONS,
  ICON_COLORS,
  getIconColorClass,
  getIconColorHex,
  IconColor,
} from './types';
import { IconName } from '../../primitives/Icon/types';
import { Trans } from '@lingui/react/macro';

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
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(selectedIconColor);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);

  // Sync selectedColor with prop changes
  useEffect(() => {
    setSelectedColor(selectedIconColor);
  }, [selectedIconColor]);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const position = {
        top: rect.bottom + 0, // 0px below button
        left: rect.right + -24, // Open to the right
      };
      setDropdownPosition(position);
    }
  }, [isOpen]);

  const handleIconClick = (iconName: IconName) => {
    onIconSelect(iconName, selectedColor);
    setIsOpen(false);
  };

  const handleButtonClick = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
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

  // Grid layout: responsive columns (4 mobile, 6 tablet, 8 desktop)
  const gridCols = 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';

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
            className={`icon-picker-button cursor-pointer w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              buttonVariant === 'primary'
                ? 'bg-accent text-white hover:bg-accent-400'
                : ''
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: 'var(--color-field-bg)' }}
            onMouseEnter={(e) => {
              if (!disabled && buttonVariant !== 'primary') {
                e.currentTarget.style.backgroundColor = 'var(--color-field-bg-focus)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && buttonVariant !== 'primary') {
                e.currentTarget.style.backgroundColor = 'var(--color-field-bg)';
              }
            }}
            aria-label={`Selected icon: ${selectedIcon}`}
          >
            <Icon
              name={selectedIcon}
              size="sm"
              style={{
                color: getIconColorHex(selectedColor as IconColor) || '#9ca3af'
              }}
              title={`${selectedIcon}`}
            />
          </span>
        ) : (
          <span
            onClick={handleButtonClick}
            className={`icon-picker-button cursor-pointer w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              buttonVariant === 'primary'
                ? 'bg-accent text-white hover:bg-accent-400'
                : ''
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: 'var(--color-field-bg)' }}
            onMouseEnter={(e) => {
              if (!disabled && buttonVariant !== 'primary') {
                e.currentTarget.style.backgroundColor = 'var(--color-field-bg-focus)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && buttonVariant !== 'primary') {
                e.currentTarget.style.backgroundColor = 'var(--color-field-bg)';
              }
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
        positionStyle="search-results"
        maxWidth={320}
        maxHeight={280}
        showCloseButton={false}
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          zIndex: 15000, // Higher than modal z-index (3000)
          backgroundColor: 'var(--color-bg-sidebar)',
        }}
      >
        {/* Color Swatch Header */}
        <div className="p-3 border-b border-surface-3 relative">
          {/* Clear selection button */}
          <Button
            type="unstyled"
            onClick={handleClearIcon}
            className="absolute top-2 right-2 flex items-center gap-1"
            size="small"
          >
            <Icon name="times" />
            <Trans>Clear</Trans>
          </Button>

          <FlexRow gap={3} className="justify-left pt-8">
            {ICON_COLORS.map((colorOption) => (
              <ColorSwatch
                key={colorOption.value}
                color={
                  colorOption.value === 'default' ? 'gray' : colorOption.value
                }
                isActive={selectedColor === colorOption.value}
                onPress={() => handleColorChange(colorOption.value)}
                size="small"
                style={
                  colorOption.value === 'default'
                    ? {
                        backgroundColor: colorOption.hex,
                        border: '1px solid #d1d5db',
                      }
                    : undefined
                }
              />
            ))}
          </FlexRow>
        </div>

        {/* Scrollable Icon Grid */}
        <div className="p-2 mt-2">
          <div className="grid grid-cols-8 gap-1">
            {ICON_OPTIONS.map((iconOption) => (
              <span
                key={iconOption.name}
                onClick={() => handleIconClick(iconOption.name)}
                className={`w-7 h-7 p-0 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  selectedIcon === iconOption.name
                    ? 'border border-accent bg-surface-5'
                    : 'bg-surface-3 hover:bg-surface-5'
                }`}
              >
                <Icon
                  name={iconOption.name}
                  size="sm"
                  style={{
                    color: getIconColorHex(selectedColor as IconColor) || '#9ca3af',
                    pointerEvents: 'none'
                  }}
                  title={`${iconOption.name}`}
                />
              </span>
            ))}
          </div>
        </div>
      </DropdownPanel>
    </>
  );
};
