#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Define paths
// Note: Only mobile playground needs sync - web playground imports directly from main app
const MAIN_PRIMITIVES_PATH = path.join(projectRoot, 'src/components/primitives');
const MOBILE_PLAYGROUND_PATH = path.join(projectRoot, 'src/playground/mobile/quorum-mobile-test/components/primitives');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Files to automatically skip during sync (architectural differences by design)
const ROUTING_FILES = [
  'index.ts',           // Different export patterns (main: .web, mobile: .native)
  /^[A-Z]\w+\.tsx$/,    // Component routing files (e.g., Button.tsx, Modal.tsx)
  'ThemeProvider.tsx'   // Environment-specific setup
];

// Check if a file should be skipped due to architectural differences
function isRoutingFile(filename) {
  return ROUTING_FILES.some(pattern => 
    typeof pattern === 'string' ? filename === pattern : pattern.test(filename)
  );
}

// Parse command line arguments
const args = process.argv.slice(2);
const toPlayground = args.includes('--to-playground');
const fromPlayground = args.includes('--from-playground');
const interactive = args.includes('--interactive');
const syncNewer = args.includes('--sync-newer');
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const force = args.includes('--force');
const noBackup = args.includes('--no-backup');
const ignoreLingui = !args.includes('--force-lingui'); // Default: ignore Lingui differences
const forceLingui = args.includes('--force-lingui');

// Get specific components from args
const components = args.filter(arg => !arg.startsWith('--'));

// Validation
if (!toPlayground && !fromPlayground && !interactive && !syncNewer) {
  console.error(`${colors.red}Error: You must specify a sync direction${colors.reset}`);
  console.error('Use --to-playground, --from-playground, --sync-newer, or --interactive');
  console.error(`${colors.dim}Optional flags: --force-lingui (sync Lingui-equivalent files), --dry-run, --no-backup${colors.reset}`);
  process.exit(1);
}

if ([toPlayground, fromPlayground, syncNewer].filter(Boolean).length > 1) {
  console.error(`${colors.red}Error: Cannot use multiple direction flags together${colors.reset}`);
  console.error('Choose one: --to-playground, --from-playground, or --sync-newer');
  process.exit(1);
}

if (!all && components.length === 0 && !interactive) {
  console.error(`${colors.red}Error: Specify components to sync or use --all${colors.reset}`);
  process.exit(1);
}

// Check for uncommitted changes
function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: projectRoot });
    return status.trim().length > 0;
  } catch (error) {
    return true; // Assume there are changes if git command fails
  }
}

// Create readline interface for interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

