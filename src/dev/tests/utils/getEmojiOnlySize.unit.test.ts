import { describe, it, expect } from 'vitest';
import { getEmojiOnlySize } from '../../../utils/remarkTwemoji';

describe('getEmojiOnlySize', () => {
  it('returns "single" for one emoji', () => {
    expect(getEmojiOnlySize('😀')).toBe('single');
  });

  it('returns "few" for two emoji', () => {
    expect(getEmojiOnlySize('😀😅')).toBe('few');
  });

  it('returns "few" for three emoji', () => {
    expect(getEmojiOnlySize('😀😅😂')).toBe('few');
  });

  it('returns null (normal size) for four emoji', () => {
    expect(getEmojiOnlySize('😀😅😂🤣')).toBeNull();
  });

  it('returns null for five or more emoji', () => {
    expect(getEmojiOnlySize('😀😅😂🤣😊')).toBeNull();
  });

  it('ignores surrounding and interleaved whitespace', () => {
    expect(getEmojiOnlySize('  😀  ')).toBe('single');
    expect(getEmojiOnlySize('😀 😅 😂')).toBe('few');
    expect(getEmojiOnlySize('\n😀\n')).toBe('single');
  });

  it('returns null when any non-emoji text is present', () => {
    expect(getEmojiOnlySize('hi 😀')).toBeNull();
    expect(getEmojiOnlySize('😀!')).toBeNull();
    expect(getEmojiOnlySize('😀 lol 😅')).toBeNull();
  });

  it('returns null for plain text with no emoji', () => {
    expect(getEmojiOnlySize('hello world')).toBeNull();
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(getEmojiOnlySize('')).toBeNull();
    expect(getEmojiOnlySize('   ')).toBeNull();
  });

  it('treats a ZWJ sequence as a single emoji', () => {
    // Family emoji (man + woman + girl + boy joined by ZWJ) is one entity.
    expect(getEmojiOnlySize('👨‍👩‍👧‍👦')).toBe('single');
  });

  it('treats a skin-tone modified emoji as a single emoji', () => {
    expect(getEmojiOnlySize('👍🏽')).toBe('single');
    expect(getEmojiOnlySize('👍🏽👋🏻')).toBe('few');
  });

  it('counts flag (regional indicator) emoji correctly', () => {
    expect(getEmojiOnlySize('🇺🇸')).toBe('single');
    expect(getEmojiOnlySize('🇺🇸🇮🇹')).toBe('few');
  });
});
