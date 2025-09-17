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
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';

export const InputTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [showInputError, setShowInputError] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="memo" size="xl" style={{ marginTop: 2 }} />
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
              <Text size="sm" variant="subtle">
                Value: "{textValue}"
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Email Input:</Label>
              <Input
                value={emailValue}
                onChange={setEmailValue}
                placeholder="Enter your email..."
                type="email"
              />
              <Text size="sm" variant="subtle">
                Value: "{emailValue}"
              </Text>
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
                onChange={(value: string) => {
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

            <FlexColumn gap="xs">
              <Label>Minimal Search:</Label>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: 1,
                  borderBottomColor: isSearchFocused
                    ? theme.colors.field.borderFocus
                    : theme.colors.field.border,
                  paddingBottom: 0,
                }}
              >
                <Icon
                  name="search"
                  size="sm"
                  style={{
                    color: isSearchFocused
                      ? theme.colors.accent[500]
                      : theme.colors.text.subtle,
                    marginRight: 8
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Input
                    variant="minimal"
                    placeholder="Search something..."
                    type="search"
                    value={searchValue}
                    onChange={setSearchValue}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    style={{ borderBottomWidth: 0 }}
                  />
                </View>
              </View>
              <Text size="sm" variant="subtle">
                Minimal style with only bottom border
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
              <Input
                placeholder="This input has no focus styling"
                noFocusStyle
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Label Management */}
        <View style={themedStyles.sectionCompact}>
          <FlexColumn gap="md">
            <Title size="sm">Label Management</Title>

            <FlexColumn gap="xs">
              <Input
                label="Static Label"
                labelType="static"
                placeholder="Enter text with static label"
                value={textValue}
                onChange={setTextValue}
              />
              <Text size="sm" variant="subtle">
                Traditional static label above the input
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Input
                label="Floating Label"
                labelType="floating"
                placeholder="Additional helper text"
                value={emailValue}
                onChange={setEmailValue}
                type="email"
              />
              <Text size="sm" variant="subtle">
                Animated floating label (Material-UI style)
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Input
                label="Required Field"
                labelType="static"
                placeholder="This field is required"
                required
                helperText="This field must be filled out"
              />
              <Text size="sm" variant="subtle">
                Shows required asterisk and helper text
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Input
                label="Floating Required"
                labelType="floating"
                placeholder="Helper text below"
                required
                helperText="Floating label with required indicator"
                error={showInputError}
                errorMessage={
                  showInputError ? 'This field is required' : undefined
                }
              />
              <Text size="sm" variant="subtle">
                Floating label with required indicator and error state
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Input
                label="Password with Label"
                labelType="floating"
                type="password"
                placeholder="Enter your password"
                helperText="Password must be at least 8 characters"
              />
              <Text size="sm" variant="subtle">
                Floating label with password field and helper text
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Input
                label="Disabled with Label"
                labelType="static"
                value="Disabled input with label"
                disabled
                helperText="This field cannot be edited"
              />
              <Text size="sm" variant="subtle">
                Disabled input with static label and helper text
              </Text>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Mobile Notes */}
        <View
          style={[
            commonTestStyles.notesSection,
            { backgroundColor: theme.colors.surface[3] },
          ]}
        >
          <FlexColumn gap="sm">
            <Title size="sm">Mobile Notes</Title>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Input types trigger correct mobile keyboards
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Touch targets are 42px high for accessibility
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Focus states work without web-style borders
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Error messages display below inputs
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Onboarding variant matches desktop pill shape
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Platform-specific keyboard types work
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Label management works with consistent styling
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Floating labels use smooth native animations
                </Text>
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
