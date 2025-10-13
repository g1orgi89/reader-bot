/**
 * Integration tests for the likes system
 */

const { normalizeQuoteField, computeNormalizedKey } = require('../../server/utils/quoteNormalizer');

describe('Quote Normalizer', () => {
  describe('normalizeQuoteField', () => {
    it('should normalize text by removing quotes and lowercasing', () => {
      const input = '"Hello World"';
      const expected = 'hello world';
      expect(normalizeQuoteField(input)).toBe(expected);
    });

    it('should unify dashes to hyphens', () => {
      const input = 'Hello — World – Test';
      const expected = 'hello - world - test';
      expect(normalizeQuoteField(input)).toBe(expected);
    });

    it('should collapse multiple spaces', () => {
      const input = 'Hello    World';
      const expected = 'hello world';
      expect(normalizeQuoteField(input)).toBe(expected);
    });

    it('should strip trailing dots', () => {
      const input = 'Hello World.';
      const expected = 'hello world';
      expect(normalizeQuoteField(input)).toBe(expected);
    });

    it('should strip trailing ellipsis', () => {
      const input = 'Hello World...';
      const expected = 'hello world';
      expect(normalizeQuoteField(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(normalizeQuoteField('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(normalizeQuoteField(null)).toBe('');
      expect(normalizeQuoteField(undefined)).toBe('');
    });

    it('should handle complex text with multiple normalizations', () => {
      const input = '«Hello — World»...   ';
      const expected = 'hello - world';
      expect(normalizeQuoteField(input)).toBe(expected);
    });
  });

  describe('computeNormalizedKey', () => {
    it('should create key with text and author', () => {
      const text = 'Hello World';
      const author = 'John Doe';
      const expected = 'hello world|||john doe';
      expect(computeNormalizedKey(text, author)).toBe(expected);
    });

    it('should handle empty author', () => {
      const text = 'Hello World';
      const expected = 'hello world|||';
      expect(computeNormalizedKey(text, '')).toBe(expected);
      expect(computeNormalizedKey(text)).toBe(expected);
    });

    it('should normalize both text and author', () => {
      const text = '"Hello World"...';
      const author = '— John Doe —';
      const expected = 'hello world|||- john doe -';
      expect(computeNormalizedKey(text, author)).toBe(expected);
    });

    it('should create same key for variations of same quote', () => {
      const key1 = computeNormalizedKey('"Hello World"', 'John Doe');
      const key2 = computeNormalizedKey('«Hello World»', 'John Doe');
      const key3 = computeNormalizedKey('Hello World...', 'John Doe');
      
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });
  });
});
