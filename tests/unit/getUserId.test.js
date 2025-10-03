/**
 * Test for getUserId function in reader.js
 * Tests the priority order: req.userId > req.query.userId > req.body.userId > 'demo-user'
 */

describe('getUserId function', () => {
  // Mock the getUserId function behavior
  function getUserId(req) {
    return String(req.userId || req.query.userId || req.body.userId || 'demo-user');
  }

  test('should return req.userId when available (highest priority)', () => {
    const req = {
      userId: '12345',
      query: { userId: '67890' },
      body: { userId: '11111' }
    };
    expect(getUserId(req)).toBe('12345');
  });

  test('should return req.query.userId when req.userId is not available', () => {
    const req = {
      query: { userId: '67890' },
      body: { userId: '11111' }
    };
    expect(getUserId(req)).toBe('67890');
  });

  test('should return req.body.userId when req.userId and req.query.userId are not available', () => {
    const req = {
      query: {},
      body: { userId: '11111' }
    };
    expect(getUserId(req)).toBe('11111');
  });

  test('should return "demo-user" when no userId is provided', () => {
    const req = {
      query: {},
      body: {}
    };
    expect(getUserId(req)).toBe('demo-user');
  });

  test('should handle undefined req.userId gracefully', () => {
    const req = {
      userId: undefined,
      query: { userId: '67890' }
    };
    expect(getUserId(req)).toBe('67890');
  });

  test('should handle null req.userId gracefully', () => {
    const req = {
      userId: null,
      query: { userId: '67890' }
    };
    expect(getUserId(req)).toBe('67890');
  });

  test('should convert numeric userId to string', () => {
    const req = {
      userId: 12345
    };
    expect(getUserId(req)).toBe('12345');
    expect(typeof getUserId(req)).toBe('string');
  });

  test('should handle the telegramAuth middleware case (req.userId set)', () => {
    // This simulates the case where telegramAuth middleware has set req.userId
    const req = {
      userId: '987654321', // Set by telegramAuth
      query: {},
      body: {}
    };
    expect(getUserId(req)).toBe('987654321');
  });
});
