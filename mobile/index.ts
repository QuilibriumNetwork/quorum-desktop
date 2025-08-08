// Import polyfills FIRST, before anything else
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Make Buffer globally available
global.Buffer = Buffer;

import { registerRootComponent } from 'expo';

// Test playground app (change to './App' for production app)
import App from './AppTest';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
