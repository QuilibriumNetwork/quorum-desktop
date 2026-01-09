#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldApply = args.includes('--apply');

if (!isDryRun && !shouldApply) {
  console.log('Usage: node scripts/add-yaml-frontmatter.js [--dry-run|--apply]');
  console.log('  --dry-run: Preview changes without modifying files');
  console.log('  --apply: Apply changes to all files');
  process.exit(1);
}

const AGENTS_DIR = path.join(process.cwd(), '.agents');

// Helper function to normalize status strings to new 4-status system
function normalizeStatus(rawStatus) {
  const normalized = rawStatus.toLowerCase().replace(/\s+/g, '-');
  const mapping = {
    // Map to 'open'
    'pending': 'open',
    'active': 'open',
    'new': 'open',
    'planning': 'open',
    // Map to 'in-progress'
    'in-progress': 'in-progress',
    'in progress': 'in-progress',
    'wip': 'in-progress',
    // Map to 'on-hold'
    'blocked': 'on-hold',
    'on-hold': 'on-hold',
    'waiting': 'on-hold',
    'paused': 'on-hold',
    // Map to 'done'
    'done': 'done',
    'completed': 'done',
    'complete': 'done',
    'solved': 'done',
    'fixed': 'done',
    'archived': 'done'
  };
  return mapping[normalized] || 'open'; // Default to 'open' if unknown
}

// Extract metadata from file content
function extractMetadata(content, filePath, filename, type) {
  const metadata = {
    type,
    title: null,
    status: null,
    complexity: null,
    ai_generated: null,
    reviewed_by: null,
    created: null,
    updated: null,
    related_issues: [],
  };

  // Normalize path for cross-platform (Windows uses backslashes)
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Extract title from H1 heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    metadata.title = titleMatch[1];
  }

  // Extract status from markdown metadata (within first 20 lines)
  const lines = content.split('\n');
  const headerLines = lines.slice(0, 20).join('\n');

  const statusMatch = headerLines.match(/\*\*Status\*\*:\s*(\w+(?:\s+\w+)?)/i);
  if (statusMatch) {
    metadata.status = normalizeStatus(statusMatch[1]);
  }
  // Check subfolder/filename (cross-platform paths)
  else if (normalizedPath.includes('/.done/') || filename.startsWith('DONE_')) {
    metadata.status = 'done';
  } else if (normalizedPath.includes('/.archived/') || normalizedPath.includes('/.archive/') || filename.startsWith('ARCHIVED_')) {
    metadata.status = 'done';
  } else if (normalizedPath.includes('/.solved/') || filename.startsWith('SOLVED_')) {
    metadata.status = 'done';
  }
  // Default based on type
  else {
    metadata.status = 'open';
  }

  // Extract created date
  const createdMatch = content.match(/\*\*(?:Created|Date)\*\*:\s*(\d{4}-\d{2}-\d{2})/i);
  if (createdMatch) {
    metadata.created = createdMatch[1];
  } else {
    // Fallback to file creation date or current date
    try {
      const stats = fs.statSync(filePath);
      const birthtime = stats.birthtime || stats.mtime;
      metadata.created = birthtime.toISOString().split('T')[0];
    } catch (err) {
      // Use current date as last resort
      metadata.created = new Date().toISOString().split('T')[0];
    }
  }

  // Extract updated date from footer (last 10 lines)
  const footer = lines.slice(-10).join('\n');
  const updatedMatch = footer.match(/(?:Last Updated|Updated):\s*(\d{4}-\d{2}-\d{2})/i) ||
                       footer.match(/\*\*(\d{4}-\d{2}-\d{2})\s*-/);
  if (updatedMatch) {
    metadata.updated = updatedMatch[1];
  } else {
    // Fallback to file modification date
    try {
      const stats = fs.statSync(filePath);
      metadata.updated = stats.mtime.toISOString().split('T')[0];
    } catch (err) {
      // Omit updated field if can't determine
      metadata.updated = null;
    }
  }

  // Extract complexity (tasks only)
  if (type === 'task') {
    const complexityMatch = content.match(/\*\*Complexity\*\*:\s*(\w+(?:\s+\w+)?)/i);
    if (complexityMatch) {
      const complexity = complexityMatch[1].toLowerCase().replace(/\s+/g, '-');
      metadata.complexity = complexity;
    }
  }

  // Extract AI-generated flag (check first 10 lines only)
  const aiGeneratedMatch = headerLines.match(/>\s*\*\*⚠️\s*AI-Generated\*\*/i);
  if (aiGeneratedMatch) {
    metadata.ai_generated = true;
  }

  // Extract related issues (first 50 lines only to avoid code examples)
  const topLines = lines.slice(0, 50).join('\n');
  const issueMatches = topLines.matchAll(/#(\d+)|issues\/(\d+)|pull\/(\d+)/g);
  const issueNumbers = [...issueMatches].map(m => `#${m[1] || m[2] || m[3]}`);
  metadata.related_issues = [...new Set(issueNumbers)];

  return metadata;
}

