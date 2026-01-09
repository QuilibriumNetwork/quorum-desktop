import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FlexRow,
  Container,
  Text,
  Icon,
} from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
import { MarkdownViewer } from './MarkdownViewer';
import { FilterableList } from './components/FilterableList';
import { useMarkdownFiles, type MarkdownFile } from './hooks/useMarkdownFiles';

export const Reports: React.FC = () => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);

  // Load markdown files dynamically
  const { files: reportFiles, loading, error, findBySlug } = useMarkdownFiles('reports');

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
        file={selectedFile}
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

        {/* Filterable Reports List */}
        {!loading && (
          <FilterableList files={reportFiles} type="reports" basePath="/dev/reports" />
        )}
      </Container>
    </Container>
  );
};