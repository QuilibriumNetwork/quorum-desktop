import React, { useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  FlexRow,
  Text,
  Button,
  Icon,
  FileUpload,
  FileUploadFile,
} from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { commonTestStyles } from '@/styles/commonTestStyles';

export const FileUploadTestScreen: React.FC = () => {
  const theme = useTheme();
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFilesSelected = (files: FileUploadFile[]) => {
    setUploadedFiles(files);
    setUploadError(null);
    
    // Show success alert
    Alert.alert(
      'Files Selected',
      `Successfully selected ${files.length} file(s)`,
      [{ text: 'OK' }]
    );
  };

  const handleUploadError = (error: Error) => {
    setUploadError(error.message);
    Alert.alert('Upload Error', error.message, [{ text: 'OK' }]);
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setUploadError(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        {/* Header */}
        <View style={commonTestStyles.header}>
          <FlexColumn gap="xs" align="center">
            <Text size="2xl" weight="bold">
              FileUpload Primitive
            </Text>
            <Text size="sm" variant="subtle" align="center">
              Cross-platform file upload with native picker integration
            </Text>
          </FlexColumn>
        </View>

        {/* Image Upload Test */}
        <Container
          padding="lg"
          style={{
            backgroundColor: theme.colors.surface[2],
            marginBottom: 16,
          }}
        >
          <FlexColumn gap="md">
            <Text size="lg" weight="semibold">
              Image Upload
            </Text>
            <Text size="sm" variant="subtle">
              Test image selection with camera and photo library options
            </Text>

            <FileUpload
              accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] }}
              onFilesSelected={handleFilesSelected}
              onError={handleUploadError}
              maxSize={2 * 1024 * 1024} // 2MB
              showCameraOption={true}
              imageQuality={0.8}
              allowsEditing={true}
              testId="image-upload"
            >
              <View
                style={{
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: theme.colors.border.default,
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surface[1],
                }}
              >
                <Icon
                  name="file-image"
                  size="xl"
                  color={theme.colors.text.subtle}
                  style={{ marginBottom: 12 }}
                />
                <Text weight="medium" align="center" style={{ marginBottom: 8 }}>
                  Tap to select image
                </Text>
                <Text size="sm" variant="subtle" align="center">
                  Camera or Photo Library
                </Text>
                <Text size="sm" variant="subtle" align="center">
                  PNG, JPG, GIF up to 2MB
                </Text>
              </View>
            </FileUpload>
          </FlexColumn>
        </Container>

        {/* Document Upload Test */}
        <Container
          padding="lg"
          style={{
            backgroundColor: theme.colors.surface[2],
            marginBottom: 16,
          }}
        >
          <FlexColumn gap="md">
            <Text size="lg" weight="semibold">
              Document Upload
            </Text>
            <Text size="sm" variant="subtle">
              Test document selection with multiple file support
            </Text>

            <FileUpload
              accept={{ '*/*': [] }}
              multiple={true}
              onFilesSelected={handleFilesSelected}
              onError={handleUploadError}
              maxSize={10 * 1024 * 1024} // 10MB
              testId="document-upload"
            >
              <View
                style={{
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: theme.colors.border.default,
                  borderRadius: 12,
                  padding: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surface[1],
                }}
              >
                <Icon
                  name="file-image"
                  size="lg"
                  color={theme.colors.text.subtle}
                  style={{ marginBottom: 8 }}
                />
                <Text weight="medium" align="center" style={{ marginBottom: 4 }}>
                  Select any files
                </Text>
                <Text size="sm" variant="subtle" align="center">
                  Multiple files, up to 10MB each
                </Text>
              </View>
            </FileUpload>
          </FlexColumn>
        </Container>

        {/* Upload Results */}
        <Container
          padding="lg"
          style={{
            backgroundColor: theme.colors.surface[2],
            marginBottom: 16,
          }}
        >
          <FlexColumn gap="md">
            <FlexRow justify="between" align="center">
              <Text size="lg" weight="semibold">
                Upload Results
              </Text>
              {uploadedFiles.length > 0 && (
                <Button type="subtle" size="small" onClick={clearFiles}>
                  Clear All
                </Button>
              )}
            </FlexRow>

            {uploadError && (
              <Container
                padding="md"
                style={{
                  backgroundColor: theme.colors.utilities.danger + '20',
                  borderColor: theme.colors.utilities.danger,
                  borderWidth: 1,
                }}
              >
                <FlexRow gap="sm" align="start">
                  <Icon name="error" color={theme.colors.utilities.danger} />
                  <Text variant="error" size="sm" style={{ flex: 1 }}>
                    {uploadError}
                  </Text>
                </FlexRow>
              </Container>
            )}

            {uploadedFiles.length > 0 ? (
              <FlexColumn gap="sm">
                <Text weight="medium">
                  {uploadedFiles.length} file(s) selected:
                </Text>
                {uploadedFiles.map((file, index) => (
                  <Container
                    key={index}
                    padding="md"
                    style={{
                      backgroundColor: theme.colors.surface[3],
                      borderRadius: 8,
                    }}
                  >
                    <FlexColumn gap="xs">
                      <FlexRow gap="sm" align="center">
                        <Icon
                          name="file-image"
                          color={theme.colors.accent.DEFAULT}
                          size="sm"
                        />
                        <Text weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                          {file.name}
                        </Text>
                      </FlexRow>
                      <FlexRow justify="between">
                        <Text size="sm" variant="subtle">
                          Size: {formatFileSize(file.size)}
                        </Text>
                        <Text size="sm" variant="subtle">
                          Type: {file.type}
                        </Text>
                      </FlexRow>
                    </FlexColumn>
                  </Container>
                ))}
              </FlexColumn>
            ) : (
              <Container
                padding="lg"
                style={{
                  backgroundColor: theme.colors.surface[1],
                  alignItems: 'center',
                }}
              >
                <Icon
                  name="file-image"
                  color={theme.colors.text.muted}
                  size="lg"
                  style={{ marginBottom: 8 }}
                />
                <Text variant="muted" align="center">
                  No files selected yet
                </Text>
                <Text size="sm" variant="muted" align="center">
                  Use the upload areas above to test file selection
                </Text>
              </Container>
            )}
          </FlexColumn>
        </Container>

        {/* Test Information */}
        <Container
          padding="lg"
          style={{
            backgroundColor: theme.colors.surface[3],
          }}
        >
          <FlexColumn gap="md">
            <Text size="lg" weight="semibold">
              Native Implementation Details
            </Text>
            <FlexColumn gap="sm">
              <FlexRow gap="xs" align="start">
                <Text>•</Text>
                <Text size="sm" style={{ flex: 1 }}>
                  Uses react-native-image-picker for image selection
                </Text>
              </FlexRow>
              <FlexRow gap="xs" align="start">
                <Text>•</Text>
                <Text size="sm" style={{ flex: 1 }}>
                  Uses react-native-document-picker for document selection
                </Text>
              </FlexRow>
              <FlexRow gap="xs" align="start">
                <Text>•</Text>
                <Text size="sm" style={{ flex: 1 }}>
                  Supports camera and photo library for images
                </Text>
              </FlexRow>
              <FlexRow gap="xs" align="start">
                <Text>•</Text>
                <Text size="sm" style={{ flex: 1 }}>
                  File validation includes size and MIME type checking
                </Text>
              </FlexRow>
              <FlexRow gap="xs" align="start">
                <Text>•</Text>
                <Text size="sm" style={{ flex: 1 }}>
                  Platform permissions are requested automatically
                </Text>
              </FlexRow>
            </FlexColumn>
          </FlexColumn>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
};