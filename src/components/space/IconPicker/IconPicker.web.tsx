import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button, Icon, FlexRow, ColorSwatch } from '../../primitives';
import { DropdownPanel } from '../../ui';
import {
  IconPickerProps,
  ICON_OPTIONS,
  ICON_COLORS,
  getIconColorHex,
  IconColor,
} from './types';
import { IconName } from '../../primitives/Icon/types';
import { Trans } from '@lingui/react/macro';

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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);

  // Memoize color calculations for performance
  const iconColorHex = useMemo(() => getIconColorHex(selectedColor), [selectedColor]);

  // Sync selectedColor with prop changes
  useEffect(() => {
    setSelectedColor(selectedIconColor);
  }, [selectedIconColor]);

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
    onIconSelect(iconName, selectedColor);
    setIsOpen(false);
  };

  const handleButtonClick = () => {
    setIsOpen(!isOpen);
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
            style={{ backgroundColor: 'var(--color-field-bg)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-field-bg-focus)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-field-bg)';
            }}
            aria-label={`Selected icon: ${selectedIcon}`}
          >
            <Icon
              name={selectedIcon}
              size="sm"
              color={iconColorHex}
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
        {/* Color Swatch Header */}
        <div className="p-3 border-b border-surface-3 relative">
          {/* Clear selection button */}
          <Button
            type="unstyled"
            onClick={handleClearIcon}
            className="absolute top-2 right-2 flex items-center gap-1 hover:text-main"
            size="small"
          >
            <Icon name="times" />
            <Trans>Clear</Trans>
          </Button>

          <FlexRow gap={3} justify="center" className="pt-8">
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
                        border: '1px solid var(--surface-5)',
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
              <button
                key={iconOption.name}
                onClick={() => handleIconClick(iconOption.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleIconClick(iconOption.name);
                  }
                }}
                className={`w-7 h-7 p-0 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none ${
                  selectedIcon === iconOption.name
                    ? 'border-2 border-accent bg-surface-2'
                    : 'border border-transparent bg-surface-2 hover:bg-surface-2 hover:border-accent focus:border-accent'
                }`}
                aria-label={`Select ${iconOption.name} icon for ${iconOption.category.toLowerCase()}`}
                aria-pressed={selectedIcon === iconOption.name}
              >
                <Icon
                  name={iconOption.name}
                  size="sm"
                  color={iconColorHex}
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
