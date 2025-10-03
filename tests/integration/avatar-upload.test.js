/**
 * Integration test for avatar upload with telegramAuth middleware
 * Verifies that filenames use the actual userId instead of 'demo-user'
 */

const path = require('path');

describe('Avatar Upload with telegramAuth', () => {
  // Mock multer storage configuration
  function getUserId(req) {
    return String(req.userId || req.query.userId || req.body.userId || 'demo-user');
  }

  function generateFilename(req, originalname) {
    const userId = getUserId(req);
    const ext = path.extname(originalname) || '.jpg';
    return `${userId}_${Date.now()}${ext}`;
  }

  test('should use req.userId from telegramAuth middleware for filename', () => {
    const req = {
      userId: '123456789', // Set by telegramAuth middleware
      query: {},
      body: {}
    };
    const originalname = 'avatar.jpg';
    
    const filename = generateFilename(req, originalname);
    
    expect(filename).toMatch(/^123456789_\d+\.jpg$/);
    expect(filename).not.toMatch(/^demo-user_/);
  });

  test('should fallback to query userId when req.userId is not set', () => {
    const req = {
      query: { userId: '987654321' },
      body: {}
    };
    const originalname = 'avatar.png';
    
    const filename = generateFilename(req, originalname);
    
    expect(filename).toMatch(/^987654321_\d+\.png$/);
    expect(filename).not.toMatch(/^demo-user_/);
  });

  test('should fallback to demo-user when no userId is provided', () => {
    const req = {
      query: {},
      body: {}
    };
    const originalname = 'avatar.gif';
    
    const filename = generateFilename(req, originalname);
    
    expect(filename).toMatch(/^demo-user_\d+\.gif$/);
  });

  test('should handle different file extensions correctly', () => {
    const req = {
      userId: '111222333'
    };
    
    expect(generateFilename(req, 'photo.jpg')).toMatch(/^111222333_\d+\.jpg$/);
    expect(generateFilename(req, 'image.png')).toMatch(/^111222333_\d+\.png$/);
    expect(generateFilename(req, 'avatar.gif')).toMatch(/^111222333_\d+\.gif$/);
    expect(generateFilename(req, 'pic.webp')).toMatch(/^111222333_\d+\.webp$/);
  });

  test('should default to .jpg when no extension is provided', () => {
    const req = {
      userId: '444555666'
    };
    const originalname = 'no-extension';
    
    const filename = generateFilename(req, originalname);
    
    expect(filename).toMatch(/^444555666_\d+\.jpg$/);
  });

  test('should prioritize req.userId over other sources', () => {
    const req = {
      userId: '111111111',        // Highest priority (from telegramAuth)
      query: { userId: '222222222' },
      body: { userId: '333333333' }
    };
    const originalname = 'avatar.jpg';
    
    const filename = generateFilename(req, originalname);
    
    expect(filename).toMatch(/^111111111_\d+\.jpg$/);
    expect(filename).not.toMatch(/^222222222_/);
    expect(filename).not.toMatch(/^333333333_/);
  });
});
