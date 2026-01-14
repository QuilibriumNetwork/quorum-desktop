import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Input,
  Flex,
  Text,
  Icon,
} from '../../../components/primitives';
import { type MarkdownFile } from '../hooks/useMarkdownFiles';
import { type IconName } from '../../../components/primitives/Icon/types';

interface FilterOption {
  label: string;
  value: string;
  count: number;
}

// Icon mapping for status, complexity, and priority
function getStatusIcon(status: string): IconName {
  switch (status) {
    case 'done':
      return 'check-circle';
    case 'in-progress':
      return 'clock';
    case 'on-hold':
      return 'warning';
    case 'open':
      return 'circle';
    case 'archived':
      return 'history';
    default:
      return 'circle';
  }
}

function getComplexityIcon(complexity: string): IconName {
  switch (complexity) {
    case 'low':
      return 'check';
    case 'medium':
      return 'target';
    case 'high':
      return 'fire';
    case 'very-high':
      return 'fire';
    default:
      return 'target';
  }
}

function getPriorityIcon(priority: string): IconName {
  switch (priority) {
    case 'low':
      return 'arrow-down';
    case 'medium':
      return 'minus';
    case 'high':
      return 'arrow-up';
    case 'critical':
      return 'warning';
    default:
      return 'minus';
  }
}

interface FilterableListProps {
  files: MarkdownFile[];
  type: 'tasks' | 'bugs' | 'docs' | 'reports';
  basePath: string;
}

