import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import theme system
import { ThemeProvider } from '@/primitives/theme';

// Import test screens
import { PrimitivesTestScreen } from '@/screens/PrimitivesTestScreen';
import { ThemeTestScreen } from '@/screens/ThemeTestScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: '#f8f9fa',
              },
              headerTitleStyle: {
                fontWeight: '600',
              },
              tabBarStyle: {
                backgroundColor: '#ffffff',
                borderTopColor: '#e9ecef',
              },
              tabBarActiveTintColor: '#007AFF',
              tabBarInactiveTintColor: '#8E8E93',
            }}
          >
            <Tab.Screen 
              name="Primitives" 
              component={PrimitivesTestScreen}
              options={{
                title: 'Primitives Test',
                tabBarLabel: 'Primitives',
              }}
            />
            <Tab.Screen 
              name="Theme" 
              component={ThemeTestScreen}
              options={{
                title: 'Theme Test',
                tabBarLabel: 'Theme',
              }}
            />
          </Tab.Navigator>
          <StatusBar style="auto" />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
