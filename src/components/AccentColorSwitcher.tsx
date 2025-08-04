import * as React from 'react';
import { ColorSwatch, FlexRow } from './primitives';
import { useAccentColor, useResponsiveLayout } from '../hooks';
import { isNative } from '../utils/platform';

const AccentColorSwitcher: React.FC = () => {
  const { activeAccent, setAccent, availableColors } = useAccentColor();
  const { isMobile } = useResponsiveLayout();

  // Native apps always use medium size for better touch targets
  // Web apps use responsive sizing based on viewport
  const swatchSize = isNative ? 'medium' : isMobile ? 'medium' : 'large';

  return (
    <FlexRow gap={3}>
      {availableColors.map((color) => (
        <ColorSwatch
          key={color}
          color={color}
          isActive={activeAccent === color}
          onPress={() => setAccent(color)}
          size={swatchSize}
        />
      ))}
    </FlexRow>
  );
};

export default AccentColorSwitcher;
