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

export const Reports: React.FC = () => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['active'])
  ); // Active section open by default

  // Load markdown files dynamically
  const { files: reportFiles, loading, error, findBySlug } = useMarkdownFiles('reports');

  // Simple grouping: archived vs active
  const groupedFiles = useMemo(() => {
    const archived = reportFiles.filter((file) => file.status === 'archived');
    const active = reportFiles.filter((file) => file.status !== 'archived');

    return {
      active,
      archived,
    };
  }, [reportFiles]);

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
    if (reportId && !loading) {
      const file = findBySlug(reportId);
      if (file) {
        setSelectedFile(file);
      } else {
        // Invalid report ID, redirect to list
        navigate('/dev/reports', { replace: true });
      }
    } else {
      setSelectedFile(null);
    }
  }, [reportId, loading, findBySlug, navigate]);

  const handleBackToList = () => {
    navigate('/dev/reports');
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
            <Icon name="clipboard" size="2xl" className="text-strong" />
            <Text as="h1" variant="strong" size="3xl" weight="bold">
              Reports & Audits
            </Text>
          </FlexRow>
          <Text as="p" variant="main" size="lg" className="mb-2" align="center">
            Security Audits, Research & Analysis Reports
          </Text>
          <Text as="p" variant="subtle" align="center">
            Browse all reports from .agents/reports/
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
              Loading reports...
            </Text>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 mb-8">
            <FlexRow gap="sm" align="center" className="mb-2">
              <Icon name="alert-triangle" size="md" className="text-danger" />
              <Text variant="strong" size="lg" className="text-danger">
                Error Loading Reports
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

        {/* Report Groups */}
        {!loading && (
          <div className="space-y-6">
            {/* Active Reports Section */}
            <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
              <div className="bg-surface-2 px-6 py-4 border-b border-default">
                <FlexRow gap="sm" align="center" justify="between">
                  <FlexRow gap="sm" align="center">
                    <Icon
                      name="clipboard"
                      size="md"
                      className="text-accent"
                    />
                    <Text variant="strong" size="lg" weight="medium">
                      Active Reports
                    </Text>
                    <Text variant="subtle" size="sm">
                      ({groupedFiles.active.length} reports)
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
                        <Link
                          to={`/dev/reports/${file.slug}`}
                          className="block hover:text-accent transition-colors"
                        >
                          <Text variant="main" size="md">
                            • {file.title}
                          </Text>
                        </Link>
                      </li>
                    ))}
                </ul>

                {groupedFiles.active.length === 0 && (
                  <div className="text-center py-8">
                    <Text variant="subtle">No active reports found</Text>
                  </div>
                )}
              </div>
            </div>

            {/* Archived Reports Section - Collapsible */}
            <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
              <div
                onClick={() => toggleSection('archived')}
                className="w-full bg-surface-2 px-6 py-4 border-b border-default hover:bg-surface-3 transition-colors cursor-pointer"
              >
                <FlexRow gap="sm" align="center" justify="between">
                  <FlexRow gap="sm" align="center">
                    <Icon
                      name="archive"
                      size="md"
                      className="text-subtle"
                    />
                    <Text variant="strong" size="lg" weight="medium">
                      Archived Reports
                    </Text>
                    <Text variant="subtle" size="sm">
                      ({groupedFiles.archived.length} reports)
                    </Text>
                  </FlexRow>
                  <Icon
                    name={
                      expandedSections.has('archived')
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size="sm"
                    className="text-subtle"
                  />
                </FlexRow>
              </div>

              {expandedSections.has('archived') && (
                <div className="p-6">
                  <ul className="space-y-2 opacity-75">
                    {groupedFiles.archived
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map((file) => (
                        <li key={file.path}>
                          <Link
                            to={`/dev/reports/${file.slug}`}
                            className="block hover:text-accent transition-colors"
                          >
                            <Text variant="main" size="md">
                              • {file.title}
                            </Text>
                          </Link>
                        </li>
                      ))}
                  </ul>

                  {groupedFiles.archived.length === 0 && (
                    <div className="text-center py-8">
                      <Text variant="subtle">No archived reports found</Text>
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