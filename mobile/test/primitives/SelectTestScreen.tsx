import React, { useState } from 'react';
import {
  ScrollView,
  SafeAreaView,
  StatusBar,
  View,
} from 'react-native';
import { 
  Text, 
 
  Title, 
  Label, 
  FlexColumn, 
  FlexRow, 
  Select, 
  Button, 
  Icon, 
  useTheme 
} from '@/primitives';
import { commonTestStyles, createThemedStyles } from '@/styles/commonTestStyles';

export const SelectTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
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
  
  // Multiselect state
  const [multiselectBasic, setMultiselectBasic] = useState<string[]>([]);
  const [multiselectPermissions, setMultiselectPermissions] = useState<string[]>([]);
  const [multiselectTags, setMultiselectTags] = useState<string[]>([]);
  const [multiselectPreselected, setMultiselectPreselected] = useState<string[]>(['option2', 'option4']);

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

  // Permission groups for multiselect
  const permissionGroups = [
    {
      groupLabel: 'Message Permissions',
      options: [
        { value: 'message:delete', label: 'Delete Messages' },
        { value: 'message:pin', label: 'Pin Messages' },
        { value: 'message:edit', label: 'Edit Messages' },
      ],
    },
    {
      groupLabel: 'User Permissions',
      options: [
        { value: 'user:kick', label: 'Kick Users' },
        { value: 'user:ban', label: 'Ban Users' },
        { value: 'user:invite', label: 'Invite Users' },
      ],
    },
  ];

  // Tag options for multiselect
  const tagOptions = [
    { value: 'react', label: 'React' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'css', label: 'CSS' },
    { value: 'html', label: 'HTML' },
    { value: 'nodejs', label: 'Node.js' },
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
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <StatusBar barStyle={theme.resolvedTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={theme.colors.bg.app} />
      <ScrollView
        contentContainerStyle={commonTestStyles.contentPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={commonTestStyles.header}>
          <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="clipboard" size="xl" style={{ marginTop: 2 }}/>
            <Title>Select</Title>
          </FlexRow>
          <View style={{ marginTop: 8 }}>
            <Text size="base" variant="default" align="center">
              Mobile dropdown/picker component with modal overlay
            </Text>
          </View>
        </View>

        {/* Basic Select */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Basic Select</Title>
            <FlexColumn gap="xs">
              <Label>Simple Select:</Label>
              <Select
                value={basicValue}
                onChange={setBasicValue}
                placeholder="Choose an option"
                options={basicOptions}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Select with Icons */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">With Icons</Title>
            <FlexColumn gap="xs">
              <Label>Action Picker:</Label>
              <Select
                value={iconValue}
                onChange={setIconValue}
                placeholder="Choose an action"
                options={iconOptions}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Select Sizes */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Size Variants</Title>

            <FlexColumn gap="xs">
              <Label>Small Size:</Label>
              <Select
                size="small"
                value={sizeTestValue}
                onChange={setSizeTestValue}
                placeholder="Small select"
                options={sizeOptions}
              />
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Medium Size (Default):</Label>
              <Select
                size="medium"
                value={sizeTestValue}
                onChange={setSizeTestValue}
                placeholder="Medium select"
                options={sizeOptions}
              />
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Large Size:</Label>
              <Select
                size="large"
                value={sizeTestValue}
                onChange={setSizeTestValue}
                placeholder="Large select"
                options={sizeOptions}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Select Variants */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Select Variants</Title>

            <FlexColumn gap="xs">
              <Label>Bordered:</Label>
              <Select
                variant="bordered"
                value={variantTestValue}
                onChange={setVariantTestValue}
                placeholder="Bordered style"
                options={basicOptions}
              />
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Filled (Default):</Label>
              <Select
                value={variantTestValue}
                onChange={setVariantTestValue}
                placeholder="Filled style"
                options={basicOptions}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Error States */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Error States</Title>

            <FlexColumn gap="xs">
              <Label>With Error:</Label>
              <Select
                value={errorValue}
                onChange={(value: string) => {
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
                style={commonTestStyles.toggleButton}
              >
                Clear Selection
              </Button>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Disabled Select:</Label>
              <Select
                value="disabled"
                onChange={() => {}}
                disabled
                options={[
                  { value: 'disabled', label: 'Cannot change this' },
                  { value: 'other', label: 'Other option' },
                ]}
              />
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Advanced Features */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Advanced Features</Title>

            <FlexColumn gap="xs">
              <Label>Full Width:</Label>
              <Select
                fullWidth
                value=""
                onChange={() => {}}
                placeholder="Full width select"
                options={basicOptions}
              />
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>With Disabled Options:</Label>
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
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Custom Width */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Custom Width</Title>

            <FlexColumn gap="xs">
              <Label>Custom 200px Width:</Label>
              <Select
                width={200}
                value={customWidthValue}
                onChange={setCustomWidthValue}
                placeholder="200px wide"
                options={longTextOptions}
              />
              <Text size="sm" variant="subtle">Uses width=200 prop</Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Custom 120px Width (Narrow):</Label>
              <Select
                width={120}
                value=""
                onChange={() => {}}
                placeholder="Narrow"
                options={longTextOptions}
              />
              <Text size="sm" variant="subtle">Demonstrates text ellipsis</Text>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Grouped Options */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Grouped Options (SpaceEditor Style)</Title>
            <FlexColumn gap="xs">
              <Label>Select Channel:</Label>
              <Select
                value={groupedValue}
                onChange={setGroupedValue}
                placeholder="Choose a channel"
                groups={channelGroups}
                fullWidth
              />
              <Text size="sm" variant="subtle">
                Options organized by category with group headers
              </Text>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* User Selection with Avatars */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">User Selection with Avatars</Title>
            <FlexColumn gap="xs">
              <Label>Select Conversation:</Label>
              <Select
                value={userValue}
                onChange={setUserValue}
                placeholder="Select conversation"
                options={userOptions}
                fullWidth
              />
              <Text size="sm" variant="subtle">
                Shows user avatars and addresses (subtitle)
              </Text>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Multiselect Examples */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Multiselect Features</Title>

            <FlexColumn gap="xs">
              <Label>Basic Multiselect:</Label>
              <Select
                multiple
                value={multiselectBasic}
                onChange={setMultiselectBasic}
                placeholder="Select multiple options"
                options={basicOptions}
                fullWidth
              />
              <Text size="sm" variant="subtle">
                Touch items to select multiple
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Permission Multiselect:</Label>
              <Select
                multiple
                value={multiselectPermissions}
                onChange={setMultiselectPermissions}
                placeholder="Select permissions"
                groups={permissionGroups}
                fullWidth
              />
              <Text size="sm" variant="subtle">
                Grouped permissions with Select All/Clear All
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Tags (No Select All):</Label>
              <Select
                multiple
                showSelectAllOption={false}
                value={multiselectTags}
                onChange={setMultiselectTags}
                placeholder="Choose tags"
                options={tagOptions}
                fullWidth
              />
              <Text size="sm" variant="subtle">
                Without Select All/Clear All options
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Pre-selected Options:</Label>
              <Select
                multiple
                value={multiselectPreselected}
                onChange={setMultiselectPreselected}
                placeholder="Select options"
                options={[
                  { value: 'option1', label: 'Option 1' },
                  { value: 'option2', label: 'Option 2 (Pre-selected)' },
                  { value: 'option3', label: 'Option 3' },
                  { value: 'option4', label: 'Option 4 (Pre-selected)' },
                  { value: 'option5', label: 'Option 5' },
                ]}
                fullWidth
              />
              <Text size="sm" variant="subtle">
                Starts with pre-selected values
              </Text>
            </FlexColumn>

            <FlexColumn gap="xs">
              <Label>Many Options (Chip Limit):</Label>
              <Select
                multiple
                maxDisplayedChips={2}
                value={[]}
                onChange={() => {}}
                placeholder="Select countries"
                options={Array.from({ length: 15 }, (_, i) => ({
                  value: `country${i}`,
                  label: `Country ${i + 1}`,
                }))}
                fullWidth
              />
              <Text size="sm" variant="subtle">
                Shows "+N more" after 2 selections
              </Text>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Implementation Notes */}
        <View style={themedStyles.notesSection}>
          <FlexColumn gap="sm">
            <Title size="sm">Mobile Notes</Title>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Uses React Native Modal for dropdown overlay</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Touch-optimized for mobile interaction</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Consistent width management (min 150px, max 280px)</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Text truncation with ellipsis for long options</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Custom width support via numeric prop</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Grouped options with sticky headers</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Avatar support with 32px circular images</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Subtitle text for secondary information</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Icons are temporary emoji (FontAwesome pending)</Text>
              </View>
            </FlexRow>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};


