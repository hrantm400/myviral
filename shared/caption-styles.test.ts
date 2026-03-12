import { describe, it, expect } from 'vitest';
import { getCaptionStyleById, CAPTION_STYLES } from './caption-styles';

describe('getCaptionStyleById', () => {
  it('should return the correct style for a valid ID', () => {
    const validId = 'capcut_yellow';
    const result = getCaptionStyleById(validId);

    // Check it returns the specific object
    const expectedStyle = CAPTION_STYLES.find(s => s.id === validId);
    expect(result).toBeDefined();
    expect(result).toEqual(expectedStyle);
    expect(result.id).toBe(validId);
  });

  it('should fall back to the default style (index 0) when given an invalid ID', () => {
    const invalidId = 'this_id_does_not_exist';
    const result = getCaptionStyleById(invalidId);

    expect(result).toBeDefined();
    expect(result).toEqual(CAPTION_STYLES[0]);
    expect(result.id).toBe(CAPTION_STYLES[0].id);
  });

  it('should fall back to the default style when given an empty string', () => {
    const emptyId = '';
    const result = getCaptionStyleById(emptyId);

    expect(result).toBeDefined();
    expect(result).toEqual(CAPTION_STYLES[0]);
  });

  it('should handle undefined input gracefully and return the default style', () => {
    // We cast to any to bypass TS type checking for this edge case test
    const undefinedId = undefined as any;
    const result = getCaptionStyleById(undefinedId);

    expect(result).toBeDefined();
    expect(result).toEqual(CAPTION_STYLES[0]);
  });

  it('should handle null input gracefully and return the default style', () => {
    // We cast to any to bypass TS type checking for this edge case test
    const nullId = null as any;
    const result = getCaptionStyleById(nullId);

    expect(result).toBeDefined();
    expect(result).toEqual(CAPTION_STYLES[0]);
  });
});
