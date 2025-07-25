import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/primitives/Button';

export const SimpleButtonTestScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🔘 Simple Button Test</Text>
        <Text style={styles.subtitle}>Testing Button primitive without flex layouts</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Variants</Text>
          
          <View style={styles.buttonContainer}>
            <Button type="primary" onClick={() => console.log('Primary clicked')}>
              Primary
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button type="secondary" onClick={() => console.log('Secondary clicked')}>
              Secondary
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button type="light" onClick={() => console.log('Light clicked')}>
              Light
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button type="light-outline" onClick={() => console.log('Light Outline clicked')}>
              Light Outline
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subtle & Utility Variants</Text>
          
          <View style={styles.buttonContainer}>
            <Button type="subtle" onClick={() => console.log('Subtle clicked')}>
              Subtle
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button type="subtle-outline" onClick={() => console.log('Subtle Outline clicked')}>
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
          <Text style={[styles.sectionTitle, { color: 'white' }]}>White Variants (on colored bg)</Text>
          
          <View style={styles.buttonContainer}>
            <Button type="primary-white" onClick={() => console.log('Primary White clicked')}>
              Primary White
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button type="secondary-white" onClick={() => console.log('Secondary White clicked')}>
              Secondary White
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button type="light-outline-white" onClick={() => console.log('Light Outline White clicked')}>
              Light Outline White
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Button Sizes</Text>
          
          <View style={styles.buttonContainer}>
            <Button type="primary" size="normal" onClick={() => console.log('Normal size')}>
              Normal Size
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button type="primary" size="small" onClick={() => console.log('Small size')}>
              Small Size
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disabled State</Text>
          
          <View style={styles.buttonContainer}>
            <Button type="primary" disabled onClick={() => console.log('Should not fire')}>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
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
    color: '#333',
    marginBottom: 16,
  },
  buttonContainer: {
    marginBottom: 12,
  },
});