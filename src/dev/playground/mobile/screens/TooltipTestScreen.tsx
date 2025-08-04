import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Tooltip } from '../components/primitives';

export const TooltipTestScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colors } = theme;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg.app }]}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 20,
      }}
    >
      <Text style={[styles.title, { color: colors.text.strong }]}>Tooltip</Text>
      <Text style={[styles.subtitle, { color: colors.text.subtle }]}>
        Cross-platform tooltip for info icons in modals
      </Text>

      {/* Basic Tooltips */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          Basic Tooltips
        </Text>

        <View style={styles.row}>
          <Tooltip
            id="basic-tooltip"
            content="This is a basic tooltip that appears when you tap this button. Tap outside or the X button to close."
            place="top"
          >
            <View
              style={[
                styles.button,
                { backgroundColor: colors.accent.DEFAULT },
              ]}
            >
              <Text style={[styles.buttonText, { color: 'white' }]}>
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
                styles.infoIcon,
                { backgroundColor: colors.accent.DEFAULT },
              ]}
            >
              <Text style={styles.infoIconText}>i</Text>
            </View>
          </Tooltip>
        </View>
      </View>

      {/* Positioning Examples */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          Positioning Options
        </Text>
        <Text style={[styles.description, { color: colors.text.subtle }]}>
          Each button is tested individually with proper spacing:
        </Text>

        <View style={styles.positioningTestContainer}>
          {/* Top positioning test */}
          <View style={styles.individualTest}>
            <Text style={[styles.testLabel, { color: colors.text.subtle }]}>
              Top:
            </Text>
            <Tooltip
              id="tooltip-top"
              content="This tooltip should appear above the button without covering it"
              place="top"
            >
              <View
                style={[
                  styles.positionButton,
                  { backgroundColor: colors.surface[3] },
                ]}
              >
                <Text
                  style={[
                    styles.positionButtonText,
                    { color: colors.text.main },
                  ]}
                >
                  Top Test
                </Text>
              </View>
            </Tooltip>
          </View>

          {/* Right positioning test */}
          <View style={styles.individualTest}>
            <Text style={[styles.testLabel, { color: colors.text.subtle }]}>
              Right:
            </Text>
            <Tooltip id="tooltip-right" content="Right" place="right">
              <View
                style={[
                  styles.positionButton,
                  { backgroundColor: colors.surface[3] },
                ]}
              >
                <Text
                  style={[
                    styles.positionButtonText,
                    { color: colors.text.main },
                  ]}
                >
                  Right Test
                </Text>
              </View>
            </Tooltip>
          </View>

          {/* Bottom positioning test */}
          <View style={styles.individualTest}>
            <Text style={[styles.testLabel, { color: colors.text.subtle }]}>
              Bottom:
            </Text>
            <Tooltip
              id="tooltip-bottom"
              content="This tooltip should appear below the button, close but not too far"
              place="bottom"
            >
              <View
                style={[
                  styles.positionButton,
                  { backgroundColor: colors.surface[3] },
                ]}
              >
                <Text
                  style={[
                    styles.positionButtonText,
                    { color: colors.text.main },
                  ]}
                >
                  Bottom Test
                </Text>
              </View>
            </Tooltip>
          </View>

          {/* Left positioning test */}
          <View style={styles.individualTest}>
            <Text style={[styles.testLabel, { color: colors.text.subtle }]}>
              Left:
            </Text>
            <Tooltip id="tooltip-left" content="Left" place="left">
              <View
                style={[
                  styles.positionButton,
                  { backgroundColor: colors.surface[3] },
                ]}
              >
                <Text
                  style={[
                    styles.positionButtonText,
                    { color: colors.text.main },
                  ]}
                >
                  Left Test
                </Text>
              </View>
            </Tooltip>
          </View>
        </View>
      </View>

      {/* Testing Notes */}
      <View style={[styles.notes, { backgroundColor: colors.surface[1] }]}>
        <Text style={[styles.notesTitle, { color: colors.text.strong }]}>
          📱 Mobile Testing Notes
        </Text>
        <Text style={[styles.notesText, { color: colors.text.subtle }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  positioningTestContainer: {
    paddingVertical: 16,
  },
  individualTest: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32, // More space between tests
    paddingHorizontal: 20,
  },
  testLabel: {
    fontSize: 14,
    width: 60,
    marginRight: 16,
  },
  positionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  positionButtonText: {
    fontSize: 12,
  },
  // Removed smallInfoIcon styles - now using the larger infoIcon for better touch targets
  notes: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
