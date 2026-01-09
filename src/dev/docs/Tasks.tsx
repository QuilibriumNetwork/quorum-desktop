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

export const Tasks: React.FC = () => {
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);

  // Load markdown files dynamically
  const { files: taskFiles, loading, error, findBySlug } = useMarkdownFiles('tasks');

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
            <Icon name="clipboard-list" size="2xl" className="text-strong" />
            <Text as="h1" variant="strong" size="3xl" weight="bold">
              Tasks
            </Text>
          </FlexRow>
          <Text as="p" variant="main" size="lg" className="mb-2" align="center">
            Development Tasks & Implementation Plans
          </Text>
          <Text as="p" variant="subtle" align="center">
            Browse all task files from .agents/tasks/
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

        {/* Filterable Task List */}
        {!loading && (
          <FilterableList files={taskFiles} type="tasks" basePath="/dev/tasks" />
        )}
      </Container>
    </Container>
  );
};
