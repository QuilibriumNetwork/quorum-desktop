import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../components/primitives/Input';

export const InputTestScreen: React.FC = () => {
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [showInputError, setShowInputError] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>📱 Input</Text>
        <Text style={styles.subtitle}>
          Testing Input primitive on React Native
        </Text>

        {/* Basic Input Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Input Types</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Text Input:</Text>
            <Input
              value={textValue}
              onChange={setTextValue}
              placeholder="Enter some text..."
              type="text"
            />
            <Text style={styles.valueText}>Value: "{textValue}"</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Input:</Text>
            <Input
              value={emailValue}
              onChange={setEmailValue}
              placeholder="Enter your email..."
              type="email"
            />
            <Text style={styles.valueText}>Value: "{emailValue}"</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password Input:</Text>
            <Input
              value={passwordValue}
              onChange={setPasswordValue}
              placeholder="Enter password..."
              type="password"
            />
            <Text style={styles.valueText}>
              Value: "{passwordValue ? '•'.repeat(passwordValue.length) : ''}"
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Disabled Input:</Text>
            <Input
              value="Cannot edit this"
              placeholder="Disabled input..."
              disabled
            />
          </View>
        </View>

        {/* Error States */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Error States</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
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
            <Text style={styles.label}>Always Error:</Text>
            <Input
              value=""
              placeholder="This input is always in error state"
              error={true}
              errorMessage="This is a persistent error message"
            />
          </View>
        </View>

        {/* Onboarding Variant */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Onboarding Variant</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Onboarding Style (pill shape):</Text>
            <Input variant="onboarding" placeholder="Bongocat" />
            <Text style={styles.infoText}>
              Full pill shape with accent colors
            </Text>
          </View>
        </View>

        {/* Focus and Styling */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus Features</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Auto Focus Input:</Text>
            <Input placeholder="This input auto-focuses" autoFocus />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>No Focus Style:</Text>
            <Input placeholder="This input has no focus styling" noFocusStyle />
          </View>
        </View>

        {/* Mobile Testing Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>📋 Mobile Testing Checklist</Text>
          <Text style={styles.notesText}>
            ✅ Input types trigger correct mobile keyboards
          </Text>
          <Text style={styles.notesText}>
            ✅ Touch targets are 42px high for accessibility
          </Text>
          <Text style={styles.notesText}>
            ✅ Focus states work without web-style borders
          </Text>
          <Text style={styles.notesText}>
            ✅ Error messages display below inputs
          </Text>
          <Text style={styles.notesText}>
            ✅ Onboarding variant matches desktop pill shape
          </Text>
          <Text style={styles.notesText}>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
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
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  valueText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
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
