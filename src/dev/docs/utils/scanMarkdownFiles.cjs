// Node.js utility to scan markdown files from the .agents directory.
//
// Run as `yarn scan-docs`. Writes `markdownFiles.json`, which the dev viewer
// imports directly — the browser cannot walk a filesystem, so this is the one
// place the tree is read.
//
// This only *reads*: it records each file's path, its folder, and whatever
// frontmatter it carries. Every judgement about what those mean (which state a
// folder implies, which epic a file belongs to, how to normalise a priority
// someone wrote prose into) lives in `issueTaxonomy.ts` so it can be unit
// tested. Do not add classification logic here.

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

/**
 * Parse frontmatter without letting one malformed file kill the scan.
 *
 * Eight files in `.agents/issues/` currently have YAML broken enough to throw —
 * an unquoted `:` inside a long prose value, or prose indented under `status:`.
 * An unguarded `matter()` call turns any one of them into a failed scan and an
 * empty viewer, so a bad file degrades to "no frontmatter" plus a recorded
 * `parseError` that the summary below reports loudly.
 */
const readFrontmatter = (fullPath) => {
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  try {
    return { frontmatter: matter(fileContent).data, parseError: null };
  } catch (err) {
    return { frontmatter: {}, parseError: err.message.split('\n')[0] };
  }
};

const scanDirectory = (dirPath, baseFolder = '') => {
  const files = [];

  if (!fs.existsSync(dirPath)) {
    console.warn(`Directory does not exist: ${dirPath}`);
    return files;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively scan subdirectories
      // Build full folder path for nested folders
      const folderPath = baseFolder ? `${baseFolder}/${item}` : item;
      const subFiles = scanDirectory(fullPath, folderPath);
      files.push(...subFiles);
    } else if (item.endsWith('.md')) {
      // Add markdown files
      const relativePath = path
        .relative(process.cwd(), fullPath)
        .replace(/\\/g, '/');

      const { frontmatter, parseError } = readFrontmatter(fullPath);

      files.push({
        name: item,
        path: relativePath,
        folder: baseFolder || 'root',
        frontmatter,
        ...(parseError ? { parseError } : {}),
      });
    }
  }

  return files;
};

const scanMarkdownFiles = () => {
  const readmeDir = path.join(process.cwd(), '.agents');

  // `issues` replaced the old `tasks` + `bugs` split; a file's bug-or-task
  // nature now lives in its `type:` frontmatter, not in its folder.
  const results = {
    docs: scanDirectory(path.join(readmeDir, 'docs')),
    issues: scanDirectory(path.join(readmeDir, 'issues')),
    reports: scanDirectory(path.join(readmeDir, 'reports')),
  };

  return results;
};

// If running directly, write the manifest and report what was found.
if (require.main === module) {
  const results = scanMarkdownFiles();

  const outputPath = path.join(__dirname, 'markdownFiles.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  const sections = Object.entries(results);
  const total = sections.reduce((sum, [, files]) => sum + files.length, 0);
  console.log(`Scanned ${total} markdown files:`);
  sections.forEach(([section, files]) =>
    console.log(`  ${String(files.length).padStart(4)}  ${section}`)
  );

  // A file whose frontmatter failed to parse renders with no title, no type and
  // no state. That is invisible in the UI, so say it here instead.
  const broken = sections.flatMap(([section, files]) =>
    files.filter((f) => f.parseError).map((f) => ({ section, ...f }))
  );
  if (broken.length > 0) {
    console.warn(
      `\nWARNING: ${broken.length} file(s) have invalid YAML frontmatter and will render without metadata:`
    );
    broken.forEach((f) => console.warn(`  ${f.path}\n      ${f.parseError}`));
  }

  console.log(`\nResults written to: ${outputPath}`);
}

module.exports = { scanMarkdownFiles, scanDirectory };
