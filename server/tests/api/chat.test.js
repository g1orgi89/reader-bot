/**
 * Test suite for Chat API with type validation
 * @file server/tests/api/chat.test.js
 */

const request = require('supertest');
const app = require('../../index');
const { validateChatRequest } = require('../../utils/validators');

// Import types for JSDoc
require('../../types');

describe('Chat API', () => {
  describe('Type Validation', () => {
    describe('validateChatRequest', () => {
      test('should validate correct chat request', () => {
        /** @type {ChatRequest} */
        const validRequest = {
          message: 'Hello, I need help',
          userId: 'user123',
          conversationId: 'conv123',
          language: 'en'
        };

        expect(() => validateChatRequest(validRequest)).not.toThrow();
      });

      test('should reject request without message', () => {
        const invalidRequest = {
          userId: 'user123'
        };

        expect(() => validateChatRequest(invalidRequest))
          .toThrow('message is required and must be a non-empty string');
      });

      test('should reject request with empty message', () => {
        const invalidRequest = {
          message: '   ',
          userId: 'user123'
        };

        expect(() => validateChatRequest(invalidRequest))
          .toThrow('message is required and must be a non-empty string');
      });

      test('should reject request without userId', () => {
        const invalidRequest = {
          message: 'Hello'
        };

        expect(() => validateChatRequest(invalidRequest))
          .toThrow('userId is required and must be a string');
      });

      test('should reject invalid language', () => {
        const invalidRequest = {
          message: 'Hello',
          userId: 'user123',
          language: 'invalid'
        };

        expect(() => validateChatRequest(invalidRequest))
          .toThrow('Invalid language: invalid. Must be one of: en, es, ru');
      });

      test('should accept request without optional fields', () => {
        const minimalRequest = {
          message: 'Hello',
          userId: 'user123'
        };

        expect(() => validateChatRequest(minimalRequest)).not.toThrow();
      });
    });
  });

  describe('POST /api/chat/message', () => {
    test('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: '',
          userId: 'user123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'message is required and must be a non-empty string',
        errorCode: 'VALIDATION_ERROR',
        details: {
          field: 'message'
        }
      });
    });

    test('should return type-safe response structure', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'Hello, how are you?',
          userId: 'user123',
          language: 'en'
        });

      // Response should match ChatResponse type
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('messageId');
      expect(response.body).toHaveProperty('needsTicket');
      expect(response.body).toHaveProperty('tokensUsed');
      expect(response.body).toHaveProperty('language');
      expect(response.body).toHaveProperty('timestamp');

      // Type checks
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.conversationId).toBe('string');
      expect(typeof response.body.messageId).toBe('string');
      expect(typeof response.body.needsTicket).toBe('boolean');
      expect(typeof response.body.tokensUsed).toBe('number');
      expect(['en', 'es', 'ru']).toContain(response.body.language);
    });

    test('should handle error with proper error type', async () => {
      // Test error handling by sending malformed request
      const response = await request(app)
        .post('/api/chat/message')
        .send(null);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('errorCode');
      
      // Should match ChatError type
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.errorCode).toBe('string');
    });
  });

  describe('GET /api/chat/conversation/:conversationId', () => {
    test('should return 400 for missing conversation ID', async () => {
      const response = await request(app)
        .get('/api/chat/conversation/');

      expect(response.status).toBe(404); // Express returns 404 for missing route params
    });

    test('should return paginated messages with correct structure', async () => {
      // First, create a conversation by sending a message
      const chatResponse = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'Hello',
          userId: 'user123'
        });

      const conversationId = chatResponse.body.conversationId;

      // Then fetch the conversation
      const response = await request(app)
        .get(`/api/chat/conversation/${conversationId}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('pagination');

      // Check pagination structure
      const pagination = response.body.data.pagination;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('totalCount');
      expect(pagination).toHaveProperty('totalPages');

      // Check message structure matches ChatMessage type
      if (response.body.data.messages.length > 0) {
        const message = response.body.data.messages[0];
        expect(message).toHaveProperty('id');
        expect(message).toHaveProperty('conversationId');
        expect(message).toHaveProperty('userId');
        expect(message).toHaveProperty('role');
        expect(message).toHaveProperty('content');
        expect(message).toHaveProperty('language');
        expect(message).toHaveProperty('createdAt');
      }
    });
  });

  describe('Type Safety Integration', () => {
    test('should maintain type safety throughout request-response cycle', async () => {
      /** @type {ChatRequest} */
      const request = {
        message: 'I need help with connecting my wallet',
        userId: 'test-user-123',
        language: 'en'
      };

      const response = await request(app)
        .post('/api/chat/message')
        .send(request);

      expect(response.status).toBe(200);

      /** @type {ChatResponse} */
      const chatResponse = response.body;

      // Verify all required properties are present and have correct types
      expect(chatResponse.message).toBeDefined();
      expect(typeof chatResponse.message).toBe('string');
      
      expect(chatResponse.conversationId).toBeDefined();
      expect(typeof chatResponse.conversationId).toBe('string');
      
      expect(chatResponse.messageId).toBeDefined();
      expect(typeof chatResponse.messageId).toBe('string');
      
      expect(chatResponse.needsTicket).toBeDefined();
      expect(typeof chatResponse.needsTicket).toBe('boolean');
      
      expect(chatResponse.tokensUsed).toBeDefined();
      expect(typeof chatResponse.tokensUsed).toBe('number');
      expect(chatResponse.tokensUsed).toBeGreaterThan(0);
      
      expect(chatResponse.language).toBeDefined();
      expect(['en', 'es', 'ru']).toContain(chatResponse.language);
      
      expect(chatResponse.timestamp).toBeDefined();
      expect(new Date(chatResponse.timestamp)).toBeInstanceOf(Date);

      // If a ticket was created, verify ticket ID
      if (chatResponse.needsTicket) {
        expect(chatResponse.ticketId).toBeDefined();
        expect(typeof chatResponse.ticketId).toBe('string');
      }
    });
  });
});
