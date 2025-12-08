/**
 * Test for Feedback model and API endpoint
 * Validates feedback creation, validation, and statistics
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

// Import models and API
const Feedback = require('../server/models/Feedback');
const readerApi = require('../server/api/reader');

describe('Feedback Model and API', () => {
  let mongoServer;
  let app;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app with the reader API
    app = express();
    app.use(express.json());
    app.use('/api/reader', readerApi);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear feedback collection before each test
    await Feedback.deleteMany({});
  });

  describe('Feedback Model', () => {
    it('should create feedback with minimal required fields', async () => {
      const feedback = new Feedback({
        telegramId: '123456789',
        rating: 5
      });

      await feedback.save();

      expect(feedback._id).toBeDefined();
      expect(feedback.telegramId).toBe('123456789');
      expect(feedback.rating).toBe(5);
      expect(feedback.context).toBe('monthly_report'); // default
      expect(feedback.source).toBe('telegram'); // default
      expect(feedback.text).toBe('');
      expect(feedback.tags).toEqual([]);
    });

    it('should create feedback with all fields', async () => {
      const feedback = new Feedback({
        telegramId: '987654321',
        rating: 3,
        text: 'Good bot but needs improvements',
        context: 'general',
        source: 'mini_app',
        tags: ['ui', 'navigation']
      });

      await feedback.save();

      expect(feedback.telegramId).toBe('987654321');
      expect(feedback.rating).toBe(3);
      expect(feedback.text).toBe('Good bot but needs improvements');
      expect(feedback.context).toBe('general');
      expect(feedback.source).toBe('mini_app');
      expect(feedback.tags).toEqual(['ui', 'navigation']);
    });

    it('should validate rating range (1-5)', async () => {
      const invalidFeedback = new Feedback({
        telegramId: '111222333',
        rating: 10
      });

      await expect(invalidFeedback.save()).rejects.toThrow();
    });

    it('should validate rating is required', async () => {
      const invalidFeedback = new Feedback({
        telegramId: '111222333'
      });

      await expect(invalidFeedback.save()).rejects.toThrow();
    });

    it('should truncate text to 300 characters', async () => {
      const longText = 'a'.repeat(400);
      const feedback = new Feedback({
        telegramId: '444555666',
        rating: 4,
        text: longText
      });

      await feedback.save();

      expect(feedback.text.length).toBe(300);
    });

    it('should sanitize tags (trim, lowercase, remove empty)', async () => {
      const feedback = new Feedback({
        telegramId: '777888999',
        rating: 4,
        tags: ['  TAG1  ', 'Tag2', '', '  ']
      });

      await feedback.save();

      expect(feedback.tags).toEqual(['tag1', 'tag2']);
    });

    it('should return rating stars virtual field', async () => {
      const feedback = new Feedback({
        telegramId: '123456789',
        rating: 4
      });

      await feedback.save();

      expect(feedback.ratingStars).toBe('⭐⭐⭐⭐');
    });

    it('should check if feedback is recent', async () => {
      const feedback = new Feedback({
        telegramId: '123456789',
        rating: 5
      });

      await feedback.save();

      expect(feedback.isRecent()).toBe(true);
    });

    it('should get latest feedback by user', async () => {
      // Create multiple feedback items
      await Feedback.create([
        { telegramId: '123456789', rating: 3 },
        { telegramId: '123456789', rating: 5 },
        { telegramId: '987654321', rating: 4 }
      ]);

      const latest = await Feedback.getLatestByUser('123456789');

      expect(latest).toBeDefined();
      expect(latest.telegramId).toBe('123456789');
      expect(latest.rating).toBe(5); // Should be the last one created
    });

    it('should get feedback statistics', async () => {
      // Create multiple feedback items
      await Feedback.create([
        { telegramId: '123', rating: 5 },
        { telegramId: '456', rating: 4 },
        { telegramId: '789', rating: 3 },
        { telegramId: '111', rating: 5 },
        { telegramId: '222', rating: 2 }
      ]);

      const stats = await Feedback.getStatistics();

      expect(stats.totalCount).toBe(5);
      expect(stats.averageRating).toBeCloseTo(3.8, 1);
      expect(stats.ratingDistribution[5]).toBe(2);
      expect(stats.ratingDistribution[4]).toBe(1);
      expect(stats.ratingDistribution[3]).toBe(1);
      expect(stats.ratingDistribution[2]).toBe(1);
    });
  });

  describe('Feedback API Endpoint', () => {
    it('should reject feedback without rating', async () => {
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Rating is required');
    });

    it('should reject rating outside 1-5 range', async () => {
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 10
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('between 1 and 5');
    });

    it('should reject low rating from mini_app without sufficient text', async () => {
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 3,
          text: 'Short',
          source: 'mini_app'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('at least 10 characters');
    });

    it('should accept high rating without text', async () => {
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.rating).toBe(5);
    });

    it('should accept low rating from telegram without text requirement', async () => {
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 2,
          source: 'telegram'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should create feedback with full data', async () => {
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 4,
          text: 'Great bot, very helpful!',
          context: 'general',
          source: 'mini_app',
          tags: ['helpful', 'ui']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.rating).toBe(4);

      // Verify in database
      const feedback = await Feedback.findById(response.body.data.id);
      expect(feedback.telegramId).toBe('123456789');
      expect(feedback.rating).toBe(4);
      expect(feedback.text).toBe('Great bot, very helpful!');
      expect(feedback.context).toBe('general');
      expect(feedback.source).toBe('mini_app');
      expect(feedback.tags).toEqual(['helpful', 'ui']);
    });

    it('should reject text longer than 300 characters', async () => {
      const longText = 'a'.repeat(301);
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 3,
          text: longText,
          source: 'mini_app'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('300 characters');
    });

    it('should default to monthly_report context and telegram source', async () => {
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 5
        });

      expect(response.status).toBe(200);
      
      const feedback = await Feedback.findById(response.body.data.id);
      expect(feedback.context).toBe('monthly_report');
      expect(feedback.source).toBe('telegram');
    });
  });
});
