import React, { useState } from 'react';
import { ScrollView, View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useTheme,
  Text,
  Paragraph,
  Label,
  Title,
  Flex,
  Icon,
  Button,
} from '@/components/primitives';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';

/**
 * POC Demo: Mention Pills for React Native
 *
 * This is a proof-of-concept to test the TextInput + overlay approach for mention pills
 * as outlined in the research phase of the mention pills task.
 *
 * Goals:
 * - Test TextInput with absolutely positioned pill overlays
 * - Test touch interactions with pills
 * - Test virtual keyboard behavior
 * - Test different mention types
 * - NOT integrated with real mention system yet
 */

interface MentionPill {
  id: string;
  type: 'user' | 'role' | 'channel' | 'everyone';
  displayName: string;
  address: string; // The actual ID that would be stored
  position: number; // Character position where pill starts
  useEnhancedFormat?: boolean; // Whether to use enhanced format
}

// Mock data for testing - includes both legacy and enhanced formats
const MOCK_MENTIONS = [
  { type: 'user', displayName: 'John Doe', address: 'QmAbc123', useEnhancedFormat: true },
  { type: 'user', displayName: 'Jane Smith', address: 'QmDef456', useEnhancedFormat: false },
  { type: 'role', displayName: 'Developers', address: 'developers' },
  { type: 'channel', displayName: 'general', address: 'ch-gen123', useEnhancedFormat: true },
  { type: 'channel', displayName: 'announcements', address: 'ch-ann456', useEnhancedFormat: false },
  { type: 'everyone', displayName: 'everyone', address: 'everyone' },
] as const;

const MentionPillComponent: React.FC<{
  mention: MentionPill;
  onRemove: () => void;
  theme: any;
}> = ({ mention, onRemove, theme }) => {
  const colors = {
    user: { bg: '#3B82F6', text: '#FFFFFF' },
    role: { bg: '#A855F7', text: '#FFFFFF' },
    channel: { bg: '#10B981', text: '#FFFFFF' },
    everyone: { bg: '#F59E0B', text: '#FFFFFF' },
  };

  const prefix = {
    user: '@',
    role: '@',
    channel: '#',
    everyone: '@',
  };

  const color = colors[mention.type];

  return (
    <TouchableOpacity
      onPress={onRemove}
      style={[
        styles.pill,
        {
          backgroundColor: color.bg + '30', // 30% opacity
          borderColor: color.bg,
        }
      ]}
    >
      <Text size="sm" style={{ color: color.bg }}>
        {prefix[mention.type]}{mention.displayName}
      </Text>
    </TouchableOpacity>
  );
};

const MentionPillInputDemo: React.FC<{
  theme: any;
  themedStyles: any;
}> = ({ theme, themedStyles }) => {
  const [text, setText] = useState('');
  const [pills, setPills] = useState<MentionPill[]>([]);
  const [pillIdCounter, setPillIdCounter] = useState(0);

  // Insert a mention pill at the end of the text
  const insertPill = (mention: typeof MOCK_MENTIONS[number]) => {
    const newPill: MentionPill = {
      id: `pill-${pillIdCounter}`,
      type: mention.type,
      displayName: mention.displayName,
      address: mention.address,
      position: text.length,
    };

    setPills([...pills, newPill]);
    setPillIdCounter(pillIdCounter + 1);

    // Add a space after the pill for visual separation
    setText(text + ' ');
  };

  // Remove a pill
  const removePill = (pillId: string) => {
    setPills(pills.filter(p => p.id !== pillId));
  };

  // Extract storage format (showing how it would be stored)
  const extractStorageFormat = () => {
    if (pills.length === 0) return text.trim() || '(empty)';

    // Show all pills in their storage format
    const pillFormats = pills.map(pill => {
      if (pill.type === 'role') {
        // Roles always use @roleTag format
        return `@${pill.address}`;
      } else if (pill.type === 'everyone') {
        return '@everyone';
      } else if (pill.useEnhancedFormat) {
        // Enhanced format: @[Display Name]<address> or #[Channel Name]<channelId>
        const prefix = pill.type === 'channel' ? '#' : '@';
        return `${prefix}[${pill.displayName}]<${pill.address}>`;
      } else {
        // Legacy format: @<address> or #<channelId>
        const prefix = pill.type === 'channel' ? '#' : '@';
        return `${prefix}<${pill.address}>`;
      }
    }).join(' ');

    return `${text.trim()} ${pillFormats}`.trim();
  };

  return (
    <Flex direction="column" gap="md">
      <Flex direction="column" gap="xs">
        <Label>Input with Pills (TextInput + Overlay Approach):</Label>

        {/* Container for TextInput and Pills */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.field.bg.default,
              borderColor: theme.colors.field.border.default,
            }
          ]}
        >
          {/* TextInput (semi-transparent to see pills below) */}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type text here..."
            placeholderTextColor={theme.colors.text.subtle}
            multiline
            style={[
              styles.textInput,
              {
                color: theme.colors.text.main,
              }
            ]}
          />

          {/* Pills Overlay */}
          <View style={styles.pillsOverlay} pointerEvents="box-none">
            <Flex gap="xs" wrap>
              {pills.map(pill => (
                <MentionPillComponent
                  key={pill.id}
                  mention={pill}
                  onRemove={() => removePill(pill.id)}
                  theme={theme}
                />
              ))}
            </Flex>
          </View>
        </View>

        <Text size="sm" variant="subtle">
          Tap pills to remove them. This demo uses overlay rendering.
        </Text>
      </Flex>

      {/* Insert Buttons */}
      <Flex direction="column" gap="xs">
        <Label>Insert Mock Mentions:</Label>
        <Flex gap="xs" wrap>
          {MOCK_MENTIONS.map((mention, index) => (
            <Button
              key={index}
              type="secondary"
              size="small"
              onPress={() => insertPill(mention)}
            >
              {mention.type === 'channel' ? '#' : '@'}{mention.displayName}
            </Button>
          ))}
        </Flex>
      </Flex>

      {/* Storage Format Display */}
      <View
        style={[
          themedStyles.codeBlock,
          { padding: 12 }
        ]}
      >
        <Text size="sm" variant="subtle">
          <Text weight="bold">Storage format: </Text>
          {extractStorageFormat()}
        </Text>
      </View>
    </Flex>
  );
};

