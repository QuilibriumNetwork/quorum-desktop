import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../components/primitives/theme';
import Select from '../components/primitives/Select/Select.native';
import Button from '../components/primitives/Button';

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
        { value: 'voice-general', label: 'General Voice', icon: '🔊' },
        { value: 'voice-meeting', label: 'Meeting Room', icon: '🔊' },
      ],
    },
    {
      groupLabel: 'Private Channels',
      options: [
        { value: 'team-leads', label: '#team-leads', icon: '🔒' },
        { value: 'admins', label: '#admins', icon: '🔒' },
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
          <Text style={[styles.title, { color: theme.colors.text.strong }]}>📋 Select</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.main }]}>
            Mobile dropdown/picker component with modal overlay
          </Text>
        </View>

        {/* Basic Select */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Basic Select</Text>
          <Text style={[styles.label, { color: theme.colors.text.main }]}>Simple Select</Text>
          <Select
            value={basicValue}
            onChange={setBasicValue}
            placeholder="Choose an option"
            options={basicOptions}
          />
        </View>

        {/* Select with Icons */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>With Icons</Text>
          <Text style={[styles.label, { color: theme.colors.text.main }]}>Action Picker</Text>
          <Select
            value={iconValue}
            onChange={setIconValue}
            placeholder="Choose an action"
            options={iconOptions}
          />
        </View>

        {/* Select Sizes */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Size Variants</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Small Size</Text>
            <Select
              size="small"
              value={sizeTestValue}
              onChange={setSizeTestValue}
              placeholder="Small select"
              options={sizeOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Medium Size (Default)</Text>
            <Select
              size="medium"
              value={sizeTestValue}
              onChange={setSizeTestValue}
              placeholder="Medium select"
              options={sizeOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Large Size</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Select Variants</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Bordered</Text>
            <Select
              variant="bordered"
              value={variantTestValue}
              onChange={setVariantTestValue}
              placeholder="Bordered style"
              options={basicOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Filled (Default)</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Error States</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>With Error</Text>
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
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Disabled Select</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Advanced Features</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Full Width</Text>
            <Select
              fullWidth
              value=""
              onChange={() => {}}
              placeholder="Full width select"
              options={basicOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>With Disabled Options</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Custom Width</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Custom 200px Width</Text>
            <Select
              width={200}
              value={customWidthValue}
              onChange={setCustomWidthValue}
              placeholder="200px wide"
              options={longTextOptions}
            />
            <Text style={styles.helpText}>Uses width=200 prop</Text>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Custom 120px Width (Narrow)</Text>
            <Select
              width={120}
              value=""
              onChange={() => {}}
              placeholder="Narrow"
              options={longTextOptions}
            />
            <Text style={styles.helpText}>Demonstrates text ellipsis</Text>
          </View>
        </View>

        {/* Grouped Options */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>
            Grouped Options (SpaceEditor Style)
          </Text>
          <Text style={[styles.label, { color: theme.colors.text.main }]}>Select Channel</Text>
          <Select
            value={groupedValue}
            onChange={setGroupedValue}
            placeholder="Choose a channel"
            groups={channelGroups}
            fullWidth
          />
          <Text style={styles.helpText}>
            Options organized by category with group headers
          </Text>
        </View>

        {/* User Selection with Avatars */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>User Selection with Avatars</Text>
          <Text style={[styles.label, { color: theme.colors.text.main }]}>Select Conversation</Text>
          <Select
            value={userValue}
            onChange={setUserValue}
            placeholder="Select conversation"
            options={userOptions}
            fullWidth
          />
          <Text style={styles.helpText}>
            Shows user avatars and addresses (subtitle)
          </Text>
        </View>

        {/* Implementation Notes */}
        <View style={[styles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <Text style={[styles.notesTitle, { color: theme.colors.text.strong }]}>📱 Mobile Implementation</Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Uses React Native Modal for dropdown overlay
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Touch-optimized for mobile interaction
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Consistent width management (min 150px, max 280px)
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Text truncation with ellipsis for long options
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Custom width support via numeric prop
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Grouped options with sticky headers
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Avatar support with 32px circular images
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
            • Subtitle text for secondary information
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text.main }]}>
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
