import { StyleSheet } from 'react-native';

/**
 * Common styles shared across all mobile playground test screens
 *
 * Dynamic theme colors are still applied per-component via theme props
 * to maintain theme-awareness.
 */

export const commonTestStyles = StyleSheet.create({
  // === LAYOUT CONTAINERS ===
  container: {
    flex: 1,
    // backgroundColor applied dynamically via theme.colors.bg.app
  },

  contentPadding: {
    padding: 20,
  },

  contentPaddingCompact: {
    padding: 16,
  },

  // === HEADER PATTERNS ===
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },

  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  // === SECTION CARDS ===
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    // backgroundColor, borderColor, borderWidth applied dynamically via createThemedStyles()
  },

  // Simple section without card styling (used by IconTestScreen)
  sectionSimple: {
    marginBottom: 32,
  },

  sectionCompact: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    // backgroundColor, borderColor, borderWidth applied dynamically via createThemedStyles()
  },

  // === NOTES/INFO SECTIONS ===
  notesSection: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    // backgroundColor applied dynamically via theme.colors.surface[3]
  },

  infoSection: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    // backgroundColor applied dynamically via theme.colors.surface[3]
  },

  // === CONTENT GROUPING ===
  inputGroup: {
    marginBottom: 20,
  },

  subSection: {
    marginBottom: 20,
  },

  // === COMPONENT ROWS ===
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  buttonContainer: {
    marginBottom: 12,
  },

  // === GRID LAYOUTS ===
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

  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },

  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
  },

  colorItem: {
    alignItems: 'center',
    gap: 8,
  },

  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // === TEST/DEMO CONTAINERS ===
  testGroup: {
    padding: 12,
    borderRadius: 8,
    // backgroundColor applied dynamically via theme.colors.surface[3]
  },

  alignmentBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    // borderColor and backgroundColor applied dynamically via theme
  },

  // === SIZE/POSITIONING TESTS ===
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

  individualTest: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },

  // === BUTTON STYLES ===
  toggleButton: {
    marginTop: 12,
  },

  positionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
    // backgroundColor applied dynamically via theme.colors.surface[3]
  },

  // === TOOLTIP-SPECIFIC PATTERNS ===
  tooltipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    // backgroundColor applied dynamically
  },

  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor applied dynamically
  },

  positioningTestContainer: {
    paddingVertical: 16,
  },

  // === TEXT POSITIONING ===
  centerText: {
    textAlign: 'center',
  },

  // === SURFACE SAMPLE (ThemeTestScreen) ===
  surfaceSample: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    // backgroundColor applied dynamically
  },

  // === SPACING HELPERS ===
  marginBottom8: {
    marginBottom: 8,
  },

  marginBottom16: {
    marginBottom: 16,
  },

  marginBottom24: {
    marginBottom: 24,
  },

  marginTop8: {
    marginTop: 8,
  },

  marginTop12: {
    marginTop: 12,
  },

  marginLeft12: {
    marginLeft: 12,
  },

  marginRight12: {
    marginRight: 12,
  },

  // === APP-LEVEL NAVIGATION ===
  appContainer: {
    flex: 1,
    // backgroundColor applied dynamically via theme.colors.bg.app
  },

  backBar: {
    borderBottomWidth: 1,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    // backgroundColor and borderBottomColor applied dynamically via createThemedStyles()
  },

  backButtonContainer: {
    alignSelf: 'flex-start',
  },
});

// Factory function to create styles with theme colors
export const createThemedStyles = (theme: any) => {
  // Debug: uncomment to check theme values
  // console.log('Theme border colors:', theme.colors.border);

  return {
    section: {
      ...commonTestStyles.section,
      backgroundColor: theme.colors.bg.card,
      borderColor: theme.colors.border.default,
      borderWidth: 1,
    },
    sectionCompact: {
      ...commonTestStyles.sectionCompact,
      backgroundColor: theme.colors.bg.card,
      borderColor: theme.colors.border.default,
      borderWidth: 1,
    },
    infoSection: {
      ...commonTestStyles.infoSection,
      backgroundColor: theme.colors.surface[3],
      borderColor: theme.colors.border.default,
      borderWidth: 1,
    },
    notesSection: {
      ...commonTestStyles.notesSection,
      backgroundColor: theme.colors.surface[3],
      borderColor: theme.colors.border.default,
      borderWidth: 1,
    },
    backBar: {
      ...commonTestStyles.backBar,
      backgroundColor: theme.colors.bg.app,
      borderBottomColor: theme.colors.border.default,
    },
  };
};

// Helper to combine common styles with dynamic theme colors
export const withThemeColors = (baseStyle: any, themeColorStyle: any) => [
  baseStyle,
  themeColorStyle,
];
