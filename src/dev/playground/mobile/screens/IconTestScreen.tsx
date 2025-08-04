import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, useCrossPlatformTheme } from '../components/primitives';

export const IconTestScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const theme = useCrossPlatformTheme();
  const { colors } = theme;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface[0] }]}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 20,
      }}
    >
      <Text style={[styles.title, { color: colors.text.strong }]}>Icon</Text>
      <Text style={[styles.subtitle, { color: colors.text.subtle }]}>
        Cross-platform icon system using FontAwesome with unified API
      </Text>

      {/* Basic Icons */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          Basic Icons
        </Text>

        <View style={styles.iconGrid}>
          <View style={styles.iconItem}>
            <Icon name="check" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              check
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="times" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              times
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="user" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              user
            </Text>
          </View>
        </View>
      </View>

      {/* Theme Icons */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          Theme Icons
        </Text>

        <View style={styles.iconGrid}>
          <View style={styles.iconItem}>
            <Icon name="sun" color={theme.colors.utilities.warning} />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              sun
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="moon" color={theme.colors.accent[600]} />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              moon
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="desktop" color={theme.colors.text.subtle} />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              desktop
            </Text>
          </View>
        </View>
      </View>

      {/* Sizes */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          Icon Sizes
        </Text>

        <View style={styles.sizeRow}>
          <View style={styles.sizeItem}>
            <Icon name="heart" size="xs" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              xs (12px)
            </Text>
          </View>
          <View style={styles.sizeItem}>
            <Icon name="heart" size="sm" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              sm (14px)
            </Text>
          </View>
          <View style={styles.sizeItem}>
            <Icon name="heart" size="md" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              md (16px)
            </Text>
          </View>
          <View style={styles.sizeItem}>
            <Icon name="heart" size="lg" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              lg (20px)
            </Text>
          </View>
          <View style={styles.sizeItem}>
            <Icon name="heart" size="xl" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              xl (24px)
            </Text>
          </View>
          <View style={styles.sizeItem}>
            <Icon name="heart" size={32} />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              32px
            </Text>
          </View>
        </View>
      </View>

      {/* Actions & Communication */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          Actions & Communication
        </Text>

        <View style={styles.iconGrid}>
          <View style={styles.iconItem}>
            <Icon name="reply" color={theme.colors.utilities.success} />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              reply
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="trash" color={theme.colors.utilities.danger} />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              trash
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="link" color={theme.colors.accent[500]} />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              link
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="bell" disabled />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              bell (disabled)
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="envelope" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              envelope
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="clipboard" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              clipboard
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          Navigation Icons
        </Text>

        <View style={styles.iconGrid}>
          <View style={styles.iconItem}>
            <Icon name="chevron-left" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              chevron-left
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="chevron-right" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              chevron-right
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="arrow-up" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              arrow-up
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="arrow-down" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              arrow-down
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="home" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              home
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="menu" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              menu
            </Text>
          </View>
        </View>
      </View>

      {/* User & Social */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.main }]}>
          User & Social Icons
        </Text>

        <View style={styles.iconGrid}>
          <View style={styles.iconItem}>
            <Icon name="users" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              users
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="user-plus" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              user-plus
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="smile" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              smile
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="face-smile-beam" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              face-smile-beam
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="eye" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              eye
            </Text>
          </View>
          <View style={styles.iconItem}>
            <Icon name="eye-slash" />
            <Text style={[styles.iconLabel, { color: colors.text.subtle }]}>
              eye-slash
            </Text>
          </View>
        </View>
      </View>

      {/* Testing Notes */}
      <View style={[styles.notes, { backgroundColor: colors.surface[3] }]}>
        <Text style={[styles.notesTitle, { color: colors.text.strong }]}>
          📱 Mobile Icon Testing
        </Text>
        <Text style={[styles.notesText, { color: colors.text.main }]}>
          • Native: Uses react-native-vector-icons with FontAwesome font{'\n'}•
          Unified API: Same props work across web and mobile{'\n'}• Automatic
          theme integration with color system{'\n'}• 60+ icons mapped from
          comprehensive codebase audit{'\n'}• Touch-friendly sizing with
          semantic size options{'\n'}• Ready to replace placeholder characters
          in primitives{'\n'}• Perfect for ColorSwatch, RadioGroup, Modal,
          Tooltip close buttons
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  iconItem: {
    alignItems: 'center',
    width: 80,
    marginBottom: 16,
  },
  iconLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  notes: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
