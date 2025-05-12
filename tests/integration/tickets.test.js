/**
 * Integration tests for tickets API
 * @file tests/integration/tickets.test.js
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const ticketService = require('../../server/services/ticketing');

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

describe('Tickets API Integration Tests', () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app with tickets routes
    app = express();
    app.use(express.json());

    // Add ticket routes
    app.post('/api/tickets', async (req, res) => {
      try {
        const ticket = await ticketService.createTicket(req.body);
        res.status(201).json({
          success: true,
          data: ticket.toApiResponse()
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'TICKET_CREATION_FAILED'
        });
      }
    });

    app.get('/api/tickets', async (req, res) => {
      try {
        const { status, priority, category, assignedTo, userId, page = 1, limit = 20 } = req.query;
        const filter = {};
        
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (category) filter.category = category;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (userId) filter.userId = userId;

        const result = await ticketService.getTickets(filter, {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: '-createdAt'
        });

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'TICKETS_FETCH_FAILED'
        });
      }
    });

    app.get('/api/tickets/:ticketId', async (req, res) => {
      try {
        const { ticketId } = req.params;
        const ticket = await ticketService.getTicketById(ticketId);
        
        if (!ticket) {
          return res.status(404).json({
            success: false,
            error: 'Ticket not found',
            errorCode: 'TICKET_NOT_FOUND'
          });
        }

        res.json({
          success: true,
          data: ticket.toApiResponse()
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'TICKET_FETCH_FAILED'
        });
      }
    });

    app.patch('/api/tickets/:ticketId', async (req, res) => {
      try {
        const { ticketId } = req.params;
        const updatedTicket = await ticketService.updateTicket(ticketId, req.body);
        
        if (!updatedTicket) {
          return res.status(404).json({
            success: false,
            error: 'Ticket not found',
            errorCode: 'TICKET_NOT_FOUND'
          });
        }

        res.json({
          success: true,
          data: updatedTicket.toApiResponse()
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'TICKET_UPDATE_FAILED'
        });
      }
    });

    app.patch('/api/tickets/:ticketId/close', async (req, res) => {
      try {
        const { ticketId } = req.params;
        const { resolution, closedBy } = req.body;
        
        const closedTicket = await ticketService.closeTicket(ticketId, resolution, closedBy);
        
        if (!closedTicket) {
          return res.status(404).json({
            success: false,
            error: 'Ticket not found',
            errorCode: 'TICKET_NOT_FOUND'
          });
        }

        res.json({
          success: true,
          data: closedTicket.toApiResponse()
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'TICKET_CLOSE_FAILED'
        });
      }
    });

    app.patch('/api/tickets/:ticketId/assign', async (req, res) => {
      try {
        const { ticketId } = req.params;
        const { agentId } = req.body;
        
        const assignedTicket = await ticketService.assignTicket(ticketId, agentId);
        
        if (!assignedTicket) {
          return res.status(404).json({
            success: false,
            error: 'Ticket not found',
            errorCode: 'TICKET_NOT_FOUND'
          });
        }

        res.json({
          success: true,
          data: assignedTicket.toApiResponse()
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'TICKET_ASSIGN_FAILED'
        });
      }
    });

    app.get('/api/tickets/agent/:agentId', async (req, res) => {
      try {
        const { agentId } = req.params;
        const { status = 'in_progress', limit = 50 } = req.query;
        
        const tickets = await ticketService.getAssignedTickets(agentId, {
          status,
          limit: parseInt(limit)
        });

        res.json({
          success: true,
          data: tickets.map(ticket => ticket.toApiResponse ? ticket.toApiResponse() : ticket)
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'ASSIGNED_TICKETS_FETCH_FAILED'
        });
      }
    });

    app.get('/api/tickets/search', async (req, res) => {
      try {
        const { q: searchTerm, status, limit = 20 } = req.query;
        
        if (!searchTerm) {
          return res.status(400).json({
            success: false,
            error: 'Search term is required',
            errorCode: 'SEARCH_TERM_REQUIRED'
          });
        }

        const tickets = await ticketService.searchTickets(searchTerm, {
          status,
          limit: parseInt(limit)
        });

        res.json({
          success: true,
          data: tickets
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'SEARCH_FAILED'
        });
      }
    });

    app.get('/api/tickets/stats', async (req, res) => {
      try {
        const stats = await ticketService.getTicketStatistics();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
          errorCode: 'STATS_FETCH_FAILED'
        });
      }
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all tickets before each test
    await mongoose.connection.db.collection('tickets').deleteMany({});
  });

  describe('POST /api/tickets', () => {
    test('should create a ticket with valid data', async () => {
      const ticketData = {
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'API Test Ticket',
        initialMessage: 'This is a test ticket from API'
      };

      const response = await request(app)
        .post('/api/tickets')
        .send(ticketData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('ticketId');
      expect(response.body.data.subject).toBe(ticketData.subject);
      expect(response.body.data.status).toBe('open');
    });

    test('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user123'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation errors');
    });

    test('should create ticket with custom priority and category', async () => {
      const ticketData = {
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'High Priority Technical Issue',
        initialMessage: 'Critical system failure',
        priority: 'high',
        category: 'technical'
      };

      const response = await request(app)
        .post('/api/tickets')
        .send(ticketData)
        .expect(201);

      expect(response.body.data.priority).toBe('high');
      expect(response.body.data.category).toBe('technical');
    });
  });

  describe('GET /api/tickets', () => {
    beforeEach(async () => {
      // Create test tickets
      await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user1',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'First ticket',
          initialMessage: 'First test ticket',
          priority: 'low'
        });

      await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user2',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Second ticket',
          initialMessage: 'Second test ticket',
          priority: 'high',
          category: 'technical'
        });
    });

    test('should get all tickets with pagination', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.totalCount).toBe(2);
      expect(response.body.data.page).toBe(1);
    });

    test('should filter tickets by priority', async () => {
      const response = await request(app)
        .get('/api/tickets?priority=high')
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].priority).toBe('high');
    });

    test('should filter tickets by category', async () => {
      const response = await request(app)
        .get('/api/tickets?category=technical')
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].category).toBe('technical');
    });

    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/tickets?page=1&limit=1')
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.totalCount).toBe(2);
      expect(response.body.data.totalPages).toBe(2);
    });
  });

  describe('GET /api/tickets/:ticketId', () => {
    let createdTicket;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user123',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Test ticket for get',
          initialMessage: 'Test message for get'
        });
      createdTicket = response.body.data;
    });

    test('should get ticket by ticketId', async () => {
      const response = await request(app)
        .get(`/api/tickets/${createdTicket.ticketId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ticketId).toBe(createdTicket.ticketId);
    });

    test('should return 404 for non-existent ticket', async () => {
      const response = await request(app)
        .get('/api/tickets/NONEXISTENT')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Ticket not found');
    });
  });

  describe('PATCH /api/tickets/:ticketId', () => {
    let createdTicket;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user123',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Test ticket for update',
          initialMessage: 'Test message for update'
        });
      createdTicket = response.body.data;
    });

    test('should update ticket status', async () => {
      const response = await request(app)
        .patch(`/api/tickets/${createdTicket.ticketId}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.data.status).toBe('in_progress');
    });

    test('should update multiple fields', async () => {
      const updateData = {
        status: 'resolved',
        priority: 'high',
        assignedTo: 'agent1'
      };

      const response = await request(app)
        .patch(`/api/tickets/${createdTicket.ticketId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.status).toBe(updateData.status);
      expect(response.body.data.priority).toBe(updateData.priority);
      expect(response.body.data.assignedTo).toBe(updateData.assignedTo);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .patch(`/api/tickets/${createdTicket.ticketId}`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.error).toContain('Invalid status');
    });
  });

  describe('PATCH /api/tickets/:ticketId/close', () => {
    let createdTicket;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user123',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Test ticket for close',
          initialMessage: 'Test message for close'
        });
      createdTicket = response.body.data;
    });

    test('should close ticket without resolution', async () => {
      const response = await request(app)
        .patch(`/api/tickets/${createdTicket.ticketId}/close`)
        .send({})
        .expect(200);

      expect(response.body.data.status).toBe('closed');
      expect(response.body.data.resolvedAt).toBeDefined();
    });

    test('should close ticket with resolution', async () => {
      const resolution = 'Fixed by restarting the service';
      const response = await request(app)
        .patch(`/api/tickets/${createdTicket.ticketId}/close`)
        .send({ resolution })
        .expect(200);

      expect(response.body.data.status).toBe('closed');
      expect(response.body.data.resolution).toBe(resolution);
    });
  });

  describe('PATCH /api/tickets/:ticketId/assign', () => {
    let createdTicket;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user123',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Test ticket for assign',
          initialMessage: 'Test message for assign'
        });
      createdTicket = response.body.data;
    });

    test('should assign ticket to agent', async () => {
      const response = await request(app)
        .patch(`/api/tickets/${createdTicket.ticketId}/assign`)
        .send({ agentId: 'agent123' })
        .expect(200);

      expect(response.body.data.assignedTo).toBe('agent123');
      expect(response.body.data.status).toBe('in_progress');
    });

    test('should return 400 for missing agentId', async () => {
      const response = await request(app)
        .patch(`/api/tickets/${createdTicket.ticketId}/assign`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('agentId is required');
    });
  });

  describe('GET /api/tickets/agent/:agentId', () => {
    beforeEach(async () => {
      // Create and assign tickets
      const ticket1Response = await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user1',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Assigned ticket 1',
          initialMessage: 'First assigned ticket'
        });

      const ticket2Response = await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user2',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Assigned ticket 2',
          initialMessage: 'Second assigned ticket'
        });

      await request(app)
        .patch(`/api/tickets/${ticket1Response.body.data.ticketId}/assign`)
        .send({ agentId: 'agent123' });

      await request(app)
        .patch(`/api/tickets/${ticket2Response.body.data.ticketId}/assign`)
        .send({ agentId: 'agent456' });
    });

    test('should get tickets assigned to agent', async () => {
      const response = await request(app)
        .get('/api/tickets/agent/agent123')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].assignedTo).toBe('agent123');
    });

    test('should filter assigned tickets by status', async () => {
      // Close one assigned ticket
      const assignedResponse = await request(app)
        .get('/api/tickets/agent/agent123');
      
      const ticket = assignedResponse.body.data[0];
      await request(app)
        .patch(`/api/tickets/${ticket.ticketId}/close`)
        .send({});

      // Get in-progress tickets
      const progressResponse = await request(app)
        .get('/api/tickets/agent/agent123?status=in_progress')
        .expect(200);

      expect(progressResponse.body.data).toHaveLength(0);

      // Get closed tickets
      const closedResponse = await request(app)
        .get('/api/tickets/agent/agent123?status=closed')
        .expect(200);

      expect(closedResponse.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/tickets/search', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user1',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Login problem',
          initialMessage: 'Cannot log into the system'
        });

      await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user2',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Payment issue',
          initialMessage: 'Payment gateway not working'
        });
    });

    test('should search tickets by subject', async () => {
      const response = await request(app)
        .get('/api/tickets/search?q=Login')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].subject).toContain('Login');
    });

    test('should search tickets by initial message', async () => {
      const response = await request(app)
        .get('/api/tickets/search?q=gateway')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].initialMessage).toContain('gateway');
    });

    test('should return 400 for missing search term', async () => {
      const response = await request(app)
        .get('/api/tickets/search')
        .expect(400);

      expect(response.body.error).toBe('Search term is required');
    });
  });

  describe('GET /api/tickets/stats', () => {
    beforeEach(async () => {
      // Create tickets with different properties
      await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user1',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Open technical',
          initialMessage: 'Tech issue',
          category: 'technical',
          priority: 'high'
        });

      await request(app)
        .post('/api/tickets')
        .send({
          userId: 'user2',
          conversationId: new mongoose.Types.ObjectId(),
          subject: 'Closed billing',
          initialMessage: 'Billing issue',
          category: 'billing',
          priority: 'medium'
        });

      // Close the second ticket
      const tickets = await request(app).get('/api/tickets');
      await request(app)
        .patch(`/api/tickets/${tickets.body.data.items[1].ticketId}/close`)
        .send({});
    });

    test('should get ticket statistics', async () => {
      const response = await request(app)
        .get('/api/tickets/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('byStatus');
      expect(response.body.data).toHaveProperty('byCategory');
      expect(response.body.data).toHaveProperty('byPriority');

      expect(response.body.data.byStatus.open).toBe(1);
      expect(response.body.data.byStatus.closed).toBe(1);
      expect(response.body.data.byCategory.technical).toBe(1);
      expect(response.body.data.byCategory.billing).toBe(1);
      expect(response.body.data.byPriority.high).toBe(1);
      expect(response.body.data.byPriority.medium).toBe(1);
    });
  });
});