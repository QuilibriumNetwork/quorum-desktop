import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Tooltip, Text, Icon, Title, FlexColumn, FlexRow, Button } from '../components/primitives';
import { commonTestStyles, createThemedStyles } from '../styles/commonTestStyles';

export const TooltipTestScreen: React.FC = () => {
  const theme = useTheme();
  const { colors } = theme;
  const themedStyles = createThemedStyles(theme);

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          <Icon
            name="comment-dots"
            size="xl"
            style={{ marginTop: 2 }}
          />
          <Title>Tooltip</Title>
        </FlexRow>
        <Text size="base" variant="default" align="center">
          Cross-platform tooltip for info icons in modals
        </Text>
      </View>

      {/* Basic Tooltips */}
      <View style={themedStyles.section}>
        <FlexColumn gap="md">
          <Title size="sm">Basic Tooltips</Title>

          <FlexRow gap="md" style={{ justifyContent: 'center' }}>
            <Tooltip
              id="basic-tooltip"
              content="This is a basic tooltip that appears when you tap this button. Tap outside or the X button to close."
              place="top"
            >
              <Button
                onClick={() => {}}
                type="primary"
                size="normal"
              >
                Tap for Info
              </Button>
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
          </FlexRow>
        </FlexColumn>
      </View>

      {/* Positioning Examples */}
      <View style={themedStyles.section}>
        <FlexColumn gap="md">
          <Title size="sm">Positioning Options</Title>
          <Text size="sm" variant="subtle">
            Each button is tested individually with proper spacing:
          </Text>

          <FlexColumn gap="lg" align="center">
            {/* Top positioning test */}
            <Tooltip
              id="tooltip-top"
              content="This tooltip should appear above the button without covering it"
              place="top"
            >
              <Button
                onClick={() => {}}
                type="secondary"
                size="small"
              >
                Top Test
              </Button>
            </Tooltip>

            {/* Right positioning test */}
            <Tooltip id="tooltip-right" content="Right" place="right">
              <Button
                onClick={() => {}}
                type="secondary"
                size="small"
              >
                Right Test
              </Button>
            </Tooltip>

            {/* Bottom positioning test */}
            <Tooltip
              id="tooltip-bottom"
              content="This tooltip should appear below the button, close but not too far"
              place="bottom"
            >
              <Button
                onClick={() => {}}
                type="secondary"
                size="small"
              >
                Bottom Test
              </Button>
            </Tooltip>

            {/* Left positioning test */}
            <Tooltip id="tooltip-left" content="Left" place="left">
              <Button
                onClick={() => {}}
                type="secondary"
                size="small"
              >
                Left Test
              </Button>
            </Tooltip>
          </FlexColumn>
        </FlexColumn>
      </View>

      {/* Testing Notes */}
      <View style={themedStyles.notesSection}>
        <FlexColumn gap="sm">
          <Title size="sm">Mobile Notes</Title>
          
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">•</Text>
            <View style={{flex: 1}}>
              <Text size="sm" variant="default">Custom modal-based tooltip with positioning</Text>
            </View>
          </FlexRow>
          
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">•</Text>
            <View style={{flex: 1}}>
              <Text size="sm" variant="default">Short tap opens tooltip, tap outside or X button closes</Text>
            </View>
          </FlexRow>
          
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">•</Text>
            <View style={{flex: 1}}>
              <Text size="sm" variant="default">Automatically positions to stay within screen bounds</Text>
            </View>
          </FlexRow>
          
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">•</Text>
            <View style={{flex: 1}}>
              <Text size="sm" variant="default">Default close button on mobile for better UX</Text>
            </View>
          </FlexRow>
          
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">•</Text>
            <View style={{flex: 1}}>
              <Text size="sm" variant="default">Ideal for info icons in UserSettingsModal and SpaceEditor</Text>
            </View>
          </FlexRow>
          
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">•</Text>
            <View style={{flex: 1}}>
              <Text size="sm" variant="default">Supports all 12 positioning options</Text>
            </View>
          </FlexRow>
          
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">•</Text>
            <View style={{flex: 1}}>
              <Text size="sm" variant="default">Configurable max width for content wrapping</Text>
            </View>
          </FlexRow>
        </FlexColumn>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};


