import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Input } from '../components/primitives/Input';
import { Icon } from '../components/primitives/Icon';
import { Text } from '../components/primitives/Text';
import { commonTestStyles } from '../styles/commonTestStyles';

export const InputTestScreen: React.FC = () => {
  const theme = useTheme();
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [showInputError, setShowInputError] = useState(false);

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.titleContainer}>
          <Icon name="memo" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
          <Text size="2xl" weight="bold" variant="strong">Input</Text>
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Testing Input primitive on React Native
          </Text>
        </View>

        {/* Basic Input Types */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Input Types</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Text Input:</Text>
            </View>
            <Input
              value={textValue}
              onChange={setTextValue}
              placeholder="Enter some text..."
              type="text"
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">Value: "{textValue}"</Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Email Input:</Text>
            </View>
            <Input
              value={emailValue}
              onChange={setEmailValue}
              placeholder="Enter your email..."
              type="email"
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">Value: "{emailValue}"</Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Password Input:</Text>
            </View>
            <Input
              value={passwordValue}
              onChange={setPasswordValue}
              placeholder="Enter password..."
              type="password"
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Value: "{passwordValue ? '•'.repeat(passwordValue.length) : ''}"
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Disabled Input:</Text>
            </View>
            <Input
              value="Cannot edit this"
              placeholder="Disabled input..."
              disabled
            />
          </View>
        </View>

        {/* Error States */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Error States</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Input with Error (type less than 3 chars):
              </Text>
            </View>
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

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Always Error:</Text>
            </View>
            <Input
              value=""
              placeholder="This input is always in error state"
              error={true}
              errorMessage="This is a persistent error message"
            />
          </View>
        </View>

        {/* Input Variants */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Input Variants</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Filled (Default):</Text>
            </View>
            <Input placeholder="Default filled style" />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Filled background, accent border on focus
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Bordered Variant:</Text>
            </View>
            <Input variant="bordered" placeholder="Bordered input style" />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Traditional bordered style (explicit variant)
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Onboarding Style (pill shape):</Text>
            </View>
            <Input variant="onboarding" placeholder="Bongocat" />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Full pill shape with brand blue colors
              </Text>
            </View>
          </View>
        </View>

        {/* Focus and Styling */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Focus Features</Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Auto Focus Input:</Text>
            </View>
            <Input placeholder="This input auto-focuses" autoFocus />
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">No Focus Style:</Text>
            </View>
            <Input placeholder="This input has no focus styling" noFocusStyle />
          </View>
        </View>

        {/* Mobile Notes */}
        <View style={[commonTestStyles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <View style={commonTestStyles.titleContainer}>
            <Text size="base" weight="semibold" variant="strong">Mobile Notes</Text>
          </View>
          <Text size="sm" variant="default">
            • Input types trigger correct mobile keyboards
          </Text>
          <Text size="sm" variant="default">
            • Touch targets are 42px high for accessibility
          </Text>
          <Text size="sm" variant="default">
            • Focus states work without web-style borders
          </Text>
          <Text size="sm" variant="default">
            • Error messages display below inputs
          </Text>
          <Text size="sm" variant="default">
            • Onboarding variant matches desktop pill shape
          </Text>
          <Text size="sm" variant="default">
            • Platform-specific keyboard types work
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Most styles now centralized in commonTestStyles
// Only screen-specific styles remain here if needed
