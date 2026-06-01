import { generateMockSpaces } from '../../../utils/mock/mockSpaces';

describe('generateMockSpaces', () => {
  it('returns the requested number of entries', () => {
    const result = generateMockSpaces(15);
    expect(result).toHaveLength(15);
  });

  it('returns DirectoryEntry-shaped objects', () => {
    const [entry] = generateMockSpaces(1);
    expect(entry).toMatchObject({
      space_address: expect.stringMatching(/^mock_space_\d{4}$/),
      name: expect.any(String),
      description: expect.any(String),
      icon: '',
      invite_link: expect.stringContaining('mock_'),
      category: expect.any(String),
      status: 'active',
      submitted_at: expect.any(Number),
      member_count: expect.any(Number),
    });
  });

  it('cycles through all 7 categories', () => {
    const entries = generateMockSpaces(14);
    const categories = new Set(entries.map((e) => e.category));
    expect(categories.size).toBe(7);
  });

  it('produces deterministic output for the same index', () => {
    const a = generateMockSpaces(5);
    const b = generateMockSpaces(5);
    expect(a).toEqual(b);
  });

  it('returns empty array when count is 0', () => {
    expect(generateMockSpaces(0)).toEqual([]);
  });
});
