/**
 * Generates initials from a user's display name
 * @param displayName - User's display name (required, always present)
 * @returns Uppercase initials (1-2 characters), or "?" for "Unknown User"
 *
 * Behavior:
 * - "Unknown User": Returns "?" (special case)
 * - Regular names: First letter of first 2 words ("John Doe" → "JD")
 * - Names starting with emoji: Only the first character ("😊 John" → "😊")
 *
 * Note: Uses simple emoji detection - if more complex emoji handling is needed
 * (skin tones, ZWJ sequences, etc.), consider using a library like emoji-regex
 */
export const getInitials = (displayName: string): string => {
  const trimmed = displayName.trim();

  // Special case: "Unknown User" should show "?" instead of "UU"
  if (trimmed === "Unknown User") {
    return "?";
  }

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
 * @returns Hex color string (pre-desaturated by 25% for subtle appearance)
 */
export const getColorFromDisplayName = (displayName: string): string => {
  // Pre-calculated desaturated colors (25% less saturation for subtle appearance)
  // Performance: Zero runtime cost - colors are hardcoded constants
  const colors = [
    // Blues
    '#5f8eeb', // blue-500 (desaturated)
    '#4970e0', // blue-600 (desaturated)
    '#42aad9', // sky-500 (desaturated)
    '#378dc0', // sky-600 (desaturated)

    // Greens
    '#40b589', // green-500 (desaturated)
    '#357671', // green-600 (desaturated)
    '#47b0a8', // teal-500 (desaturated)
    '#3d948e', // teal-600 (desaturated)
    '#8dbc4b', // lime-500 (desaturated)
    '#759b3d', // lime-600 (desaturated)

    // Purples & Violets
    '#9673ea', // purple-500 (desaturated)
    '#8858e1', // violet-500 (desaturated)
    '#7579e6', // indigo-500 (desaturated)
    '#6559da', // indigo-600 (desaturated)
    '#af6cf1', // purple-600 (desaturated)
    '#9e50dd', // purple-700 (desaturated)

    // Pinks & Reds
    '#e4649f', // pink-500 (desaturated)
    '#d14882', // pink-600 (desaturated)
    '#e85c76', // rose-500 (desaturated)
    '#d63e5c', // rose-600 (desaturated)
    '#e7615d', // red-500 (desaturated)
    '#d04545', // red-600 (desaturated)

    // Oranges & Yellows
    '#eba03f', // amber-500 (desaturated)
    '#ce8336', // amber-600 (desaturated)
    '#ec814a', // orange-500 (desaturated)
    '#dc6738', // orange-600 (desaturated)

    // Magentas & Fuchsias
    '#df65e4', // fuchsia-500 (desaturated)
    '#c54cc7', // fuchsia-600 (desaturated)
    '#e594ed', // fuchsia-400 (desaturated)

    // Cyans & Aqua
    '#3aafc9', // cyan-500 (desaturated)
    '#3393ae', // cyan-600 (desaturated)
    '#5dcce0', // cyan-400 (desaturated)
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

/**
 * Reduce saturation of a hex color by a percentage
 * @param hex - Hex color string (e.g., '#3B82F6')
 * @param percent - Percentage to reduce saturation (0-100)
 * @returns Desaturated hex color string
 */
const desaturateColor = (hex: string, percent: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Reduce saturation by percentage, capped at 0
  const newS = Math.max(0, s - percent);

  const [newR, newG, newB] = hslToRgb(h, newS, l);
  return rgbToHex(newR, newG, newB);
};
