/**
 * Unit tests for AudioProgress model
 * @file tests/unit/audioProgress.test.js
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AudioProgress = require('../../server/models/AudioProgress');

describe('AudioProgress Model', () => {
  let mongoServer;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clear the collection after each test
    await AudioProgress.deleteMany({});
  });

  describe('Schema validation', () => {
    it('should create a valid progress record', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';
      const positionSec = 100;

      const progress = new AudioProgress({
        userId,
        audioId,
        positionSec
      });

      const savedProgress = await progress.save();

      expect(savedProgress._id).toBeDefined();
      expect(savedProgress.userId.toString()).toBe(userId.toString());
      expect(savedProgress.audioId).toBe(audioId);
      expect(savedProgress.positionSec).toBe(positionSec);
      expect(savedProgress.updatedAt).toBeDefined();
    });

    it('should require userId', async () => {
      const progress = new AudioProgress({
        audioId: 'free-1',
        positionSec: 100
      });

      await expect(progress.save()).rejects.toThrow();
    });

    it('should require audioId', async () => {
      const userId = new mongoose.Types.ObjectId();
      const progress = new AudioProgress({
        userId,
        positionSec: 100
      });

      await expect(progress.save()).rejects.toThrow();
    });

    it('should default positionSec to 0', async () => {
      const userId = new mongoose.Types.ObjectId();
      const progress = new AudioProgress({
        userId,
        audioId: 'free-1'
      });

      const savedProgress = await progress.save();
      expect(savedProgress.positionSec).toBe(0);
    });

    it('should enforce unique constraint on userId + audioId', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';

      const progress1 = new AudioProgress({
        userId,
        audioId,
        positionSec: 100
      });

      await progress1.save();

      const progress2 = new AudioProgress({
        userId,
        audioId,
        positionSec: 200
      });

      await expect(progress2.save()).rejects.toThrow();
    });
  });

  describe('updateProgress', () => {
    it('should create new progress record', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';
      const positionSec = 150;

      const progress = await AudioProgress.updateProgress(userId, audioId, positionSec);

      expect(progress.userId.toString()).toBe(userId.toString());
      expect(progress.audioId).toBe(audioId);
      expect(progress.positionSec).toBe(positionSec);
    });

    it('should update existing progress record', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';

      // Create initial progress
      await AudioProgress.updateProgress(userId, audioId, 100);

      // Update progress
      const updatedProgress = await AudioProgress.updateProgress(userId, audioId, 200);

      expect(updatedProgress.positionSec).toBe(200);

      // Verify only one record exists
      const count = await AudioProgress.countDocuments({ userId, audioId });
      expect(count).toBe(1);
    });
  });

  describe('getProgress', () => {
    it('should return progress for existing record', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';
      const positionSec = 250;

      await AudioProgress.updateProgress(userId, audioId, positionSec);

      const progress = await AudioProgress.getProgress(userId, audioId);

      expect(progress).toBeDefined();
      expect(progress.positionSec).toBe(positionSec);
    });

    it('should return null for non-existing record', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';

      const progress = await AudioProgress.getProgress(userId, audioId);

      expect(progress).toBeNull();
    });
  });

  describe('getUserProgress', () => {
    it('should return all progress records for a user', async () => {
      const userId = new mongoose.Types.ObjectId();

      await AudioProgress.updateProgress(userId, 'free-1', 100);
      await AudioProgress.updateProgress(userId, 'free-2', 200);

      const progressList = await AudioProgress.getUserProgress(userId);

      expect(progressList).toHaveLength(2);
      expect(progressList[0].audioId).toBeDefined();
      expect(progressList[1].audioId).toBeDefined();
    });

    it('should return empty array for user with no progress', async () => {
      const userId = new mongoose.Types.ObjectId();

      const progressList = await AudioProgress.getUserProgress(userId);

      expect(progressList).toHaveLength(0);
    });
  });

  describe('deleteProgress', () => {
    it('should delete progress record', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';

      await AudioProgress.updateProgress(userId, audioId, 100);

      const result = await AudioProgress.deleteProgress(userId, audioId);

      expect(result.deletedCount).toBe(1);

      const progress = await AudioProgress.getProgress(userId, audioId);
      expect(progress).toBeNull();
    });

    it('should return 0 deletedCount for non-existing record', async () => {
      const userId = new mongoose.Types.ObjectId();
      const audioId = 'free-1';

      const result = await AudioProgress.deleteProgress(userId, audioId);

      expect(result.deletedCount).toBe(0);
    });
  });
});
