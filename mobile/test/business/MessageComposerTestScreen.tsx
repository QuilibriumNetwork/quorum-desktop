import React, { useState, useRef } from 'react';
import { 
  ScrollView, 
  View, 
  Alert,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  KeyboardAvoidingView,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Title, Button } from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { commonTestStyles } from '@/styles/commonTestStyles';
import { MessageComposer, MessageComposerRef } from '@/components/message/MessageComposer.native';

export const MessageComposerTestScreen: React.FC = () => {
  const theme = useTheme();
  const composerRef = useRef<MessageComposerRef>(null);

  // Test state
  const [message, setMessage] = useState('');
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);
  const [inReplyTo, setInReplyTo] = useState<any>(undefined);

  // Working functions that can be tested in playground

  const handleSubmitMessage = () => {
    // In real app, this would send the message to the channel/chat
    // The MessageComposer itself doesn't validate or show confirmations
    console.log('Submit message:', { message, hasFile: !!fileData });
    
    // Clear message after sending (like real chat behavior)
    if (message.trim() || fileData) {
      setMessage('');
      setFileData(undefined);
      setInReplyTo(undefined);
    }
  };

  const handleShowStickers = () => {
    Alert.alert('Stickers', 'Sticker picker would open here');
  };

  const handleFileSelect = () => {
    Alert.alert(
      'File Picker',
      'File picker would open here. Simulate adding a file?',
      [
        { text: 'Cancel' },
        { 
          text: 'Add Demo File', 
          onPress: () => {
            // Simulate file data
            const demoData = new ArrayBuffer(8);
            setFileData(demoData);
          }
        }
      ]
    );
  };

  const clearFile = () => {
    setFileData(undefined);
    setFileError(null);
  };

  // Dummy function that won't work in playground (requires user data context)
  const mapSenderToUser = () => {
    return { displayName: 'Test User' };
  };

  // Test scenarios
  const testScenarios = [
    {
      title: 'Add Reply',
      action: () => setInReplyTo({ 
        content: { senderId: 'user123' }
      })
    },
    {
      title: 'Add File Error',
      action: () => setFileError('File too large (max 10MB)')
    },
    {
      title: 'Add Long Text',
      action: () => setMessage('This is a very long message that should demonstrate the auto-resize functionality of the textarea component when typing multiple lines of text.')
    },
    {
      title: 'Focus Composer',
      action: () => composerRef.current?.focus()
    },
    {
      title: 'Clear All',
      action: () => {
        setMessage('');
        setFileData(undefined);
        setFileError(null);
        setInReplyTo(undefined);
      }
    }
  ];

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 80}
      >
        <ScrollView 
          contentContainerStyle={commonTestStyles.contentPadding}
          showsVerticalScrollIndicator={false}
        >
        <View style={commonTestStyles.header}>
          <View style={{ alignItems: 'center' }}>
            <Title size="xl" weight="bold" style={{ marginBottom: 4 }}>
              MessageComposer Test
            </Title>
            <Text size="sm" variant="subtle">
              Test the native message composer with mobile-specific features
            </Text>
          </View>
        </View>

        {/* Test Controls */}
        <View style={{ marginBottom: 24 }}>
          <Text size="lg" weight="semibold" style={{ marginBottom: 12 }}>
            Test Scenarios:
          </Text>
          <View>
            {testScenarios.map((scenario, index) => (
              <Button
                key={index}
                type="secondary"
                onPress={scenario.action}
                style={{ alignSelf: 'flex-start', marginBottom: 8 }}
              >
                {scenario.title}
              </Button>
            ))}
          </View>
        </View>

        {/* Current State Display */}
        <View style={{ 
          backgroundColor: theme.colors.bg.card,
          padding: 16,
          borderRadius: 8,
          marginBottom: 24
        }}>
          <Text size="md" weight="semibold" style={{ marginBottom: 8 }}>
            Current State:
          </Text>
          <Text size="sm">Message length: {message.length}</Text>
          <Text size="sm">Has file: {fileData ? 'Yes' : 'No'}</Text>
          <Text size="sm">Has reply: {inReplyTo ? 'Yes' : 'No'}</Text>
          <Text size="sm">Has error: {fileError ? 'Yes' : 'No'}</Text>
        </View>

        {/* Feature Highlights */}
        <View style={{ marginBottom: 24 }}>
          <Text size="lg" weight="semibold" style={{ marginBottom: 12 }}>
            Mobile Features to Test:
          </Text>
          <View>
            <Text size="sm" style={{ marginBottom: 4 }}>• Emoji/sticker buttons hide when textarea expands</Text>
            <Text size="sm" style={{ marginBottom: 4 }}>• Right arrow appears to collapse expanded textarea</Text>
            <Text size="sm" style={{ marginBottom: 4 }}>• KeyboardAvoidingView for mobile typing</Text>
            <Text size="sm" style={{ marginBottom: 4 }}>• Touch-optimized button sizes (32px)</Text>
            <Text size="sm">• Auto-resize textarea for multiline messages</Text>
          </View>
        </View>

        {/* MessageComposer Component */}
        <View style={{
          backgroundColor: theme.colors.bg.chat,
          borderRadius: 12,
          padding: 16,
          minHeight: 120
        }}>
          <Text size="md" weight="semibold" style={{ marginBottom: 12 }}>
            MessageComposer:
          </Text>
          
          <MessageComposer
            ref={composerRef}
            value={message}
            onChange={setMessage}
            placeholder="Type your message..."
            onFileSelect={handleFileSelect}
            fileData={fileData}
            clearFile={clearFile}
            onSubmitMessage={handleSubmitMessage}
            onShowStickers={handleShowStickers}
            hasStickers={true}
            inReplyTo={inReplyTo}
            fileError={fileError}
            mapSenderToUser={mapSenderToUser}
            setInReplyTo={setInReplyTo}
          />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};