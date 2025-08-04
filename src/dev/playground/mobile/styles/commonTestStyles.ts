import { StyleSheet } from 'react-native';

/**
 * Common styles shared across all mobile playground test screens
 * 
 * This centralizes the repeated patterns found across test screens:
 * - Layout containers and content padding
 * - Header and title structures  
 * - Section cards with consistent shadows and spacing
 * - Input/component grouping patterns
 * - Grid layouts for icons and colors
 * - Notes/info sections
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    // backgroundColor applied dynamically via theme.colors.bg.card
  },

  sectionCompact: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    // backgroundColor applied dynamically via theme.colors.bg.card
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

  // === TEXT POSITIONING ===
  centerText: {
    textAlign: 'center',
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
});

// Helper to combine common styles with dynamic theme colors
export const withThemeColors = (
  baseStyle: any,
  themeColorStyle: any
) => [baseStyle, themeColorStyle];