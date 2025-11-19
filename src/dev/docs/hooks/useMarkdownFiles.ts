import { useState, useEffect, useMemo } from 'react';

export interface MarkdownFile {
  name: string;
  path: string;
  folder: string;
  title: string;
  slug: string; // URL-safe identifier
  status?: 'pending' | 'done' | 'archived' | 'active' | 'solved';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  content?: string;
}

// Import the generated data
import markdownFilesData from '../utils/markdownFiles.json';

// Utility to convert filename to title
const filenameToTitle = (filename: string): string => {
  return filename
    .replace('.md', '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/^(DONE|FAILED|SOLVED)_?/, ''); // Remove status prefixes
};

// Generate URL-safe slug from file path
const generateSlug = (path: string): string => {
  // Remove .agents prefix and .md extension
  let slug = path
    .replace(/^\.agents\//, '')
    .replace(/\.md$/, '')
    .toLowerCase();
  
  // Remove type prefix (docs/, tasks/, bugs/, reports/)
  slug = slug.replace(/^(docs|tasks|bugs|reports)\//, '');
  
  // Replace special characters and spaces with hyphens
  slug = slug
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  return slug;
};

// Determine status from filename or folder structure
const determineStatus = (
  path: string,
  filename: string,
  type: 'docs' | 'tasks' | 'bugs' | 'reports'
): MarkdownFile['status'] => {
  if (type === 'tasks') {
    // Check if it's in a .done folder or has status prefix
    if (path.includes('/.done/') || filename.startsWith('DONE_')) {
      return 'done';
    }
    // Check if it's in a .archived folder or has ARCHIVED prefix
    if (path.includes('/.archived/') || filename.startsWith('ARCHIVED_')) {
      return 'archived';
    }
    return 'pending';
  }

  if (type === 'bugs') {
    // Check if it's in .solved folder or has SOLVED prefix
    if (path.includes('/.solved/') || filename.startsWith('SOLVED_')) {
      return 'solved';
    }
    return 'active';
  }

  if (type === 'reports') {
    // Check if it's in .archive folder
    if (path.includes('/.archive/')) {
      return 'archived';
    }
    // Check if it's in .done folder (for backwards compatibility)
    if (path.includes('/.done/')) {
      return 'archived';
    }
    return 'active';
  }

  return undefined;
};

// Determine priority from filename (for bugs)
const determinePriority = (filename: string): MarkdownFile['priority'] => {
  const name = filename.toLowerCase();
  if (name.includes('critical') || name.includes('crash')) {
    return 'critical';
  }
  if (
    name.includes('high') ||
    name.includes('urgent') ||
    name.includes('important')
  ) {
    return 'high';
  }
  if (name.includes('low') || name.includes('minor')) {
    return 'low';
  }
  return 'medium'; // default
};

export const useMarkdownFiles = (type: 'docs' | 'tasks' | 'bugs' | 'reports') => {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoading(true);
        setError('');

        // Get the raw file data
        const rawFiles = (markdownFilesData as any)[type] || [];

        // Process the files with titles, status, and slugs
        const processedFiles: MarkdownFile[] = rawFiles.map((file: any) => ({
          name: file.name,
          path: file.path,
          folder: file.folder,
          title: filenameToTitle(file.name),
          slug: generateSlug(file.path),
          status: determineStatus(file.path, file.name, type),
          priority: type === 'bugs' ? determinePriority(file.name) : undefined,
        }));

        setFiles(processedFiles);
      } catch (err) {
        setError(
          `Error loading ${type} files: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [type]);

  // Helper to find a file by slug
  const findBySlug = (slug: string) => {
    return files.find(f => f.slug === slug);
  };

  return { files, loading, error, findBySlug };
};

// Hook for loading individual markdown file content
export const useMarkdownContent = (filePath: string) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadContent = async () => {
    if (!filePath) return;

    try {
      setLoading(true);
      setError('');

      // In development, fetch the actual markdown file
      // The Vite config allows serving .agents folder
      const response = await fetch(`/${filePath}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const markdownContent = await response.text();
      setContent(markdownContent);
    } catch (err) {
      console.error('Error loading markdown file:', err);
      setError(
        `Error loading file: ${err instanceof Error ? err.message : 'Unknown error'}`
      );

      // Fallback content with error info
      const fallbackContent = `# Error Loading File

**File Path:** ${filePath}

**Error:** ${err instanceof Error ? err.message : 'Unknown error'}

---

## Troubleshooting

This error typically occurs when:

1. **File doesn't exist** at the specified path
2. **Vite dev server** isn't configured to serve .agents folder
3. **Network error** preventing file fetch

## Current Setup

The dev dashboards are configured to read markdown files directly from your \`.agents\` folder using Vite's static file serving.

**Expected location:** \`${filePath}\``;

      setContent(fallbackContent);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, [filePath]);

  return { content, loading, error, reload: loadContent };
};
