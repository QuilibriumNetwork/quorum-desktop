import * as React from 'react';
import { ColorSwatch, FlexRow } from './primitives';
import { useTheme } from './primitives/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { isNative } from '../utils/platform';
import type { AccentColor } from './primitives/theme/colors';

const ACCENT_COLORS: AccentColor[] = ['blue', 'purple', 'fuchsia', 'orange', 'green', 'yellow'];

const AccentColorSwitcher: React.FC = () => {
  const { accent, setAccent } = useTheme();
  const { isMobile } = useResponsiveLayout();

  // Native apps always use medium size for better touch targets
  // Web apps use responsive sizing based on viewport
  const swatchSize = isNative ? 'medium' : isMobile ? 'medium' : 'large';
  
  // Native/mobile apps need larger gaps for better touch targets
  // Web apps use smaller gaps for compact layout
  const swatchGap = isNative ? 12 : isMobile ? 12 : 3;

  return (
    <FlexRow gap={swatchGap}>
      {ACCENT_COLORS.map((color) => (
        <ColorSwatch
          key={color}
          color={color}
          isActive={accent === color}
          onPress={() => setAccent(color)}
          size={swatchSize}
        />
      ))}
    </FlexRow>
  );
};

export default AccentColorSwitcher;