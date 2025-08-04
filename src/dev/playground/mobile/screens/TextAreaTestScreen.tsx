import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { TextArea } from '../components/primitives/TextArea';

export const TextAreaTestScreen: React.FC = () => {
  const theme = useTheme();
  const [textAreaValue, setTextAreaValue] = useState('');
  const [autoResizeValue, setAutoResizeValue] = useState('');
  const [errorTextArea, setErrorTextArea] = useState('');
  const [showTextAreaError, setShowTextAreaError] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text.strong }]}>📝 TextArea</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.main }]}>
          Testing TextArea primitive on React Native
        </Text>

        {/* Basic TextArea Types */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Basic TextArea</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Standard TextArea (3 rows):</Text>
            <TextArea
              value={textAreaValue}
              onChange={setTextAreaValue}
              placeholder="Enter your message here..."
              rows={3}
            />
            <Text style={styles.valueText}>
              Lines: {textAreaValue.split('\n').length} | Chars:{' '}
              {textAreaValue.length}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Auto-Resize TextArea (2-6 rows):</Text>
            <TextArea
              value={autoResizeValue}
              onChange={setAutoResizeValue}
              placeholder="Type multiple lines to see auto-resize..."
              autoResize
              minRows={2}
              maxRows={6}
            />
            <Text style={styles.infoText}>Auto-resizes between 2-6 rows</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Large TextArea (5 rows):</Text>
            <TextArea
              placeholder="Large text area for longer content..."
              rows={5}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Disabled TextArea:</Text>
            <TextArea
              value="This content cannot be edited on mobile"
              placeholder="Disabled text area..."
              disabled
              rows={3}
            />
          </View>
        </View>

        {/* Error States */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Error States</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>
              TextArea with Error (type less than 10 chars):
            </Text>
            <TextArea
              value={errorTextArea}
              onChange={(value) => {
                setErrorTextArea(value);
                setShowTextAreaError(value.length > 0 && value.length < 10);
              }}
              placeholder="Type less than 10 characters..."
              error={showTextAreaError}
              errorMessage={
                showTextAreaError
                  ? 'Text must be at least 10 characters long'
                  : undefined
              }
              rows={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Always Error:</Text>
            <TextArea
              value=""
              placeholder="This textarea is always in error state"
              error={true}
              errorMessage="This is a persistent error message for textarea"
              rows={3}
            />
          </View>
        </View>

        {/* TextArea Variants */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>TextArea Variants</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Filled (Default):</Text>
            <TextArea placeholder="Default filled style..." rows={4} />
            <Text style={styles.infoText}>
              Filled background, accent border on focus
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Bordered Variant:</Text>
            <TextArea
              variant="bordered"
              placeholder="Bordered textarea style..."
              rows={4}
            />
            <Text style={styles.infoText}>
              Traditional bordered style (explicit variant)
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>
              Onboarding Style (rounded corners):
            </Text>
            <TextArea
              variant="onboarding"
              placeholder="Tell us about yourself..."
              rows={4}
            />
            <Text style={styles.infoText}>
              Rounded corners with brand blue colors
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Onboarding Auto-Resize:</Text>
            <TextArea
              variant="onboarding"
              placeholder="Type multiple lines..."
              autoResize
              minRows={3}
              maxRows={7}
            />
            <Text style={styles.infoText}>
              Onboarding style with auto-resize
            </Text>
          </View>
        </View>

        {/* Focus Features */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Focus Features</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Auto Focus TextArea:</Text>
            <TextArea
              placeholder="This textarea auto-focuses"
              autoFocus
              rows={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>No Focus Style:</Text>
            <TextArea
              placeholder="This textarea has no focus styling"
              noFocusStyle
              rows={3}
            />
          </View>
        </View>

        {/* Mobile Testing Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>📋 Mobile Testing Checklist</Text>
          <Text style={styles.notesText}>
            ✅ Auto-resize functionality works on mobile
          </Text>
          <Text style={styles.notesText}>
            ✅ Touch targets optimized for mobile
          </Text>
          <Text style={styles.notesText}>
            ✅ Focus states work without web-style borders
          </Text>
          <Text style={styles.notesText}>
            ✅ Error messages display below textarea
          </Text>
          <Text style={styles.notesText}>
            ✅ Onboarding variant matches desktop style
          </Text>
          <Text style={styles.notesText}>
            ✅ Multiline text input with mobile keyboard
          </Text>
          <Text style={styles.notesText}>
            ✅ Text alignment starts at top for multiline
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor removed - now uses theme.colors.bg.app dynamically
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    // color removed - now uses theme colors dynamically
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    // color removed - now uses theme colors dynamically
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    // backgroundColor removed - now uses theme.colors.bg.card dynamically
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    // color removed - now uses theme colors dynamically
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    // color removed - now uses theme colors dynamically
    marginBottom: 8,
  },
  valueText: {
    fontSize: 12,
    // color removed - now uses theme colors dynamically
    marginTop: 4,
    fontStyle: 'italic',
  },
  infoText: {
    fontSize: 12,
    // color removed - now uses theme colors dynamically
    marginTop: 4,
  },
  notesSection: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 4,
    lineHeight: 20,
  },
});
