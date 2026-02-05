/**
 * Unit tests for entitlement service
 * @file tests/unit/entitlement.test.js
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const entitlementService = require('../../server/services/access/entitlementService');
const UserEntitlement = require('../../server/models/UserEntitlement');
const UserProfile = require('../../server/models/userProfile');

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

describe('Entitlement Service', () => {
  let testUserId;

  beforeEach(async () => {
    const user = await UserProfile.create({
      userId: 'test_telegram_123',
      name: 'Test User'
    });
    testUserId = user._id;
  });

  describe('grantAudio', () => {
    it('should grant audio access with expiration', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const entitlement = await entitlementService.grantAudio(
        testUserId,
        'alice_wonderland',
        {
          expiresAt,
          grantedBy: 'test',
          metadata: { test: true }
        }
      );

      expect(entitlement).toBeDefined();
      expect(entitlement.userId.toString()).toBe(testUserId.toString());
      expect(entitlement.kind).toBe('audio');
      expect(entitlement.resourceId).toBe('alice_wonderland');
      expect(entitlement.expiresAt).toBeDefined();
      expect(entitlement.metadata.test).toBe(true);
    });

    it('should grant audio access without expiration', async () => {
      const entitlement = await entitlementService.grantAudio(
        testUserId,
        'test_audio'
      );

      expect(entitlement).toBeDefined();
      expect(entitlement.expiresAt).toBeNull();
    });

    it('should update existing entitlement', async () => {
      // Grant initial entitlement
      const initialExpiry = new Date();
      initialExpiry.setDate(initialExpiry.getDate() + 15);
      
      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt: initialExpiry,
        metadata: { initial: true }
      });

      // Grant again with new expiry
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);
      
      const updated = await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt: newExpiry,
        metadata: { updated: true }
      });

      expect(updated.metadata.updated).toBe(true);
      expect(updated.expiresAt.getTime()).toBeGreaterThan(initialExpiry.getTime());

      // Should have only one entitlement
      const all = await UserEntitlement.find({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland'
      });
      expect(all.length).toBe(1);
    });
  });

  describe('hasAudioAccess', () => {
    it('should return true for valid entitlement', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt
      });

      const hasAccess = await entitlementService.hasAudioAccess(
        testUserId,
        'alice_wonderland'
      );

      expect(hasAccess).toBe(true);
    });

    it('should return false for non-existent entitlement', async () => {
      const hasAccess = await entitlementService.hasAudioAccess(
        testUserId,
        'nonexistent_audio'
      );

      expect(hasAccess).toBe(false);
    });

    it('should return false for expired entitlement', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired yesterday

      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt
      });

      const hasAccess = await entitlementService.hasAudioAccess(
        testUserId,
        'alice_wonderland'
      );

      expect(hasAccess).toBe(false);
    });

    it('should return true for entitlement without expiration', async () => {
      await entitlementService.grantAudio(testUserId, 'permanent_audio');

      const hasAccess = await entitlementService.hasAudioAccess(
        testUserId,
        'permanent_audio'
      );

      expect(hasAccess).toBe(true);
    });
  });

  describe('getRemainingDays', () => {
    it('should calculate remaining days correctly', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt
      });

      const remainingDays = await entitlementService.getRemainingDays(
        testUserId,
        'alice_wonderland'
      );

      expect(remainingDays).toBeGreaterThanOrEqual(14);
      expect(remainingDays).toBeLessThanOrEqual(15);
    });

    it('should return null for non-existent entitlement', async () => {
      const remainingDays = await entitlementService.getRemainingDays(
        testUserId,
        'nonexistent_audio'
      );

      expect(remainingDays).toBeNull();
    });

    it('should return null for expired entitlement', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 5);

      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt
      });

      const remainingDays = await entitlementService.getRemainingDays(
        testUserId,
        'alice_wonderland'
      );

      expect(remainingDays).toBeNull();
    });

    it('should return -1 for permanent entitlement', async () => {
      await entitlementService.grantAudio(testUserId, 'permanent_audio');

      const remainingDays = await entitlementService.getRemainingDays(
        testUserId,
        'permanent_audio'
      );

      expect(remainingDays).toBe(-1);
    });

    it('should round up partial days', async () => {
      const expiresAt = new Date();
      // Set expiration to 1.5 days from now
      expiresAt.setTime(expiresAt.getTime() + (1.5 * 24 * 60 * 60 * 1000));

      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt
      });

      const remainingDays = await entitlementService.getRemainingDays(
        testUserId,
        'alice_wonderland'
      );

      // Should round up to 2 days
      expect(remainingDays).toBe(2);
    });

    it('should return 0 for entitlement expiring today', async () => {
      const expiresAt = new Date();
      // Set to expire in 1 hour
      expiresAt.setTime(expiresAt.getTime() + (60 * 60 * 1000));

      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt
      });

      const remainingDays = await entitlementService.getRemainingDays(
        testUserId,
        'alice_wonderland'
      );

      // Should be either 0 or 1 (rounded up)
      expect(remainingDays).toBeGreaterThanOrEqual(0);
      expect(remainingDays).toBeLessThanOrEqual(1);
    });
  });

  describe('revokeAudio', () => {
    it('should revoke audio access', async () => {
      await entitlementService.grantAudio(testUserId, 'alice_wonderland');

      const hasAccessBefore = await entitlementService.hasAudioAccess(
        testUserId,
        'alice_wonderland'
      );
      expect(hasAccessBefore).toBe(true);

      await entitlementService.revokeAudio(testUserId, 'alice_wonderland');

      const hasAccessAfter = await entitlementService.hasAudioAccess(
        testUserId,
        'alice_wonderland'
      );
      expect(hasAccessAfter).toBe(false);
    });
  });

  describe('getUserAudioEntitlements', () => {
    it('should return all audio entitlements for user', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await entitlementService.grantAudio(testUserId, 'alice_wonderland', {
        expiresAt
      });
      await entitlementService.grantAudio(testUserId, 'another_audio');

      const entitlements = await entitlementService.getUserAudioEntitlements(
        testUserId
      );

      expect(entitlements.length).toBe(2);
      expect(entitlements.map(e => e.resourceId)).toContain('alice_wonderland');
      expect(entitlements.map(e => e.resourceId)).toContain('another_audio');
    });

    it('should not return expired entitlements', async () => {
      const futureExpiry = new Date();
      futureExpiry.setDate(futureExpiry.getDate() + 30);
      
      const pastExpiry = new Date();
      pastExpiry.setDate(pastExpiry.getDate() - 1);

      await entitlementService.grantAudio(testUserId, 'valid_audio', {
        expiresAt: futureExpiry
      });
      await entitlementService.grantAudio(testUserId, 'expired_audio', {
        expiresAt: pastExpiry
      });

      const entitlements = await entitlementService.getUserAudioEntitlements(
        testUserId
      );

      expect(entitlements.length).toBe(1);
      expect(entitlements[0].resourceId).toBe('valid_audio');
    });

    it('should return empty array for user with no entitlements', async () => {
      const entitlements = await entitlementService.getUserAudioEntitlements(
        testUserId
      );

      expect(entitlements).toEqual([]);
    });
  });
});
