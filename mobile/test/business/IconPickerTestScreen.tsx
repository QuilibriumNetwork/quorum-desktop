import React, { useState } from 'react';
import { ScrollView, View, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  FlexRow,
  Text,
  Title,
  Button,
  Icon,
  Modal,
  Input,
} from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { commonTestStyles, createThemedStyles } from '@/styles/commonTestStyles';
import { IconPicker } from '@/components/space/IconPicker/IconPicker.native';
import type { IconName } from '@/primitives/Icon/types';
import type { IconColor } from '@/components/space/IconPicker/types';

export const IconPickerTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  // Modal state
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Form state for Channel Editor simulation
  const [channelName, setChannelName] = useState('general');
  const [channelTopic, setChannelTopic] = useState('General discussion for the team');
  const [channelIcon, setChannelIcon] = useState<IconName | null>('hashtag');
  const [channelIconColor, setChannelIconColor] = useState<IconColor>('blue');

  // Form state for Group Editor simulation
  const [groupName, setGroupName] = useState('Development');
  const [groupIcon, setGroupIcon] = useState<IconName | null>('code');
  const [groupIconColor, setGroupIconColor] = useState<IconColor>('purple');

  const handleChannelIconSelect = (icon: IconName | null, color: IconColor) => {
    setChannelIcon(icon);
    setChannelIconColor(color);
    console.log('Channel icon selected:', { icon, color });
  };

  const handleGroupIconSelect = (icon: IconName | null, color: IconColor) => {
    setGroupIcon(icon);
    setGroupIconColor(color);
    console.log('Group icon selected:', { icon, color });
  };

  const handleChannelSave = () => {
    Alert.alert(
      'Channel Saved',
      `Name: ${channelName}\nTopic: ${channelTopic}\nIcon: ${channelIcon || 'none'} (${channelIconColor})`,
      [{ text: 'OK' }]
    );
    setIsChannelModalOpen(false);
  };

  const handleGroupSave = () => {
    Alert.alert(
      'Group Saved',
      `Name: ${groupName}\nIcon: ${groupIcon || 'none'} (${groupIconColor})`,
      [{ text: 'OK' }]
    );
    setIsGroupModalOpen(false);
  };

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <Container style={themedStyles.section}>
          <Title>IconPicker Bottom Sheet Test</Title>
          <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
            Test the IconPicker in realistic bottom sheet modals that simulate how
            ChannelEditor and GroupEditor will work on mobile.
          </Text>
        </Container>

        {/* Trigger Buttons */}
        <Container style={themedStyles.section}>
          <Title size="h3">Test Bottom Sheets</Title>
          <Text style={{ color: theme.colors.text.subtle, marginBottom: 16 }}>
            These buttons open modals that simulate the real mobile experience
          </Text>

          <FlexColumn style={{ gap: 12 }}>
            <Button
              type="primary"
              onClick={() => {
                console.log('Opening Channel Modal...');
                setIsChannelModalOpen(true);
              }}
              style={{ width: '100%' }}
            >
              <FlexRow style={{ alignItems: 'center', gap: 8 }}>
                <Icon name="hashtag" size="sm" />
                <Text>Edit Channel</Text>
              </FlexRow>
            </Button>

            <Button
              type="secondary"
              onClick={() => {
                console.log('Opening Group Modal...');
                setIsGroupModalOpen(true);
              }}
              style={{ width: '100%' }}
            >
              <FlexRow style={{ alignItems: 'center', gap: 8 }}>
                <Icon name="folder" size="sm" />
                <Text>Edit Group</Text>
              </FlexRow>
            </Button>
          </FlexColumn>
        </Container>

        {/* Debug Info */}
        <Container style={themedStyles.section}>
          <Title size="h3">Debug Info</Title>
          <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
            Channel Modal Open: {isChannelModalOpen ? 'true' : 'false'}
          </Text>
          <Text style={{ color: theme.colors.text.subtle }}>
            Group Modal Open: {isGroupModalOpen ? 'true' : 'false'}
          </Text>
        </Container>

        {/* Current State Display */}
        <Container style={themedStyles.section}>
          <Title size="h3">Current Selections</Title>
          <FlexColumn style={{ gap: 12, marginTop: 12 }}>
            <FlexRow style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: 'bold', minWidth: 80 }}>Channel:</Text>
              {channelIcon ? (
                <FlexRow style={{ alignItems: 'center', gap: 8 }}>
                  <Icon name={channelIcon} size="sm" style={{ color: theme.colors.accent.DEFAULT }} />
                  <Text>{channelIcon} ({channelIconColor})</Text>
                </FlexRow>
              ) : (
                <Text style={{ color: theme.colors.text.subtle }}>None selected</Text>
              )}
            </FlexRow>

            <FlexRow style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: 'bold', minWidth: 80 }}>Group:</Text>
              {groupIcon ? (
                <FlexRow style={{ alignItems: 'center', gap: 8 }}>
                  <Icon name={groupIcon} size="sm" style={{ color: theme.colors.accent.DEFAULT }} />
                  <Text>{groupIcon} ({groupIconColor})</Text>
                </FlexRow>
              ) : (
                <Text style={{ color: theme.colors.text.subtle }}>None selected</Text>
              )}
            </FlexRow>
          </FlexColumn>
        </Container>

        {/* Theme Testing Info */}
        <Container style={themedStyles.section}>
          <Title size="h3">Theme Testing</Title>
          <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
            Current theme: {theme.resolvedTheme} | Accent: {theme.accent}
          </Text>
          <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
            Switch themes and accent colors in the app settings to test the IconPicker's
            appearance in different themes and color schemes.
          </Text>
        </Container>

        {/* Usage Notes */}
        <Container style={themedStyles.section}>
          <Title size="h3">Usage Notes</Title>
          <FlexColumn style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
              • Icons are organized by usage tiers (most common first)
            </Text>
            <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
              • Color selection affects all icons in the grid
            </Text>
            <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
              • "Clear Selection" removes both icon and resets color to default
            </Text>
            <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
              • Component is designed to fit in bottom sheets with scrollable content
            </Text>
            <Text style={{ color: theme.colors.text.subtle, marginTop: 8 }}>
              • All interactions are logged to console for debugging
            </Text>
          </FlexColumn>
        </Container>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Channel Editor Modal */}
      <Modal
        visible={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        title="Edit Channel"
        size="large"
      >
        <ScrollView style={{ maxHeight: 500 }}>
          <FlexColumn style={{ gap: 16, padding: 20 }}>
            {/* Channel Name Input */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Channel Name</Text>
              <Input
                value={channelName}
                onChange={setChannelName}
                placeholder="Enter channel name"
              />
            </View>

            {/* Channel Topic Input */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Channel Topic</Text>
              <Input
                value={channelTopic}
                onChange={setChannelTopic}
                placeholder="Enter channel topic"
                multiline
              />
            </View>

            {/* Channel Icon Section */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Channel Icon</Text>
              <IconPicker
                selectedIcon={channelIcon}
                selectedIconColor={channelIconColor}
                onIconSelect={handleChannelIconSelect}
                testID="channel-icon-picker"
              />
            </View>

            {/* Dummy Content Below */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Read Only</Text>
              <Text style={{ color: theme.colors.text.subtle }}>
                This channel is currently editable by all members
              </Text>
            </View>

            {/* Action Buttons */}
            <FlexRow style={{ gap: 12, marginTop: 20 }}>
              <Button
                type="secondary"
                onClick={() => setIsChannelModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleChannelSave}
                style={{ flex: 1 }}
              >
                Save Channel
              </Button>
            </FlexRow>
          </FlexColumn>
        </ScrollView>
      </Modal>

      {/* Group Editor Modal */}
      <Modal
        visible={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Edit Group"
        size="large"
      >
        <ScrollView style={{ maxHeight: 500 }}>
          <FlexColumn style={{ gap: 16, padding: 20 }}>
            {/* Group Name Input */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Group Name</Text>
              <Input
                value={groupName}
                onChange={setGroupName}
                placeholder="Enter group name"
              />
            </View>

            {/* Group Icon Section */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Group Icon (optional)</Text>
              <IconPicker
                selectedIcon={groupIcon}
                selectedIconColor={groupIconColor}
                onIconSelect={handleGroupIconSelect}
                testID="group-icon-picker"
              />
            </View>

            {/* Dummy Content Below */}
            <View>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Channels in this group</Text>
              <Text style={{ color: theme.colors.text.subtle }}>
                #general, #random, #development
              </Text>
            </View>

            {/* Action Buttons */}
            <FlexRow style={{ gap: 12, marginTop: 20 }}>
              <Button
                type="secondary"
                onClick={() => setIsGroupModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleGroupSave}
                style={{ flex: 1 }}
              >
                Save Group
              </Button>
            </FlexRow>
          </FlexColumn>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
};