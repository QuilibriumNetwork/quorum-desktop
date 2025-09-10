// Node.js utility to scan markdown files from .readme directory
// This can be run as a build step or used in an API endpoint

const fs = require('fs');
const path = require('path');

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
      const subFiles = scanDirectory(fullPath, item);
      files.push(...subFiles);
    } else if (item.endsWith('.md')) {
      // Add markdown files
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      files.push({
        name: item,
        path: relativePath,
        folder: baseFolder || 'root',
      });
    }
  }
  
  return files;
};

const scanMarkdownFiles = () => {
  const readmeDir = path.join(process.cwd(), '.readme');
  
  const results = {
    docs: scanDirectory(path.join(readmeDir, 'docs')),
    tasks: scanDirectory(path.join(readmeDir, 'tasks')),
    bugs: scanDirectory(path.join(readmeDir, 'bugs')),
  };
  
  return results;
};

// If running directly, output the results
if (require.main === module) {
  const results = scanMarkdownFiles();
  console.log('Found markdown files:');
  console.log(JSON.stringify(results, null, 2));
  
  // Optionally write to a JSON file for the frontend to consume
  const outputPath = path.join(__dirname, 'markdownFiles.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results written to: ${outputPath}`);
}

module.exports = { scanMarkdownFiles, scanDirectory };