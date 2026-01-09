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

export const Bugs: React.FC = () => {
  const { bugId } = useParams<{ bugId?: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);

  // Load markdown files dynamically
  const { files: bugFiles, loading, error, findBySlug } = useMarkdownFiles('bugs');

  // Handle URL-based navigation
  useEffect(() => {
    if (bugId && !loading) {
      const file = findBySlug(bugId);
      if (file) {
        setSelectedFile(file);
      } else {
        // Invalid bug ID, redirect to list
        navigate('/dev/bugs', { replace: true });
      }
    } else {
      setSelectedFile(null);
    }
  }, [bugId, loading, findBySlug, navigate]);

  const handleBackToList = () => {
    navigate('/dev/bugs');
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
            <Icon name="bug" size="2xl" className="text-strong" />
            <Text as="h1" variant="strong" size="3xl" weight="bold">
              Bug Reports
            </Text>
          </FlexRow>
          <Text as="p" variant="main" size="lg" className="mb-2" align="center">
            Bug Reports & Known Issues
          </Text>
          <Text as="p" variant="subtle" align="center">
            Browse all bug reports from .agents/bugs/
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

        {/* Filterable Bug List */}
        {!loading && (
          <FilterableList files={bugFiles} type="bugs" basePath="/dev/bugs" />
        )}
      </Container>
    </Container>
  );
};
