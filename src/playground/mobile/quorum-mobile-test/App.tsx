import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { InputTestScreen } from './screens/InputTestScreen';
import { TextAreaTestScreen } from './screens/TextAreaTestScreen';

type Screen = 'basic' | 'input' | 'textarea';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('basic');

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'basic' && styles.activeTab]}
        onPress={() => setCurrentScreen('basic')}
      >
        <Text style={[styles.tabText, currentScreen === 'basic' && styles.activeTabText]}>
          Basic Test
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'input' && styles.activeTab]}
        onPress={() => setCurrentScreen('input')}
      >
        <Text style={[styles.tabText, currentScreen === 'input' && styles.activeTabText]}>
          Input Test
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, currentScreen === 'textarea' && styles.activeTab]}
        onPress={() => setCurrentScreen('textarea')}
      >
        <Text style={[styles.tabText, currentScreen === 'textarea' && styles.activeTabText]}>
          TextArea Test
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'input':
        return <InputTestScreen />;
      case 'textarea':
        return <TextAreaTestScreen />;
      case 'basic':
      default:
        return (
          <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>🚀 Basic React Native Test</Text>
              <Text style={styles.subtitle}>Testing if React Native works on this platform</Text>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Flex Layout Test</Text>
                <View style={[styles.testContainer, { flexDirection: 'row', gap: 16 }]}>
                  <View style={styles.item}><Text style={styles.itemText}>Item 1</Text></View>
                  <View style={styles.item}><Text style={styles.itemText}>Item 2</Text></View>
                  <View style={styles.item}><Text style={styles.itemText}>Item 3</Text></View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Space Between Test</Text>
                <View style={[styles.testContainer, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                  <Text style={styles.betweenText}>Left Side</Text>
                  <Text style={styles.betweenText}>Right Side</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Center Test</Text>
                <View style={[styles.centerContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={styles.centerText}>Perfectly Centered! 🎯</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.successMessage}>
                  ✅ If you see this, React Native is working!
                </Text>
                <Text style={styles.infoMessage}>
                  Next step: Test our cross-platform primitives. Tap "Input Test" or "TextArea Test" tabs above.
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        );
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.appContainer}>
        {renderTabBar()}
        {renderScreen()}
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1976d2',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1976d2',
    fontWeight: '600',
  },
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
    marginBottom: 12,
  },
  testContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 50,
  },
  centerContainer: {
    height: 80,
  },
  item: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  itemText: {
    color: '#1976d2',
    fontWeight: '500',
    fontSize: 14,
  },
  betweenText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 16,
  },
  centerText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  successMessage: {
    fontSize: 18,
    color: '#28a745',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 12,
  },
  infoMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
  },
});
