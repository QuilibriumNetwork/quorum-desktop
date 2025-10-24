/**
 * Generates initials from a user's display name
 * @param displayName - User's display name (required, always present)
 * @returns Uppercase initials (1-2 characters)
 *
 * Behavior:
 * - Regular names: First letter of first 2 words ("John Doe" → "JD")
 * - Names starting with emoji: Only the first character ("😊 John" → "😊")
 *
 * Note: Uses simple emoji detection - if more complex emoji handling is needed
 * (skin tones, ZWJ sequences, etc.), consider using a library like emoji-regex
 */
export const getInitials = (displayName: string): string => {
  const trimmed = displayName.trim();

  // Use codePointAt on the original string to properly detect emojis
  // (emojis are often multi-byte UTF-16 surrogate pairs)
  const codePoint = trimmed.codePointAt(0) || 0;

  // Simple emoji detection: check if first char is in common emoji ranges
  // Covers ~99% of actual emoji usage without over-engineering
  // Performance: O(1) - constant time checks, extremely fast even for thousands of users
  const isEmoji = (
    // Modern emojis (most common)
    (codePoint >= 0x1F600 && codePoint <= 0x1F64F) || // Emoticons (😀-🙏)
    (codePoint >= 0x1F300 && codePoint <= 0x1F5FF) || // Misc Symbols (🌀-🗿)
    (codePoint >= 0x1F680 && codePoint <= 0x1F6FF) || // Transport (🚀-🛿)
    (codePoint >= 0x1F900 && codePoint <= 0x1F9FF) || // Supplemental (🤐-🧿)
    (codePoint >= 0x1FA70 && codePoint <= 0x1FAFF) || // Extended-A (🩰-🫶)
    // Older Unicode emojis (still commonly used)
    (codePoint >= 0x2600 && codePoint <= 0x26FF) ||   // Misc symbols (☀️-⛿)
    (codePoint >= 0x2700 && codePoint <= 0x27BF) ||   // Dingbats (✀-➿)
    // Special cases
    (codePoint >= 0x1F1E0 && codePoint <= 0x1F1FF)    // Regional indicators (flags 🇦-🇿)
  );

  // If starts with emoji, extract and return it properly
  // Use String.fromCodePoint to handle multi-byte emojis correctly
  if (isEmoji) {
    return String.fromCodePoint(codePoint);
  }

  // Standard initials: first letter of first 2 words
  const words = trimmed.split(/\s+/);
  const initials = words
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();

  return initials;
};

/**
 * Generates a consistent color for a user based on their display name
 * Uses improved DJB2 hash algorithm for better distribution
 * Privacy: Color is tied to display name, not address, preventing user fingerprinting
 * @param displayName - User's display name (for deterministic color)
 * @returns Hex color string
 */
export const getColorFromDisplayName = (displayName: string): string => {
  const colors = [
    // Blues
    '#3B82F6', // blue-500
    '#2563EB', // blue-600
    '#0EA5E9', // sky-500
    '#0284C7', // sky-600

    // Greens
    '#10B981', // green-500
    '#059669', // green-600
    '#14B8A6', // teal-500
    '#0D9488', // teal-600
    '#84CC16', // lime-500
    '#65A30D', // lime-600

    // Purples & Violets
    '#8B5CF6', // purple-500
    '#7C3AED', // violet-500
    '#6366F1', // indigo-500
    '#4F46E5', // indigo-600
    '#A855F7', // purple-600
    '#9333EA', // purple-700

    // Pinks & Reds
    '#EC4899', // pink-500
    '#DB2777', // pink-600
    '#F43F5E', // rose-500
    '#E11D48', // rose-600
    '#EF4444', // red-500
    '#DC2626', // red-600

    // Oranges & Yellows
    '#F59E0B', // amber-500
    '#D97706', // amber-600
    '#F97316', // orange-500
    '#EA580C', // orange-600

    // Magentas & Fuchsias
    '#D946EF', // fuchsia-500
    '#C026D3', // fuchsia-600
    '#E879F9', // fuchsia-400

    // Cyans & Aqua
    '#06B6D4', // cyan-500
    '#0891B2', // cyan-600
    '#22D3EE', // cyan-400
  ];

  // Normalize display name for consistent hashing (case-insensitive)
  const normalized = displayName.toLowerCase().trim();

  // DJB2 hash algorithm for better distribution
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i); // hash * 33 + c
  }

  // Use unsigned right shift to ensure positive number
  return colors[(hash >>> 0) % colors.length];
};

/**
 * Convert hex color to RGB values
 * @param hex - Hex color string (e.g., '#3B82F6')
 * @returns RGB values as [r, g, b] where each value is 0-255
 */
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
};

/**
 * Convert RGB to hex color
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string (e.g., '#3B82F6')
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Convert RGB to HSL
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns HSL values as [h, s, l] where h is 0-360, s and l are 0-100
 */
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
};

/**
 * Convert HSL to RGB
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns RGB values as [r, g, b] where each value is 0-255
 */
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r * 255, g * 255, b * 255];
};

/**
 * Lighten a hex color by a percentage
 * @param hex - Hex color string (e.g., '#3B82F6')
 * @param percent - Percentage to lighten (0-100)
 * @returns Lightened hex color string
 */
export const lightenColor = (hex: string, percent: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Increase lightness, capped at 100
  const newL = Math.min(100, l + percent);

  const [newR, newG, newB] = hslToRgb(h, s, newL);
  return rgbToHex(newR, newG, newB);
};

/**
 * Darken a hex color by a percentage
 * @param hex - Hex color string (e.g., '#3B82F6')
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color string
 */
export const darkenColor = (hex: string, percent: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Decrease lightness, capped at 0
  const newL = Math.max(0, l - percent);

  const [newR, newG, newB] = hslToRgb(h, s, newL);
  return rgbToHex(newR, newG, newB);
};
