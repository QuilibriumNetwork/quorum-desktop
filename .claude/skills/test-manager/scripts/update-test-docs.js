#!/usr/bin/env node

/**
 * Script to update test documentation based on current test structure
 *
 * Usage: node scripts/update-test-docs.js
 *
 * This script:
 * - Scans test directories for test files
 * - Counts tests in each category
 * - Updates README files with current statistics
 * - Identifies missing documentation
 */

const fs = require('fs').promises;
const path = require('path');

const TEST_DIR = 'src/dev/tests';
const CATEGORIES = ['services', 'utils', 'components', 'hooks', 'integration', 'e2e'];

async function countTestsInFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    // Count 'it(' and 'test(' calls
    const itMatches = content.match(/\bit\s*\(/g) || [];
    const testMatches = content.match(/\btest\s*\(/g) || [];
    return itMatches.length + testMatches.length;
  } catch (error) {
    console.warn(`Could not read file ${filePath}:`, error.message);
    return 0;
  }
}

async function scanDirectory(dirPath) {
  const stats = {
    files: 0,
    tests: 0,
    testFiles: []
  };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx'))) {
        const filePath = path.join(dirPath, entry.name);
        const testCount = await countTestsInFile(filePath);

        stats.files++;
        stats.tests += testCount;
        stats.testFiles.push({
          name: entry.name,
          tests: testCount,
          path: filePath
        });
      }
    }
  } catch (error) {
    console.warn(`Could not scan directory ${dirPath}:`, error.message);
  }

  return stats;
}

async function generateCategoryReport(category) {
  const categoryPath = path.join(TEST_DIR, category);
  const stats = await scanDirectory(categoryPath);

  return {
    category,
    ...stats,
    path: categoryPath
  };
}

async function updateMainReadme(reports) {
  const mainReadmePath = path.join(TEST_DIR, 'README.md');

  try {
    let content = await fs.readFile(mainReadmePath, 'utf8');

    // Calculate totals
    const totalFiles = reports.reduce((sum, r) => sum + r.files, 0);
    const totalTests = reports.reduce((sum, r) => sum + r.tests, 0);

    // Update the directory structure section
    let newStructure = '```\nsrc/dev/tests/\n';

    for (const report of reports) {
      const filesList = report.testFiles.map(f =>
        `│   ├── ${f.name}${' '.repeat(Math.max(1, 35 - f.name.length))}(${f.tests} tests)`
      ).join('\n');

      newStructure += `├── ${report.category}/\n`;
      if (filesList) {
        newStructure += filesList + '\n';
      } else {
        newStructure += `│   └── README.md\n`;
      }
    }

    newStructure += '├── docs/\n';
    newStructure += '├── setup.ts\n';
    newStructure += '└── README.md\n```';

    // Replace the directory structure
    content = content.replace(
      /```\nsrc\/dev\/tests\/[\s\S]*?```/,
      newStructure
    );

    // Update the statistics at the bottom
    const today = new Date().toISOString().split('T')[0];
    const statsPattern = /_Total test coverage:.*?\n_Test organization:.*?$/m;
    const newStats = `_Total test coverage: ${totalTests} tests across ${totalFiles} files\n_Test organization: ${reports.length} categories with dedicated documentation and examples_`;

    if (statsPattern.test(content)) {
      content = content.replace(statsPattern, newStats);
    }

    // Update last updated date
    content = content.replace(
      /_Last updated: \d{4}-\d{2}-\d{2}_/,
      `_Last updated: ${today}_`
    );

    await fs.writeFile(mainReadmePath, content, 'utf8');
    console.log('✅ Updated main README.md');

  } catch (error) {
    console.error('❌ Could not update main README:', error.message);
  }
}

async function updateCategoryReadme(report) {
  const readmePath = path.join(report.path, 'README.md');

  try {
    const exists = await fs.access(readmePath).then(() => true).catch(() => false);

    if (exists) {
      let content = await fs.readFile(readmePath, 'utf8');

      // Update file count and test count if the pattern exists
      const today = new Date().toISOString().split('T')[0];
      content = content.replace(
        /_Created: \d{4}-\d{2}-\d{2}_/,
        `_Updated: ${today}_`
      );

      await fs.writeFile(readmePath, content, 'utf8');
      console.log(`✅ Updated ${report.category} README.md`);
    } else {
      console.log(`⚠️ No README.md found in ${report.category}/`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not update ${report.category} README:`, error.message);
  }
}

async function checkForOrphanedTests() {
  const allTestFiles = [];

  // Scan for all test files
  async function scanRecursive(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await scanRecursive(fullPath);
        } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
          allTestFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
  }

  await scanRecursive(TEST_DIR);

  // Check if any tests are outside organized directories
  const organizedTests = [];
  for (const category of CATEGORIES) {
    const categoryPath = path.join(TEST_DIR, category);
    const testFiles = allTestFiles.filter(f => f.startsWith(categoryPath));
    organizedTests.push(...testFiles);
  }

  const orphanedTests = allTestFiles.filter(f => !organizedTests.includes(f));

  if (orphanedTests.length > 0) {
    console.log('\n⚠️ Found orphaned test files (not in organized categories):');
    orphanedTests.forEach(test => {
      const relativePath = path.relative(process.cwd(), test);
      console.log(`  - ${relativePath}`);
    });
    console.log('\n💡 Consider moving these to appropriate category directories');
  }

  return orphanedTests;
}

async function main() {
  console.log('🔍 Scanning test directories...\n');

  const reports = [];

  for (const category of CATEGORIES) {
    const report = await generateCategoryReport(category);
    reports.push(report);

    const emoji = report.files > 0 ? '✅' : '📝';
    console.log(`${emoji} ${category}: ${report.files} files, ${report.tests} tests`);

    if (report.files > 0) {
      await updateCategoryReadme(report);
    }
  }

  console.log('\n📊 Updating documentation...');
  await updateMainReadme(reports);

  console.log('\n🔍 Checking for orphaned tests...');
  await checkForOrphanedTests();

  const totalTests = reports.reduce((sum, r) => sum + r.tests, 0);
  const totalFiles = reports.reduce((sum, r) => sum + r.files, 0);

  console.log(`\n🎉 Documentation updated! Found ${totalFiles} test files with ${totalTests} total tests`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main, countTestsInFile, scanDirectory };