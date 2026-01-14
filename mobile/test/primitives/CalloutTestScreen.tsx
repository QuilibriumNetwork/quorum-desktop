import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Title, Icon } from '@/components/primitives';
import Callout from '@/components/primitives/Callout';
import { Flex } from '@/components/primitives';
import { commonTestStyles } from '@/styles/commonTestStyles';

export const CalloutTestScreen: React.FC = () => {
  const theme = useTheme();

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
            <Icon name="info-circle" size="xl" style={{ marginTop: 2 }} />
            <Title>Callout</Title>
          </Flex>
          <Text align="center">
            Centralized messaging component with variants, sizes, and dismissible options
          </Text>
        </Flex>

        <View style={[styles.section, { backgroundColor: theme.colors.surface[1] }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Callout Variants</Text>
          <View style={styles.exampleContainer}>
            <Callout variant="info">
              This is an info callout with important information for the user.
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="success">
              Great! Your operation completed successfully.
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="warning">
              Warning: Please review this information carefully.
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="error">
              Error: Something went wrong. Please try again.
            </Callout>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface[1] }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Callout Sizes</Text>
          <View style={styles.exampleContainer}>
            <Callout variant="info" size="xs">
              Extra small callout for compact messages
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="info" size="sm">
              Small callout (default size) for regular messages
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="info" size="md">
              Medium callout for more prominent messages
            </Callout>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface[1] }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Layout Modes</Text>
          <View style={styles.exampleContainer}>
            <Callout variant="success" layout="base">
              Base layout with background and border (default)
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="success" layout="minimal">
              Minimal layout with icon and colored text only
            </Callout>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface[1] }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Dismissible Callouts</Text>
          <View style={styles.exampleContainer}>
            <Callout
              variant="warning"
              dismissible
              onClose={() => console.log('Closed!')}
            >
              This callout can be dismissed by clicking the × button
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="info" layout="minimal" dismissible>
              Minimal layout can also be dismissible
            </Callout>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface[1] }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Combined Features</Text>
          <View style={styles.exampleContainer}>
            <Callout variant="error" size="xs" layout="minimal" dismissible>
              Compact error message with minimal styling
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="success" size="md" dismissible>
              Large success message with dismissible button
            </Callout>
          </View>
          <View style={styles.exampleContainer}>
            <Callout variant="warning" size="sm" layout="base">
              <View>
                <Text style={[styles.customContentTitle, { color: '#F59E0B' }]}>Custom Content:</Text>
                <Text style={{ color: '#F59E0B' }}>You can pass any React Native content as children.</Text>
                <Text style={{ color: '#F59E0B' }}>• List item 1</Text>
                <Text style={{ color: '#F59E0B' }}>• List item 2</Text>
              </View>
            </Callout>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  section: {
    padding: 20,
    marginBottom: 12,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  exampleContainer: {
    marginBottom: 12,
  },
  customContentTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
});