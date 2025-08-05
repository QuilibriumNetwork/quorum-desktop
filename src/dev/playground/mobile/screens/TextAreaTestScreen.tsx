import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { TextArea } from '../components/primitives/TextArea';
import { Icon } from '../components/primitives/Icon';
import { Text } from '../components/primitives/Text';
import { commonTestStyles } from '../styles/commonTestStyles';

export const TextAreaTestScreen: React.FC = () => {
  const theme = useTheme();
  const [textAreaValue, setTextAreaValue] = useState('');
  const [autoResizeValue, setAutoResizeValue] = useState('');
  const [errorTextArea, setErrorTextArea] = useState('');
  const [showTextAreaError, setShowTextAreaError] = useState(false);

  return (
    <SafeAreaView
      style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.titleContainer}>
          <Icon
            name="memo"
            size="xl"
            color={theme.colors.text.strong}
            style={{ marginRight: 12 }}
          />
          <Text size="2xl" weight="bold" variant="strong">
            Textarea
          </Text>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Testing TextArea primitive on React Native
          </Text>
        </View>

        {/* Basic TextArea Types */}
        <View
          style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}
        >
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Basic TextArea
            </Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Standard TextArea (3 rows):
              </Text>
            </View>
            <TextArea
              value={textAreaValue}
              onChange={setTextAreaValue}
              placeholder="Enter your message here..."
              rows={3}
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Lines: {textAreaValue.split('\n').length} | Chars:{' '}
                {textAreaValue.length}
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Auto-Resize TextArea (2-6 rows):
              </Text>
            </View>
            <TextArea
              value={autoResizeValue}
              onChange={setAutoResizeValue}
              placeholder="Type multiple lines to see auto-resize..."
              autoResize
              minRows={2}
              maxRows={6}
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Auto-resizes between 2-6 rows
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Large TextArea (5 rows):
              </Text>
            </View>
            <TextArea
              placeholder="Large text area for longer content..."
              rows={5}
            />
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Disabled TextArea:
              </Text>
            </View>
            <TextArea
              value="This content cannot be edited on mobile"
              placeholder="Disabled text area..."
              disabled
              rows={3}
            />
          </View>
        </View>

        {/* Error States */}
        <View
          style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}
        >
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Error States
            </Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                TextArea with Error (type less than 10 chars):
              </Text>
            </View>
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
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Always Error:
              </Text>
            </View>
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
        <View
          style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}
        >
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              TextArea Variants
            </Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Filled (Default):
              </Text>
            </View>
            <TextArea placeholder="Default filled style..." rows={4} />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Filled background, accent border on focus
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Bordered Variant:
              </Text>
            </View>
            <TextArea
              variant="bordered"
              placeholder="Bordered textarea style..."
              rows={4}
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Traditional bordered style (explicit variant)
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Onboarding Style (rounded corners):
              </Text>
            </View>
            <TextArea
              variant="onboarding"
              placeholder="Tell us about yourself..."
              rows={4}
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Rounded corners with brand blue colors
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Onboarding Auto-Resize:
              </Text>
            </View>
            <TextArea
              variant="onboarding"
              placeholder="Type multiple lines..."
              autoResize
              minRows={3}
              maxRows={7}
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">
                Onboarding style with auto-resize
              </Text>
            </View>
          </View>
        </View>

        {/* Focus Features */}
        <View
          style={[commonTestStyles.sectionCompact, { backgroundColor: theme.colors.bg.card }]}
        >
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Focus Features
            </Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                Auto Focus TextArea:
              </Text>
            </View>
            <TextArea
              placeholder="This textarea auto-focuses"
              autoFocus
              rows={3}
            />
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">
                No Focus Style:
              </Text>
            </View>
            <TextArea
              placeholder="This textarea has no focus styling"
              noFocusStyle
              rows={3}
            />
          </View>
        </View>

        {/* Mobile Notes */}
        <View
          style={[
            commonTestStyles.notesSection,
            { backgroundColor: theme.colors.surface[3] },
          ]}
        >
          <View style={commonTestStyles.titleContainer}>
            <Text size="base" weight="semibold" variant="strong">
              Mobile Notes
            </Text>
          </View>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// All styles now centralized in commonTestStyles
