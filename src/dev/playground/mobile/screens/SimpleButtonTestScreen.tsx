import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import Button from '../components/primitives/Button';

export const SimpleButtonTestScreen: React.FC = () => {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text.strong }]}>🔘 Simple Button Test</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.main }]}>
          Testing Button primitive without flex layouts
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Primary Variants</Text>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              onClick={() => console.log('Primary clicked')}
            >
              Primary
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="secondary"
              onClick={() => console.log('Secondary clicked')}
            >
              Secondary
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button type="light" onClick={() => console.log('Light clicked')}>
              Light
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="light-outline"
              onClick={() => console.log('Light Outline clicked')}
            >
              Light Outline
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Subtle & Utility Variants</Text>

          <View style={styles.buttonContainer}>
            <Button type="subtle" onClick={() => console.log('Subtle clicked')}>
              Subtle
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="subtle-outline"
              onClick={() => console.log('Subtle Outline clicked')}
            >
              Subtle Outline
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button type="danger" onClick={() => console.log('Danger clicked')}>
              Danger
            </Button>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: '#4A90E2' }]}>
          <Text style={[styles.sectionTitle, { color: 'white' }]}>
            White Variants (on colored bg)
          </Text>

          <View style={styles.buttonContainer}>
            <Button
              type="primary-white"
              onClick={() => console.log('Primary White clicked')}
            >
              Primary White
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="secondary-white"
              onClick={() => console.log('Secondary White clicked')}
            >
              Secondary White
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="light-outline-white"
              onClick={() => console.log('Light Outline White clicked')}
            >
              Light Outline White
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Button Sizes</Text>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              size="large"
              onClick={() => console.log('Large size')}
            >
              Large Size
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              size="normal"
              onClick={() => console.log('Normal size')}
            >
              Normal Size
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              size="small"
              onClick={() => console.log('Small size')}
            >
              Small Size
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Buttons with Icons</Text>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              iconName="plus"
              onClick={() => console.log('Add item')}
            >
              Add Item
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              iconName="edit"
              iconOnly
              onClick={() => console.log('Edit')}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="secondary"
              iconName="save"
              size="large"
              onClick={() => console.log('Save large')}
            >
              Save Document
            </Button>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              iconName="download"
              iconOnly
              size="large"
              onClick={() => console.log('Download large')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Disabled State</Text>

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              disabled
              onClick={() => console.log('Should not fire')}
            >
              Disabled Button
            </Button>
          </View>
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
  content: {
    padding: 20,
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
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
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
  buttonContainer: {
    marginBottom: 12,
  },
});
