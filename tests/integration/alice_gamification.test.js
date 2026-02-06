/**
 * Integration tests for Alice gamification badge
 * @file tests/integration/alice_gamification.test.js
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const badgesService = require('../../server/services/gamification/badgesService');
const entitlementService = require('../../server/services/access/entitlementService');
const UserProfile = require('../../server/models/userProfile');
const PhotoPost = require('../../server/models/PhotoPost');
const Follow = require('../../server/models/Follow');
const Favorite = require('../../server/models/Favorite');
const Quote = require('../../server/models/quote');
const UserEntitlement = require('../../server/models/UserEntitlement');

let mongoServer;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean up all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Alice Gamification Badge', () => {
  describe('Progress Calculation', () => {
    it('should return zero progress for new user', async () => {
      const userId = 'test_user_123';
      
      // Create user profile
      await UserProfile.create({
        userId,
        name: 'Test User',
        isOnboardingComplete: true
      });
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress).toMatchObject({
        photos: { current: 0, required: 10 },
        following: { current: 0, required: 5 },
        likesGivenToOthers: { current: 0, required: 10 },
        streak: { current: 0, required: 30 },
        completed: false,
        percent: 0
      });
    });

    it('should count published photos correctly', async () => {
      const userId = 'test_user_123';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      // Create 5 published photos
      for (let i = 0; i < 5; i++) {
        await PhotoPost.create({
          userId,
          imageUrl: `/test/image${i}.jpg`,
          dayKey: `2025-01-${10 + i}`,
          status: 'published'
        });
      }
      
      // Create 1 hidden photo (should not count)
      await PhotoPost.create({
        userId,
        imageUrl: '/test/hidden.jpg',
        dayKey: '2025-01-20',
        status: 'hidden'
      });
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress.photos.current).toBe(5);
    });

    it('should count follows correctly', async () => {
      const userId = 'test_user_123';
      const otherUsers = ['user1', 'user2', 'user3', 'user4', 'user5', 'user6'];
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      // Create 6 follows
      for (const otherUserId of otherUsers) {
        await Follow.create({
          followerId: userId,
          followingId: otherUserId
        });
      }
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress.following.current).toBe(6);
    });

    it('should count likes given to others correctly', async () => {
      const userId = 'test_user_123';
      const otherUserId = 'other_user_456';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      // Create quotes by other user
      for (let i = 0; i < 8; i++) {
        const quote = await Quote.create({
          userId: otherUserId,
          text: `Test quote ${i}`,
          author: 'Test Author',
          normalizedText: `test quote ${i}`,
          normalizedAuthor: 'test author',
          normalizedKey: `test quote ${i}|||test author`
        });
        
        // User likes these quotes
        await Favorite.create({
          userId,
          text: quote.text,
          author: quote.author,
          normalizedKey: quote.normalizedKey
        });
      }
      
      // Create a quote by the user themselves (should not count)
      const ownQuote = await Quote.create({
        userId,
        text: 'My own quote',
        author: 'Me',
        normalizedText: 'my own quote',
        normalizedAuthor: 'me',
        normalizedKey: 'my own quote|||me'
      });
      
      await Favorite.create({
        userId,
        text: ownQuote.text,
        author: ownQuote.author,
        normalizedKey: ownQuote.normalizedKey
      });
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress.likesGivenToOthers.current).toBe(8);
    });

    it('should calculate activity streak correctly', async () => {
      const userId = 'test_user_123';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      const today = new Date();
      
      // Create activity for the last 10 days (including today)
      for (let i = 0; i < 10; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // Alternate between different types of activity
        if (i % 4 === 0) {
          await PhotoPost.create({
            userId,
            imageUrl: `/test/image${i}.jpg`,
            dayKey: date.toISOString().split('T')[0],
            status: 'published',
            createdAt: date
          });
        } else if (i % 4 === 1) {
          await Quote.create({
            userId,
            text: `Quote ${i}`,
            author: 'Author',
            normalizedText: `quote ${i}`,
            normalizedAuthor: 'author',
            normalizedKey: `quote ${i}|||author`,
            createdAt: date
          });
        } else if (i % 4 === 2) {
          await Follow.create({
            followerId: userId,
            followingId: `user_${i}`,
            createdAt: date
          });
        } else {
          await Favorite.create({
            userId,
            text: `Fav ${i}`,
            author: 'Author',
            normalizedKey: `fav ${i}|||author`,
            createdAt: date
          });
        }
      }
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress.streak.current).toBe(10);
    });

    it('should increment streak when adding a quote today', async () => {
      const userId = 'test_user_123';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      // No prior activity, add a quote today
      const today = new Date();
      await Quote.create({
        userId,
        text: 'My first quote',
        author: 'Test Author',
        normalizedText: 'my first quote',
        normalizedAuthor: 'test author',
        normalizedKey: 'my first quote|||test author',
        createdAt: today
      });
      
      const progress = await badgesService.getAliceProgress(userId);
      
      // Should have streak of at least 1 since we added a quote today
      expect(progress.streak.current).toBeGreaterThanOrEqual(1);
    });

    it('should calculate streak with daily_login useractions', async () => {
      const userId = 'test_user_123';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      const today = new Date();
      const userActionsColl = mongoose.connection.collection('useractions');
      
      // Create daily_login entries for the last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        // Set to 12:00:00 UTC for consistency
        date.setUTCHours(12, 0, 0, 0);
        
        await userActionsColl.insertOne({
          userId,
          type: 'daily_login',
          createdAt: date
        });
      }
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress.streak.current).toBe(30);
    });

    it('should calculate streak with mixed activity types including daily_login', async () => {
      const userId = 'test_user_123';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      const today = new Date();
      const userActionsColl = mongoose.connection.collection('useractions');
      
      // Create 15 consecutive days with different activity types
      for (let i = 0; i < 15; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // Mix of activity types
        if (i % 3 === 0) {
          // Use daily_login from useractions
          date.setUTCHours(12, 0, 0, 0);
          await userActionsColl.insertOne({
            userId,
            type: 'daily_login',
            createdAt: date
          });
        } else if (i % 3 === 1) {
          // Use Quote
          await Quote.create({
            userId,
            text: `Streak quote ${i}`,
            author: 'Author',
            normalizedText: `streak quote ${i}`,
            normalizedAuthor: 'author',
            normalizedKey: `streak quote ${i}|||author`,
            createdAt: date
          });
        } else {
          // Use Follow
          await Follow.create({
            followerId: userId,
            followingId: `user_${i}`,
            createdAt: date
          });
        }
      }
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress.streak.current).toBe(15);
    });

    it('should detect completed requirements', async () => {
      const userId = 'test_user_123';
      const otherUserId = 'other_user';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      const today = new Date();
      
      // Create 10 photos
      for (let i = 0; i < 10; i++) {
        await PhotoPost.create({
          userId,
          imageUrl: `/test/image${i}.jpg`,
          dayKey: `2025-01-${10 + i}`,
          status: 'published'
        });
      }
      
      // Create 5 follows
      for (let i = 0; i < 5; i++) {
        await Follow.create({
          followerId: userId,
          followingId: `user_${i}`
        });
      }
      
      // Create 10 likes to others' quotes
      for (let i = 0; i < 10; i++) {
        const quote = await Quote.create({
          userId: otherUserId,
          text: `Quote ${i}`,
          author: 'Author',
          normalizedText: `quote ${i}`,
          normalizedAuthor: 'author',
          normalizedKey: `quote ${i}|||author`
        });
        
        await Favorite.create({
          userId,
          text: quote.text,
          author: quote.author,
          normalizedKey: quote.normalizedKey
        });
      }
      
      // Create 30-day streak
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        await Quote.create({
          userId,
          text: `Streak quote ${i}`,
          author: 'Author',
          normalizedText: `streak quote ${i}`,
          normalizedAuthor: 'author',
          normalizedKey: `streak quote ${i}|||author`,
          createdAt: date
        });
      }
      
      const progress = await badgesService.getAliceProgress(userId);
      
      expect(progress.completed).toBe(true);
      expect(progress.percent).toBe(100);
    });
  });

  describe('Badge Claiming', () => {
    it('should fail to claim if requirements not met', async () => {
      const userId = 'test_user_123';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      const result = await badgesService.claimAlice(userId);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Requirements not met');
    });

    it('should handle like added and removed correctly', async () => {
      const userId = 'test_user_123';
      const otherUserId = 'other_user_456';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      // Create a quote by another user
      const quote = await Quote.create({
        userId: otherUserId,
        text: 'Test quote',
        author: 'Test Author',
        normalizedText: 'test quote',
        normalizedAuthor: 'test author',
        normalizedKey: 'test quote|||test author'
      });
      
      // Initially no likes
      let progress = await badgesService.getAliceProgress(userId);
      expect(progress.likesGivenToOthers.current).toBe(0);
      
      // Add like
      await Favorite.create({
        userId,
        text: quote.text,
        author: quote.author,
        normalizedKey: quote.normalizedKey
      });
      
      // Check count increased
      progress = await badgesService.getAliceProgress(userId);
      expect(progress.likesGivenToOthers.current).toBe(1);
      
      // Remove like (simulate unlike by deleting the favorite)
      await Favorite.deleteOne({
        userId,
        normalizedKey: quote.normalizedKey
      });
      
      // Check count decreased
      progress = await badgesService.getAliceProgress(userId);
      expect(progress.likesGivenToOthers.current).toBe(0);
    });

    it('should handle follow and unfollow correctly', async () => {
      const userId = 'test_user_123';
      const targetUserId = 'target_user_456';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      // Initially no follows
      let progress = await badgesService.getAliceProgress(userId);
      expect(progress.following.current).toBe(0);
      
      // Add follow
      await Follow.create({
        followerId: userId,
        followingId: targetUserId
      });
      
      // Check count increased
      progress = await badgesService.getAliceProgress(userId);
      expect(progress.following.current).toBe(1);
      
      // Unfollow (delete the follow)
      await Follow.deleteOne({
        followerId: userId,
        followingId: targetUserId
      });
      
      // Check count decreased
      progress = await badgesService.getAliceProgress(userId);
      expect(progress.following.current).toBe(0);
    });

    it('should handle photo upload correctly', async () => {
      const userId = 'test_user_123';
      
      await UserProfile.create({ userId, name: 'Test User' });
      
      // Initially no photos
      let progress = await badgesService.getAliceProgress(userId);
      expect(progress.photos.current).toBe(0);
      
      // Upload photo
      await PhotoPost.create({
        userId,
        imageUrl: '/test/photo.jpg',
        dayKey: '2025-01-15',
        status: 'published'
      });
      
      // Check count increased
      progress = await badgesService.getAliceProgress(userId);
      expect(progress.photos.current).toBe(1);
    });

    it('should successfully claim badge when requirements met', async () => {
      const userId = 'test_user_123';
      const otherUserId = 'other_user';
      
      const userProfile = await UserProfile.create({ userId, name: 'Test User' });
      const today = new Date();
      
      // Meet all requirements
      // 10 photos
      for (let i = 0; i < 10; i++) {
        await PhotoPost.create({
          userId,
          imageUrl: `/test/image${i}.jpg`,
          dayKey: `2025-01-${10 + i}`,
          status: 'published'
        });
      }
      
      // 5 follows
      for (let i = 0; i < 5; i++) {
        await Follow.create({
          followerId: userId,
          followingId: `user_${i}`
        });
      }
      
      // 10 likes to others
      for (let i = 0; i < 10; i++) {
        const quote = await Quote.create({
          userId: otherUserId,
          text: `Quote ${i}`,
          author: 'Author',
          normalizedText: `quote ${i}`,
          normalizedAuthor: 'author',
          normalizedKey: `quote ${i}|||author`
        });
        
        await Favorite.create({
          userId,
          text: quote.text,
          author: quote.author,
          normalizedKey: quote.normalizedKey
        });
      }
      
      // 30-day streak
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        await Quote.create({
          userId,
          text: `Streak ${i}`,
          author: 'Author',
          normalizedText: `streak ${i}`,
          normalizedAuthor: 'author',
          normalizedKey: `streak ${i}|||author`,
          createdAt: date
        });
      }
      
      const result = await badgesService.claimAlice(userId);
      
      expect(result.success).toBe(true);
      expect(result.expiresAt).toBeDefined();
      
      // Verify entitlement was created
      const entitlement = await UserEntitlement.findOne({
        userId: userProfile._id,
        kind: 'audio',
        resourceId: 'alice_wonderland'
      });
      
      expect(entitlement).toBeTruthy();
      expect(entitlement.metadata.badge).toBe('alice');
    });

    it('should be idempotent (allow re-claiming)', async () => {
      const userId = 'test_user_123';
      const otherUserId = 'other_user';
      
      const userProfile = await UserProfile.create({ userId, name: 'Test User' });
      const today = new Date();
      
      // Meet all requirements (same as previous test)
      for (let i = 0; i < 10; i++) {
        await PhotoPost.create({
          userId,
          imageUrl: `/test/image${i}.jpg`,
          dayKey: `2025-01-${10 + i}`,
          status: 'published'
        });
      }
      
      for (let i = 0; i < 5; i++) {
        await Follow.create({
          followerId: userId,
          followingId: `user_${i}`
        });
      }
      
      for (let i = 0; i < 10; i++) {
        const quote = await Quote.create({
          userId: otherUserId,
          text: `Quote ${i}`,
          author: 'Author',
          normalizedText: `quote ${i}`,
          normalizedAuthor: 'author',
          normalizedKey: `quote ${i}|||author`
        });
        
        await Favorite.create({
          userId,
          text: quote.text,
          author: quote.author,
          normalizedKey: quote.normalizedKey
        });
      }
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        await Quote.create({
          userId,
          text: `Streak ${i}`,
          author: 'Author',
          normalizedText: `streak ${i}`,
          normalizedAuthor: 'author',
          normalizedKey: `streak ${i}|||author`,
          createdAt: date
        });
      }
      
      // First claim
      const result1 = await badgesService.claimAlice(userId);
      expect(result1.success).toBe(true);
      
      // Second claim (should succeed idempotently)
      const result2 = await badgesService.claimAlice(userId);
      expect(result2.success).toBe(true);
      expect(result2.alreadyClaimed).toBe(true);
      
      // Should still have only one entitlement
      const entitlements = await UserEntitlement.find({
        userId: userProfile._id,
        kind: 'audio',
        resourceId: 'alice_wonderland'
      });
      
      expect(entitlements.length).toBe(1);
    });
  });

  describe('Entitlement Integration', () => {
    it('should grant 30-day access to alice_wonderland audio', async () => {
      const userId = 'test_user_123';
      
      const userProfile = await UserProfile.create({ userId, name: 'Test User' });
      
      // Grant entitlement manually (simulating successful claim)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await entitlementService.grantAudio(userProfile._id, 'alice_wonderland', {
        expiresAt,
        grantedBy: 'alice_badge',
        metadata: { badge: 'alice' }
      });
      
      // Check access
      const hasAccess = await entitlementService.hasAudioAccess(
        userProfile._id,
        'alice_wonderland'
      );
      
      expect(hasAccess).toBe(true);
      
      // Check remaining days
      const remainingDays = await entitlementService.getRemainingDays(
        userProfile._id,
        'alice_wonderland'
      );
      
      expect(remainingDays).toBeGreaterThan(0);
      expect(remainingDays).toBeLessThanOrEqual(30);
    });
  });
});
