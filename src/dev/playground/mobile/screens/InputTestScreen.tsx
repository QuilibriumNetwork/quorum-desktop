import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Input } from '../components/primitives/Input';

export const InputTestScreen: React.FC = () => {
  const theme = useTheme();
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [showInputError, setShowInputError] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text.strong }]}>📱 Input</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.main }]}>
          Testing Input primitive on React Native
        </Text>

        {/* Basic Input Types */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Input Types</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Text Input:</Text>
            <Input
              value={textValue}
              onChange={setTextValue}
              placeholder="Enter some text..."
              type="text"
            />
            <Text style={[styles.valueText, { color: theme.colors.text.subtle }]}>Value: "{textValue}"</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Email Input:</Text>
            <Input
              value={emailValue}
              onChange={setEmailValue}
              placeholder="Enter your email..."
              type="email"
            />
            <Text style={[styles.valueText, { color: theme.colors.text.subtle }]}>Value: "{emailValue}"</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Password Input:</Text>
            <Input
              value={passwordValue}
              onChange={setPasswordValue}
              placeholder="Enter password..."
              type="password"
            />
            <Text style={[styles.valueText, { color: theme.colors.text.subtle }]}>
              Value: "{passwordValue ? '•'.repeat(passwordValue.length) : ''}"
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Disabled Input:</Text>
            <Input
              value="Cannot edit this"
              placeholder="Disabled input..."
              disabled
            />
          </View>
        </View>

        {/* Error States */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Error States</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>
              Input with Error (type less than 3 chars):
            </Text>
            <Input
              value={errorInput}
              onChange={(value) => {
                setErrorInput(value);
                setShowInputError(value.length > 0 && value.length < 3);
              }}
              placeholder="Type less than 3 characters..."
              error={showInputError}
              errorMessage={
                showInputError
                  ? 'Input must be at least 3 characters long'
                  : undefined
              }
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Always Error:</Text>
            <Input
              value=""
              placeholder="This input is always in error state"
              error={true}
              errorMessage="This is a persistent error message"
            />
          </View>
        </View>

        {/* Input Variants */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Input Variants</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Filled (Default):</Text>
            <Input placeholder="Default filled style" />
            <Text style={[styles.infoText, { color: theme.colors.text.subtle }]}>
              Filled background, accent border on focus
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Bordered Variant:</Text>
            <Input variant="bordered" placeholder="Bordered input style" />
            <Text style={[styles.infoText, { color: theme.colors.text.subtle }]}>
              Traditional bordered style (explicit variant)
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Onboarding Style (pill shape):</Text>
            <Input variant="onboarding" placeholder="Bongocat" />
            <Text style={[styles.infoText, { color: theme.colors.text.subtle }]}>
              Full pill shape with brand blue colors
            </Text>
          </View>
        </View>

        {/* Focus and Styling */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Focus Features</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>Auto Focus Input:</Text>
            <Input placeholder="This input auto-focuses" autoFocus />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text.strong }]}>No Focus Style:</Text>
            <Input placeholder="This input has no focus styling" noFocusStyle />
          </View>
        </View>

        {/* Mobile Testing Notes */}
        <View style={[styles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <Text style={[styles.notesTitle, { color: theme.colors.text.strong }]}>📋 Mobile Testing Checklist</Text>
          <Text style={[styles.notesText, { color: theme.colors.text.main }]}>
            ✅ Input types trigger correct mobile keyboards
          </Text>
          <Text style={[styles.notesText, { color: theme.colors.text.main }]}>
            ✅ Touch targets are 42px high for accessibility
          </Text>
          <Text style={[styles.notesText, { color: theme.colors.text.main }]}>
            ✅ Focus states work without web-style borders
          </Text>
          <Text style={[styles.notesText, { color: theme.colors.text.main }]}>
            ✅ Error messages display below inputs
          </Text>
          <Text style={[styles.notesText, { color: theme.colors.text.main }]}>
            ✅ Onboarding variant matches desktop pill shape
          </Text>
          <Text style={[styles.notesText, { color: theme.colors.text.main }]}>
            ✅ Platform-specific keyboard types work
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
    // backgroundColor removed - now uses theme colors dynamically
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
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    // color removed - now uses theme colors dynamically
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    marginBottom: 4,
    lineHeight: 20,
  },
});
