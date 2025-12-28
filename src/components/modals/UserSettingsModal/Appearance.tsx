import * as React from 'react';
import { Select, Button, Tooltip, Spacer, ColorSwatch, FlexRow } from '../../primitives';
import { t } from '@lingui/core/macro';
import { ThemeRadioGroup } from '../../ui';
import { useTheme, type AccentColor } from '../../primitives/theme';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';

const ACCENT_COLORS: AccentColor[] = [
  'blue',
  'purple',
  'fuchsia',
  'orange',
  'green',
  'yellow',
];

interface AppearanceProps {
  language: string;
  setLanguage: (value: string) => void;
  languageChanged: boolean;
  localeOptions: Array<{ value: string; label: string }>;
  forceUpdate: () => void;
}

const Appearance: React.FunctionComponent<AppearanceProps> = ({
  language,
  setLanguage,
  languageChanged,
  localeOptions,
  forceUpdate,
}) => {
  const { accent, setAccent } = useTheme();
  const { isMobile } = useResponsiveLayout();
  const swatchSize = isMobile ? 'medium' : 'large';

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">{t`Appearance`}</div>
          <div className="pt-2 text-body">
            {t`Choose your preferred theme for Quorum.`}
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <ThemeRadioGroup horizontal />

        <div className="mt-8 ml-1">
          <FlexRow gap={isMobile ? 'lg' : 'sm'}>
            {ACCENT_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                isActive={accent === color}
                onPress={() => setAccent(color)}
                size={swatchSize}
                applyAccentTheme
              />
            ))}
          </FlexRow>
        </div>

        <div className="mt-8">
          <Spacer size="md" direction="vertical" borderTop={true} />
          <div className="text-subtitle-2 pb-2">{t`Language`}</div>
          <div className="flex flex-row gap-2 items-center">
            <Select
              value={language}
              options={localeOptions}
              onChange={(value: string) => {
                setLanguage(value);
              }}
              width="200px"
              dropdownPlacement="bottom"
            />
            <Tooltip
              id="settings-language-refresh-tooltip"
              content={t`Changes are made automatically, but the active page may not be updated. Refresh the page to apply the new language.`}
              place="top"
            >
              <Button
                type="secondary"
                disabled={!languageChanged}
                onClick={forceUpdate}
              >
                {t`Refresh`}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </>
  );
};

export default Appearance;