export const MentionPillsTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <Flex direction="column" style={commonTestStyles.header}>
          <Flex gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="at" size="xl" style={{ marginTop: 2 }} />
            <Title>Mention Pills (POC)</Title>
          </Flex>
          <Paragraph align="center">
            Testing TextInput + overlay approach for mention pills on React Native
          </Paragraph>
        </Flex>

        {/* POC Information */}
        <View style={themedStyles.sectionCompact}>
          <Flex direction="column" gap="md">
            <Title size="sm">Proof of Concept</Title>
            <Paragraph>
              This demo tests the React Native implementation approach for mention pills using TextInput with absolutely positioned overlays.
            </Paragraph>

            <Flex direction="column" gap="xs">
              <Text size="sm" weight="bold">What this tests:</Text>
              <Text size="sm">• TextInput with pill overlay rendering</Text>
              <Text size="sm">• Touch interactions with pills</Text>
              <Text size="sm">• Virtual keyboard behavior</Text>
              <Text size="sm">• Different mention types (user, role, channel)</Text>
              <Text size="sm">• Storage format extraction</Text>
            </Flex>

            <Flex direction="column" gap="xs">
              <Text size="sm" weight="bold">NOT included yet:</Text>
              <Text size="sm">• Integration with real mention system</Text>
              <Text size="sm">• Autocomplete dropdown</Text>
              <Text size="sm">• Cursor position tracking</Text>
              <Text size="sm">• Text measurement for pill positioning</Text>
            </Flex>
          </Flex>
        </View>

        {/* Demo Section */}
        <View style={themedStyles.sectionCompact}>
          <Flex direction="column" gap="md">
            <Title size="sm">Interactive Demo</Title>
            <MentionPillInputDemo theme={theme} themedStyles={themedStyles} />
          </Flex>
        </View>

        {/* Technical Notes */}
        <View style={themedStyles.sectionCompact}>
          <Flex direction="column" gap="md">
            <Title size="sm">Technical Approach</Title>
            <Paragraph>
              <Text weight="bold">React Native Implementation Strategy:</Text>
            </Paragraph>

            <Text size="sm">
              1. <Text weight="bold">TextInput</Text> - Standard React Native TextInput for text entry
            </Text>
            <Text size="sm">
              2. <Text weight="bold">Overlay</Text> - Absolutely positioned View for rendering pills
            </Text>
            <Text size="sm">
              3. <Text weight="bold">Touch Handling</Text> - Pills respond to taps for removal
            </Text>
            <Text size="sm">
              4. <Text weight="bold">Storage Format</Text> - Pills convert to @&lt;address&gt; or #&lt;address&gt;
            </Text>

            <Paragraph style={{ marginTop: 8 }}>
              This approach differs from web (contentEditable) but achieves the same UX goals on mobile.
            </Paragraph>
          </Flex>
        </View>

        {/* Next Steps */}
        <View style={themedStyles.sectionCompact}>
          <Flex direction="column" gap="md">
            <Title size="sm">Next Steps for Full Implementation</Title>

            <Text size="sm">
              1. Implement text measurement for accurate pill positioning
            </Text>
            <Text size="sm">
              2. Add cursor position tracking for pill insertion
            </Text>
            <Text size="sm">
              3. Integrate with existing useMentionInput hook
            </Text>
            <Text size="sm">
              4. Handle backspace to delete pills
            </Text>
            <Text size="sm">
              5. Implement copy/paste with React Native Clipboard
            </Text>
            <Text size="sm">
              6. Add autocomplete dropdown positioning
            </Text>
            <Text size="sm">
              7. Performance optimization for 60fps
            </Text>
          </Flex>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    position: 'relative',
  },
  textInput: {
    minHeight: 80,
    fontSize: 16,
    padding: 0,
    textAlignVertical: 'top',
  },
  pillsOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    pointerEvents: 'box-none',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 4,
    marginBottom: 4,
  },
});
