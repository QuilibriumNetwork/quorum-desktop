import { describe, it, expect } from 'vitest';
import {
  normalizePrivateKeyHex,
  cleanHexKeyInput,
  isValidEd448HexKey,
  cleanAndValidateHexKey,
  ED448_PRIVATE_KEY_HEX_LENGTH,
} from '../../../utils/privateKey';

// A valid-shaped 114-char hex key (57 bytes). Content is arbitrary; only shape matters here.
const HEX_KEY = 'a'.repeat(ED448_PRIVATE_KEY_HEX_LENGTH);

describe('privateKey helpers', () => {
  describe('normalizePrivateKeyHex (export side)', () => {
    it('passes through a clean hex key', () => {
      expect(normalizePrivateKeyHex(HEX_KEY)).toBe(HEX_KEY);
    });

    it('strips a 0x prefix, whitespace, and lowercases', () => {
      const messy = `0X${HEX_KEY.toUpperCase()}`;
      expect(normalizePrivateKeyHex(messy)).toBe(HEX_KEY);
    });

    it('converts a legacy JSON { private_key: number[] } blob to hex', () => {
      const bytes = Array.from({ length: 57 }, () => 0xab); // 57 bytes -> "abab..." 114 chars
      const blob = JSON.stringify({ private_key: bytes });
      const expected = 'ab'.repeat(57);
      expect(normalizePrivateKeyHex(blob)).toBe(expected);
    });

    it('throws on a JSON blob without a private_key array', () => {
      expect(() => normalizePrivateKeyHex('{"foo":1}')).toThrow();
    });

    it('throws on a hex string of the wrong length', () => {
      expect(() => normalizePrivateKeyHex('dead')).toThrow();
    });
  });

  describe('cleanHexKeyInput', () => {
    it('strips 0x, whitespace (incl. newlines), and lowercases without validating length', () => {
      expect(cleanHexKeyInput('0xDE AD\nBE EF')).toBe('deadbeef');
    });
  });

  describe('isValidEd448HexKey', () => {
    it('accepts exactly 114 lowercase hex chars', () => {
      expect(isValidEd448HexKey(HEX_KEY)).toBe(true);
    });
    it('rejects wrong length', () => {
      expect(isValidEd448HexKey('a'.repeat(113))).toBe(false);
      expect(isValidEd448HexKey('a'.repeat(115))).toBe(false);
    });
    it('rejects non-hex / uppercase', () => {
      expect(isValidEd448HexKey('A'.repeat(114))).toBe(false);
      expect(isValidEd448HexKey('g'.repeat(114))).toBe(false);
    });
  });

  describe('cleanAndValidateHexKey (import side)', () => {
    it('cleans and returns valid pasted hex', () => {
      expect(cleanAndValidateHexKey(`0x ${HEX_KEY.toUpperCase()} `)).toBe(HEX_KEY);
    });

    it('throws on non-hex characters', () => {
      expect(() => cleanAndValidateHexKey('z'.repeat(114))).toThrow(/hexadecimal/);
    });

    it('throws with a length message when too short/long', () => {
      expect(() => cleanAndValidateHexKey('a'.repeat(113))).toThrow(/got 113/);
      expect(() => cleanAndValidateHexKey('a'.repeat(115))).toThrow(/got 115/);
    });
  });
});
