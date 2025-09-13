import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Input,
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

export const Docs: React.FC = () => {
  const { docId } = useParams<{ docId?: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);

  // Load markdown files dynamically
  const { files: docFiles, loading, error, findBySlug } = useMarkdownFiles('docs');

  const filteredFiles = useMemo(() => {
    return docFiles.filter(
      (file) =>
        file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.folder.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [docFiles, searchTerm]);

  const groupedFiles = useMemo(() => {
    const groups: Record<string, MarkdownFile[]> = {};
    filteredFiles.forEach((file) => {
      // Extract the full folder path from the file path for better grouping
      let folderName = 'root';
      if (file.path.includes('/')) {
        const pathParts = file.path.split('/');
        // Remove .readme, docs, and filename to get the folder structure
        const relevantParts = pathParts.slice(2, -1); // Skip ".readme/docs" and filename
        if (relevantParts.length > 0) {
          folderName = relevantParts.join('/');
        }
      }

      if (!groups[folderName]) {
        groups[folderName] = [];
      }
      groups[folderName].push(file);
    });
    return groups;
  }, [filteredFiles]);

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
      />
    );
  }

  return (
    <Container className="min-h-screen bg-app">
      <DevNavMenu currentPath={window.location.pathname} />
      <Container padding="lg" className="mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <FlexRow justify="center" gap="sm" className="mb-4">
            <Icon name="book" size="2xl" className="text-strong" />
            <Text as="h1" variant="strong" size="3xl" weight="bold">
              Documentation
            </Text>
          </FlexRow>
          <Text as="p" variant="main" size="lg" className="mb-2" align="center">
            Project Documentation & Guides
          </Text>
          <Text as="p" variant="subtle" align="center">
            Browse all documentation files from .readme/docs/
          </Text>
        </div>

        {/* Search */}
        <FlexRow gap="md" className="mb-6">
          <FlexColumn className="flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Search documentation..."
              variant="bordered"
              value={searchTerm}
              onChange={(value: string) => setSearchTerm(value)}
            />
          </FlexColumn>
        </FlexRow>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Total Documents
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {docFiles.length}
            </Text>
          </div>
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Categories
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {Object.keys(groupedFiles).length}
            </Text>
          </div>
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Matching Results
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {filteredFiles.length}
            </Text>
          </div>
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
              Loading documentation files...
            </Text>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 mb-8">
            <FlexRow gap="sm" align="center" className="mb-2">
              <Icon name="alert-triangle" size="md" className="text-danger" />
              <Text variant="strong" size="lg" className="text-danger">
                Error Loading Documentation
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

        {/* Document Groups */}
        {!loading && (
          <div className="space-y-8">
            {Object.entries(groupedFiles)
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
                          ? 'Documentation Root'
                          : folder
                              .split('/')
                              .map(
                                (part) =>
                                  part.charAt(0).toUpperCase() + part.slice(1)
                              )
                              .join(' / ')}
                      </Text>
                      <Text variant="subtle" size="sm">
                        ({files.length} files)
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
                              to={`/dev/docs/${file.slug}`}
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
                </div>
              ))}
          </div>
        )}

        {!loading && filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <Icon
              name="search"
              size="2xl"
              className="text-muted mx-auto mb-4"
            />
            <Text variant="subtle" size="lg">
              No documentation files found
            </Text>
            <Text variant="muted" size="sm">
              Try adjusting your search terms
            </Text>
          </div>
        )}
      </Container>
    </Container>
  );
};
