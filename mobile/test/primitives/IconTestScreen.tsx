import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, useTheme, Text, Paragraph, Title } from '@/primitives';
import { FlexRow, FlexColumn } from '@/primitives';
import { commonTestStyles } from '@/styles/commonTestStyles';

export const IconTestScreen: React.FC = () => {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="target" size="xl" style={{ marginTop: 2 }} />
            <Title>Icon</Title>
          </FlexRow>
          <Paragraph align="center">
            Cross-platform icon system using FontAwesome with unified API
          </Paragraph>
        </FlexColumn>

        {/* Basic Icons */}
        <FlexColumn style={commonTestStyles.sectionSimple}>
          <Title size="sm">Basic Icons</Title>

          <FlexRow wrap gap="md" style={commonTestStyles.iconGrid}>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="check" />
              <Text size="sm" variant="subtle">
                check
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="times" />
              <Text size="sm" variant="subtle">
                times
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="user" />
              <Text size="sm" variant="subtle">
                user
              </Text>
            </FlexColumn>
          </FlexRow>
        </FlexColumn>

        {/* Theme Icons */}
        <FlexColumn style={commonTestStyles.sectionSimple}>
          <Title size="sm">Theme Icons</Title>

          <FlexRow wrap gap="md" style={commonTestStyles.iconGrid}>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="sun" color={theme.colors.utilities.warning} />
              <Text size="xs" variant="subtle">
                sun
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="moon" color={theme.colors.accent[600]} />
              <Text size="xs" variant="subtle">
                moon
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="desktop" color={theme.colors.text.subtle} />
              <Text size="xs" variant="subtle">
                desktop
              </Text>
            </FlexColumn>
          </FlexRow>
        </FlexColumn>

        {/* Sizes */}
        <FlexColumn style={commonTestStyles.sectionSimple}>
          <Title size="sm">Icon Sizes</Title>

          <FlexRow
            wrap
            justify="between"
            align="center"
            style={commonTestStyles.sizeRow}
          >
            <FlexColumn align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="xs" />
              <Text size="xs" variant="subtle">
                xs (12px)
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="sm" />
              <Text size="xs" variant="subtle">
                sm (14px)
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="md" />
              <Text size="xs" variant="subtle">
                md (16px)
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="lg" />
              <Text size="xs" variant="subtle">
                lg (20px)
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size="xl" />
              <Text size="xs" variant="subtle">
                xl (24px)
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.sizeItem}>
              <Icon name="heart" size={32} />
              <Text size="xs" variant="subtle">
                32px
              </Text>
            </FlexColumn>
          </FlexRow>
        </FlexColumn>

        {/* Actions & Communication */}
        <FlexColumn style={commonTestStyles.sectionSimple}>
          <Title size="sm">Actions & Communication</Title>

          <FlexRow wrap gap="md" style={commonTestStyles.iconGrid}>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="reply" color={theme.colors.utilities.success} />
              <Text size="xs" variant="subtle">
                reply
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="trash" color={theme.colors.utilities.danger} />
              <Text size="xs" variant="subtle">
                trash
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="link" color={theme.colors.accent[500]} />
              <Text size="xs" variant="subtle">
                link
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="bell" disabled />
              <Text size="xs" variant="subtle">
                bell (disabled)
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="envelope" />
              <Text size="xs" variant="subtle">
                envelope
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="clipboard" />
              <Text size="xs" variant="subtle">
                clipboard
              </Text>
            </FlexColumn>
          </FlexRow>
        </FlexColumn>

        {/* Navigation */}
        <FlexColumn style={commonTestStyles.sectionSimple}>
          <Title size="sm">Navigation Icons</Title>

          <FlexRow wrap gap="md" style={commonTestStyles.iconGrid}>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="chevron-left" />
              <Text size="xs" variant="subtle">
                chevron-left
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="chevron-right" />
              <Text size="xs" variant="subtle">
                chevron-right
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="arrow-up" />
              <Text size="xs" variant="subtle">
                arrow-up
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="arrow-down" />
              <Text size="xs" variant="subtle">
                arrow-down
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="home" />
              <Text size="xs" variant="subtle">
                home
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="menu" />
              <Text size="xs" variant="subtle">
                menu
              </Text>
            </FlexColumn>
          </FlexRow>
        </FlexColumn>

        {/* User & Social */}
        <FlexColumn style={commonTestStyles.sectionSimple}>
          <Title size="sm">User & Social Icons</Title>

          <FlexRow wrap gap="md" style={commonTestStyles.iconGrid}>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="users" />
              <Text size="xs" variant="subtle">
                users
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="user-plus" />
              <Text size="xs" variant="subtle">
                user-plus
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="smile" />
              <Text size="xs" variant="subtle">
                smile
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="face-smile-beam" />
              <Text size="xs" variant="subtle">
                face-smile-beam
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="eye" />
              <Text size="xs" variant="subtle">
                eye
              </Text>
            </FlexColumn>
            <FlexColumn align="center" style={commonTestStyles.iconItem}>
              <Icon name="eye-slash" />
              <Text size="xs" variant="subtle">
                eye-slash
              </Text>
            </FlexColumn>
          </FlexRow>
        </FlexColumn>

        {/* Testing Notes */}
        <View
          style={[
            commonTestStyles.notesSection,
            { backgroundColor: colors.surface[3] },
          ]}
        >
          <Text size="base" weight="semibold" variant="strong">
            Mobile Icon Testing
          </Text>

          <FlexColumn gap="xs">
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Native: Uses react-native-vector-icons with FontAwesome font
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Unified API: Same props work across web and mobile
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Automatic theme integration with color system
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  60+ icons mapped from comprehensive codebase audit
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Touch-friendly sizing with semantic size options
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Ready to replace placeholder characters in primitives
                </Text>
              </View>
            </FlexRow>

            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Perfect for ColorSwatch, RadioGroup, Modal, Tooltip close
                  buttons
                </Text>
              </View>
            </FlexRow>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
