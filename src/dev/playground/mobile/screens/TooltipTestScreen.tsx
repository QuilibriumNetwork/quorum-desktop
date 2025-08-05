import React from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Tooltip, Text, Icon } from '../components/primitives';
import { commonTestStyles } from '../styles/commonTestStyles';

export const TooltipTestScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colors } = theme;

  return (
    <ScrollView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 20,
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Icon
            name="comment-dots"
            size="xl"
            color={theme.colors.text.strong}
            style={{ marginRight: 12 }}
          />
          <Text size="2xl" weight="bold" variant="strong">
            Tooltip
          </Text>
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Cross-platform tooltip for info icons in modals
          </Text>
        </View>
      </View>

      {/* Basic Tooltips */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Basic Tooltips
          </Text>
        </View>

        <View style={[commonTestStyles.componentRow, { gap: 16 }]}>
          <Tooltip
            id="basic-tooltip"
            content="This is a basic tooltip that appears when you tap this button. Tap outside or the X button to close."
            place="top"
          >
            <View
              style={[
                commonTestStyles.tooltipButton,
                { backgroundColor: colors.accent.DEFAULT },
              ]}
            >
              <Text size="base" weight="medium" color="white">
                Tap for Info
              </Text>
            </View>
          </Tooltip>

          <Tooltip
            id="info-icon-tooltip"
            content="This tooltip simulates the info icons used in UserSettingsModal and SpaceEditor. The tooltip opens with a short tap."
            place="bottom"
            maxWidth={280}
          >
            <View
              style={[
                commonTestStyles.infoIcon,
                { backgroundColor: colors.accent.DEFAULT },
              ]}
            >
              <Text size="sm" weight="bold" color="white">
                i
              </Text>
            </View>
          </Tooltip>
        </View>
      </View>

      {/* Positioning Examples */}
      <View style={commonTestStyles.sectionSimple}>
        <View style={{ marginBottom: 16 }}>
          <Text size="lg" weight="semibold" variant="strong">
            Positioning Options
          </Text>
        </View>
        <View style={{ marginBottom: 16 }}>
          <Text size="sm" variant="subtle">
            Each button is tested individually with proper spacing:
          </Text>
        </View>

        <View
          style={[
            commonTestStyles.positioningTestContainer,
            { alignItems: 'center', gap: 20 },
          ]}
        >
          {/* Top positioning test */}
          <Tooltip
            id="tooltip-top"
            content="This tooltip should appear above the button without covering it"
            place="top"
          >
            <View
              style={[
                commonTestStyles.positionButton,
                { backgroundColor: colors.surface[3] },
              ]}
            >
              <Text size="xs" variant="default">
                Top Test
              </Text>
            </View>
          </Tooltip>

          {/* Right positioning test */}
          <Tooltip id="tooltip-right" content="Right" place="right">
            <View
              style={[
                commonTestStyles.positionButton,
                { backgroundColor: colors.surface[3] },
              ]}
            >
              <Text size="xs" variant="default">
                Right Test
              </Text>
            </View>
          </Tooltip>

          {/* Bottom positioning test */}
          <Tooltip
            id="tooltip-bottom"
            content="This tooltip should appear below the button, close but not too far"
            place="bottom"
          >
            <View
              style={[
                commonTestStyles.positionButton,
                { backgroundColor: colors.surface[3] },
              ]}
            >
              <Text size="xs" variant="default">
                Bottom Test
              </Text>
            </View>
          </Tooltip>

          {/* Left positioning test */}
          <Tooltip id="tooltip-left" content="Left" place="left">
            <View
              style={[
                commonTestStyles.positionButton,
                { backgroundColor: colors.surface[3] },
              ]}
            >
              <Text size="xs" variant="default">
                Left Test
              </Text>
            </View>
          </Tooltip>
        </View>
      </View>

      {/* Testing Notes */}
      <View
        style={[
          commonTestStyles.notesSection,
          { backgroundColor: colors.surface[3] },
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Text size="base" weight="semibold" variant="strong">
            Mobile Notes
          </Text>
        </View>
        <Text size="sm" variant="default">
          • Custom modal-based tooltip with positioning{'\n'}• Short tap opens
          tooltip, tap outside or X button closes{'\n'}• Automatically positions
          to stay within screen bounds{'\n'}• Default close button on mobile for
          better UX{'\n'}• Ideal for info icons in UserSettingsModal and
          SpaceEditor{'\n'}• Supports all 12 positioning options{'\n'}•
          Configurable max width for content wrapping
        </Text>
      </View>
    </ScrollView>
  );
};

// All styles now centralized in commonTestStyles
