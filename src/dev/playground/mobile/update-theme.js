#!/usr/bin/env node
/**
 * Script to update all mobile playground screens with proper theme support
 * This script adds useTheme imports and updates common text styles to use theme colors
 */

const fs = require('fs');
const path = require('path');

const SCREENS_DIR = './screens';

// Theme update patterns
const THEME_UPDATES = {
  // Add theme import
  addThemeImport: {
    pattern: /import { SafeAreaView } from 'react-native-safe-area-context';/g,
    replacement: `import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';`
  },
  
  // Add useTheme hook
  addUseTheme: {
    pattern: /export const (\w+): React\.FC.*?= \((.*?)\) => \{/g,
    replacement: `export const $1: React.FC = ($2) => {
  const theme = useTheme();`
  },
  
  // Update container background
  updateContainer: {
    pattern: /style={styles\.container}/g,
    replacement: 'style={[styles.container, { backgroundColor: theme.colors.bg.app }]}'
  },
  
  // Update common text styles
  updateTitle: {
    pattern: /style={styles\.title}/g,
    replacement: 'style={[styles.title, { color: theme.colors.text.strong }]}'
  },
  
  updateSubtitle: {
    pattern: /style={styles\.subtitle}/g,
    replacement: 'style={[styles.subtitle, { color: theme.colors.text.main }]}'
  },
  
  updateSectionTitle: {
    pattern: /style={styles\.sectionTitle}/g,
    replacement: 'style={[styles.sectionTitle, { color: theme.colors.text.strong }]}'
  },
  
  updateLabel: {
    pattern: /style={styles\.label}/g,
    replacement: 'style={[styles.label, { color: theme.colors.text.main }]}'
  },
  
  // Remove hardcoded colors from styles
  removeContainerBg: {
    pattern: /backgroundColor: '#f5f5f5',/g,
    replacement: '// backgroundColor removed - now uses theme.colors.bg.app dynamically'
  },
  
  removeTextColors: {
    pattern: /color: '#(333|666|555)',/g,
    replacement: '// color removed - now uses theme colors dynamically'
  }
};

function updateScreenFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already has theme import
  if (content.includes('useTheme')) {
    console.log(`  - ${filePath} already has theme support, skipping...`);
    return;
  }
  
  // Apply all theme updates
  Object.entries(THEME_UPDATES).forEach(([key, update]) => {
    if (update.pattern && update.replacement) {
      content = content.replace(update.pattern, update.replacement);
    }
  });
  
  // Write back to file
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✅ Updated ${filePath}`);
}

function main() {
  console.log('🎨 Updating mobile playground screens with theme support...\n');
  
  const screenFiles = fs.readdirSync(SCREENS_DIR)
    .filter(file => file.endsWith('TestScreen.tsx'))
    .map(file => path.join(SCREENS_DIR, file));
  
  screenFiles.forEach(updateScreenFile);
  
  console.log(`\n✅ Theme updates completed for ${screenFiles.length} screen files!`);
  console.log('\n📋 Next steps:');
  console.log('1. Test the theme switching in the mobile playground');
  console.log('2. Fix any compilation errors manually');
  console.log('3. Verify all screens respond to theme changes');
}

if (require.main === module) {
  main();
}