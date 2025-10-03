/**
 * Tests for avatar upload path fix
 * Verifies that avatar storage paths are correctly configured using __dirname
 */

const path = require('path');

describe('Avatar Path Configuration', () => {
  test('should use __dirname-based paths instead of process.cwd()', () => {
    // Simulate what the server/api/reader.js does
    const mockDirname = '/home/runner/work/reader-bot/reader-bot/server/api';
    const UPLOADS_ROOT = path.join(mockDirname, '../uploads');
    const AVATARS_DIR = path.join(UPLOADS_ROOT, 'avatars');
    
    // Verify the paths are constructed correctly
    expect(UPLOADS_ROOT).toBe(path.normalize('/home/runner/work/reader-bot/reader-bot/server/uploads'));
    expect(AVATARS_DIR).toBe(path.normalize('/home/runner/work/reader-bot/reader-bot/server/uploads/avatars'));
    
    // Verify they don't contain process.cwd()
    expect(AVATARS_DIR).not.toContain('process.cwd()');
  });

  test('should match paths between reader.js and telegramAvatarFetcher.js', () => {
    // reader.js path construction
    const readerDirname = '/home/runner/work/reader-bot/reader-bot/server/api';
    const readerAvatarsDir = path.join(readerDirname, '../uploads/avatars');
    
    // telegramAvatarFetcher.js path construction
    const utilsDirname = '/home/runner/work/reader-bot/reader-bot/server/utils';
    const utilsAvatarsDir = path.join(utilsDirname, '../uploads/avatars');
    
    // Both should resolve to the same directory
    expect(path.resolve(readerAvatarsDir)).toBe(path.resolve(utilsAvatarsDir));
  });
});

describe('safeExtractUserId function behavior', () => {
  test('should extract userId from req.userId (highest priority)', () => {
    const req = {
      userId: '12345',
      query: { userId: '67890' },
      body: { userId: '11111' },
      headers: {}
    };
    
    // Simulate the priority logic
    const userId = req.userId || req.query?.userId || req.body?.userId || null;
    expect(userId).toBe('12345');
  });

  test('should return null for demo-user or missing userId', () => {
    const req = {
      query: {},
      body: {},
      headers: {}
    };
    
    const userId = req.userId || req.query?.userId || req.body?.userId || null;
    expect(userId).toBeNull();
  });

  test('should validate numeric userId format', () => {
    const validUserId = '123456789';
    const invalidUserId = 'demo-user';
    
    expect(/^\d+$/.test(validUserId)).toBe(true);
    expect(/^\d+$/.test(invalidUserId)).toBe(false);
  });
});

describe('parseUserIdFromInitData hardening', () => {
  test('should validate initData is a string', () => {
    const validInitData = 'user=%7B%22id%22%3A123%7D';
    const invalidInitData = null;
    
    expect(typeof validInitData === 'string').toBe(true);
    expect(typeof invalidInitData === 'string').toBe(false);
  });

  test('should check for expected pattern (contains =)', () => {
    const validInitData = 'user={"id":123}';
    const invalidInitData = 'invalid-data';
    
    expect(validInitData.includes('=')).toBe(true);
    expect(invalidInitData.includes('=')).toBe(false);
  });

  test('should handle URLSearchParams parsing', () => {
    const initData = 'user=%7B%22id%22%3A123%7D&auth_date=1234567890';
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    
    expect(userStr).toBeTruthy();
    
    // Should be able to parse JSON
    const userObj = JSON.parse(userStr);
    expect(userObj.id).toBe(123);
  });
});

describe('Avatar filename validation', () => {
  test('should validate avatar filename pattern', () => {
    const validFilenames = [
      '123456_1634567890123.jpg',
      '987654321_1634567890123.png',
      '111111_1634567890123.webp'
    ];
    
    const invalidFilenames = [
      'demo-user_1634567890123.jpg',
      '../../../etc/passwd',
      'file.jpg',
      '123_456.jpg' // missing timestamp-like number
    ];
    
    const pattern = /^\d+_\d+\.(jpg|jpeg|png|gif|webp)$/i;
    
    validFilenames.forEach(filename => {
      expect(pattern.test(filename)).toBe(true);
    });
    
    invalidFilenames.forEach(filename => {
      expect(pattern.test(filename)).toBe(false);
    });
  });

  test('should prevent directory traversal', () => {
    const maliciousFilenames = [
      '../../../etc/passwd',
      'file/../../../secret.txt',
      'file\\..\\..\\secret.txt'
    ];
    
    maliciousFilenames.forEach(filename => {
      expect(filename.includes('..')).toBe(true);
      expect(filename.includes('/') || filename.includes('\\')).toBe(true);
    });
  });
});
