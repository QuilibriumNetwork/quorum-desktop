import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Flex,
  Icon,
} from '../../components/primitives';
import { DevPage, DevPageHeader } from '../shell';
import { MarkdownViewer } from './MarkdownViewer';
import { FilterableList } from './components/FilterableList';
import { useMarkdownFiles, type MarkdownFile } from './hooks/useMarkdownFiles';

export const Docs: React.FC = () => {
  const { docId } = useParams<{ docId?: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);

  // Load markdown files dynamically
  const { files: docFiles, loading, error, findBySlug } = useMarkdownFiles('docs');

  // Handle URL-based navigation
  useEffect(() => {
    if (docId && !loading) {
      const file = findBySlug(docId);
      if (file) {
        setSelectedFile(file);
      } else {
        // Invalid doc ID, redirect to list
        navigate('/dev/docs', { replace: true });
      }
    } else {
      setSelectedFile(null);
    }
  }, [docId, loading, findBySlug, navigate]);

  const handleBackToList = () => {
    navigate('/dev/docs');
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
    <DevPage>
        <DevPageHeader
          icon="book"
          title="Documentation"
          subtitle="Browse all documentation files from .agents/docs/"
        />

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Icon
              name="spinner"
              size="2xl"
              className="text-accent mx-auto mb-4"
            />
            <span className="text-lg text-main">
              Loading documentation files...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 mb-8">
            <Flex gap="sm" align="center" className="mb-2">
              <Icon name="warning" size="md" className="text-danger" />
              <span className="text-lg text-strong text-danger">
                Error Loading Documentation
              </span>
            </Flex>
            <span className="text-sm text-main mb-4">
              {error}
            </span>
            <span className="text-sm text-subtle">
              The system is using a placeholder implementation. To see real
              files, implement the markdown loading API or build process.
            </span>
          </div>
        )}

        {/* Filterable Documentation List */}
        {!loading && (
          <FilterableList files={docFiles} section="docs" basePath="/dev/docs" />
        )}
    </DevPage>
  );
};
