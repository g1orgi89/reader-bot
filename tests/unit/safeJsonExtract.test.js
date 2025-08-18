/**
 * Tests for safe JSON extraction utility
 */

const { safeJsonExtract, normalizeAnalysis } = require('../../server/services/quoteHandler');

describe('Safe JSON Extraction', () => {
  describe('safeJsonExtract', () => {
    test('should parse plain JSON', () => {
      const input = '{"category": "Мудрость", "themes": ["жизнь"], "sentiment": "positive", "insights": "Глубокая мысль"}';
      const result = safeJsonExtract(input);
      
      expect(result.category).toBe('Мудрость');
      expect(result.themes).toEqual(['жизнь']);
      expect(result.sentiment).toBe('positive');
      expect(result.insights).toBe('Глубокая мысль');
    });

    test('should extract JSON from markdown fences', () => {
      const input = `Here is the analysis:

\`\`\`json
{
  "category": "Философия",
  "themes": ["размышления", "мудрость"],
  "sentiment": "neutral",
  "insights": "Интересная перспектива"
}
\`\`\`

That's it!`;
      
      const result = safeJsonExtract(input);
      
      expect(result.category).toBe('Философия');
      expect(result.themes).toEqual(['размышления', 'мудрость']);
      expect(result.sentiment).toBe('neutral');
      expect(result.insights).toBe('Интересная перспектива');
    });

    test('should extract JSON from code fences without language', () => {
      const input = `Analysis complete:

\`\`\`
{
  "category": "Мотивация",
  "themes": ["успех"],
  "sentiment": "positive",
  "insights": "Мотивирующие слова"
}
\`\`\``;
      
      const result = safeJsonExtract(input);
      
      expect(result.category).toBe('Мотивация');
      expect(result.sentiment).toBe('positive');
    });

    test('should extract JSON by finding braces', () => {
      const input = `Some text before { "category": "Любовь", "themes": ["отношения"], "sentiment": "positive", "insights": "О любви" } and after`;
      
      const result = safeJsonExtract(input);
      
      expect(result.category).toBe('Любовь');
      expect(result.themes).toEqual(['отношения']);
    });

    test('should throw error for invalid input', () => {
      expect(() => safeJsonExtract(null)).toThrow();
      expect(() => safeJsonExtract('')).toThrow();
      expect(() => safeJsonExtract('no json here')).toThrow();
    });
  });

  describe('normalizeAnalysis', () => {
    test('should normalize valid analysis', () => {
      const input = {
        category: 'Саморазвитие',
        themes: ['рост', 'развитие', 'цели', 'планы', 'слишком много тем'],
        sentiment: 'positive',
        insights: 'Полезный анализ'
      };
      
      const result = normalizeAnalysis(input);
      
      expect(result.category).toBe('Саморазвитие');
      expect(result.themes).toEqual(['рост', 'развитие', 'цели']); // limited to 3
      expect(result.sentiment).toBe('positive');
      expect(result.insights).toBe('Полезный анализ');
    });

    test('should provide defaults for invalid data', () => {
      const input = {
        category: null,
        themes: 'not an array',
        sentiment: 'invalid',
        insights: null
      };
      
      const result = normalizeAnalysis(input);
      
      expect(result.category).toBe('Другое');
      expect(result.themes).toEqual(['размышления']);
      expect(result.sentiment).toBe('neutral');
      expect(result.insights).toBe('Интересная мысль для размышления');
    });

    test('should handle empty themes array', () => {
      const input = {
        category: 'Мудрость',
        themes: [],
        sentiment: 'neutral',
        insights: 'Test'
      };
      
      const result = normalizeAnalysis(input);
      
      expect(result.themes).toEqual(['размышления']);
    });
  });
});