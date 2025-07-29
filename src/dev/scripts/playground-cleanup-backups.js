#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
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

// Parse command line arguments
const args = process.argv.slice(2);
const all = args.includes('--all');
const older = args.includes('--older');
const dryRun = args.includes('--dry-run');

let daysOld = 7; // Default: clean backups older than 7 days
const olderIndex = args.indexOf('--older');
if (olderIndex !== -1 && args[olderIndex + 1]) {
  const providedDays = parseInt(args[olderIndex + 1]);
  if (!isNaN(providedDays)) {
    daysOld = providedDays;
  }
}

function findBackupFiles(basePath) {
  const backupFiles = [];
  
  function scanDirectory(dirPath) {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      items.forEach(item => {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          scanDirectory(fullPath);
        } else if (item.name.includes('.backup-')) {
          const stats = fs.statSync(fullPath);
          backupFiles.push({
            path: fullPath,
            name: item.name,
            size: stats.size,
            mtime: stats.mtime,
            ageInDays: (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)
          });
        }
      });
    } catch (error) {
      // Ignore errors for directories that don't exist
    }
  }
  
  scanDirectory(basePath);
  return backupFiles;
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  return kb < 1 ? `${bytes}B` : `${kb.toFixed(1)}KB`;
}

function formatAge(days) {
  if (days < 1) {
    const hours = Math.floor(days * 24);
    return `${hours}h`;
  }
  return `${Math.floor(days)}d`;
}

function main() {
  console.log(`\n${colors.blue}🧹 Mobile Playground Backup Cleanup${colors.reset}`);
  console.log(`${colors.dim}Note: Web playground imports directly from main app (no backups created)${colors.reset}\n`);
  
  if (dryRun) {
    console.log(`${colors.yellow}🔍 DRY RUN MODE - No files will be deleted${colors.reset}\n`);
  }
  
  // Find all backup files
  const mainBackups = findBackupFiles(MAIN_PRIMITIVES_PATH);
  const playgroundBackups = findBackupFiles(MOBILE_PLAYGROUND_PATH);
  const allBackups = [...mainBackups, ...playgroundBackups];
  
  if (allBackups.length === 0) {
    console.log(`${colors.green}✓ No backup files found${colors.reset}`);
    return;
  }
  
  console.log(`Found ${allBackups.length} backup files:\n`);
  
  // Group by component for better display
  const backupsByComponent = {};
  allBackups.forEach(backup => {
    const componentPath = path.dirname(backup.path);
    const componentName = path.basename(componentPath);
    if (!backupsByComponent[componentName]) {
      backupsByComponent[componentName] = [];
    }
    backupsByComponent[componentName].push(backup);
  });
  
  let totalSize = 0;
  let toDelete = [];
  
  Object.keys(backupsByComponent).sort().forEach(componentName => {
    const backups = backupsByComponent[componentName];
    console.log(`${colors.blue}${componentName}:${colors.reset}`);
    
    backups.forEach(backup => {
      totalSize += backup.size;
      const shouldDelete = all || (older && backup.ageInDays > daysOld);
      
      if (shouldDelete) {
        toDelete.push(backup);
        console.log(`  ${colors.red}✗${colors.reset} ${backup.name} ${colors.dim}(${formatSize(backup.size)}, ${formatAge(backup.ageInDays)} old)${colors.reset}`);
      } else {
        console.log(`  ${colors.green}✓${colors.reset} ${backup.name} ${colors.dim}(${formatSize(backup.size)}, ${formatAge(backup.ageInDays)} old)${colors.reset}`);
      }
    });
  });
  
  console.log(`\n${colors.blue}📊 Summary${colors.reset}`);
  console.log(`Total backup files: ${allBackups.length}`);
  console.log(`Total size: ${formatSize(totalSize)}`);
  console.log(`${colors.red}Files to delete: ${toDelete.length}${colors.reset}`);
  console.log(`${colors.green}Files to keep: ${allBackups.length - toDelete.length}${colors.reset}`);
  
  if (toDelete.length > 0) {
    const sizeToDelete = toDelete.reduce((sum, backup) => sum + backup.size, 0);
    console.log(`Space to recover: ${formatSize(sizeToDelete)}`);
    
    if (!dryRun) {
      let deletedCount = 0;
      toDelete.forEach(backup => {
        try {
          fs.unlinkSync(backup.path);
          deletedCount++;
        } catch (error) {
          console.log(`${colors.red}Failed to delete: ${backup.name}${colors.reset}`);
        }
      });
      
      console.log(`\n${colors.green}✓ Deleted ${deletedCount} backup files${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}💡 To actually delete these files, run without --dry-run${colors.reset}`);
    }
  } else {
    console.log(`\n${colors.green}✓ No files to delete${colors.reset}`);
  }
  
  if (!all && !older) {
    console.log(`\n${colors.yellow}💡 Cleanup options:${colors.reset}`);
    console.log(`  yarn playground:cleanup --all          ${colors.dim}# Delete all backup files${colors.reset}`);
    console.log(`  yarn playground:cleanup --older 7      ${colors.dim}# Delete backups older than 7 days${colors.reset}`);
    console.log(`  yarn playground:cleanup --older 1      ${colors.dim}# Delete backups older than 1 day${colors.reset}`);
    console.log(`  yarn playground:cleanup --dry-run --all ${colors.dim}# See what would be deleted${colors.reset}`);
  }
}

// Show help if no valid options provided
if (!all && !older && args.length > 0 && !dryRun) {
  console.log(`${colors.red}Error: Invalid options${colors.reset}`);
  console.log(`\nUsage:`);
  console.log(`  yarn playground:cleanup --all              # Delete all backup files`);
  console.log(`  yarn playground:cleanup --older [days]     # Delete backups older than N days`);
  console.log(`  yarn playground:cleanup --dry-run --all    # Preview what would be deleted`);
  process.exit(1);
}

// Run the script
main();