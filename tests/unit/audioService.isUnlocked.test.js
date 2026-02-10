/**
 * Unit tests for audioService.isUnlocked() track ID pattern extraction
 * @file tests/unit/audioService.isUnlocked.test.js
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const audioService = require('../../server/services/audio/audioService');
const UserEntitlement = require('../../server/models/UserEntitlement');
const UserProfile = require('../../server/models/userProfile');

// Mock the logger to avoid console output during tests
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('audioService.isUnlocked() - Track ID Pattern Extraction', () => {
  let testUserId;

  beforeEach(async () => {
    const user = await UserProfile.create({
      userId: 'test_telegram_123',
      name: 'Test User'
    });
    testUserId = user._id;
  });

  describe('Track ID pattern: containerId-NN', () => {
    it('should check entitlement on container for alice_wonderland-01 track', async () => {
      // Grant entitlement on the container (alice_wonderland)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland',
        expiresAt,
        grantedBy: 'test'
      });

      // Check if track is unlocked - should check alice_wonderland, not alice_wonderland-01
      const unlocked = await audioService.isUnlocked(testUserId, 'alice_wonderland-01');
      
      expect(unlocked).toBe(true);
    });

    it('should check entitlement on container for alice_wonderland-06 track', async () => {
      // Grant entitlement on the container (alice_wonderland)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland',
        expiresAt,
        grantedBy: 'test'
      });

      // Check if track 6 is unlocked - should check alice_wonderland, not alice_wonderland-06
      const unlocked = await audioService.isUnlocked(testUserId, 'alice_wonderland-06');
      
      expect(unlocked).toBe(true);
    });

    it('should return false when entitlement on container does not exist', async () => {
      // No entitlement granted
      const unlocked = await audioService.isUnlocked(testUserId, 'alice_wonderland-01');
      
      expect(unlocked).toBe(false);
    });

    it('should extract container ID from track pattern even if not in FREE_AUDIO_METADATA', async () => {
      // Grant entitlement on a hypothetical container not in FREE_AUDIO_METADATA
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'some_other_container',
        expiresAt,
        grantedBy: 'test'
      });

      // Check if track is unlocked - should extract 'some_other_container' from pattern
      const unlocked = await audioService.isUnlocked(testUserId, 'some_other_container-03');
      
      expect(unlocked).toBe(true);
    });

    it('should handle track IDs with multi-digit numbers', async () => {
      // Grant entitlement on container
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'long_audiobook',
        expiresAt,
        grantedBy: 'test'
      });

      // Check track with multi-digit number
      const unlocked = await audioService.isUnlocked(testUserId, 'long_audiobook-42');
      
      expect(unlocked).toBe(true);
    });
  });

  describe('Free content', () => {
    it('should return true for free tracks from malenkii_princ container', async () => {
      // malenkii_princ is free in FREE_AUDIO_METADATA
      const unlocked = await audioService.isUnlocked(testUserId, 'malenkii_princ-01');
      
      expect(unlocked).toBe(true);
    });

    it('should return true for free tracks without userId', async () => {
      const unlocked = await audioService.isUnlocked(null, 'malenkii_princ-03');
      
      expect(unlocked).toBe(true);
    });

    it('should return true for free- prefixed content', async () => {
      const unlocked = await audioService.isUnlocked(testUserId, 'free-sample');
      
      expect(unlocked).toBe(true);
    });
  });

  describe('Non-track IDs (direct container or audio IDs)', () => {
    it('should check entitlement directly for non-track pattern IDs', async () => {
      // Grant entitlement on a direct audio ID
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'premium_single',
        expiresAt,
        grantedBy: 'test'
      });

      const unlocked = await audioService.isUnlocked(testUserId, 'premium_single');
      
      expect(unlocked).toBe(true);
    });

    it('should return false for non-track IDs without entitlement', async () => {
      const unlocked = await audioService.isUnlocked(testUserId, 'premium_audio');
      
      expect(unlocked).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle track IDs with hyphens in container name', async () => {
      // Grant entitlement on container with hyphen
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice-in-wonderland',
        expiresAt,
        grantedBy: 'test'
      });

      // The pattern will match the LAST hyphen-number, so 'alice-in-wonderland-01' 
      // will extract 'alice-in-wonderland' as container
      const unlocked = await audioService.isUnlocked(testUserId, 'alice-in-wonderland-01');
      
      expect(unlocked).toBe(true);
    });

    it('should return false for expired entitlement on container', async () => {
      // Grant expired entitlement
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland',
        expiresAt,
        grantedBy: 'test'
      });

      const unlocked = await audioService.isUnlocked(testUserId, 'alice_wonderland-01');
      
      expect(unlocked).toBe(false);
    });
  });
});
