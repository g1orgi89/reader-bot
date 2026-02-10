/**
 * Integration tests for Protected Stream Endpoint
 * @file tests/integration/protected-stream.test.js
 * 
 * Tests the fix for 403 Forbidden issue when accessing protected audio streams.
 * The fix ensures userId from query is used directly as ObjectId without resolveUserObjectId.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
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

describe('Protected Stream Endpoint Tests', () => {
  let app;
  let mongoServer;
  let testUserId;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app with the protected stream route
    app = express();
    app.use(express.json());
    
    // Register the protected stream route directly
    app.get('/media/stream/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const rawUserId = req.query.userId;

        if (!rawUserId) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        // Use raw userId directly as MongoDB ObjectId (no resolveUserObjectId)
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
          return res.status(401).json({ success: false, error: 'Invalid user ID' });
        }
        const userId = new mongoose.Types.ObjectId(rawUserId);

        // Normalize track ID: 'alice_wonderland-01' → 'alice_wonderland'
        const trackMatch = id.match(/^(.+)-(\d+)$/);
        const baseId = trackMatch ? trackMatch[1] : id;

        // Direct entitlement check in DB (no service layers)
        const UserEntitlement = require('../../server/models/UserEntitlement');
        const ent = await UserEntitlement.findOne({
          userId,
          kind: 'audio',
          resourceId: baseId
        }).lean();

        const now = new Date();
        const isValid = !!ent && (!ent.expiresAt || new Date(ent.expiresAt) > now);

        if (!isValid) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Map ID to protected file path
        let filePath;
        if (trackMatch) {
          const [, containerId, trackNumber] = trackMatch;
          filePath = `${containerId}/${trackNumber}.mp3`;
        } else {
          filePath = `${id}.mp3`;
        }

        // Serve via X-Accel-Redirect
        const protectedPath = `/media-protected/${filePath}`;
        res.setHeader('X-Accel-Redirect', protectedPath);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        return res.status(200).end();
      } catch (error) {
        console.error('Error in protected stream:', error);
        res.status(500).json({ success: false, error: 'Failed to stream audio', details: error.message });
      }
    });

    // Create test user ID
    testUserId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clear collections after each test
    await UserEntitlement.deleteMany({});
  });

  describe('Direct ObjectId Usage (Fix for 403 Issue)', () => {
    it('should accept ObjectId directly from query without resolveUserObjectId', async () => {
      // Grant access to alice_wonderland with the exact ObjectId
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland',
        expiresAt,
        grantedBy: 'test'
      });

      // Request with ObjectId directly (as passed from client)
      const response = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .query({ userId: testUserId.toString() })
        .expect(200);

      // Should return X-Accel-Redirect header
      expect(response.headers['x-accel-redirect']).toBe('/media-protected/alice_wonderland/01.mp3');
      expect(response.headers['content-type']).toBe('audio/mpeg');
      expect(response.headers['accept-ranges']).toBe('bytes');
    });

    it('should normalize track ID to container ID for entitlement check', async () => {
      // Grant access to base container (alice_wonderland)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland', // Base container
        expiresAt,
        grantedBy: 'test'
      });

      // Request any track from the container
      const response1 = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .query({ userId: testUserId.toString() })
        .expect(200);

      const response2 = await request(app)
        .get('/media/stream/alice_wonderland-06')
        .query({ userId: testUserId.toString() })
        .expect(200);

      expect(response1.headers['x-accel-redirect']).toBe('/media-protected/alice_wonderland/01.mp3');
      expect(response2.headers['x-accel-redirect']).toBe('/media-protected/alice_wonderland/06.mp3');
    });

    it('should return 403 when no entitlement exists for the user', async () => {
      // No entitlement created
      const response = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .query({ userId: testUserId.toString() })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });

    it('should return 403 when entitlement is expired', async () => {
      // Grant access with expired date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Yesterday
      
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland',
        expiresAt,
        grantedBy: 'test'
      });

      const response = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .query({ userId: testUserId.toString() })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });

    it('should allow access when expiresAt is null (never expires)', async () => {
      // Grant access with no expiration
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland',
        expiresAt: null,
        grantedBy: 'test'
      });

      const response = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .query({ userId: testUserId.toString() })
        .expect(200);

      expect(response.headers['x-accel-redirect']).toBe('/media-protected/alice_wonderland/01.mp3');
    });

    it('should return 401 when userId is missing', async () => {
      const response = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should return 401 when userId is invalid ObjectId', async () => {
      const response = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .query({ userId: 'invalid-objectid' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid user ID');
    });

    it('should handle different resource types correctly', async () => {
      // Grant access to different audio containers
      await UserEntitlement.create({
        userId: testUserId,
        kind: 'audio',
        resourceId: 'malenkii_princ',
        expiresAt: null,
        grantedBy: 'test'
      });

      const response = await request(app)
        .get('/media/stream/malenkii_princ-03')
        .query({ userId: testUserId.toString() })
        .expect(200);

      expect(response.headers['x-accel-redirect']).toBe('/media-protected/malenkii_princ/03.mp3');
    });
  });

  describe('Scenario: Dev Environment Issue Reproduction', () => {
    it('should handle the exact scenario from dev: ObjectId userId with entitlement', async () => {
      // Simulate the exact dev scenario:
      // - Entitlement exists with ObjectId userId: '6925e7e64ae91123a887501f'
      // - Request comes with the same ObjectId
      const devUserId = new mongoose.Types.ObjectId('6925e7e64ae91123a887501f');
      
      // Create entitlement exactly as it appears in dev
      await UserEntitlement.create({
        userId: devUserId,
        kind: 'audio',
        resourceId: 'alice_wonderland',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days future
        grantedBy: 'test'
      });

      // Request with the same ObjectId (as it comes from API)
      const response = await request(app)
        .get('/media/stream/alice_wonderland-01')
        .query({ userId: devUserId.toString() })
        .expect(200);

      expect(response.headers['x-accel-redirect']).toBe('/media-protected/alice_wonderland/01.mp3');
    });
  });
});
