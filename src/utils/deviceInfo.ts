/**
 * Device detection utility for human-readable device name suggestions.
 * Uses privacy-first minimal fingerprinting (basic categorization only).
 */

function isElectron(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as any).electronAPI !== 'undefined';
}

function isMobileApp(): boolean {
  return typeof navigator !== 'undefined' &&
    navigator.product === 'ReactNative';
}

function detectOS(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'Windows';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

async function detectBrave(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as any;
  if (nav.brave && typeof nav.brave.isBrave === 'function') {
    try { return await nav.brave.isBrave(); } catch { /* ignore */ }
  }
  if (typeof nav.brave !== 'undefined') return true;
  if (/brave/i.test(navigator.userAgent)) return true;
  return false;
}

function detectBrowserSync(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Vivaldi/.test(ua)) return 'Vivaldi';
  if (/YaBrowser/.test(ua)) return 'Yandex';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/UCBrowser/.test(ua)) return 'UC Browser';
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Chrome/.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  return 'Browser';
}

/**
 * Returns a human-readable suggested device name.
 * Examples: "Desktop App (Windows)", "Chrome (macOS)", "Mobile App (iOS)"
 */
export async function getDeviceName(): Promise<string> {
  const os = detectOS();
  if (isElectron()) return `Desktop App (${os})`;
  if (isMobileApp()) return `Mobile App (${os})`;
  const isBrave = await detectBrave();
  const browser = isBrave ? 'Brave' : detectBrowserSync();
  return `${browser} (${os})`;
}

/**
 * Truncates an inbox address for display: first 4 chars + ... + last 4 chars.
 * Returns the address unchanged if it is 8 characters or shorter.
 */
export function truncateAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
