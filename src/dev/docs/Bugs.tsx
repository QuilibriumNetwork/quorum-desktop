import React, { useState, useMemo } from 'react';
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

export const Bugs: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['active'])
  ); // Active section open by default

  // Load markdown files dynamically
  const { files: bugFiles, loading, error } = useMarkdownFiles('bugs');

  // Simple grouping: solved vs active
  const groupedFiles = useMemo(() => {
    const solved = bugFiles.filter((file) => file.status === 'solved');
    const active = bugFiles.filter((file) => file.status !== 'solved');

    return {
      active,
      solved,
    };
  }, [bugFiles]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleFileClick = (file: MarkdownFile) => {
    setSelectedFile(file);
  };

  const handleBackToList = () => {
    setSelectedFile(null);
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
            <Icon name="bug" size="2xl" className="text-strong" />
            <Text as="h1" variant="strong" size="3xl" weight="bold">
              Bug Reports
            </Text>
          </FlexRow>
          <Text as="p" variant="main" size="lg" className="mb-2" align="center">
            Bug Reports & Known Issues
          </Text>
          <Text as="p" variant="subtle" align="center">
            Browse all bug reports from .readme/bugs/
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
              Loading bug reports...
            </Text>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 mb-8">
            <FlexRow gap="sm" align="center" className="mb-2">
              <Icon name="alert-triangle" size="md" className="text-danger" />
              <Text variant="strong" size="lg" className="text-danger">
                Error Loading Bug Reports
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

        {/* Bug Groups */}
        {!loading && (
          <div className="space-y-6">
            {/* Active Bugs Section */}
            <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
              <div className="bg-surface-2 px-6 py-4 border-b border-default">
                <FlexRow gap="sm" align="center" justify="between">
                  <FlexRow gap="sm" align="center">
                    <Icon
                      name="alert-circle"
                      size="md"
                      className="text-danger"
                    />
                    <Text variant="strong" size="lg" weight="medium">
                      Active
                    </Text>
                    <Text variant="subtle" size="sm">
                      ({groupedFiles.active.length} issues)
                    </Text>
                  </FlexRow>
                </FlexRow>
              </div>

              <div className="p-6">
                <ul className="space-y-2">
                  {groupedFiles.active
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((file) => (
                      <li key={file.path}>
                        <div
                          className="hover:text-accent transition-colors cursor-pointer"
                          onClick={() => handleFileClick(file)}
                        >
                          <Text variant="main" size="md">
                            • {file.title}
                          </Text>
                        </div>
                      </li>
                    ))}
                </ul>

                {groupedFiles.active.length === 0 && (
                  <div className="text-center py-8">
                    <Text variant="subtle">No active bugs found</Text>
                  </div>
                )}
              </div>
            </div>

            {/* Solved Bugs Section - Collapsible */}
            <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
              <div
                onClick={() => toggleSection('solved')}
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
                      Solved
                    </Text>
                    <Text variant="subtle" size="sm">
                      ({groupedFiles.solved.length} issues)
                    </Text>
                  </FlexRow>
                  <Icon
                    name={
                      expandedSections.has('solved')
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size="sm"
                    className="text-subtle"
                  />
                </FlexRow>
              </div>

              {expandedSections.has('solved') && (
                <div className="p-6">
                  <ul className="space-y-2 opacity-75">
                    {groupedFiles.solved
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map((file) => (
                        <li key={file.path}>
                          <div
                            className="hover:text-accent transition-colors cursor-pointer"
                            onClick={() => handleFileClick(file)}
                          >
                            <Text variant="main" size="md">
                              • {file.title}
                            </Text>
                          </div>
                        </li>
                      ))}
                  </ul>

                  {groupedFiles.solved.length === 0 && (
                    <div className="text-center py-8">
                      <Text variant="subtle">No solved bugs found</Text>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Container>
    </Container>
  );
};
