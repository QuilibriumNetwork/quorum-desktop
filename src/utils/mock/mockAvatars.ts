/**
 * Enhanced avatar generation for mock users
 * Creates diverse avatar templates while maintaining performance (limited API calls)
 */

import { DefaultImages } from '../../utils';

/**
 * Generate enhanced avatar templates with variety while keeping API calls minimal
 * Only generates the templates once, then cycles through them for all users
 */
function generateAvatarTemplates(): string[] {
  const backgrounds = [
    '007bff', '28a745', 'dc3545', 'ffc107', '6f42c1',
    '20c997', 'fd7e14', 'e83e8c', '6c757d', '17a2b8',
    '343a40', '495057', '6f42c1', 'e74c3c', '3498db',
    'f39c12', '27ae60', '8e44ad', 'e67e22', '2c3e50'
  ];

  const textColors = ['fff', '000'];
  const sizes = [40, 44]; // Slight size variations

  const templates: string[] = [DefaultImages.UNKNOWN_USER];

  // Create diverse combinations of background colors and initials
  backgrounds.forEach((bg, bgIndex) => {
    const textColor = textColors[bgIndex % textColors.length];
    const size = sizes[bgIndex % sizes.length];

    // Use index-based initials to create variety
    const letter1 = String.fromCharCode(65 + (bgIndex % 26)); // A-Z
    const letter2 = String.fromCharCode(65 + ((bgIndex + 13) % 26)); // Offset for variety
    const initials = letter1 + letter2;

    templates.push(
      `https://ui-avatars.com/api/?name=${initials}&background=${bg}&color=${textColor}&size=${size}&bold=true&rounded=true`
    );
  });

  return templates;
}

// Generate templates once when module loads
const AVATAR_TEMPLATES = generateAvatarTemplates();

/**
 * Get an avatar URL for a mock user by index
 * Cycles through pre-generated templates to avoid excessive API calls
 */
export function getMockAvatar(index: number): string {
  return AVATAR_TEMPLATES[index % AVATAR_TEMPLATES.length];
}

/**
 * Get the total number of available avatar templates
 */
export function getAvatarTemplateCount(): number {
  return AVATAR_TEMPLATES.length;
}

/**
 * Get all avatar templates (useful for debugging)
 */
export function getAllAvatarTemplates(): string[] {
  return [...AVATAR_TEMPLATES];
}