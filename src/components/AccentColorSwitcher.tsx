import * as React from 'react';
import { ColorSwatch, FlexRow } from './primitives';
import { useTheme } from './primitives/theme';
import { useResponsiveLayout } from '../hooks';
import { isNative } from '../utils/platform';
import type { AccentColor } from './primitives/theme/colors';

const ACCENT_COLORS: AccentColor[] = ['blue', 'purple', 'fuchsia', 'orange', 'green', 'yellow'];

const AccentColorSwitcher: React.FC = () => {
  const { accent, setAccent } = useTheme();
  const { isMobile } = useResponsiveLayout();

  // Native apps always use medium size for better touch targets
  // Web apps use responsive sizing based on viewport
  const swatchSize = isNative ? 'medium' : isMobile ? 'medium' : 'large';

  return (
    <FlexRow gap={3}>
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
