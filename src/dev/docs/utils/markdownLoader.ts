export interface MarkdownFile {
  name: string;
  path: string;
  folder: string;
  title: string;
  status?: 'pending' | 'done' | 'active' | 'solved';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  content?: string;
}

// Utility to convert filename to title
const filenameToTitle = (filename: string): string => {
  return filename
    .replace('.md', '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

// Determine status from filename or folder structure
const determineStatus = (
  path: string,
  type: 'docs' | 'tasks' | 'bugs'
): MarkdownFile['status'] => {
  if (type === 'tasks') {
    // Check if it's in a .done folder or has 'done' in the path
    if (path.includes('/.done/') || path.includes('-done.md')) {
      return 'done';
    }
    return 'pending';
  }

  if (type === 'bugs') {
    // Check if it's marked as solved (could be in filename or we'll determine from content)
    if (path.includes('solved') || path.includes('fixed')) {
      return 'solved';
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

// Since we can't directly access the filesystem in the browser, we'll need to
// implement this through an API endpoint or pre-build process
// For now, we'll create a function that would work with an API
export const loadMarkdownFiles = async (
  type: 'docs' | 'tasks' | 'bugs'
): Promise<MarkdownFile[]> => {
  try {
    // This would typically be an API call to scan the filesystem
    const response = await fetch(`/api/markdown/scan?type=${type}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${type} files`);
    }

    const files = (await response.json()) as Array<{
      name: string;
      path: string;
      folder: string;
    }>;

    return files.map((file) => ({
      ...file,
      title: filenameToTitle(file.name),
      status: determineStatus(file.path, type),
      priority: type === 'bugs' ? determinePriority(file.name) : undefined,
    }));
  } catch (error) {
    console.error(`Error loading ${type} files:`, error);

    // Fallback to hardcoded data for development
    return getHardcodedFiles(type);
  }
};

// Load markdown file content
export const loadMarkdownContent = async (
  filePath: string
): Promise<string> => {
  try {
    const response = await fetch(
      `/api/markdown/content?path=${encodeURIComponent(filePath)}`
    );
    if (!response.ok) {
      throw new Error('Failed to load markdown content');
    }
    return await response.text();
  } catch (error) {
    console.error('Error loading markdown content:', error);
    // Return placeholder content for development
    return `# File Not Found\n\n**Path:** ${filePath}\n\n*This file could not be loaded. In development, this would show the actual markdown content.*\n\n## Note\n\nTo fully implement this feature, you need to create API endpoints that can:\n1. Scan the .readme directory structure\n2. Read markdown file contents\n3. Return the data to the frontend\n\nAlternatively, you could use a build-time process to generate a manifest of all markdown files.`;
  }
};

// Hardcoded fallback data for development (same as before but organized)
const getHardcodedFiles = (type: 'docs' | 'tasks' | 'bugs'): MarkdownFile[] => {
  const allFiles = {
    docs: [
      {
        name: 'component-management-guide.md',
        path: '.readme/docs/component-management-guide.md',
        folder: 'root',
      },
      {
        name: 'cross-platform-components-guide.md',
        path: '.readme/docs/cross-platform-components-guide.md',
        folder: 'root',
      },
      {
        name: 'cross-platform-repository-implementation.md',
        path: '.readme/docs/cross-platform-repository-implementation.md',
        folder: 'root',
      },
      {
        name: 'data-management-architecture-guide.md',
        path: '.readme/docs/data-management-architecture-guide.md',
        folder: 'root',
      },
      {
        name: 'expo-dev-testing-guide.md',
        path: '.readme/docs/expo-dev-testing-guide.md',
        folder: 'root',
      },
      {
        name: 'space-roles.md',
        path: '.readme/docs/space-roles.md',
        folder: 'root',
      },
      {
        name: 'unused-dependencies-analysis.md',
        path: '.readme/docs/development/unused-dependencies-analysis.md',
        folder: 'development',
      },
      {
        name: 'cross-platform-key-backup.md',
        path: '.readme/docs/features/cross-platform-key-backup.md',
        folder: 'features',
      },
      {
        name: 'cross-platform-theming.md',
        path: '.readme/docs/features/cross-platform-theming.md',
        folder: 'features',
      },
      // ... add more as needed
    ],
    tasks: [
      {
        name: 'combined-text-image-messages.md',
        path: '.readme/tasks/combined-text-image-messages.md',
        folder: 'root',
      },
      {
        name: 'conversation-deletion-state-sync.md',
        path: '.readme/tasks/conversation-deletion-state-sync.md',
        folder: 'root',
      },
      {
        name: 'pinned-messages-feature.md',
        path: '.readme/tasks/pinned-messages-feature.md',
        folder: 'root',
      },
      {
        name: 'analysis.md',
        path: '.readme/tasks/css-refactor/analysis.md',
        folder: 'css-refactor',
      },
      // ... add more as needed
    ],
    bugs: [
      {
        name: 'brave-browser-react-hook-errors.md',
        path: '.readme/bugs/brave-browser-react-hook-errors.md',
        folder: 'root',
      },
      {
        name: 'joinspacemodal-invalid-json-network-error.md',
        path: '.readme/bugs/joinspacemodal-invalid-json-network-error.md',
        folder: 'root',
      },
      {
        name: 'messagedb-cross-platform-storage-issue.md',
        path: '.readme/bugs/messagedb-cross-platform-storage-issue.md',
        folder: 'root',
      },
      // ... add more as needed
    ],
  };

  return allFiles[type].map((file) => ({
    ...file,
    title: filenameToTitle(file.name),
    status: determineStatus(file.path, type),
    priority: type === 'bugs' ? determinePriority(file.name) : undefined,
  }));
};
