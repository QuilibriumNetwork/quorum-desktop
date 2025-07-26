import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Select from '../components/primitives/Select/Select.native';
import Button from '../components/primitives/Button';

export const SelectTestScreen: React.FC = () => {
  // Select testing state
  const [basicValue, setBasicValue] = useState('');
  const [iconValue, setIconValue] = useState('edit');
  const [errorValue, setErrorValue] = useState('');
  const [showError, setShowError] = useState(false);
  const [sizeTestValue, setSizeTestValue] = useState('');
  const [variantTestValue, setVariantTestValue] = useState('');
  const [customWidthValue, setCustomWidthValue] = useState('');

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📋 Select</Text>
          <Text style={styles.subtitle}>
            Mobile dropdown/picker component with modal overlay
          </Text>
        </View>

        {/* Basic Select */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Select</Text>
          <Text style={styles.label}>Simple Select</Text>
          <Select
            value={basicValue}
            onChange={setBasicValue}
            placeholder="Choose an option"
            options={basicOptions}
          />
        </View>

        {/* Select with Icons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>With Icons</Text>
          <Text style={styles.label}>Action Picker</Text>
          <Select
            value={iconValue}
            onChange={setIconValue}
            placeholder="Choose an action"
            options={iconOptions}
          />
        </View>

        {/* Select Sizes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Size Variants</Text>

          <View style={styles.subSection}>
            <Text style={styles.label}>Small Size</Text>
            <Select
              size="small"
              value={sizeTestValue}
              onChange={setSizeTestValue}
              placeholder="Small select"
              options={sizeOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={styles.label}>Medium Size (Default)</Text>
            <Select
              size="medium"
              value={sizeTestValue}
              onChange={setSizeTestValue}
              placeholder="Medium select"
              options={sizeOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={styles.label}>Large Size</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Variants</Text>

          <View style={styles.subSection}>
            <Text style={styles.label}>Default (Bordered)</Text>
            <Select
              variant="default"
              value={variantTestValue}
              onChange={setVariantTestValue}
              placeholder="Default style"
              options={basicOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={styles.label}>Filled</Text>
            <Select
              variant="filled"
              value={variantTestValue}
              onChange={setVariantTestValue}
              placeholder="Filled style"
              options={basicOptions}
            />
          </View>
        </View>

        {/* Error States */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Error States</Text>

          <View style={styles.subSection}>
            <Text style={styles.label}>With Error</Text>
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
            <Text style={styles.label}>Disabled Select</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Features</Text>

          <View style={styles.subSection}>
            <Text style={styles.label}>Full Width</Text>
            <Select
              fullWidth
              value=""
              onChange={() => {}}
              placeholder="Full width select"
              options={basicOptions}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={styles.label}>With Disabled Options</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Width</Text>

          <View style={styles.subSection}>
            <Text style={styles.label}>Custom 200px Width</Text>
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
            <Text style={styles.label}>Custom 120px Width (Narrow)</Text>
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

        {/* Implementation Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>📱 Mobile Implementation</Text>
          <Text style={styles.noteText}>
            • Uses React Native Modal for dropdown overlay
          </Text>
          <Text style={styles.noteText}>
            • Touch-optimized for mobile interaction
          </Text>
          <Text style={styles.noteText}>
            • Consistent width management (min 150px, max 280px)
          </Text>
          <Text style={styles.noteText}>
            • Text truncation with ellipsis for long options
          </Text>
          <Text style={styles.noteText}>
            • Custom width support via numeric prop
          </Text>
          <Text style={styles.noteText}>
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
    backgroundColor: '#f5f5f5',
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
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: 'white',
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
    color: '#333',
    marginBottom: 16,
  },
  subSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  selectedText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  toggleButton: {
    marginTop: 24,
    alignSelf: 'flex-start',
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
  noteText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 6,
    lineHeight: 20,
  },
});
