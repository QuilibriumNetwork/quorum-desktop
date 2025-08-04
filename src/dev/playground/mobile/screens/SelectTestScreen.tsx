import React, { useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../components/primitives/theme';
import Select from '../components/primitives/Select/Select.native';
import Button from '../components/primitives/Button';
import { Icon } from '../components/primitives/Icon';
import { Text } from '../components/primitives/Text';

export const SelectTestScreen: React.FC = () => {
  const theme = useTheme();
  // Select testing state
  const [basicValue, setBasicValue] = useState('');
  const [iconValue, setIconValue] = useState('edit');
  const [errorValue, setErrorValue] = useState('');
  const [showError, setShowError] = useState(false);
  const [sizeTestValue, setSizeTestValue] = useState('');
  const [variantTestValue, setVariantTestValue] = useState('');
  const [customWidthValue, setCustomWidthValue] = useState('');
  const [groupedValue, setGroupedValue] = useState('');
  const [userValue, setUserValue] = useState('');

  const basicOptions = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'date', label: 'Date' },
    { value: 'elderberry', label: 'Elderberry' },
  ];

  const iconOptions = [
    { value: 'edit', label: 'Edit', icon: 'edit' },
    { value: 'copy', label: 'Copy', icon: 'copy' },
    { value: 'share', label: 'Share', icon: 'share' },
    { value: 'download', label: 'Download', icon: 'download' },
    { value: 'trash', label: 'Delete', icon: 'trash' },
  ];

  const sizeOptions = [
    { value: 'xs', label: 'Extra Small' },
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
  ];

  const longTextOptions = [
    { value: 'short', label: 'Short' },
    { value: 'medium-length', label: 'Medium Length Text Example' },
    {
      value: 'very-long',
      label: 'Very Long Text Example That Should Be Truncated',
    },
    {
      value: 'extremely-long',
      label:
        'Extremely Long Text Example That Demonstrates Text Overflow Behavior',
    },
  ];

  // Grouped options (like SpaceEditor channels)
  const channelGroups = [
    {
      groupLabel: 'Text Channels',
      options: [
        { value: 'general', label: '#general', icon: '#' },
        { value: 'announcements', label: '#announcements', icon: '#' },
        { value: 'questions', label: '#questions', icon: '#' },
      ],
    },
    {
      groupLabel: 'Voice Channels',
      options: [
        { value: 'voice-general', label: 'General Voice', icon: 'volume-up' },
        { value: 'voice-meeting', label: 'Meeting Room', icon: 'volume-up' },
      ],
    },
    {
      groupLabel: 'Private Channels',
      options: [
        { value: 'team-leads', label: '#team-leads', icon: 'lock' },
        { value: 'admins', label: '#admins', icon: 'lock' },
      ],
    },
  ];

  // User options with avatars
  const userOptions = [
    {
      value: 'alice',
      label: 'Alice Johnson',
      avatar: 'https://i.pravatar.cc/150?img=1',
      subtitle: '0x1234...5678',
    },
    {
      value: 'bob',
      label: 'Bob Smith',
      avatar: 'https://i.pravatar.cc/150?img=3',
      subtitle: '0x9876...4321',
    },
    {
      value: 'charlie',
      label: 'Charlie Brown',
      avatar: 'https://i.pravatar.cc/150?img=5',
      subtitle: '0xabcd...efgh',
    },
    {
      value: 'diana',
      label: 'Diana Prince',
      avatar: 'https://i.pravatar.cc/150?img=9',
      subtitle: '0xijkl...mnop',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <StatusBar barStyle={theme.resolvedTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={theme.colors.bg.app} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Icon name="clipboard" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
            <Text size="2xl" weight="bold" variant="strong">Select</Text>
          </View>
          <View style={{ marginBottom: 24 }}>
            <Text size="base" variant="default" align="center">
              Mobile dropdown/picker component with modal overlay
            </Text>
          </View>
        </View>

        {/* Basic Select */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Basic Select</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">Simple Select:</Text>
          </View>
          <Select
            value={basicValue}
            onChange={setBasicValue}
            placeholder="Choose an option"
            options={basicOptions}
          />
        </View>

        {/* Select with Icons */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">With Icons</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">Action Picker:</Text>
          </View>
          <Select
            value={iconValue}
            onChange={setIconValue}
            placeholder="Choose an action"
            options={iconOptions}
          />
        </View>

        {/* Select Sizes */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Size Variants</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Small Size:</Text>
            </View>
            <Select
              size="small"
              value={sizeTestValue}
              onChange={setSizeTestValue}
              placeholder="Small select"
              options={sizeOptions}
            />
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Medium Size (Default):</Text>
            </View>
            <Select
              size="medium"
              value={sizeTestValue}
              onChange={setSizeTestValue}
              placeholder="Medium select"
              options={sizeOptions}
            />
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Large Size:</Text>
            </View>
            <Select
              size="large"
              value={sizeTestValue}
              onChange={setSizeTestValue}
              placeholder="Large select"
              options={sizeOptions}
            />
          </View>
        </View>

        {/* Select Variants */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Select Variants</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Bordered:</Text>
            </View>
            <Select
              variant="bordered"
              value={variantTestValue}
              onChange={setVariantTestValue}
              placeholder="Bordered style"
              options={basicOptions}
            />
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Filled (Default):</Text>
            </View>
            <Select
              value={variantTestValue}
              onChange={setVariantTestValue}
              placeholder="Filled style"
              options={basicOptions}
            />
          </View>
        </View>

        {/* Error States */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Error States</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">With Error:</Text>
            </View>
            <Select
              value={errorValue}
              onChange={(value) => {
                setErrorValue(value);
                // Show error when "Invalid Option" is selected
                setShowError(value === 'invalid');
              }}
              placeholder="Select with error"
              error={showError}
              errorMessage={
                showError
                  ? 'Invalid selection - please choose a valid option'
                  : 'This field is required'
              }
              options={[
                { value: 'valid', label: 'Valid Option' },
                { value: 'invalid', label: 'Invalid Option' },
              ]}
            />
            <Button
              size="small"
              type="secondary"
              onClick={() => {
                setErrorValue('');
                setShowError(false);
              }}
              style={styles.toggleButton}
            >
              Clear Selection
            </Button>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Disabled Select:</Text>
            </View>
            <Select
              value="disabled"
              onChange={() => {}}
              disabled
              options={[
                { value: 'disabled', label: 'Cannot change this' },
                { value: 'other', label: 'Other option' },
              ]}
            />
          </View>
        </View>

        {/* Advanced Features */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Advanced Features</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Full Width:</Text>
            </View>
            <Select
              fullWidth
              value=""
              onChange={() => {}}
              placeholder="Full width select"
              options={basicOptions}
            />
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">With Disabled Options:</Text>
            </View>
            <Select
              value=""
              onChange={() => {}}
              placeholder="Some options disabled"
              options={[
                { value: 'available', label: 'Available Option' },
                {
                  value: 'disabled1',
                  label: 'Disabled Option 1',
                  disabled: true,
                },
                { value: 'available2', label: 'Available Option 2' },
                {
                  value: 'disabled2',
                  label: 'Disabled Option 2',
                  disabled: true,
                },
              ]}
            />
          </View>
        </View>

        {/* Custom Width */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Custom Width</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Custom 200px Width:</Text>
            </View>
            <Select
              width={200}
              value={customWidthValue}
              onChange={setCustomWidthValue}
              placeholder="200px wide"
              options={longTextOptions}
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">Uses width=200 prop</Text>
            </View>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Custom 120px Width (Narrow):</Text>
            </View>
            <Select
              width={120}
              value=""
              onChange={() => {}}
              placeholder="Narrow"
              options={longTextOptions}
            />
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">Demonstrates text ellipsis</Text>
            </View>
          </View>
        </View>

        {/* Grouped Options */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Grouped Options (SpaceEditor Style)
            </Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">Select Channel:</Text>
          </View>
          <Select
            value={groupedValue}
            onChange={setGroupedValue}
            placeholder="Choose a channel"
            groups={channelGroups}
            fullWidth
          />
          <View style={{ marginTop: 8 }}>
            <Text size="sm" variant="subtle">
              Options organized by category with group headers
            </Text>
          </View>
        </View>

        {/* User Selection with Avatars */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">User Selection with Avatars</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">Select Conversation:</Text>
          </View>
          <Select
            value={userValue}
            onChange={setUserValue}
            placeholder="Select conversation"
            options={userOptions}
            fullWidth
          />
          <View style={{ marginTop: 8 }}>
            <Text size="sm" variant="subtle">
              Shows user avatars and addresses (subtitle)
            </Text>
          </View>
        </View>

        {/* Implementation Notes */}
        <View style={[styles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <View style={styles.titleContainer}>
            <Text size="base" weight="semibold" variant="strong">Mobile Notes</Text>
          </View>
          <Text size="sm" variant="default">
            • Uses React Native Modal for dropdown overlay
          </Text>
          <Text size="sm" variant="default">
            • Touch-optimized for mobile interaction
          </Text>
          <Text size="sm" variant="default">
            • Consistent width management (min 150px, max 280px)
          </Text>
          <Text size="sm" variant="default">
            • Text truncation with ellipsis for long options
          </Text>
          <Text size="sm" variant="default">
            • Custom width support via numeric prop
          </Text>
          <Text size="sm" variant="default">
            • Grouped options with sticky headers
          </Text>
          <Text size="sm" variant="default">
            • Avatar support with 32px circular images
          </Text>
          <Text size="sm" variant="default">
            • Subtitle text for secondary information
          </Text>
          <Text size="sm" variant="default">
            • Icons are temporary emoji (FontAwesome pending)
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    // color removed - now uses theme colors dynamically
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    // color removed - now uses theme colors dynamically
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    // backgroundColor removed - now uses theme.colors.bg.card dynamically
    borderRadius: 12,
    padding: 20,
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
  subSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    // color removed - now uses theme colors dynamically
    marginBottom: 8,
  },
  selectedText: {
    fontSize: 12,
    // color removed - now uses theme colors dynamically
    marginTop: 8,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: 12,
    // color removed - now uses theme colors dynamically
    marginTop: 4,
    fontStyle: 'italic',
  },
  toggleButton: {
    marginTop: 24,
    alignSelf: 'flex-start',
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
  noteText: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    marginBottom: 6,
    lineHeight: 20,
  },
});
