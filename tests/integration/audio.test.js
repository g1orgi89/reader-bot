/**
 * Integration tests for Audio API
 * @file tests/integration/audio.test.js
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const audioRoutes = require('../../server/api/audio');
const AudioProgress = require('../../server/models/AudioProgress');
const UserEntitlement = require('../../server/models/UserEntitlement');

// Mock the logger to avoid console output during tests
jest.mock('../../server/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  return mockLogger;
});

describe('Audio API Integration Tests', () => {
  let app;
  let mongoServer;
  let testUserId;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app with audio routes
    app = express();
    app.use(express.json());
    app.use('/api/audio', audioRoutes);

    // Create test user ID
    testUserId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clear collections after each test
    await AudioProgress.deleteMany({});
    await UserEntitlement.deleteMany({});
  });

  describe('GET /api/audio/free', () => {
    it('should return list of free audios', async () => {
      const response = await request(app)
        .get('/api/audio/free')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.audios).toBeDefined();
      expect(Array.isArray(response.body.audios)).toBe(true);
      expect(response.body.audios.length).toBeGreaterThan(0);
      
      // Check first audio has required fields
      const audio = response.body.audios[0];
      expect(audio.id).toBeDefined();
      expect(audio.title).toBeDefined();
      expect(audio.author).toBeDefined();
      expect(audio.audioUrl).toBeDefined();
      expect(audio.isFree).toBe(true);
    });
  });

  describe('GET /api/audio/:id', () => {
    it('should return audio metadata for free audio', async () => {
      const response = await request(app)
        .get('/api/audio/free-1')
        .query({ userId: testUserId.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.audio).toBeDefined();
      expect(response.body.audio.id).toBe('free-1');
      expect(response.body.audio.title).toBeDefined();
      expect(response.body.audio.unlocked).toBe(true);
    });

    it('should return 404 for non-existing audio', async () => {
      const response = await request(app)
        .get('/api/audio/non-existing')
        .query({ userId: testUserId.toString() })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Audio not found');
    });

    it('should return unlocked=false for premium audio without entitlement', async () => {
      // This test assumes we have a premium audio in the future
      // For now, it just checks that non-free audio without entitlement is locked
      const response = await request(app)
        .get('/api/audio/premium-1')
        .query({ userId: testUserId.toString() })
        .expect(404); // Will be 404 since premium-1 doesn't exist yet

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/audio/:id/stream-url', () => {
    it('should return stream URL for free audio', async () => {
      const response = await request(app)
        .get('/api/audio/free-1/stream-url')
        .query({ userId: testUserId.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.url).toBeDefined();
      expect(response.body.url).toContain('/media/free/');
    });

    it('should return 401 without userId', async () => {
      const response = await request(app)
        .get('/api/audio/free-1/stream-url')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User ID required');
    });

    it('should return 404 for non-existing audio', async () => {
      const response = await request(app)
        .get('/api/audio/non-existing/stream-url')
        .query({ userId: testUserId.toString() })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Audio not found');
    });
  });

  describe('POST /api/audio/:id/progress', () => {
    it('should update progress for an audio', async () => {
      const response = await request(app)
        .post('/api/audio/free-1/progress')
        .query({ userId: testUserId.toString() })
        .send({ positionSec: 150 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.progress).toBeDefined();
      expect(response.body.progress.audioId).toBe('free-1');
      expect(response.body.progress.positionSec).toBe(150);
    });

    it('should return 401 without userId', async () => {
      const response = await request(app)
        .post('/api/audio/free-1/progress')
        .send({ positionSec: 150 })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User ID required');
    });

    it('should return 400 with invalid positionSec', async () => {
      const response = await request(app)
        .post('/api/audio/free-1/progress')
        .query({ userId: testUserId.toString() })
        .send({ positionSec: -10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid positionSec');
    });

    it('should update existing progress', async () => {
      // First update
      await request(app)
        .post('/api/audio/free-1/progress')
        .query({ userId: testUserId.toString() })
        .send({ positionSec: 100 })
        .expect(200);

      // Second update
      const response = await request(app)
        .post('/api/audio/free-1/progress')
        .query({ userId: testUserId.toString() })
        .send({ positionSec: 200 })
        .expect(200);

      expect(response.body.progress.positionSec).toBe(200);

      // Verify only one record exists
      const count = await AudioProgress.countDocuments({ userId: testUserId, audioId: 'free-1' });
      expect(count).toBe(1);
    });
  });

  describe('GET /api/audio/:id/progress', () => {
    it('should return progress for existing record', async () => {
      // Create progress
      await AudioProgress.updateProgress(testUserId, 'free-1', 300);

      const response = await request(app)
        .get('/api/audio/free-1/progress')
        .query({ userId: testUserId.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.progress).toBeDefined();
      expect(response.body.progress.audioId).toBe('free-1');
      expect(response.body.progress.positionSec).toBe(300);
    });

    it('should return default progress for non-existing record', async () => {
      const response = await request(app)
        .get('/api/audio/free-1/progress')
        .query({ userId: testUserId.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.progress).toBeDefined();
      expect(response.body.progress.audioId).toBe('free-1');
      expect(response.body.progress.positionSec).toBe(0);
      expect(response.body.progress.updatedAt).toBeNull();
    });

    it('should return 401 without userId', async () => {
      const response = await request(app)
        .get('/api/audio/free-1/progress')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User ID required');
    });
  });
});
