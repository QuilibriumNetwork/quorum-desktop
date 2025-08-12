import React, { useState, useRef } from 'react';
import { 
  ScrollView, 
  View, 
  Alert,
  TouchableOpacity,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  KeyboardAvoidingView,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paragraph, Text, Title } from '@/primitives';
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
    console.log('Sticker button clicked in MessageComposer!');
    const stickers = ['🌟', '🎭', '🎨', '🎪', '🎯', '🎲'];
    const stickerNames = ['Star', 'Theater', 'Art', 'Circus', 'Target', 'Dice'];
    
    Alert.alert(
      'Sticker Picker',
      'Choose a sticker to add to your message:',
      [
        { text: 'Cancel' },
        ...stickers.map((sticker, index) => ({
          text: `${sticker} ${stickerNames[index]}`,
          onPress: () => setMessage(prev => prev + sticker)
        }))
      ]
    );
  };

  // Handle real file selection from MessageComposer
  const handleFileSelect = (fileData: ArrayBuffer, fileType: string) => {
    console.log('Real file selected:', { size: fileData.byteLength, type: fileType });
    setFileData(fileData);
    setFileError(null);
  };

  // Handle file upload errors
  const handleFileError = (error: string) => {
    console.log('File upload error:', error);
    setFileError(error);
    setFileData(undefined);
  };

  const clearFile = () => {
    console.log('clearFile called - clearing file data');
    setFileData(undefined);
    setFileError(null);
  };

  // Dummy function that won't work in playground (requires user data context)
  const mapSenderToUser = () => {
    return { displayName: 'Test User' };
  };

  // Test scenarios for MessageComposer features that are handled internally
  const testScenarios = [
    {
      title: 'Reply',
      action: () => {
        console.log('Reply clicked');
        setInReplyTo({ 
          content: { 
            senderId: 'alice_crypto'
          }
        });
      }
    },
    {
      title: 'File Error',
      action: () => {
        console.log('File Error clicked');
        setFileError('File too large (max 10MB)');
      }
    },
    {
      title: 'Clear All',
      action: () => {
        console.log('Clear All clicked');
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 80}
      >
        <ScrollView 
          contentContainerStyle={[commonTestStyles.contentPadding, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled={true}
        >
          <View style={commonTestStyles.header}>
            <View style={{ alignItems: 'center' }}>
              <Title size="lg" weight="bold">
                MessageComposer Test
              </Title>
              <Paragraph align='center'>
                Test the native message composer with mobile-specific features
              </Paragraph>
            </View>
          </View>

          {/* Test Controls */}
          <View style={{ marginBottom: 24 }}>
            <Text size="lg" weight="semibold" style={{ marginBottom: 12 }}>
              Test Scenarios:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {testScenarios.map((scenario, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={scenario.action}
                  style={{ 
                    backgroundColor: theme.colors.surface[2],
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    flex: index < 2 ? 1 : 0,
                    minWidth: index === 2 ? 100 : undefined
                  }}
                  activeOpacity={0.7}
                >
                  <Text size="sm" weight="medium" style={{ textAlign: 'center' }}>
                    {scenario.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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

          {/* Spacer to push MessageComposer to bottom */}
          <View style={{ flex: 1 }} />
        </ScrollView>
        
        {/* MessageComposer Component - Fixed at bottom */}
        <View style={{
          backgroundColor: theme.colors.bg.chat,
          borderRadius: 12,
          paddingVertical: 16,
          paddingHorizontal: 8,
          marginHorizontal: 16,
          marginBottom: 16
        }}>
          <Text size="md" weight="semibold" style={{ marginBottom: 12, marginHorizontal: 8 }}>
            MessageComposer:
          </Text>
          
          <MessageComposer
            ref={composerRef}
            value={message}
            onChange={setMessage}
            placeholder="Message..."
            onFileSelect={handleFileSelect}
            fileData={fileData}
            clearFile={clearFile}
            onFileError={handleFileError}
            onSubmitMessage={handleSubmitMessage}
            onShowStickers={handleShowStickers}
            hasStickers={true}
            inReplyTo={inReplyTo}
            fileError={fileError}
            mapSenderToUser={mapSenderToUser}
            setInReplyTo={setInReplyTo}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};