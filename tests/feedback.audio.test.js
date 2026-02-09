/**
 * Test for Audio Feedback Integration
 * Tests the new endpoints: GET /api/reader/feedback/audio/:audioId/stats and comments
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

// Import models and API
const Feedback = require('../server/models/Feedback');
const readerApi = require('../server/api/reader');

describe('Audio Feedback API', () => {
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

  describe('GET /api/reader/feedback/audio/:audioId/stats', () => {
    it('should return stats for audio with multiple ratings', async () => {
      // Create test feedback data
      const audioId = 'free-1';
      
      await Feedback.create([
        {
          telegramId: '123',
          rating: 5,
          text: 'Great audio!',
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        },
        {
          telegramId: '456',
          rating: 4,
          text: 'Good content',
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        },
        {
          telegramId: '789',
          rating: 5,
          text: 'Excellent',
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        }
      ]);

      const response = await request(app)
        .get(`/api/reader/feedback/audio/${audioId}/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.avgRating).toBeCloseTo(4.7, 1);
      expect(response.body.data.distribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 1,
        5: 2
      });
    });

    it('should return empty stats for audio with no feedback', async () => {
      const response = await request(app)
        .get('/api/reader/feedback/audio/nonexistent-audio/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.avgRating).toBe(0);
      expect(response.body.data.distribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
      });
    });

    it('should only count feedback from mini_app source and bot context', async () => {
      const audioId = 'free-2';
      
      await Feedback.create([
        {
          telegramId: '123',
          rating: 5,
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        },
        {
          telegramId: '456',
          rating: 4,
          context: 'bot',
          source: 'telegram', // Different source - should not be counted
          tags: ['audio', audioId]
        },
        {
          telegramId: '789',
          rating: 3,
          context: 'general', // Different context - should not be counted
          source: 'mini_app',
          tags: ['audio', audioId]
        }
      ]);

      const response = await request(app)
        .get(`/api/reader/feedback/audio/${audioId}/stats`)
        .expect(200);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.avgRating).toBe(5);
    });

    it('should handle ratings distribution correctly', async () => {
      const audioId = 'free-3';
      
      await Feedback.create([
        { telegramId: '1', rating: 1, context: 'bot', source: 'mini_app', tags: ['audio', audioId] },
        { telegramId: '2', rating: 2, context: 'bot', source: 'mini_app', tags: ['audio', audioId] },
        { telegramId: '3', rating: 2, context: 'bot', source: 'mini_app', tags: ['audio', audioId] },
        { telegramId: '4', rating: 3, context: 'bot', source: 'mini_app', tags: ['audio', audioId] },
        { telegramId: '5', rating: 4, context: 'bot', source: 'mini_app', tags: ['audio', audioId] },
        { telegramId: '6', rating: 5, context: 'bot', source: 'mini_app', tags: ['audio', audioId] }
      ]);

      const response = await request(app)
        .get(`/api/reader/feedback/audio/${audioId}/stats`)
        .expect(200);

      expect(response.body.data.total).toBe(6);
      expect(response.body.data.distribution).toEqual({
        1: 1,
        2: 2,
        3: 1,
        4: 1,
        5: 1
      });
    });
  });

  describe('GET /api/reader/feedback/audio/:audioId/comments', () => {
    it('should return comments with text for audio', async () => {
      const audioId = 'free-1';
      
      await Feedback.create([
        {
          telegramId: '123',
          rating: 5,
          text: 'Great audio!',
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        },
        {
          telegramId: '456',
          rating: 4,
          text: 'Good content',
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        },
        {
          telegramId: '789',
          rating: 5,
          text: '', // Empty text - should not be returned
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        }
      ]);

      const response = await request(app)
        .get(`/api/reader/feedback/audio/${audioId}/comments`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.items[0]).toHaveProperty('telegramId');
      expect(response.body.data.items[0]).toHaveProperty('rating');
      expect(response.body.data.items[0]).toHaveProperty('text');
      expect(response.body.data.items[0]).toHaveProperty('createdAt');
    });

    it('should support pagination', async () => {
      const audioId = 'free-2';
      
      // Create 15 comments
      const comments = [];
      for (let i = 1; i <= 15; i++) {
        comments.push({
          telegramId: String(i),
          rating: 5,
          text: `Comment ${i}`,
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        });
      }
      await Feedback.create(comments);

      // Get first page (10 items)
      const page1 = await request(app)
        .get(`/api/reader/feedback/audio/${audioId}/comments?page=1&limit=10`)
        .expect(200);

      expect(page1.body.data.items).toHaveLength(10);
      expect(page1.body.data.total).toBe(15);
      expect(page1.body.data.page).toBe(1);
      expect(page1.body.data.totalPages).toBe(2);

      // Get second page (5 items)
      const page2 = await request(app)
        .get(`/api/reader/feedback/audio/${audioId}/comments?page=2&limit=10`)
        .expect(200);

      expect(page2.body.data.items).toHaveLength(5);
      expect(page2.body.data.total).toBe(15);
      expect(page2.body.data.page).toBe(2);
    });

    it('should return empty array for audio with no comments', async () => {
      const response = await request(app)
        .get('/api/reader/feedback/audio/nonexistent-audio/comments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });

    it('should limit page size to maximum of 50', async () => {
      const audioId = 'free-3';
      
      // Create 60 comments
      const comments = [];
      for (let i = 1; i <= 60; i++) {
        comments.push({
          telegramId: String(i),
          rating: 5,
          text: `Comment ${i}`,
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId]
        });
      }
      await Feedback.create(comments);

      // Request with limit > 50
      const response = await request(app)
        .get(`/api/reader/feedback/audio/${audioId}/comments?limit=100`)
        .expect(200);

      // Should be capped at 50
      expect(response.body.data.items).toHaveLength(50);
    });
  });

  describe('POST /api/reader/feedback (existing endpoint)', () => {
    it('should create feedback with audio tags', async () => {
      const audioId = 'free-1';
      
      const response = await request(app)
        .post('/api/reader/feedback')
        .send({
          telegramId: '123456789',
          rating: 5,
          text: 'Excellent audio!',
          context: 'bot',
          source: 'mini_app',
          tags: ['audio', audioId, 'free-audio-slug']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.rating).toBe(5);

      // Verify it was saved correctly
      const saved = await Feedback.findById(response.body.data.id);
      expect(saved.tags).toContain('audio');
      expect(saved.tags).toContain(audioId);
    });
  });
});
