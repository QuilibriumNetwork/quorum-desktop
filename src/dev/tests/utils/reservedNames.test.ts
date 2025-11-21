import { describe, it, expect } from 'vitest';
import {
  normalizeHomoglyphs,
  isImpersonationName,
  isEveryoneReserved,
  getReservedNameType,
  isReservedName,
} from '../../../utils/validation';

describe('Reserved Name Validation', () => {
  describe('normalizeHomoglyphs', () => {
    it('should convert homoglyph characters to letters', () => {
      expect(normalizeHomoglyphs('adm1n')).toBe('admin');
      expect(normalizeHomoglyphs('supp0rt')).toBe('support');
      expect(normalizeHomoglyphs('m0derat0r')).toBe('moderator');
      expect(normalizeHomoglyphs('@dmin')).toBe('admin');
      expect(normalizeHomoglyphs('$upport')).toBe('support');
      expect(normalizeHomoglyphs('adm!n')).toBe('admin');
    });

    it('should convert to lowercase', () => {
      expect(normalizeHomoglyphs('ADMIN')).toBe('admin');
      expect(normalizeHomoglyphs('AdMiN')).toBe('admin');
      expect(normalizeHomoglyphs('ADM1N')).toBe('admin');
    });

    it('should handle multiple homoglyphs', () => {
      expect(normalizeHomoglyphs('@DM1N')).toBe('admin');
      expect(normalizeHomoglyphs('$upp0r7')).toBe('support');
      expect(normalizeHomoglyphs('4dm1n1$7r470r')).toBe('administrator');
    });

    it('should not change normal text', () => {
      expect(normalizeHomoglyphs('john')).toBe('john');
      expect(normalizeHomoglyphs('alice')).toBe('alice');
    });
  });

  describe('isEveryoneReserved', () => {
    it('should block exact "everyone" match', () => {
      expect(isEveryoneReserved('everyone')).toBe(true);
      expect(isEveryoneReserved('Everyone')).toBe(true);
      expect(isEveryoneReserved('EVERYONE')).toBe(true);
      expect(isEveryoneReserved('  everyone  ')).toBe(true); // with whitespace
    });

    it('should allow phrases containing everyone', () => {
      expect(isEveryoneReserved('everyone loves me')).toBe(false);
      expect(isEveryoneReserved('hello everyone')).toBe(false);
      expect(isEveryoneReserved('everyones friend')).toBe(false);
    });

    it('should NOT apply homoglyph check for everyone', () => {
      expect(isEveryoneReserved('3very0ne')).toBe(false);
      expect(isEveryoneReserved('3v3ry0n3')).toBe(false);
    });
  });

  describe('isImpersonationName', () => {
    describe('exact matches', () => {
      it('should block exact reserved names', () => {
        expect(isImpersonationName('admin')).toBe(true);
        expect(isImpersonationName('administrator')).toBe(true);
        expect(isImpersonationName('moderator')).toBe(true);
        expect(isImpersonationName('support')).toBe(true);
      });

      it('should block with different cases', () => {
        expect(isImpersonationName('ADMIN')).toBe(true);
        expect(isImpersonationName('Admin')).toBe(true);
        expect(isImpersonationName('aDmIn')).toBe(true);
        expect(isImpersonationName('MODERATOR')).toBe(true);
        expect(isImpersonationName('SUPPORT')).toBe(true);
      });
    });

    describe('homoglyph detection', () => {
      it('should block homoglyph variations', () => {
        expect(isImpersonationName('adm1n')).toBe(true);
        expect(isImpersonationName('ADM1N')).toBe(true);
        expect(isImpersonationName('@dmin')).toBe(true);
        expect(isImpersonationName('supp0rt')).toBe(true);
        expect(isImpersonationName('m0derat0r')).toBe(true);
        expect(isImpersonationName('$upport')).toBe(true);
        expect(isImpersonationName('adm!n')).toBe(true);
      });

      it('should block complex homoglyph combinations', () => {
        expect(isImpersonationName('@DM1N')).toBe(true);
        expect(isImpersonationName('$upp0r7')).toBe(true);
      });
    });

    describe('word boundary detection', () => {
      it('should block when reserved word is at start with numbers/spaces', () => {
        expect(isImpersonationName('admin123')).toBe(true);
        expect(isImpersonationName('admin team')).toBe(true);
        expect(isImpersonationName('moderator Jim')).toBe(true);
        expect(isImpersonationName('support 24/7')).toBe(true);
      });

      it('should block when reserved word is at end', () => {
        expect(isImpersonationName('123admin')).toBe(true);
        expect(isImpersonationName('the admin')).toBe(true);
        expect(isImpersonationName('team moderator')).toBe(true);
      });

      it('should block homoglyph + word boundary combinations', () => {
        expect(isImpersonationName('adm1n team')).toBe(true);
        expect(isImpersonationName('supp0rt 24/7')).toBe(true);
        expect(isImpersonationName('m0derat0r123')).toBe(true);
      });
    });

    describe('allowed embedded words', () => {
      it('should allow reserved words embedded within other words', () => {
        expect(isImpersonationName('sysadmin')).toBe(false);
        expect(isImpersonationName('padministrator')).toBe(false);
        expect(isImpersonationName('supporting')).toBe(false);
        expect(isImpersonationName('unsupportive')).toBe(false);
      });

      it('should allow normal names', () => {
        expect(isImpersonationName('John')).toBe(false);
        expect(isImpersonationName('Alice')).toBe(false);
        expect(isImpersonationName('Vladimir')).toBe(false);
        expect(isImpersonationName('Jasmine')).toBe(false);
      });
    });
  });

  describe('getReservedNameType', () => {
    it('should return "everyone" for everyone match', () => {
      expect(getReservedNameType('everyone')).toBe('everyone');
      expect(getReservedNameType('Everyone')).toBe('everyone');
    });

    it('should return "impersonation" for impersonation names', () => {
      expect(getReservedNameType('admin')).toBe('impersonation');
      expect(getReservedNameType('adm1n')).toBe('impersonation');
      expect(getReservedNameType('moderator')).toBe('impersonation');
      expect(getReservedNameType('support')).toBe('impersonation');
    });

    it('should return null for allowed names', () => {
      expect(getReservedNameType('John')).toBe(null);
      expect(getReservedNameType('sysadmin')).toBe(null);
      expect(getReservedNameType('supporting')).toBe(null);
      expect(getReservedNameType('everyone loves me')).toBe(null);
    });
  });

  describe('isReservedName', () => {
    it('should return true for any reserved name', () => {
      expect(isReservedName('everyone')).toBe(true);
      expect(isReservedName('admin')).toBe(true);
      expect(isReservedName('adm1n')).toBe(true);
      expect(isReservedName('moderator team')).toBe(true);
    });

    it('should return false for allowed names', () => {
      expect(isReservedName('John')).toBe(false);
      expect(isReservedName('sysadmin')).toBe(false);
      expect(isReservedName('everyone loves me')).toBe(false);
    });
  });
});
