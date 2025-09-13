import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Button,
  FlexRow,
  FlexColumn,
  Container,
  Text,
  Icon,
} from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
import { MarkdownViewer } from './MarkdownViewer';
import { useMarkdownFiles, type MarkdownFile } from './hooks/useMarkdownFiles';

export const Tasks: React.FC = () => {
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['pending'])
  ); // Keep all sections open except done

  // Load markdown files dynamically
  const { files: taskFiles, loading, error, findBySlug } = useMarkdownFiles('tasks');

  // Group files by folder, separating done from others
  const groupedFiles = useMemo(() => {
    const groups: Record<string, MarkdownFile[]> = {};
    const done: MarkdownFile[] = [];

    taskFiles.forEach((file) => {
      if (file.status === 'done') {
        done.push(file);
      } else {
        // Extract the full folder path from the file path for better grouping
        let folderName = 'root';
        if (file.path.includes('/')) {
          const pathParts = file.path.split('/');
          // Remove .readme, tasks, and filename to get the folder structure
          const relevantParts = pathParts.slice(2, -1); // Skip ".readme/tasks" and filename
          if (relevantParts.length > 0) {
            folderName = relevantParts.join('/');
          }
        }

        if (!groups[folderName]) {
          groups[folderName] = [];
        }
        groups[folderName].push(file);
      }
    });

    return {
      regular: groups,
      done,
    };
  }, [taskFiles]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Handle URL-based navigation
  useEffect(() => {
    if (taskId && !loading) {
      const file = findBySlug(taskId);
      if (file) {
        setSelectedFile(file);
      } else {
        // Invalid task ID, redirect to list
        navigate('/dev/tasks', { replace: true });
      }
    } else {
      setSelectedFile(null);
    }
  }, [taskId, loading, findBySlug, navigate]);

  const handleBackToList = () => {
    navigate('/dev/tasks');
  };

  if (selectedFile) {
    return (
      <MarkdownViewer
        filePath={selectedFile.path}
        onBack={handleBackToList}
        title={selectedFile.title}
      />
    );
  }

  return (
    <Container className="min-h-screen bg-app">
      <DevNavMenu currentPath={window.location.pathname} />
      <Container padding="lg" className="mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <FlexRow justify="center" gap="sm" className="mb-4">
            <Icon name="clipboard-list" size="2xl" className="text-strong" />
            <Text as="h1" variant="strong" size="3xl" weight="bold">
              Tasks
            </Text>
          </FlexRow>
          <Text as="p" variant="main" size="lg" className="mb-2" align="center">
            Development Tasks & Implementation Plans
          </Text>
          <Text as="p" variant="subtle" align="center">
            Browse all task files from .readme/tasks/
          </Text>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Icon
              name="loader"
              size="2xl"
              className="text-accent mx-auto mb-4"
            />
            <Text variant="main" size="lg">
              Loading tasks...
            </Text>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 mb-8">
            <FlexRow gap="sm" align="center" className="mb-2">
              <Icon name="alert-triangle" size="md" className="text-danger" />
              <Text variant="strong" size="lg" className="text-danger">
                Error Loading Tasks
              </Text>
            </FlexRow>
            <Text variant="main" size="sm" className="mb-4">
              {error}
            </Text>
            <Text variant="subtle" size="sm">
              The system is using a placeholder implementation. To see real
              files, implement the markdown loading API or build process.
            </Text>
          </div>
        )}

        {/* Task Groups */}
        {!loading && (
          <div className="space-y-6">
            {/* Regular Task Sections */}
            {Object.entries(groupedFiles.regular)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([folder, files]) => (
                <div
                  key={folder}
                  className="bg-surface-1 rounded-lg border border-default overflow-hidden"
                >
                  <div className="bg-surface-2 px-6 py-4 border-b border-default">
                    <FlexRow gap="sm" align="center">
                      <Icon name="folder" size="md" className="text-accent" />
                      <Text variant="strong" size="lg" weight="medium">
                        {folder === 'root'
                          ? 'Root Tasks'
                          : folder
                              .split('/')
                              .map(
                                (part) =>
                                  part.charAt(0).toUpperCase() + part.slice(1)
                              )
                              .join(' / ')}
                      </Text>
                      <Text variant="subtle" size="sm">
                        ({files.length} tasks)
                      </Text>
                    </FlexRow>
                  </div>

                  <div className="p-6">
                    <ul className="space-y-2">
                      {files
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((file) => (
                          <li key={file.path}>
                            <Link
                              to={`/dev/tasks/${file.slug}`}
                              className="block hover:text-accent transition-colors"
                            >
                              <Text variant="main" size="md">
                                • {file.title}
                              </Text>
                            </Link>
                          </li>
                        ))}
                    </ul>

                    {files.length === 0 && (
                      <div className="text-center py-8">
                        <Text variant="subtle">
                          No tasks found in this category
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* Done Tasks Section - Collapsible */}
            {groupedFiles.done.length > 0 && (
              <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
                <div
                  onClick={() => toggleSection('done')}
                  className="w-full bg-surface-2 px-6 py-4 border-b border-default hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  <FlexRow gap="sm" align="center" justify="between">
                    <FlexRow gap="sm" align="center">
                      <Icon
                        name="check-circle"
                        size="md"
                        className="text-success"
                      />
                      <Text variant="strong" size="lg" weight="medium">
                        Done
                      </Text>
                      <Text variant="subtle" size="sm">
                        ({groupedFiles.done.length} tasks)
                      </Text>
                    </FlexRow>
                    <Icon
                      name={
                        expandedSections.has('done')
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size="sm"
                      className="text-subtle"
                    />
                  </FlexRow>
                </div>

                {expandedSections.has('done') && (
                  <div className="p-6">
                    <ul className="space-y-2 opacity-75">
                      {groupedFiles.done
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((file) => (
                          <li key={file.path}>
                            <Link
                              to={`/dev/tasks/${file.slug}`}
                              className="block hover:text-accent transition-colors"
                            >
                              <Text variant="main" size="md">
                                • {file.title}
                              </Text>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Container>
    </Container>
  );
};
