import { useState, useEffect } from 'react';
import { FrontmatterData } from '../types/frontmatter';
import {
  deriveEpic,
  deriveState,
  issueSortDate,
  normalizeComplexity,
  normalizePriority,
  normalizeType,
  type IssueComplexity,
  type IssuePriority,
  type IssueState,
  type IssueType,
} from '../utils/issueTaxonomy';

/** The three trees the dev viewer browses. `.agents/issues/` replaced the old
 *  `tasks/` + `bugs/` split, so there is one issue section, not two. */
export type MarkdownSection = 'docs' | 'issues' | 'reports';

export interface MarkdownFile {
  name: string;
  path: string;
  folder: string;
  title: string;
  slug: string; // URL-safe identifier
  /** Issues: derived from the folder. Reports: active/archived. Docs: from frontmatter. */
  status?: IssueState | 'active';
  /** Issues only — the named epic folder this belongs to, if any. */
  epic?: string | null;
  /** Issues only — bug or task, from `type:` frontmatter. */
  issueType?: IssueType | null;
  priority?: IssuePriority;
  complexity?: IssueComplexity;
  /** Sort key for newest-first ordering; empty when the file carries no date. */
  sortDate?: string;
  content?: string;
  frontmatter?: FrontmatterData; // Extracted YAML frontmatter
  /** Set when the file's YAML could not be parsed, so its metadata is missing. */
  parseError?: string;
  created?: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
  ai_generated?: boolean;
  reviewed_by?: 'human' | 'agent' | null;
  related_issues?: string[];
  related_docs?: string[];
  related_tasks?: string[];
  related_bugs?: string[];
}

// Import the generated data
import markdownFilesData from '../utils/markdownFiles.json';

// Extract number prefix from filename (e.g., "001-" or "006:")
const extractNumberPrefix = (filename: string): string | null => {
  const match = filename.match(/^(\d{3,4})[-:]/);
  return match ? match[1] : null;
};

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

  // Remove section prefix (docs/, issues/, reports/)
  slug = slug.replace(/^(docs|issues|reports)\//, '');

  // Replace special characters and spaces with hyphens
  slug = slug
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  return slug;
};

/**
 * Status for the two sections that are not issues.
 *
 * Issues get theirs from `deriveState`, which knows the whole `.open/`,
 * `.deferred/`, `.done/`, `.archived/` vocabulary. Docs and reports have a much
 * smaller one: a report is current or it has been archived, and a doc simply
 * carries whatever its frontmatter says.
 */
const sectionStatus = (
  path: string,
  section: 'docs' | 'reports'
): MarkdownFile['status'] | undefined => {
  if (section === 'reports') {
    return path.includes('/.archived/') ||
      path.includes('/.archive/') ||
      path.includes('/.done/')
      ? 'archived'
      : 'active';
  }
  return undefined;
};

export const useMarkdownFiles = (section: MarkdownSection) => {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoading(true);
        setError('');

        // Get the raw file data
        const rawFiles = (markdownFilesData as any)[section] || [];

        // Process the files with titles, status, and slugs
        // Priority: Use frontmatter if exists, otherwise fall back to detection functions
        const processedFiles: MarkdownFile[] = rawFiles.map((file: any) => {
          // Get base title from frontmatter or filename
          let title = file.frontmatter?.title || filenameToTitle(file.name);

          // Preserve numbering from filename if not already in title
          const numberPrefix = extractNumberPrefix(file.name);
          if (numberPrefix && !title.match(/^\d{3,4}[:-]/)) {
            title = `${numberPrefix}: ${title}`;
          }

          const isIssue = section === 'issues';

          return {
            name: file.name,
            path: file.path,
            folder: file.folder,
            title,
            slug: generateSlug(file.path),
            status: isIssue
              ? deriveState(file.folder, file.frontmatter?.status)
              : file.frontmatter?.status ??
                sectionStatus(file.path, section as 'docs' | 'reports'),
            epic: isIssue ? deriveEpic(file.folder) : undefined,
            issueType: isIssue ? normalizeType(file.frontmatter?.type) : undefined,
            // Priority is read from frontmatter only. It used to be guessed from
            // words in the filename ("crash" => critical), which quietly graded
            // issues nobody had graded.
            priority: normalizePriority(file.frontmatter?.priority) ?? undefined,
            complexity:
              normalizeComplexity(file.frontmatter?.complexity) ?? undefined,
            sortDate: isIssue
              ? issueSortDate(file.frontmatter?.created, file.name)
              : undefined,
            frontmatter: file.frontmatter,
            parseError: file.parseError,
            created: file.frontmatter?.created,
            updated: file.frontmatter?.updated,
            ai_generated: file.frontmatter?.ai_generated,
            reviewed_by: file.frontmatter?.reviewed_by,
            related_issues: file.frontmatter?.related_issues,
            related_docs: file.frontmatter?.related_docs,
            related_tasks: file.frontmatter?.related_tasks,
            related_bugs: file.frontmatter?.related_bugs,
          };
        });

        setFiles(processedFiles);
      } catch (err) {
        setError(
          `Error loading ${section} files: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [section]);

  // Helper to find a file by slug
  const findBySlug = (slug: string) => {
    return files.find((f) => f.slug === slug);
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