// Generate YAML frontmatter string
function generateFrontmatter(metadata) {
  const lines = ['---'];

  // Always include type and title
  lines.push(`type: ${metadata.type}`);
  if (metadata.title) {
    // Escape quotes in title
    const escapedTitle = metadata.title.replace(/"/g, '\\"');
    lines.push(`title: "${escapedTitle}"`);
  }

  // Include status if present
  if (metadata.status) {
    lines.push(`status: ${metadata.status}`);
  }

  // Include complexity if present (tasks only)
  if (metadata.complexity) {
    lines.push(`complexity: ${metadata.complexity}`);
  }

  // Include AI-generated flag only if true
  if (metadata.ai_generated) {
    lines.push(`ai_generated: true`);
  }

  // reviewed_by is always null for existing files (omit it)
  // Include created date if present
  if (metadata.created) {
    lines.push(`created: ${metadata.created}`);
  }

  // Include updated date if present
  if (metadata.updated) {
    lines.push(`updated: ${metadata.updated}`);
  }

  // Include related_issues only if non-empty
  if (metadata.related_issues && metadata.related_issues.length > 0) {
    lines.push(`related_issues: [${metadata.related_issues.map(i => `"${i}"`).join(', ')}]`);
  }

  lines.push('---');
  lines.push(''); // Empty line after frontmatter
  lines.push(''); // Second line to create visual blank line

  return lines.join('\n');
}

// Process a single file
function processFile(filePath, type, dryRun = true) {
  try {
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if file already has frontmatter
    const parsed = matter(content);
    if (parsed.data && Object.keys(parsed.data).length > 0) {
      console.log(`  ⏭️  Skipping (already has frontmatter): ${filePath}`);
      return { skipped: true };
    }

    // Extract metadata
    const filename = path.basename(filePath);
    const metadata = extractMetadata(content, filePath, filename, type);

    // Generate frontmatter
    const frontmatter = generateFrontmatter(metadata);

    // Prepend frontmatter to content
    const newContent = frontmatter + content;

    if (dryRun) {
      console.log(`  📄 Would update: ${filePath}`);
      console.log(`     Type: ${metadata.type}, Status: ${metadata.status}, Title: ${metadata.title?.substring(0, 50)}...`);
      return { updated: true, dryRun: true };
    } else {
      // Write file with UTF-8 encoding
      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log(`  ✅ Updated: ${filePath}`);
      return { updated: true, dryRun: false };
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return { error: true };
  }
}

// Recursively scan directory for markdown files
function scanDirectory(dirPath, type, dryRun = true) {
  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
  };

  if (!fs.existsSync(dirPath)) {
    console.log(`  ⚠️  Directory does not exist: ${dirPath}`);
    return results;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      const subResults = scanDirectory(fullPath, type, dryRun);
      results.processed += subResults.processed;
      results.skipped += subResults.skipped;
      results.errors += subResults.errors;
    } else if (item.endsWith('.md')) {
      const result = processFile(fullPath, type, dryRun);
      if (result.skipped) {
        results.skipped++;
      } else if (result.error) {
        results.errors++;
      } else if (result.updated) {
        results.processed++;
      }
    }
  }

  return results;
}

// Main execution
function main() {
  console.log('🔄 YAML Frontmatter Migration Script');
  console.log('=====================================');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no files will be modified)' : '✏️  APPLY (files will be modified)'}\n`);

  const folders = ['docs', 'tasks', 'bugs', 'reports'];
  const totalResults = {
    processed: 0,
    skipped: 0,
    errors: 0,
  };

  for (const folder of folders) {
    const folderPath = path.join(AGENTS_DIR, folder);
    console.log(`\n📁 Processing ${folder}/...`);

    const results = scanDirectory(folderPath, folder === 'docs' ? 'doc' : folder.slice(0, -1), isDryRun);

    totalResults.processed += results.processed;
    totalResults.skipped += results.skipped;
    totalResults.errors += results.errors;

    console.log(`   ${folder}: ${results.processed} processed, ${results.skipped} skipped, ${results.errors} errors`);
  }

  console.log('\n=====================================');
  console.log('📊 Summary');
  console.log(`   Total processed: ${totalResults.processed}`);
  console.log(`   Total skipped: ${totalResults.skipped}`);
  console.log(`   Total errors: ${totalResults.errors}`);

  if (isDryRun) {
    console.log('\n✨ This was a dry run. Run with --apply to make changes.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

main();
