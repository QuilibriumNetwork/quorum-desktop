import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useTheme,
  Input,
  Icon,
  Text,
  Paragraph,
  Label,
  Title,
  FlexColumn,
  FlexRow,
} from '@/primitives';
import { commonTestStyles, createThemedStyles } from '../styles/commonTestStyles';

export const InputTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [showInputError, setShowInputError] = useState(false);

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="memo" size="xl" style={{ marginTop: 2 }}/>
            <Title>Input</Title>
          </FlexRow>
          <Paragraph align="center">
            Testing Input primitive on React Native
          </Paragraph>
        </FlexColumn>

        {/* Basic Input Types */}
        <View style={themedStyles.sectionCompact}>
          <FlexColumn gap="md">
            <Title size="sm">Input Types</Title>

            <FlexColumn gap="xs">
              <Label>Text Input:</Label>
              <Input
                value={textValue}
                onChange={setTextValue}
                placeholder="Enter some text..."
                type="text"
              />
              <Text size="sm" variant="subtle">Value: "{textValue}"</Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Email Input:</Label>
              <Input
                value={emailValue}
                onChange={setEmailValue}
                placeholder="Enter your email..."
                type="email"
              />
              <Text size="sm" variant="subtle">Value: "{emailValue}"</Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Password Input:</Label>
              <Input
                value={passwordValue}
                onChange={setPasswordValue}
                placeholder="Enter password..."
                type="password"
              />
              <Text size="sm" variant="subtle">
                Value: "{passwordValue ? '•'.repeat(passwordValue.length) : ''}"
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Disabled Input:</Label>
              <Input
                value="Cannot edit this"
                placeholder="Disabled input..."
                disabled
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Error States */}
        <View style={themedStyles.sectionCompact}>
          <FlexColumn gap="md">
            <Title size="sm">Error States</Title>

            <FlexColumn gap="xs">
              <Label>Input with Error (type less than 3 chars):</Label>
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
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Always Error:</Label>
              <Input
                value=""
                placeholder="This input is always in error state"
                error={true}
                errorMessage="This is a persistent error message"
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Input Variants */}
        <View style={themedStyles.sectionCompact}>
          <FlexColumn gap="md">
            <Title size="sm">Input Variants</Title>

            <FlexColumn gap="xs">
              <Label>Filled (Default):</Label>
              <Input placeholder="Default filled style" />
              <Text size="sm" variant="subtle">
                Filled background, accent border on focus
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Bordered Variant:</Label>
              <Input variant="bordered" placeholder="Bordered input style" />
              <Text size="sm" variant="subtle">
                Traditional bordered style (explicit variant)
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Onboarding Style (pill shape):</Label>
              <Input variant="onboarding" placeholder="Bongocat" />
              <Text size="sm" variant="subtle">
                Full pill shape with brand blue colors
              </Text>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Focus and Styling */}
        <View style={themedStyles.sectionCompact}>
          <FlexColumn gap="md">
            <Title size="sm">Focus Features</Title>

            <FlexColumn gap="xs">
              <Label>Auto Focus Input:</Label>
              <Input placeholder="This input auto-focuses" autoFocus />
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>No Focus Style:</Label>
              <Input placeholder="This input has no focus styling" noFocusStyle />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Mobile Notes */}
        <View style={[commonTestStyles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <FlexColumn gap="sm">
            <Title size="sm">Mobile Notes</Title>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Input types trigger correct mobile keyboards</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Touch targets are 42px high for accessibility</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Focus states work without web-style borders</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Error messages display below inputs</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Onboarding variant matches desktop pill shape</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Platform-specific keyboard types work</Text>
              </View>
            </FlexRow>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Most styles now centralized in commonTestStyles
// Only screen-specific styles remain here if needed
