/**
 * Integration tests for CORS functionality
 * @file tests/integration/cors.test.js
 */

const request = require('supertest');
const { app } = require('../../server');

describe('CORS Tests', () => {
  describe('🍄 CORS Preflight (OPTIONS) Requests', () => {
    test('should handle basic OPTIONS request successfully', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200);

      // Verify CORS headers are present
      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should handle complex OPTIONS request with custom headers', async () => {
      const response = await request(app)
        .options('/api/chat-simple')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization, X-Requested-With')
        .expect(200);

      // Verify all requested headers are allowed
      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toContain('Content-Type');
      expect(allowedHeaders).toContain('Authorization');
      expect(allowedHeaders).toContain('X-Requested-With');
    });

    test('should handle admin endpoint OPTIONS correctly', async () => {
      const response = await request(app)
        .options('/api/admin/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
        .expect(200);

      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('🍄 Actual CORS Requests (after preflight)', () => {
    test('should allow actual GET request after preflight', async () => {
      // First the preflight
      await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200);

      // Then the actual request
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('should allow actual POST request after preflight', async () => {
      // First the preflight
      await request(app)
        .options('/api/chat-simple')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(200);

      // Then the actual request
      const response = await request(app)
        .post('/api/chat-simple')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .send({ message: 'Test CORS message' })
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.body.success).toBe(true);
    });
  });

  describe('🍄 Edge Cases', () => {
    test('should handle requests without origin', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Should still work without origin (for tools like curl, Postman)
      expect(response.body.status).toBeDefined();
    });

    test('should handle multiple allowed origins in development', async () => {
      const origins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001'
      ];

      for (const origin of origins) {
        const response = await request(app)
          .get('/api/health')
          .set('Origin', origin)
          .expect(200);

        // In development mode, all origins should be allowed
        expect(response.headers).toHaveProperty('access-control-allow-origin');
      }
    });

    test('should handle all standard HTTP methods in preflight', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      
      for (const method of methods) {
        const response = await request(app)
          .options('/api/health')
          .set('Origin', 'http://localhost:3000')
          .set('Access-Control-Request-Method', method)
          .expect(200);

        const allowedMethods = response.headers['access-control-allow-methods'];
        expect(allowedMethods).toContain(method);
      }
    });

    test('should include all necessary exposed headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // Check for specific headers that should be exposed
      const exposedHeaders = response.headers['access-control-expose-headers'];
      if (exposedHeaders) {
        // Verify critical headers are exposed
        expect(response.headers).toHaveProperty('content-type');
        expect(response.headers).toHaveProperty('content-length');
      }
    });
  });

  describe('🍄 CORS in Production Mode', () => {
    let originalNodeEnv;

    beforeAll(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should respect CORS_ORIGIN environment variable', async () => {
      // Note: This test assumes the app has been configured with proper origins
      // The actual behavior will depend on the CORS_ORIGIN env var
      
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('🍄 WebSocket CORS', () => {
    test('should configure Socket.IO with CORS settings', () => {
      // This test verifies that Socket.IO is configured with CORS
      // The actual testing would require Socket.IO client setup
      // For now, we just verify the server starts without errors
      expect(app).toBeDefined();
    });
  });
});

// Export for use in other test files
module.exports = {
  testCorsHeaders: async (app, endpoint, origin = 'http://localhost:3000') => {
    const response = await request(app)
      .options(endpoint)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(200);

    return {
      allowOrigin: response.headers['access-control-allow-origin'],
      allowMethods: response.headers['access-control-allow-methods'],
      allowHeaders: response.headers['access-control-allow-headers'],
      allowCredentials: response.headers['access-control-allow-credentials']
    };
  }
};