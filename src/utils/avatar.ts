/**
 * Generates initials from a user's display name or address
 * @param fullName - User's display name or address
 * @returns Uppercase initials (1-2 characters) or "?" for empty input
 *
 * Behavior:
 * - Regular names: First letter of first 2 words ("John Doe" → "JD")
 * - Names starting with emoji: Only the first character ("😊 John" → "😊")
 * - Empty/whitespace: Returns "?"
 *
 * Note: Uses simple emoji detection - if more complex emoji handling is needed
 * (skin tones, ZWJ sequences, etc.), consider using a library like emoji-regex
 */
export const getInitials = (fullName: string): string => {
  if (!fullName?.trim()) return "?";

  const trimmed = fullName.trim();

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

  return initials || "?";
};

/**
 * Generates a consistent color for a user based on their address
 * Uses improved DJB2 hash algorithm for better distribution
 * @param address - User's address (for deterministic color)
 * @returns Hex color string
 */
export const getColorFromAddress = (address: string): string => {
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

  // Handle undefined or empty address - return first color
  if (!address || address.length === 0) {
    return colors[0];
  }

  // DJB2 hash algorithm for better distribution
  let hash = 5381;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) + hash) + address.charCodeAt(i); // hash * 33 + c
  }

  // Use unsigned right shift to ensure positive number
  return colors[(hash >>> 0) % colors.length];
};
