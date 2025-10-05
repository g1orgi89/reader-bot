/**
 * Unit test for avatar cleanup functionality
 * Tests that old avatars are deleted when uploading a new one
 */

const path = require('path');
const fs = require('fs').promises;

describe('Avatar Cleanup on Upload', () => {
  const AVATARS_DIR = path.join(__dirname, '../../uploads/avatars');
  const userId = '123456789';

  // Mock UserProfile model
  const mockUserProfile = {
    findOne: jest.fn(),
  };

  // Helper function to simulate the cleanup logic
  async function cleanupOldAvatar(userId, userProfile, AVATARS_DIR) {
    if (userProfile && userProfile.avatarUrl) {
      const oldAvatarUrl = userProfile.avatarUrl.trim();
      
      // Check if old avatar is not empty and not a default/external URL
      if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/avatars/')) {
        // Extract filename from URL
        const oldFilename = path.basename(oldAvatarUrl);
        
        // Validate filename pattern belongs to this user (userId_timestamp.ext)
        const filenamePattern = new RegExp(`^${userId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`, 'i');
        
        if (filenamePattern.test(oldFilename)) {
          const oldFilePath = path.join(AVATARS_DIR, oldFilename);
          const resolvedOldPath = path.resolve(oldFilePath);
          const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
          
          // Security: Ensure the file is within AVATARS_DIR
          if (resolvedOldPath.startsWith(resolvedAvatarsDir)) {
            // Check if old avatar file exists and delete it
            try {
              await fs.access(resolvedOldPath, fs.constants.F_OK);
              await fs.unlink(resolvedOldPath);
              return { deleted: true, filename: oldFilename };
            } catch (deleteError) {
              if (deleteError.code === 'ENOENT') {
                return { deleted: false, reason: 'not_found', filename: oldFilename };
              }
              throw deleteError;
            }
          }
          return { deleted: false, reason: 'outside_dir', filename: oldFilename };
        }
        return { deleted: false, reason: 'pattern_mismatch', filename: oldFilename };
      }
    }
    return { deleted: false, reason: 'no_old_avatar' };
  }

  describe('Old avatar filename validation', () => {
    test('should validate correct filename pattern for user', () => {
      const filename = `${userId}_1234567890.jpg`;
      const pattern = new RegExp(`^${userId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`, 'i');
      expect(pattern.test(filename)).toBe(true);
    });

    test('should reject filename from different user', () => {
      const filename = '987654321_1234567890.jpg';
      const pattern = new RegExp(`^${userId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`, 'i');
      expect(pattern.test(filename)).toBe(false);
    });

    test('should accept different valid extensions', () => {
      const pattern = new RegExp(`^${userId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`, 'i');
      expect(pattern.test(`${userId}_1234567890.jpg`)).toBe(true);
      expect(pattern.test(`${userId}_1234567890.jpeg`)).toBe(true);
      expect(pattern.test(`${userId}_1234567890.png`)).toBe(true);
      expect(pattern.test(`${userId}_1234567890.gif`)).toBe(true);
      expect(pattern.test(`${userId}_1234567890.webp`)).toBe(true);
    });

    test('should reject invalid extensions', () => {
      const pattern = new RegExp(`^${userId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`, 'i');
      expect(pattern.test(`${userId}_1234567890.txt`)).toBe(false);
      expect(pattern.test(`${userId}_1234567890.pdf`)).toBe(false);
      expect(pattern.test(`${userId}_1234567890.exe`)).toBe(false);
    });

    test('should reject filename without timestamp', () => {
      const pattern = new RegExp(`^${userId}_\\d+\\.(jpg|jpeg|png|gif|webp)$`, 'i');
      expect(pattern.test(`${userId}.jpg`)).toBe(false);
      expect(pattern.test(`${userId}_abc.jpg`)).toBe(false);
    });
  });

  describe('Avatar URL extraction', () => {
    test('should extract filename from URL', () => {
      const avatarUrl = `/uploads/avatars/${userId}_1234567890.jpg`;
      const filename = path.basename(avatarUrl);
      expect(filename).toBe(`${userId}_1234567890.jpg`);
    });

    test('should handle URLs with trailing slashes', () => {
      const avatarUrl = `/uploads/avatars/${userId}_1234567890.jpg/`;
      const filename = path.basename(avatarUrl);
      // basename removes trailing slashes
      expect(filename).toBe(`${userId}_1234567890.jpg`);
    });

    test('should not process external URLs', () => {
      const avatarUrl = 'https://example.com/avatar.jpg';
      const shouldProcess = avatarUrl.startsWith('/uploads/avatars/');
      expect(shouldProcess).toBe(false);
    });

    test('should not process empty or null URLs', () => {
      expect(''.startsWith('/uploads/avatars/')).toBe(false);
      expect(null?.startsWith?.('/uploads/avatars/')).toBeFalsy();
    });
  });

  describe('Path security validation', () => {
    test('should validate path is within AVATARS_DIR', () => {
      const filename = `${userId}_1234567890.jpg`;
      const filePath = path.join(AVATARS_DIR, filename);
      const resolvedPath = path.resolve(filePath);
      const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
      
      expect(resolvedPath.startsWith(resolvedAvatarsDir)).toBe(true);
    });

    test('should reject path traversal attempts', () => {
      const filename = `../../etc/passwd`;
      const filePath = path.join(AVATARS_DIR, filename);
      const resolvedPath = path.resolve(filePath);
      const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
      
      // The resolved path should not be within AVATARS_DIR
      expect(resolvedPath.startsWith(resolvedAvatarsDir)).toBe(false);
    });

    test('should reject absolute path injections', () => {
      const filename = `/tmp/malicious.jpg`;
      // Using basename prevents absolute path injection
      const safeFilename = path.basename(filename);
      expect(safeFilename).toBe('malicious.jpg');
      
      const filePath = path.join(AVATARS_DIR, safeFilename);
      const resolvedPath = path.resolve(filePath);
      const resolvedAvatarsDir = path.resolve(AVATARS_DIR);
      
      expect(resolvedPath.startsWith(resolvedAvatarsDir)).toBe(true);
    });
  });

  describe('Cleanup logic behavior', () => {
    test('should skip cleanup when user has no avatar', async () => {
      const userProfile = { avatarUrl: null };
      const result = await cleanupOldAvatar(userId, userProfile, AVATARS_DIR);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('no_old_avatar');
    });

    test('should skip cleanup when avatar is empty string', async () => {
      const userProfile = { avatarUrl: '' };
      const result = await cleanupOldAvatar(userId, userProfile, AVATARS_DIR);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('no_old_avatar');
    });

    test('should skip cleanup for external URLs', async () => {
      const userProfile = { avatarUrl: 'https://example.com/avatar.jpg' };
      const result = await cleanupOldAvatar(userId, userProfile, AVATARS_DIR);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('no_old_avatar');
    });

    test('should skip cleanup when filename belongs to different user', async () => {
      const userProfile = { avatarUrl: '/uploads/avatars/987654321_1234567890.jpg' };
      const result = await cleanupOldAvatar(userId, userProfile, AVATARS_DIR);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('pattern_mismatch');
    });

    test('should return not_found when old file does not exist', async () => {
      const userProfile = { avatarUrl: `/uploads/avatars/${userId}_9999999999.jpg` };
      const result = await cleanupOldAvatar(userId, userProfile, AVATARS_DIR);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not_found');
    });
  });

  describe('Integration with file system', () => {
    const testDir = path.join(__dirname, '../../test-avatars');
    
    beforeAll(async () => {
      // Create test directory
      try {
        await fs.mkdir(testDir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }
    });

    afterAll(async () => {
      // Clean up test directory
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    });

    test('should delete existing old avatar file', async () => {
      const oldFilename = `${userId}_1234567890.jpg`;
      const oldFilePath = path.join(testDir, oldFilename);
      
      // Create a test file
      await fs.writeFile(oldFilePath, 'test image data');
      
      // Verify it exists
      await expect(fs.access(oldFilePath)).resolves.not.toThrow();
      
      // Run cleanup
      const userProfile = { avatarUrl: `/uploads/avatars/${oldFilename}` };
      const result = await cleanupOldAvatar(userId, userProfile, testDir);
      
      expect(result.deleted).toBe(true);
      expect(result.filename).toBe(oldFilename);
      
      // Verify file is deleted
      await expect(fs.access(oldFilePath)).rejects.toThrow();
    });

    test('should not delete files from other users', async () => {
      const otherUserId = '987654321';
      const otherFilename = `${otherUserId}_1234567890.jpg`;
      const otherFilePath = path.join(testDir, otherFilename);
      
      // Create a test file for another user
      await fs.writeFile(otherFilePath, 'other user image data');
      
      // Try to cleanup with wrong user ID
      const userProfile = { avatarUrl: `/uploads/avatars/${otherFilename}` };
      const result = await cleanupOldAvatar(userId, userProfile, testDir);
      
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('pattern_mismatch');
      
      // Verify file still exists
      await expect(fs.access(otherFilePath)).resolves.not.toThrow();
      
      // Clean up
      await fs.unlink(otherFilePath);
    });
  });
});
