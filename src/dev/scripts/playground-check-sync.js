#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

// Define paths
// Note: Only mobile playground needs sync - web playground imports directly from main app
const MAIN_PRIMITIVES_PATH = path.join(projectRoot, 'src/components/primitives');
const MOBILE_PLAYGROUND_PATH = path.join(projectRoot, 'src/dev/playground/mobile/quorum-mobile-test/components/primitives');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

// Files to automatically skip during sync (architectural differences by design)
const ROUTING_FILES = [
  'index.ts',           // Different export patterns (main: .web, mobile: .native)
  /^[A-Z]\w+\.tsx$/     // Component routing files (e.g., Button.tsx, Modal.tsx)
];

// Check if a file should be skipped due to architectural differences
function isRoutingFile(filename) {
  return ROUTING_FILES.some(pattern => 
    typeof pattern === 'string' ? filename === pattern : pattern.test(filename)
  );
}

// Helper functions
function getFileChecksum(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

function normalizeLinguiContent(content) {
  // Normalize Lingui imports and usage for comparison
  // This allows detecting when files are functionally identical except for Lingui vs hardcoded strings
  
  let normalized = content;
  
  // Remove Lingui import lines
  normalized = normalized.replace(/import\s+\{\s*t\s*\}\s+from\s+['"]@lingui\/core\/macro['"];\s*\n?/g, '');
  normalized = normalized.replace(/import\s+\{\s*Trans\s*\}\s+from\s+['"]@lingui\/react\/macro['"];\s*\n?/g, '');
  
  // Convert Lingui template literals to regular strings
  // Handle t`text` -> 'text'
  normalized = normalized.replace(/t`([^`]*)`/g, "'$1'");
  
  // Handle t`text ${variable}` -> 'text ' + variable (simplified)
  normalized = normalized.replace(/t`([^`]*\$\{[^}]+\}[^`]*)`/g, (match, content) => {
    // For complex interpolations, just replace with a placeholder
    return "'[INTERPOLATED_TEXT]'";
  });
  
  // Remove playground-specific comments
  normalized = normalized.replace(/\/\/ Playground-specific: Skip Lingui for demo purposes\s*\n\/\/ Real mobile app will use full Lingui integration\s*\n?/g, '');
  
  // Remove empty lines that might be left after import removal
  normalized = normalized.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Remove leading/trailing whitespace for consistent comparison
  normalized = normalized.trim();
  
  return normalized;
}

function compareFilesLinguiAware(mainPath, playgroundPath) {
  // Compare files with Lingui awareness
  // Returns: 'identical', 'lingui-equivalent', 'different', or 'missing'
  
  try {
    const mainExists = fs.existsSync(mainPath);
    const playgroundExists = fs.existsSync(playgroundPath);
    
    if (!mainExists && !playgroundExists) return 'missing';
    if (!mainExists || !playgroundExists) return 'different';
    
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    const playgroundContent = fs.readFileSync(playgroundPath, 'utf8');
    
    // First check if they're identical
    if (mainContent === playgroundContent) return 'identical';
    
    // Check if they're Lingui-equivalent (same after normalization)
    const mainNormalized = normalizeLinguiContent(mainContent);
    const playgroundNormalized = normalizeLinguiContent(playgroundContent);
    
    if (mainNormalized === playgroundNormalized) return 'lingui-equivalent';
    
    return 'different';
  } catch (error) {
    return 'different';
  }
}

function getFileMtime(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  } catch (error) {
    return null;
  }
}

function formatDate(date) {
  if (!date) return 'N/A';
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function formatBytes(bytes) {
  if (!bytes) return 'N/A';
  const kb = bytes / 1024;
  return kb < 1 ? `${bytes}B` : `${kb.toFixed(1)}KB`;
}

// Get all primitive directories
function getPrimitiveDirectories(basePath) {
  try {
    const items = fs.readdirSync(basePath, { withFileTypes: true });
    return items
      .filter(item => item.isDirectory() && !item.name.startsWith('.'))
      .map(item => item.name)
      .filter(name => name !== 'index.ts'); // Exclude index file
  } catch (error) {
    return [];
  }
}

// Check sync status for a single component
function checkComponentSync(componentName) {
  const mainComponentPath = path.join(MAIN_PRIMITIVES_PATH, componentName);
  const playgroundComponentPath = path.join(MOBILE_PLAYGROUND_PATH, componentName);
  
  const results = {
    component: componentName,
    files: [],
    inSync: true,
  };

  // Get all files from both locations
  // Mobile playground uses native-only architecture, only check relevant files
  const fileExtensions = ['.native.tsx', '.ts']; // Only native implementations and types
  const checkedFiles = new Set();

  // Check files in main component directory
  if (fs.existsSync(mainComponentPath)) {
    const mainFiles = fs.readdirSync(mainComponentPath)
      .filter(file => fileExtensions.some(ext => file.endsWith(ext)))
      .filter(file => !isRoutingFile(file)); // Skip architectural differences
    
    mainFiles.forEach(file => {
      checkedFiles.add(file);
      const mainFilePath = path.join(mainComponentPath, file);
      const playgroundFilePath = path.join(playgroundComponentPath, file);
      
      const mainChecksum = getFileChecksum(mainFilePath);
      const playgroundChecksum = getFileChecksum(playgroundFilePath);
      const mainMtime = getFileMtime(mainFilePath);
      const playgroundMtime = getFileMtime(playgroundFilePath);
      
      // Lingui-aware comparison
      const comparison = compareFilesLinguiAware(mainFilePath, playgroundFilePath);
      
      const fileResult = {
        fileName: file,
        mainExists: !!mainChecksum,
        playgroundExists: !!playgroundChecksum,
        inSync: comparison === 'identical' || comparison === 'lingui-equivalent',
        comparison: comparison, // New field to track comparison status
        mainMtime,
        playgroundMtime,
        mainSize: mainChecksum ? fs.statSync(mainFilePath).size : null,
        playgroundSize: playgroundChecksum ? fs.statSync(playgroundFilePath).size : null,
      };
      
      if (!fileResult.inSync) {
        results.inSync = false;
      }
      
      results.files.push(fileResult);
    });
  }

  // Check for files that only exist in playground
  if (fs.existsSync(playgroundComponentPath)) {
    const playgroundFiles = fs.readdirSync(playgroundComponentPath)
      .filter(file => fileExtensions.some(ext => file.endsWith(ext)))
      .filter(file => !isRoutingFile(file)); // Skip architectural differences
    
    playgroundFiles.forEach(file => {
      if (!checkedFiles.has(file)) {
        const playgroundFilePath = path.join(playgroundComponentPath, file);
        const playgroundMtime = getFileMtime(playgroundFilePath);
        
        results.files.push({
          fileName: file,
          mainExists: false,
          playgroundExists: true,
          inSync: false,
          mainMtime: null,
          playgroundMtime,
          mainSize: null,
          playgroundSize: fs.statSync(playgroundFilePath).size,
        });
        
        results.inSync = false;
      }
    });
  }

  return results;
}

// Main function
function main() {
  console.log(`\n${colors.blue}🔍 Checking Mobile Playground Component Sync Status${colors.reset}`);
  console.log(`${colors.dim}Note: Web playground imports directly from main app (no sync needed)${colors.reset}\n`);
  
  // Get all primitives from both locations
  const mainPrimitives = new Set(getPrimitiveDirectories(MAIN_PRIMITIVES_PATH));
  const playgroundPrimitives = new Set(getPrimitiveDirectories(MOBILE_PLAYGROUND_PATH));
  const allPrimitives = new Set([...mainPrimitives, ...playgroundPrimitives]);
  
  let totalInSync = 0;
  let totalOutOfSync = 0;
  const outOfSyncComponents = [];
  
  // Check each primitive
  allPrimitives.forEach(primitive => {
    const syncStatus = checkComponentSync(primitive);
    
    // Check if component has any Lingui-equivalent files
    const hasLinguiEquivalent = syncStatus.files.some(file => file.comparison === 'lingui-equivalent');
    
    // Check if all files are either identical or lingui-equivalent
    const allFilesInSyncOrLinguiEquivalent = syncStatus.files.length > 0 && 
      syncStatus.files.every(file => file.comparison === 'identical' || file.comparison === 'lingui-equivalent');
    
    if (syncStatus.inSync && syncStatus.files.length > 0) {
      totalInSync++;
      if (hasLinguiEquivalent) {
        console.log(`${colors.green}≈${colors.reset} ${primitive} ${colors.dim}(Lingui-equivalent)${colors.reset}`);
      } else {
        console.log(`${colors.green}✓${colors.reset} ${primitive} ${colors.dim}(in sync)${colors.reset}`);
      }
    } else if (allFilesInSyncOrLinguiEquivalent) {
      // Component is Lingui-equivalent (treat as in sync)
      totalInSync++;
      console.log(`${colors.green}≈${colors.reset} ${primitive} ${colors.dim}(Lingui-equivalent)${colors.reset}`);
    } else if (!syncStatus.inSync || syncStatus.files.length === 0) {
      totalOutOfSync++;
      outOfSyncComponents.push(syncStatus);
      console.log(`${colors.red}✗${colors.reset} ${primitive} ${colors.yellow}(out of sync)${colors.reset}`);
      
      // Show details for out-of-sync files
      syncStatus.files.forEach(file => {
        if (!file.inSync) {
          let status = '';
          if (!file.mainExists) {
            status = `${colors.yellow}only in playground${colors.reset}`;
          } else if (!file.playgroundExists) {
            status = `${colors.yellow}only in main app${colors.reset}`;
          } else if (file.comparison === 'different') {
            const mainNewer = file.mainMtime > file.playgroundMtime;
            const newerLocation = mainNewer ? 'main app' : 'playground';
            status = `${colors.yellow}${newerLocation} is newer (different content)${colors.reset}`;
          } else {
            const mainNewer = file.mainMtime > file.playgroundMtime;
            const newerLocation = mainNewer ? 'main app' : 'playground';
            status = `${colors.yellow}${newerLocation} is newer${colors.reset}`;
          }
          
          console.log(`  └─ ${file.fileName}: ${status}`);
          
          if (file.mainExists && file.playgroundExists) {
            console.log(`     Main:       ${formatDate(file.mainMtime)} (${formatBytes(file.mainSize)})`);
            console.log(`     Playground: ${formatDate(file.playgroundMtime)} (${formatBytes(file.playgroundSize)})`);
          }
        }
      });
    }
  });
  
  // Summary
  console.log(`\n${colors.blue}📊 Summary${colors.reset}`);
  console.log(`${colors.green}In sync:${colors.reset} ${totalInSync} components`);
  console.log(`${colors.red}Out of sync:${colors.reset} ${totalOutOfSync} components`);
  console.log(`${colors.dim}Lingui awareness: Enabled (Lingui-equivalent files treated as in-sync)${colors.reset}`);
  
  if (totalOutOfSync > 0) {
    console.log(`\n${colors.yellow}💡 To sync components, run:${colors.reset}`);
    console.log(`   yarn playground:sync --sync-newer --all     ${colors.dim}# Auto-sync based on newer files (recommended)${colors.reset}`);
    console.log(`   yarn playground:sync --to-playground --all  ${colors.dim}# Copy all from main app to playground${colors.reset}`);
    console.log(`   yarn playground:sync --from-playground --all ${colors.dim}# Copy all from playground to main app${colors.reset}`);
    console.log(`   yarn playground:sync --interactive          ${colors.dim}# Choose direction for each component${colors.reset}`);
    console.log(`   yarn playground:sync --force-lingui --all   ${colors.dim}# Force sync even Lingui-equivalent files${colors.reset}`);
  }
  
  // Exit with code 1 if out of sync (useful for scripts/CI)
  if (totalOutOfSync > 0) {
    console.log(`\n${colors.dim}Note: Exiting with code 1 to indicate out-of-sync status${colors.reset}`);
  }
  process.exit(totalOutOfSync > 0 ? 1 : 0);
}

// Run the script
main();