export const FilterableList: React.FC<FilterableListProps> = ({
  files,
  type,
  basePath,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Calculate available filters
  const filterOptions = useMemo(() => {
    const statuses: Record<string, number> = {};
    const complexities: Record<string, number> = {};
    const priorities: Record<string, number> = {};

    files.forEach((file) => {
      if (file.status) {
        statuses[file.status] = (statuses[file.status] || 0) + 1;
      }
      if (file.complexity) {
        complexities[file.complexity] = (complexities[file.complexity] || 0) + 1;
      }
      if (file.priority) {
        priorities[file.priority] = (priorities[file.priority] || 0) + 1;
      }
    });

    // Define status order: open → in-progress → on-hold → done → archived
    const statusOrder = ['open', 'in-progress', 'on-hold', 'done', 'archived'];
    const statusOptions: FilterOption[] = [
      { label: 'All', value: 'all', count: files.length },
      ...statusOrder
        .filter(status => statuses[status] > 0)
        .map(status => ({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          value: status,
          count: statuses[status],
        })),
    ];

    // Define complexity order: low → medium → high → very-high
    const complexityOrder = ['low', 'medium', 'high', 'very-high'];
    const complexityOptions: FilterOption[] = [
      { label: 'All', value: 'all', count: files.length },
      ...complexityOrder
        .filter(complexity => complexities[complexity] > 0)
        .map(complexity => ({
          label: complexity.charAt(0).toUpperCase() + complexity.slice(1),
          value: complexity,
          count: complexities[complexity],
        })),
    ];

    // Define priority order: low → medium → high → critical
    const priorityOrder = ['low', 'medium', 'high', 'critical'];
    const priorityOptions: FilterOption[] = [
      { label: 'All', value: 'all', count: files.length },
      ...priorityOrder
        .filter(priority => priorities[priority] > 0)
        .map(priority => ({
          label: priority.charAt(0).toUpperCase() + priority.slice(1),
          value: priority,
          count: priorities[priority],
        })),
    ];

    return { statusOptions, complexityOptions, priorityOptions };
  }, [files]);

  // Apply filters
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Search filter
      const matchesSearch =
        file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.path.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' || file.status === statusFilter;

      // Complexity filter (only for tasks)
      const matchesComplexity =
        complexityFilter === 'all' || file.complexity === complexityFilter;

      // Priority filter (only for bugs)
      const matchesPriority =
        priorityFilter === 'all' || file.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesComplexity && matchesPriority;
    });
  }, [files, searchTerm, statusFilter, complexityFilter, priorityFilter]);

  // Build hierarchical folder structure
  interface FolderNode {
    name: string;
    path: string;
    files: typeof filteredFiles;
    subfolders: FolderNode[];
  }

  const buildFolderTree = useMemo(() => {
    const root: FolderNode = {
      name: 'root',
      path: '',
      files: [],
      subfolders: []
    };

    filteredFiles.forEach((file) => {
      let folder = file.folder || 'root';

      if (folder === 'root') {
        // File belongs to root
        root.files.push(file);
        return;
      }

      const folderParts = folder.split('/');

      // Only exclude dot-prefixed folders if they're at the root level (first segment)
      // For example: ".done" → excluded, but "messagedb/.done" → kept
      if (folderParts.length === 1 && folderParts[0].startsWith('.')) {
        // Root-level dot folder (e.g., .done, .archived, .solved)
        // Add to root since these are for status filtering
        root.files.push(file);
        return;
      }

      // Navigate/create folder hierarchy and add file to the deepest folder
      let currentNode = root;
      let currentPath = '';

      folderParts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        // Find or create subfolder (including dot-prefixed if nested)
        let subfolder = currentNode.subfolders.find(sf => sf.name === part);
        if (!subfolder) {
          subfolder = {
            name: part,
            path: currentPath,
            files: [],
            subfolders: []
          };
          currentNode.subfolders.push(subfolder);
        }

        currentNode = subfolder;
      });

      // Add file to the deepest folder level
      currentNode.files.push(file);
    });

    // Sort files and subfolders alphabetically
    const sortNode = (node: FolderNode) => {
      node.files.sort((a, b) => a.title.localeCompare(b.title));
      node.subfolders.sort((a, b) => a.name.localeCompare(b.name));
      node.subfolders.forEach(sortNode);
    };

    sortNode(root);
    return root;
  }, [filteredFiles]);

  return (
    <div>
      {/* Filters Section */}
      <div className="bg-surface-1 rounded-lg border border-default p-4 mb-6">
        <Flex direction="column" gap="md">
          {/* Search */}
          <div>
            <Text variant="subtle" size="sm" weight="medium" className="mb-2">
              Search
            </Text>
            <Input
              type="text"
              placeholder={`Search ${type}...`}
              variant="bordered"
              value={searchTerm}
              onChange={(value: string) => setSearchTerm(value)}
            />
          </div>

          {/* Status Filter */}
          <div>
            <Text variant="subtle" size="sm" weight="medium" className="mb-2">
              Status
            </Text>
            <Flex gap="xs" className="flex-wrap">
              {filterOptions.statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                    statusFilter === option.value
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-main hover:bg-surface-3'
                  }`}
                >
                  {option.value !== 'all' && (
                    <Icon name={getStatusIcon(option.value)} size="sm" />
                  )}
                  {option.label} ({option.count})
                </button>
              ))}
            </Flex>
          </div>

          {/* Complexity Filter (only for tasks) */}
          {type === 'tasks' && filterOptions.complexityOptions.length > 1 && (
            <div>
              <Text variant="subtle" size="sm" weight="medium" className="mb-2">
                Complexity
              </Text>
              <Flex gap="xs" className="flex-wrap">
                {filterOptions.complexityOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setComplexityFilter(option.value)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                      complexityFilter === option.value
                        ? 'bg-accent text-white'
                        : 'bg-surface-2 text-main hover:bg-surface-3'
                    }`}
                  >
                    {option.value !== 'all' && (
                      <Icon name={getComplexityIcon(option.value)} size="sm" />
                    )}
                    {option.label} ({option.count})
                  </button>
                ))}
              </Flex>
            </div>
          )}

          {/* Priority Filter (only for bugs) */}
          {type === 'bugs' && filterOptions.priorityOptions.length > 1 && (
            <div>
              <Text variant="subtle" size="sm" weight="medium" className="mb-2">
                Priority
              </Text>
              <Flex gap="xs" className="flex-wrap">
                {filterOptions.priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPriorityFilter(option.value)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                      priorityFilter === option.value
                        ? 'bg-accent text-white'
                        : 'bg-surface-2 text-main hover:bg-surface-3'
                    }`}
                  >
                    {option.value !== 'all' && (
                      <Icon name={getPriorityIcon(option.value)} size="sm" />
                    )}
                    {option.label} ({option.count})
                  </button>
                ))}
              </Flex>
            </div>
          )}

          {/* Results count */}
          <div className="pt-2 border-t border-default">
            <Text variant="subtle" size="sm">
              Showing {filteredFiles.length} of {files.length} {type}
            </Text>
          </div>
        </Flex>
      </div>

      {/* List Section */}
      <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
        <div className="p-6">
          {filteredFiles.length > 0 ? (
            <div className="space-y-4">
              {/* Render root files first */}
              {buildFolderTree.files.length > 0 && (
                <ul className="space-y-2">
                  {buildFolderTree.files.map((file) => (
                    <li key={file.path}>
                      <Link
                        to={`${basePath}/${file.slug}`}
                        className="block hover:text-accent transition-colors"
                      >
                        <Flex gap="sm" align="center">
                          <Text variant="main" size="md">
                            • {file.title}
                          </Text>
                          {file.status && (
                            <span
                              className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getStatusStyle(
                                file.status
                              )}`}
                            >
                              <Icon name={getStatusIcon(file.status)} size="xs" />
                              {file.status}
                            </span>
                          )}
                          {file.complexity && (
                            <span
                              className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getComplexityStyle(
                                file.complexity
                              )}`}
                            >
                              <Icon name={getComplexityIcon(file.complexity)} size="xs" />
                              {file.complexity}
                            </span>
                          )}
                          {file.priority && (
                            <span
                              className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getPriorityStyle(
                                file.priority
                              )}`}
                            >
                              <Icon name={getPriorityIcon(file.priority)} size="xs" />
                              {file.priority}
                            </span>
                          )}
                        </Flex>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* Render folder tree recursively */}
              {buildFolderTree.subfolders.map((folder) => (
                <FolderView
                  key={folder.path}
                  folder={folder}
                  basePath={basePath}
                  level={0}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon
                name="search"
                size="2xl"
                className="text-muted mx-auto mb-4"
              />
              <Text variant="subtle" size="lg">
                No {type} found
              </Text>
              <Text variant="muted" size="sm">
                Try adjusting your filters
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Recursive component for rendering folders
interface FolderViewProps {
  folder: {
    name: string;
    path: string;
    files: MarkdownFile[];
    subfolders: any[];
  };
  basePath: string;
  level: number;
}

const FolderView: React.FC<FolderViewProps> = ({ folder, basePath, level }) => {
  const indent = level * 20; // 20px per nesting level

  return (
    <div style={{ marginLeft: `${indent}px` }} className="space-y-3">
      {/* Folder Header */}
      <div className="mb-2">
        <Flex gap="xs" align="center">
          <Icon name="folder" size="md" className="text-accent" />
          <Text variant="main" size="lg" weight="semibold" className="text-accent">
            {folder.name.charAt(0).toUpperCase() + folder.name.slice(1)}
          </Text>
        </Flex>
        <div className="h-px bg-border mt-1" />
      </div>

      {/* Files in this folder */}
      {folder.files.length > 0 && (
        <ul className="space-y-2 mb-4">
          {folder.files.map((file) => (
            <li key={file.path}>
              <Link
                to={`${basePath}/${file.slug}`}
                className="block hover:text-accent transition-colors"
              >
                <Flex gap="sm" align="center">
                  <Text variant="main" size="md">
                    • {file.title}
                  </Text>
                  {file.status && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getStatusStyle(
                        file.status
                      )}`}
                    >
                      <Icon name={getStatusIcon(file.status)} size="xs" />
                      {file.status}
                    </span>
                  )}
                  {file.complexity && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getComplexityStyle(
                        file.complexity
                      )}`}
                    >
                      <Icon name={getComplexityIcon(file.complexity)} size="xs" />
                      {file.complexity}
                    </span>
                  )}
                  {file.priority && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getPriorityStyle(
                        file.priority
                      )}`}
                    >
                      <Icon name={getPriorityIcon(file.priority)} size="xs" />
                      {file.priority}
                    </span>
                  )}
                </Flex>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Render subfolders recursively */}
      {folder.subfolders.map((subfolder) => (
        <FolderView
          key={subfolder.path}
          folder={subfolder}
          basePath={basePath}
          level={level + 1}
        />
      ))}
    </div>
  );
};

// Helper functions for styling
function getStatusStyle(status: string): string {
  switch (status) {
    case 'done':
      return 'bg-success/20 text-success border border-success/30';
    case 'in-progress':
      return 'bg-accent/20 text-accent border border-accent/30';
    case 'on-hold':
      return 'bg-warning/20 text-warning border border-warning/30';
    case 'open':
      return 'bg-surface-2 text-subtle border border-default';
    case 'archived':
      return 'bg-muted/20 text-muted border border-muted/30';
    default:
      return 'bg-surface-2 text-subtle border border-default';
  }
}

function getComplexityStyle(complexity: string): string {
  switch (complexity) {
    case 'low':
      return 'bg-success/20 text-success border border-success/30';
    case 'medium':
      return 'bg-accent/20 text-accent border border-accent/30';
    case 'high':
      return 'bg-warning/20 text-warning border border-warning/30';
    case 'very-high':
      return 'bg-danger/20 text-danger border border-danger/30';
    default:
      return 'bg-surface-2 text-subtle border border-default';
  }
}

function getPriorityStyle(priority: string): string {
  switch (priority) {
    case 'low':
      return 'bg-success/20 text-success border border-success/30';
    case 'medium':
      return 'bg-accent/20 text-accent border border-accent/30';
    case 'high':
      return 'bg-warning/20 text-warning border border-warning/30';
    case 'critical':
      return 'bg-danger/20 text-danger border border-danger/30';
    default:
      return 'bg-surface-2 text-subtle border border-default';
  }
}
