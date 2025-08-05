import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  useTheme,
  TextArea,
  Icon,
  Text,
  SectionHeading,
  Label,
  FlexColumn,
  FlexRow
} from '../components/primitives';
import { commonTestStyles } from '../styles/commonTestStyles';

export const TextAreaTestScreen: React.FC = () => {
  const theme = useTheme();
  const [textAreaValue, setTextAreaValue] = useState('');
  const [autoResizeValue, setAutoResizeValue] = useState('');
  const [errorTextArea, setErrorTextArea] = useState('');
  const [showTextAreaError, setShowTextAreaError] = useState(false);

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.header}>
          <FlexColumn gap="lg" align="center">
            <FlexRow gap="md" align="center">
              <Icon name="memo" size="xl" color={theme.colors.text.strong} />
              <SectionHeading color="strong">TextArea</SectionHeading>
            </FlexRow>
            <Text size="base" variant="default" align="center">
              Testing TextArea primitive on React Native
            </Text>
          </FlexColumn>
        </View>

        {/* Basic TextArea Types */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading>Basic TextArea</SectionHeading>
            
            <FlexColumn gap="xs">
              <Label>Standard TextArea (3 rows):</Label>
              <TextArea
                value={textAreaValue}
                onChange={setTextAreaValue}
                placeholder="Enter your message here..."
                rows={3}
              />
              <Text size="sm" variant="subtle">
                Lines: {textAreaValue.split('\n').length} | Chars: {textAreaValue.length}
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Auto-Resize TextArea (2-6 rows):</Label>
              <TextArea
                value={autoResizeValue}
                onChange={setAutoResizeValue}
                placeholder="Type multiple lines to see auto-resize..."
                autoResize
                minRows={2}
                maxRows={6}
              />
              <Text size="sm" variant="subtle">
                Auto-resizes between 2-6 rows
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Large TextArea (5 rows):</Label>
              <TextArea
                placeholder="Large text area for longer content..."
                rows={5}
              />
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Disabled TextArea:</Label>
              <TextArea
                value="This content cannot be edited on mobile"
                placeholder="Disabled text area..."
                disabled
                rows={3}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Error States */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading>Error States</SectionHeading>

            <FlexColumn gap="xs">
              <Label>TextArea with Error (type less than 10 chars):</Label>
              <TextArea
                value={errorTextArea}
                onChange={(value: string) => {
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
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Always Error:</Label>
              <TextArea
                value=""
                placeholder="This textarea is always in error state"
                error={true}
                errorMessage="This is a persistent error message for textarea"
                rows={3}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* TextArea Variants */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading>TextArea Variants</SectionHeading>

            <FlexColumn gap="xs">
              <Label>Filled (Default):</Label>
              <TextArea placeholder="Default filled style..." rows={4} />
              <Text size="sm" variant="subtle">
                Filled background, accent border on focus
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Bordered Variant:</Label>
              <TextArea
                variant="bordered"
                placeholder="Bordered textarea style..."
                rows={4}
              />
              <Text size="sm" variant="subtle">
                Traditional bordered style (explicit variant)
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Onboarding Style (rounded corners):</Label>
              <TextArea
                variant="onboarding"
                placeholder="Tell us about yourself..."
                rows={4}
              />
              <Text size="sm" variant="subtle">
                Rounded corners with brand blue colors
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Onboarding Auto-Resize:</Label>
              <TextArea
                variant="onboarding"
                placeholder="Type multiple lines..."
                autoResize
                minRows={3}
                maxRows={7}
              />
              <Text size="sm" variant="subtle">
                Onboarding style with auto-resize
              </Text>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Focus Features */}
        <View style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading>Focus Features</SectionHeading>

            <FlexColumn gap="xs">
              <Label>Auto Focus TextArea:</Label>
              <TextArea
                placeholder="This textarea auto-focuses"
                autoFocus
                rows={3}
              />
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>No Focus Style:</Label>
              <TextArea
                placeholder="This textarea has no focus styling"
                noFocusStyle
                rows={3}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Mobile Notes */}
        <View style={[commonTestStyles.infoSection, { backgroundColor: theme.colors.surface[3] }]}>
          <FlexColumn gap="sm">
            <SectionHeading color="strong">Mobile Notes</SectionHeading>
            <Text size="sm" variant="default">
              • Auto-resize functionality works on mobile
            </Text>
            <Text size="sm" variant="default">
              • Touch targets optimized for mobile
            </Text>
            <Text size="sm" variant="default">
              • Focus states work without web-style borders
            </Text>
            <Text size="sm" variant="default">
              • Error messages display below textarea
            </Text>
            <Text size="sm" variant="default">
              • Onboarding variant matches desktop style
            </Text>
            <Text size="sm" variant="default">
              • Multiline text input with mobile keyboard
            </Text>
            <Text size="sm" variant="default">
              • Text alignment starts at top for multiline
            </Text>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// All styles now centralized in commonTestStyles