// Helper functions
function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createBackup(filePath) {
  if (fs.existsSync(filePath)) {
    // Create backup with timestamp to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupPath = `${filePath}.backup-${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }
  return null;
}

function cleanupOldBackups(filePath, keepCount = 3) {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);
  
  try {
    const files = fs.readdirSync(dir);
    const backupFiles = files
      .filter(file => file.startsWith(`${baseName}.backup-`))
      .map(file => ({
        name: file,
        path: path.join(dir, file),
        mtime: fs.statSync(path.join(dir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by newest first
    
    // Keep only the most recent backups, delete the rest
    const toDelete = backupFiles.slice(keepCount);
    
    toDelete.forEach(backup => {
      try {
        fs.unlinkSync(backup.path);
        console.log(`    ${colors.dim}Cleaned up old backup: ${backup.name}${colors.reset}`);
      } catch (error) {
        // Ignore errors when deleting backups
      }
    });
    
    return backupFiles.length - toDelete.length; // Return number of backups kept
  } catch (error) {
    return 0;
  }
}

function copyFile(source, destination) {
  ensureDirectoryExists(destination);
  
  if (!dryRun) {
    const backupPath = createBackup(destination);
    if (backupPath) {
      console.log(`  ${colors.dim}Created backup: ${path.basename(backupPath)}${colors.reset}`);
    }
    fs.copyFileSync(source, destination);
  }
}

function adjustImportPaths(content, fromPlayground) {
  // Adjust import paths when copying between environments
  if (fromPlayground) {
    // From playground to main: adjust relative imports
    content = content.replace(/from ['"]\.\.\/\.\.\//g, 'from \'../');
    content = content.replace(/from ['"]\.\.\/ReactTooltip/g, 'from \'react-tooltip');
  } else {
    // From main to playground: might need to adjust absolute imports
    content = content.replace(/from ['"]react-tooltip/g, 'from \'../../ReactTooltip');
  }
  
  return content;
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

function getFileTimestamp(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  } catch (error) {
    return null;
  }
}

function determineNewerFile(mainPath, playgroundPath) {
  const mainTime = getFileTimestamp(mainPath);
  const playgroundTime = getFileTimestamp(playgroundPath);
  
  if (!mainTime && !playgroundTime) return null;
  if (!mainTime) return 'playground';
  if (!playgroundTime) return 'main';
  
  return mainTime > playgroundTime ? 'main' : 'playground';
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

function syncFile(sourcePath, destPath, direction) {
  if (fs.existsSync(sourcePath)) {
    console.log(`  ${colors.cyan}→${colors.reset} ${path.basename(sourcePath)}`);
    
    // Read content and adjust imports if it's a TypeScript/JavaScript file
    if (sourcePath.endsWith('.tsx') || sourcePath.endsWith('.ts')) {
      let content = fs.readFileSync(sourcePath, 'utf8');
      content = adjustImportPaths(content, direction === 'from-playground');
      
      if (!dryRun) {
        ensureDirectoryExists(destPath);
        
        // Create backup and clean up old ones (unless disabled)
        if (!noBackup) {
          const backupPath = createBackup(destPath);
          if (backupPath) {
            console.log(`    ${colors.dim}Created backup: ${path.basename(backupPath)}${colors.reset}`);
            // Clean up old backups (keep only 3 most recent)
            cleanupOldBackups(destPath, 3);
          }
        }
        
        fs.writeFileSync(destPath, content, 'utf8');
      }
    } else {
      // For non-TS files (like SCSS), just copy
      if (!dryRun) {
        ensureDirectoryExists(destPath);
        
        // Create backup and clean up old ones (unless disabled)
        if (!noBackup) {
          const backupPath = createBackup(destPath);
          if (backupPath) {
            console.log(`    ${colors.dim}Created backup: ${path.basename(backupPath)}${colors.reset}`);
            // Clean up old backups (keep only 3 most recent)
            cleanupOldBackups(destPath, 3);
          }
        }
        
        fs.copyFileSync(sourcePath, destPath);
      }
    }
    
    return true;
  }
  return false;
}

// Get all primitive directories
function getPrimitiveDirectories(basePath) {
  try {
    const items = fs.readdirSync(basePath, { withFileTypes: true });
    return items
      .filter(item => item.isDirectory() && !item.name.startsWith('.'))
      .map(item => item.name)
      .filter(name => name !== 'index.ts' && name !== 'theme');
  } catch (error) {
    return [];
  }
}

// Sync a single component
async function syncComponent(componentName, direction) {
  const mainComponentPath = path.join(MAIN_PRIMITIVES_PATH, componentName);
  const playgroundComponentPath = path.join(MOBILE_PLAYGROUND_PATH, componentName);
  
  // For sync-newer mode, we need to check each file individually
  if (direction === 'sync-newer') {
    return await syncComponentByNewerFiles(componentName, mainComponentPath, playgroundComponentPath);
  }
  
  const sourcePath = direction === 'to-playground' ? mainComponentPath : playgroundComponentPath;
  const destPath = direction === 'to-playground' ? playgroundComponentPath : mainComponentPath;
  
  if (!fs.existsSync(sourcePath)) {
    console.log(`${colors.yellow}⚠${colors.reset} Component '${componentName}' not found in source location`);
    return false;
  }
  
  console.log(`\n${colors.blue}Syncing ${componentName}${colors.reset} ${direction === 'to-playground' ? '→ playground' : '← playground'}`);
  
  // Get files relevant for mobile playground (native-only architecture)
  const fileExtensions = direction === 'to-playground' 
    ? ['.native.tsx', '.ts'] // Only sync native implementations and types to playground
    : ['.web.tsx', '.native.tsx', '.tsx', '.ts', '.scss']; // Sync all files from playground back to main
  const files = fs.readdirSync(sourcePath)
    .filter(file => fileExtensions.some(ext => file.endsWith(ext)) || file === 'types.ts');
  
  let syncedCount = 0;
  
  for (const file of files) {
    // Skip routing files as they have different architectures by design
    if (isRoutingFile(file) && !force) {
      console.log(`  ${colors.dim}Skipping ${file} (architectural difference - use --force to override)${colors.reset}`);
      continue;
    }
    
    const sourceFile = path.join(sourcePath, file);
    const destFile = path.join(destPath, file);
    
    if (interactive) {
      const sourceLabel = direction === 'to-playground' ? 'main app' : 'playground';
      const destLabel = direction === 'to-playground' ? 'playground' : 'main app';
      
      const answer = await askQuestion(
        `  Copy ${file} from ${sourceLabel} to ${destLabel}? (y/n/q) `
      );
      
      if (answer === 'q') {
        console.log('Sync cancelled by user');
        process.exit(0);
      }
      
      if (answer !== 'y') {
        console.log(`  ${colors.dim}Skipped ${file}${colors.reset}`);
        continue;
      }
    }
    
    if (syncFile(sourceFile, destFile, direction)) {
      syncedCount++;
    }
  }
  
  console.log(`  ${colors.green}✓ Synced ${syncedCount} files${colors.reset}`);
  return syncedCount > 0;
}

// Sync component by checking which files are newer
async function syncComponentByNewerFiles(componentName, mainComponentPath, playgroundComponentPath) {
  console.log(`\n${colors.blue}Syncing ${componentName}${colors.reset} ${colors.cyan}(sync newer files)${colors.reset}`);
  
  // Get all files from both locations (mobile playground uses native-only architecture)
  const fileExtensions = ['.native.tsx', '.ts']; // Only native implementations and types
  const allFiles = new Set();
  
  // Collect files from main component
  if (fs.existsSync(mainComponentPath)) {
    const mainFiles = fs.readdirSync(mainComponentPath)
      .filter(file => fileExtensions.some(ext => file.endsWith(ext)) || file === 'types.ts' || file === 'index.ts');
    mainFiles.forEach(file => allFiles.add(file));
  }
  
  // Collect files from playground component
  if (fs.existsSync(playgroundComponentPath)) {
    const playgroundFiles = fs.readdirSync(playgroundComponentPath)
      .filter(file => fileExtensions.some(ext => file.endsWith(ext)) || file === 'types.ts' || file === 'index.ts');
    playgroundFiles.forEach(file => allFiles.add(file));
  }
  
  if (allFiles.size === 0) {
    console.log(`${colors.yellow}⚠${colors.reset} No files found for component '${componentName}'`);
    return false;
  }
  
  let syncedCount = 0;
  let mainToPlayground = 0;
  let playgroundToMain = 0;
  
  for (const file of allFiles) {
    // Skip routing files as they have different architectures by design
    if (isRoutingFile(file) && !force) {
      console.log(`  ${colors.dim}Skipping ${file} (architectural difference - use --force to override)${colors.reset}`);
      continue;
    }
    
    const mainFile = path.join(mainComponentPath, file);
    const playgroundFile = path.join(playgroundComponentPath, file);
    
    // Check Lingui-aware file comparison first
    const comparison = compareFilesLinguiAware(mainFile, playgroundFile);
    
    if (comparison === 'identical') {
      console.log(`  ${colors.green}✓${colors.reset} ${file} ${colors.dim}(identical)${colors.reset}`);
      continue;
    }
    
    if (comparison === 'lingui-equivalent' && ignoreLingui) {
      console.log(`  ${colors.green}≈${colors.reset} ${file} ${colors.dim}(Lingui-equivalent, skipped)${colors.reset}`);
      continue;
    }
    
    if (comparison === 'missing') {
      console.log(`  ${colors.dim}Skipping ${file} (file not found in either location)${colors.reset}`);
      continue;
    }
    
    // Determine which file is newer for sync direction
    const newerLocation = determineNewerFile(mainFile, playgroundFile);
    
    if (!newerLocation) {
      console.log(`  ${colors.dim}Skipping ${file} (file not found in either location)${colors.reset}`);
      continue;
    }
    
    // Show file status in sync messages
    const statusSuffix = comparison === 'lingui-equivalent' ? ' (Lingui-equivalent)' : '';
    
    if (newerLocation === 'main') {
      console.log(`  ${colors.cyan}→${colors.reset} ${file} ${colors.dim}(main app → playground)${statusSuffix}${colors.reset}`);
      if (syncFile(mainFile, playgroundFile, 'to-playground')) {
        syncedCount++;
        mainToPlayground++;
      }
    } else {
      console.log(`  ${colors.cyan}←${colors.reset} ${file} ${colors.dim}(playground → main app)${statusSuffix}${colors.reset}`);
      if (syncFile(playgroundFile, mainFile, 'from-playground')) {
        syncedCount++;
        playgroundToMain++;
      }
    }
  }
  
  console.log(`  ${colors.green}✓ Synced ${syncedCount} files${colors.reset} ${colors.dim}(${mainToPlayground}→ playground, ${playgroundToMain}← main)${colors.reset}`);
  return syncedCount > 0;
}

// Main function
async function main() {
  if (dryRun) {
    console.log(`\n${colors.yellow}🔍 DRY RUN MODE - No files will be modified${colors.reset}`);
  }
  
  // Check for uncommitted changes
  if (!force && hasUncommittedChanges()) {
    console.log(`${colors.yellow}⚠ Warning: You have uncommitted changes${colors.reset}`);
    const answer = await askQuestion('Continue anyway? (y/n) ');
    if (answer !== 'y') {
      console.log('Sync cancelled');
      process.exit(0);
    }
  }
  
  const direction = toPlayground ? 'to-playground' : fromPlayground ? 'from-playground' : syncNewer ? 'sync-newer' : 'interactive';
  
  console.log(`\n${colors.blue}🔄 Mobile Playground Component Sync${colors.reset}`);
  console.log(`${colors.dim}Note: Web playground imports directly from main app (no sync needed)${colors.reset}`);
  const directionLabel = {
    'to-playground': 'Main App → Playground',
    'from-playground': 'Playground → Main App',
    'sync-newer': 'Sync Newer Files (bidirectional)',
    'interactive': 'Interactive mode'
  }[direction];
  console.log(`Direction: ${directionLabel}`);
  
  // Get components to sync
  let componentsToSync = components;
  
  if (all) {
    const mainPrimitives = new Set(getPrimitiveDirectories(MAIN_PRIMITIVES_PATH));
    const playgroundPrimitives = new Set(getPrimitiveDirectories(MOBILE_PLAYGROUND_PATH));
    componentsToSync = [...new Set([...mainPrimitives, ...playgroundPrimitives])];
  }
  
  if (componentsToSync.length === 0) {
    console.log(`${colors.red}No components found to sync${colors.reset}`);
    process.exit(1);
  }
  
  // Sync each component
  let totalSynced = 0;
  
  for (const component of componentsToSync) {
    let syncDirection = direction;
    
    if (interactive && direction === 'interactive') {
      const answer = await askQuestion(
        `\nSync ${component}? (t=to playground, f=from playground, n=sync newer, s=skip, q=quit) `
      );
      
      if (answer === 'q') {
        console.log('Sync cancelled by user');
        break;
      }
      
      if (answer === 's') {
        console.log(`${colors.dim}Skipped ${component}${colors.reset}`);
        continue;
      }
      
      syncDirection = answer === 't' ? 'to-playground' : answer === 'f' ? 'from-playground' : answer === 'n' ? 'sync-newer' : null;
      
      if (!syncDirection) {
        console.log(`${colors.dim}Invalid option, skipping ${component}${colors.reset}`);
        continue;
      }
    }
    
    if (await syncComponent(component, syncDirection)) {
      totalSynced++;
    }
  }
  
  // Summary
  console.log(`\n${colors.blue}📊 Summary${colors.reset}`);
  console.log(`${colors.green}Components synced:${colors.reset} ${totalSynced}`);
  
  if (ignoreLingui) {
    console.log(`${colors.dim}Lingui awareness: Enabled (Lingui-equivalent files skipped by default)${colors.reset}`);
  } else {
    console.log(`${colors.dim}Lingui awareness: Disabled (--force-lingui used)${colors.reset}`);
  }
  
  if (totalSynced > 0 && !dryRun) {
    console.log(`\n${colors.yellow}💡 Don't forget to:${colors.reset}`);
    console.log(`  1. Test the synced components`);
    console.log(`  2. Commit the changes`);
    console.log(`  3. Run 'yarn playground:check' to verify sync status`);
  }
  
  rl.close();
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
});