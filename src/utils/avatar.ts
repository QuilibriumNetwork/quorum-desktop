/**
 * Generates initials from a user's display name or address
 * @param fullName - User's display name or address
 * @returns Uppercase initials (1-2 characters) or "?" for empty input
 */
export const getInitials = (fullName: string): string => {
  if (!fullName) return "?";

  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2) // Take first 2 words
    .map(word => word[0])
    .join("")
    .toUpperCase();
};

/**
 * Generates a consistent color for a user based on their address
 * Uses improved DJB2 hash algorithm for better distribution
 * @param address - User's address (for deterministic color)
 * @returns Hex color string
 */
export const getColorFromAddress = (address: string): string => {
  const colors = [
    '#3B82F6', // bg-blue-500
    '#10B981', // bg-green-500
    '#8B5CF6', // bg-purple-500
    '#EC4899', // bg-pink-500
    '#6366F1', // bg-indigo-500
    '#14B8A6', // bg-teal-500
    '#F59E0B', // bg-orange-500
    '#EF4444', // bg-red-500
    '#F97316', // bg-orange-600
    '#06B6D4', // bg-cyan-500
    '#7C3AED', // bg-violet-500 (fixed duplicate)
    '#D946EF', // bg-fuchsia-500
    '#84CC16', // bg-lime-500
    '#F43F5E', // bg-rose-500
    '#0EA5E9', // bg-sky-500
    '#A855F7', // bg-purple-600
  ];

  // DJB2 hash algorithm for better distribution
  let hash = 5381;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) + hash) + address.charCodeAt(i); // hash * 33 + c
  }

  // Use unsigned right shift to ensure positive number
  return colors[(hash >>> 0) % colors.length];
};
